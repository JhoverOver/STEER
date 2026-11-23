const pool = require('../config/db');
const { errorHttp } = require('../middleware/errores');

// Pistas de keyframes (Incremento 3). Una pista guarda la imagen de la capa que anima y sus keyframes;
// las capas que genera en cada frame se guardan como capas normales con su "pista_id".

function aPista(fila) {
    return {
        id: fila.id,
        nombre: fila.nombre,
        // MySQL entrega las columnas JSON ya convertidas; MariaDB, como texto
        keyframes: typeof fila.keyframes === 'string' ? JSON.parse(fila.keyframes) : fila.keyframes,
        imagen_data: fila.imagen_data,
    };
}

async function obtenerPistas(proyecto_id) {
    const [rows] = await pool.execute(
        'SELECT id, nombre, keyframes, imagen_data FROM pistas WHERE proyecto_id = ? ORDER BY id ASC',
        [proyecto_id]
    );
    return rows.map(aPista);
}

// Deja las pistas del proyecto iguales a la lista (dentro de la transacción de reemplazarFrames):
//   { clave, id, nombre, keyframes }           pista ya guardada: se actualiza
//   { clave, nombre, keyframes, imagen_data }  pista nueva: se crea
// Las pistas del proyecto que no vienen en la lista se borran (sus capas quedan sin pista).
// Devuelve un Map clave -> id, para que las capas generadas apunten a su pista.
async function guardarPistas(conexion, proyecto_id, pistas) {
    const [actuales] = await conexion.execute('SELECT id FROM pistas WHERE proyecto_id = ? FOR UPDATE', [proyecto_id]);
    const idsActuales = new Set(actuales.map((fila) => fila.id));
    const ids = new Map();

    for (const pista of pistas) {
        const keyframes = JSON.stringify(pista.keyframes);
        if (pista.id !== undefined) {
            if (!idsActuales.has(pista.id)) {
                throw errorHttp(400, 'La lista incluye una pista que no pertenece a este proyecto.');
            }
            await conexion.execute('UPDATE pistas SET nombre = ?, keyframes = ? WHERE id = ?', [pista.nombre, keyframes, pista.id]);
            ids.set(pista.clave, pista.id);
        } else {
            const [nueva] = await conexion.execute(
                'INSERT INTO pistas (proyecto_id, nombre, keyframes, imagen_data) VALUES (?, ?, ?, ?)',
                [proyecto_id, pista.nombre, keyframes, pista.imagen_data]
            );
            ids.set(pista.clave, nueva.insertId);
        }
    }

    const conservadas = new Set(ids.values());
    const borrar = [...idsActuales].filter((id) => !conservadas.has(id));
    if (borrar.length) {
        await conexion.query('DELETE FROM pistas WHERE proyecto_id = ? AND id IN (?)', [proyecto_id, borrar]);
    }
    return ids;
}

module.exports = { obtenerPistas, guardarPistas };