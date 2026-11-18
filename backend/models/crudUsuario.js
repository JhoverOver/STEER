const pool = require('../config/db');

async function crearUsuario(nombre, email, contrasenaHash) {
    const [result] = await pool.execute(
        'INSERT INTO usuarios (nombre, email, contrasena) VALUES (?, ?, ?)',
        [nombre, email, contrasenaHash]
    );
    return { id: result. insertId, nombre, email};
}

async function filtrarMail(email) {
    const [rows] = await pool.execute(
        'SELECT * FROM usuarios WHERE email = ?',
        [email]
    );
    return rows[0] || null;
}

module.exports = { 
    crearUsuario, 
    filtrarMail
};
