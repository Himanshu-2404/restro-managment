const db=require('../config/db'),bcrypt=require('bcryptjs'),jwt=require('jsonwebtoken');
const token=e=>jwt.sign({id:e.id,name:e.name,role:e.role},process.env.JWT_SECRET,{expiresIn:'12h'});
exports.signup=async(q,r)=>{const{name,email,password,phone}=q.body;
 if(!name||!email||!password)return r.status(400).json({error:'Name, email and password are required'});
 const[[c]]=await db.query('SELECT COUNT(*) n FROM employees');const roleId=c.n===0?1:4; // first user = Admin, others = Waiter
 try{await db.query('INSERT INTO employees(name,email,password,phone,role_id) VALUES(?,?,?,?,?)',[name,email,await bcrypt.hash(password,10),phone,roleId]);r.json({ok:true});}
 catch{r.status(400).json({error:'Email already registered'});}};
exports.login=async(q,r)=>{const[[e]]=await db.query('SELECT e.*,r.name role FROM employees e LEFT JOIN roles r ON r.id=e.role_id WHERE email=? AND active=1',[q.body.email]);
 if(!e||!await bcrypt.compare(q.body.password||'',e.password))return r.status(401).json({error:'Wrong email or password'});
 r.json({token:token(e),user:{name:e.name,role:e.role}});};
