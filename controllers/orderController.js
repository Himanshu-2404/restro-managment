const db=require('../config/db');
const normalizePhone=value=>String(value||'').replace(/\D/g,'');
exports.lookupCustomer=async(q,r)=>{
 const phone=normalizePhone(q.query.phone);
 if(phone.length<7||phone.length>15)return r.status(400).json({error:'Enter a valid mobile number with 7 to 15 digits.'});
 const[[customer]]=await db.query('SELECT id,name,phone,address FROM customers WHERE phone=? LIMIT 1',[phone]);
 r.json({customer:customer||null});
};
exports.create=async(q,r)=>{
 const{order_type,table_id,customer,items,notes}=q.body;
 const phone=customer ? normalizePhone(customer.phone) : '';
 const name=String(customer?.name||'').trim();
 const address=String(customer?.address||'').trim();
 const discount=Number(q.body.discount||0);
 const roundOff=Number(q.body.round_off||0);
 if(!items?.length)return r.status(400).json({error:'Cart is empty'});
 if(customer&&(phone.length<7||phone.length>15))return r.status(400).json({error:'Enter a valid mobile number with 7 to 15 digits.'});
 if(customer&&!name)return r.status(400).json({error:'Customer name is required.'});
 if(!Number.isFinite(discount)||discount<0||!Number.isFinite(roundOff))return r.status(400).json({error:'Enter a valid discount and round-off amount.'});
 const c=await db.getConnection();
 try{
  await c.beginTransaction();
  const[[tx]]=await c.query("SELECT setting_value v FROM settings WHERE setting_key='tax_percent'");
  let cid=null;
  if(customer){
   const[customerResult]=await c.query(
    'INSERT INTO customers(name,phone,address) VALUES(?,?,?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id),name=VALUES(name),address=VALUES(address)',
    [name,phone,address||null]
   );
   cid=customerResult.insertId;
  }
  const[o]=await c.query('INSERT INTO orders(order_type,table_id,customer_id,employee_id,notes) VALUES(?,?,?,?,?)',[order_type,table_id||null,cid,q.user.id,notes]);
  let sub=0;
  for(const it of items){
   const[[row]]=await c.query('SELECT name,base_price FROM items WHERE id=?',[it.item_id]);
   if(!row)throw new Error(`Menu item ${it.item_id} was not found.`);
   let price=+row.base_price,v=null,ad=[];
   if(it.variation_id){[[v]]=await c.query('SELECT * FROM item_variations WHERE id=? AND item_id=?',[it.variation_id,it.item_id]);if(v)price=+v.price;}
   for(const id of it.addon_ids||[]){const[[a]]=await c.query('SELECT * FROM item_addons WHERE id=? AND item_id=?',[id,it.item_id]);if(a){ad.push(a);price+=+a.price;}}
   const[oi]=await c.query('INSERT INTO order_items(order_id,item_id,item_name,qty,price) VALUES(?,?,?,?,?)',[o.insertId,it.item_id,row.name,it.qty,price]);
   if(v)await c.query('INSERT INTO order_variations(order_item_id,variation_id,name,price) VALUES(?,?,?,?)',[oi.insertId,v.id,v.name,v.price]);
   for(const a of ad)await c.query('INSERT INTO order_addons(order_item_id,addon_id,name,price) VALUES(?,?,?,?)',[oi.insertId,a.id,a.name,a.price]);
   sub+=price*it.qty;
  }
  const tax=+(sub*(+tx?.v||0)/100).toFixed(2);
  const gross=+(sub+tax).toFixed(2);
  if(discount>gross)throw new Error('Discount cannot exceed the order total.');
  const total=+(gross-discount+roundOff).toFixed(2);
  if(total<0)throw new Error('The final amount cannot be negative.');
  await c.query('UPDATE orders SET subtotal=?,tax=?,discount=?,round_off=?,total=? WHERE id=?',[sub,tax,discount,roundOff,total,o.insertId]);
  if(table_id)await c.query("UPDATE tables SET status='occupied' WHERE id=?",[table_id]);
  await c.commit();r.json({id:o.insertId,total});
 }catch(e){
  await c.rollback();
  if(e.message==='Discount cannot exceed the order total.'||e.message==='The final amount cannot be negative.')return r.status(400).json({error:e.message});
  console.error(e);r.status(500).json({error:'Could not place order'});
 }finally{c.release();}
};
exports.list=async(q,r)=>{const{status,live}=q.query;
 let sql='SELECT o.*,t.name table_name,c.name customer_name,c.phone customer_phone FROM orders o LEFT JOIN tables t ON t.id=o.table_id LEFT JOIN customers c ON c.id=o.customer_id';
 if(live)sql+=" WHERE o.status IN ('placed','preparing','ready')";else if(status)sql+=' WHERE o.status='+db.escape(status);
 const[rows]=await db.query(sql+' ORDER BY o.id DESC LIMIT 200');
 for(const o of rows)[o.items]=await db.query('SELECT oi.*,(SELECT GROUP_CONCAT(name) FROM order_variations WHERE order_item_id=oi.id) variation,(SELECT GROUP_CONCAT(name) FROM order_addons WHERE order_item_id=oi.id) addons FROM order_items oi WHERE order_id=?',[o.id]);
 r.json(rows);};
exports.setStatus=async(q,r)=>{const s=q.body.status;await db.query('UPDATE orders SET status=? WHERE id=?',[s,q.params.id]);
 if(['served','delivered','cancelled'].includes(s)){const[[o]]=await db.query('SELECT table_id FROM orders WHERE id=?',[q.params.id]);if(o.table_id)await db.query("UPDATE tables SET status='free' WHERE id=?",[o.table_id]);}
 r.json({ok:true});};
exports.pay=async(q,r)=>{const[[o]]=await db.query('SELECT * FROM orders WHERE id=?',[q.params.id]);
 if(!o||o.payment_status==='paid')return r.status(400).json({error:'Order not found or already paid'});
 const[c]=await db.query('INSERT INTO checkout(order_id,amount,method) VALUES(?,?,?)',[o.id,o.total,q.body.method||'cash']);
 await db.query('INSERT INTO transactions(checkout_id,reference) VALUES(?,?)',[c.insertId,'TXN'+Date.now()]);
 await db.query("UPDATE orders SET payment_status='paid' WHERE id=?",[o.id]);r.json({ok:true});};
exports.bill=async(q,r)=>{const[[o]]=await db.query('SELECT o.*,c.name customer_name,c.phone customer_phone FROM orders o LEFT JOIN customers c ON c.id=o.customer_id WHERE o.id=?',[q.params.id]);
 if(!o)return r.status(404).json({error:'Order not found'});
 const[items]=await db.query('SELECT * FROM order_items WHERE order_id=?',[o.id]);const[s]=await db.query('SELECT * FROM settings');
 r.json({order:o,items,settings:Object.fromEntries(s.map(x=>[x.setting_key,x.setting_value]))});};
