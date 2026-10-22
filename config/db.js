// require('dotenv').config();
// module.exports = require('mysql2/promise').createPool({ host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, waitForConnections: true, connectionLimit: 10 });


require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 4000),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: {
        minVersion: 'TLSv1.2'
    },
    waitForConnections: true,
    connectionLimit: 10
});

module.exports = pool;