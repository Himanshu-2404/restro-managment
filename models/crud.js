const db = require('../config/db');
// whitelist of master tables and their editable columns
const T = {
    departments: ['name'], job_types: ['name'], roles: ['name'], categories: ['name', 'parent_id'], table_places: ['name'],
    tables: ['name', 'place_id', 'capacity', 'status'], customers: ['name', 'phone', 'address'], items: ['name', 'category_id', 'base_price', 'is_veg', 'available', 'description', 'image_url'],
    item_variations: ['item_id', 'name', 'price'], item_addons: ['item_id', 'name', 'price'], item_skus: ['item_id', 'sku'],
    employees: ['name', 'email', 'phone', 'role_id', 'department_id', 'job_type_id', 'designation', 'active'], lookups: ['type', 'value']
};
exports.T = T;
exports.list = async t => (await db.query(`SELECT * FROM ${t}` + (t === 'employees' ? '' : '')))[0].map(r => { delete r.password; return r; });
exports.create = async (t, b) => { const c = T[t].filter(k => b[k] !== undefined); return (await db.query(`INSERT INTO ${t}(${c.join()}) VALUES(${c.map(() => '?').join()})`, c.map(k => b[k])))[0].insertId; };
exports.update = async (t, id, b) => { const c = T[t].filter(k => b[k] !== undefined); if (c.length) await db.query(`UPDATE ${t} SET ${c.map(k => k + '=?').join()} WHERE id=?`, [...c.map(k => b[k]), id]); };
exports.remove = (t, id) => db.query(`DELETE FROM ${t} WHERE id=?`, [id]);
