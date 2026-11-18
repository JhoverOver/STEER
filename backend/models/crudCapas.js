const pool = require('../config/db');

// objeto de capa
function aCapa(fila) {
    return {
        id: fila.id,
        frame_id: fila.frame_id,
        orden: fila.orden,
        nombre: fila.nombre,
        //convertir a booleano
        visible: Boolean(fila.visible),
        bloqueada: Boolean(fila.bloqueada),
        imagen_data: fila.imagen_data,
    };
}

// Capas de un fotograma
async function obtenerCapasDelProyecto(frame_id, proyecto_id) {
    const [rows] = await pool.execute(
        `SELECT c.id, c.frame_id, c.orden, c.nombre, c.visible, c.bloqueada, c.imagen_data
        FROM capas c JOIN frames f ON f.id = c.frame_id
        WHERE c.frame_id = ? AND f.proyecto_id = ? ORDER BY c.orden ASC`,
        [frame_id, proyecto_id]
    );
    return rows.map(aCapa);
}

//inserta capas de un fotograma en orden, la primera capa queda abajo y la última queda arriba
async function insertarCapas(conexion, frame_id, capas) {
    for (let i = 0; i < capas.length; i++) {
        const capa = capas[i];
        await conexion.execute(
            'INSERT INTO capas (frame_id, orden, nombre, visible, bloqueada, imagen_data) VALUES (?, ?, ?, ?, ?, ?)',
            [frame_id, i, capa.nombre, capa.visible ? 1 : 0, capa.bloqueada ? 1 : 0, capa.imagen_data]
        );
    }
}


// Duplica todas las capas de un fotograma para otro
async function copiarCapas(conexion, origen_id, nuevo_id) {
    await conexion.execute(
        `INSERT INTO capas (frame_id, orden, nombre, visible, bloqueada, imagen_data)
        SELECT  ?, orden, nombre, visible, bloqueada, imagen_data FROM capas WHERE frame_id = ?`,
        [nuevo_id, origen_id]
    );
}

module.exports = {
    obtenerCapasDelProyecto,
    insertarCapas,
    copiarCapas,
};