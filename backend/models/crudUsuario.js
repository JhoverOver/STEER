const pool =require('../config/db');

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

async function filtrarID(id) {
    const [rows] = await pool.execute(
        'SELECT id, nombre, email, fecha_creacion FROM usuarios WHERE id= ?',
        [id]
    );
    return rows[0] || null;
}

async function borrarUsuario(id) {
    const [result] = await pool.execute(
        'DELETE FROM usuarios WHERE id = ?',
        [id]
    );
    return result.affectedRows > 0; //devuelve falso si el id no existia
}

module.exports = { 
    crearUsuario, 
    filtrarMail, 
    filtrarID, 
    borrarUsuario};
