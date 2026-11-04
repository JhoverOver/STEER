require('dotenv').config()
const mysql = require('mysql2/promise');
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    //10 conexiones maximas
    connectionLimit:10,
    waitForConnections: true,
    queueLimit: 0,
    // Las bases en la nube (Aiven, TiDB) exigen conexión cifrada: se activa con DB_SSL=true
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined
})

module.exports = pool;