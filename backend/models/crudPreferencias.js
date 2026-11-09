const pool = require('../config/db');

// Atajos que el usuario cambió: { accion: combinacion }.
async function obtenerAtajos(usuario_id) {
    const [rows] = await pool.execute('SELECT atajos FROM preferencias WHERE usuario_id = ?', [usuario_id]);
    if (!rows.length) return {};
    const atajos = rows[0].atajos;
    // MySQL entrega el JSON ya convertido; otras bases lo entregan como texto
    return typeof atajos === 'string' ? JSON.parse(atajos) : atajos;
}

async function guardarAtajos(usuario_id, atajos) {
    await pool.execute(
        `INSERT INTO preferencias (usuario_id, atajos) VALUES (?, ?)
        ON DUPLICATE KEY UPDATE atajos = VALUES(atajos)`,
        [usuario_id, JSON.stringify(atajos)]
    );
    return true;
}

module.exports = {
    obtenerAtajos,
    guardarAtajos,
};