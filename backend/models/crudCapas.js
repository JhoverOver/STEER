const pool = require('../config/db');
const { leerJSON } = require('../utils/validarForma');

const COLUMNAS = 'frame_id, orden, nombre, visible, bloqueada, imagen_data, forma, animacion';

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
        forma: leerJSON(fila.forma), // texto o rectángulo editable (utils/validarForma.js)
        animacion: leerJSON(fila.animacion), // keyframes de su fila (utils/validarAnimacion.js)
    };
}

// Capas de un fotograma
async function obtenerCapasDelProyecto(frame_id, proyecto_id) {
    const [rows] = await pool.execute(
        `SELECT c.id, c.frame_id, c.orden, c.nombre, c.visible, c.bloqueada, c.imagen_data, c.forma, c.animacion
        FROM capas c JOIN frames f ON f.id = c.frame_id
        WHERE c.frame_id = ? AND f.proyecto_id = ? ORDER BY c.orden ASC`,
        [frame_id, proyecto_id]
    );
    return rows.map(aCapa);
}

// Inserta las capas de un fotograma en orden: la primera queda abajo y la última arriba
async function insertarCapas(conexion, frame_id, capas) {
    for (let i = 0; i < capas.length; i++) {
        const capa = capas[i];
        await conexion.execute(
            `INSERT INTO capas (${COLUMNAS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                frame_id, i, capa.nombre, capa.visible ? 1 : 0, capa.bloqueada ? 1 : 0, capa.imagen_data,
                capa.forma ? JSON.stringify(capa.forma) : null,
                capa.animacion ? JSON.stringify(capa.animacion) : null,
            ]
        );
    }
}

// Duplica todas las capas de un fotograma para otro
async function copiarCapas(conexion, origen_id, nuevo_id) {
    await conexion.execute(
        `INSERT INTO capas (${COLUMNAS})
        SELECT ?, ${COLUMNAS.replace('frame_id, ', '')} FROM capas WHERE frame_id = ?`,
        [nuevo_id, origen_id]
    );
}

module.exports = {
    obtenerCapasDelProyecto,
    insertarCapas,
    copiarCapas,
};