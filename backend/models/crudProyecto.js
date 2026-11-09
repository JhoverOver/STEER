const pool = require('../config/db');
const crudCapas = require('./crudCapas');
// Columnas que se entregan al cliente
const COLUMNAS = 'id, usuario_id, nombre, descripcion, etiquetas, color, ancho, alto, fecha_creacion, fecha_edicion';


function leerEtiquetas(texto) {
    if (!texto) return [];
    try {
        const lista = JSON.parse(texto);
        return Array.isArray(lista) ? lista.filter((e) => typeof e === 'string') : [];
    } catch {
        return [];
    }
}

function aProyecto(fila) {
    if (!fila) return null;
    const { miniatura, ...resto } = fila;
    return { ...resto, etiquetas: leerEtiquetas(fila.etiquetas), tieneMiniatura: Boolean(miniatura) };
}

async function crearProyecto(usuario_id, nombre, descripcion, etiquetas = [], color = null) {
    const [result] = await pool.execute(
        'INSERT INTO proyectos (usuario_id, nombre, descripcion, etiquetas, color) VALUES (?, ?, ?, ?, ?)',
        [usuario_id, nombre, descripcion || null, JSON.stringify(etiquetas), color]
    );
    return { id: result.insertId, usuario_id, nombre, descripcion, etiquetas, color };
}

async function obtenerProyectos(usuario_id) {
    // El proyecto sin ediciones queda con fecha_edicion vacía: se ordena por la fecha más reciente de las dos
    const [rows] = await pool.execute(
        `SELECT ${COLUMNAS}, miniatura
        FROM proyectos WHERE usuario_id = ?
        ORDER BY COALESCE(fecha_edicion, fecha_creacion) DESC, id DESC`,
        [usuario_id]
    );
    return rows.map((fila) => ({
        ...aProyecto(fila),
        miniatura: fila.miniatura ? `data:image/webp;base64,${fila.miniatura.toString('base64')}` : null,
    }));
}

async function obtenerProyecto(id, usuario_id) {
    const [rows] = await pool.execute(
        `SELECT ${COLUMNAS}, miniatura IS NOT NULL AS miniatura FROM proyectos WHERE id = ? AND usuario_id = ?`,
        [id, usuario_id]
    );
    return aProyecto(rows[0]);
}

// Solo cambia los campos que vienen en `datos`
async function actualizarProyecto(id, usuario_id, datos) {
    const columnas = [];
    const valores = [];
    if (datos.nombre !== undefined) { columnas.push('nombre = ?'); valores.push(datos.nombre); }
    if (datos.descripcion !== undefined) { columnas.push('descripcion = ?'); valores.push(datos.descripcion || null); }
    if (datos.etiquetas !== undefined) { columnas.push('etiquetas = ?'); valores.push(JSON.stringify(datos.etiquetas)); }
    if (datos.color !== undefined) { columnas.push('color = ?'); valores.push(datos.color); }
    if (!columnas.length) return false;
    const [result] = await pool.execute(
        `UPDATE proyectos SET ${columnas.join(', ')}, fecha_edicion = NOW() WHERE id = ? AND usuario_id = ?`,
        [...valores, id, usuario_id]
    );
    return result.affectedRows > 0;
}

// La miniatura no cambia la fecha de edición: no es una edición del usuario
async function guardarMiniatura(proyecto_id, miniatura) {
    await pool.execute('UPDATE proyectos SET miniatura = ? WHERE id = ?', [miniatura, proyecto_id]);
}

//Fija el tamaño del lienzo del proyecto
async function guardarTamanoLienzo(proyecto_id, ancho, alto) {
    const [result] = await pool.execute(
        'UPDATE proyectos SET ancho = ?, alto = ? WHERE id = ?',
        [ancho, alto, proyecto_id]);
        return result.affectedRows > 0;
}

//Proyectos que aún no tienen tamaño de lienzo
async function proyectosSinLienzo() {
    const [rows] = await pool.execute('SELECT id, usuario_id FROM proyectos WHERE ancho IS NULL OR alto IS NULL');
    return rows;
}

async function proyectosSinMiniatura() {
    const [rows] = await pool.execute(
        `SELECT p.id FROM proyectos p
        WHERE p.miniatura IS NULL AND EXISTS (SELECT 1 FROM frames f WHERE f.proyecto_id = p.id)`
    );
    return rows.map((fila) => fila.id);
}

async function eliminarProyecto(id, usuario_id) {
    const [result] = await pool.execute(
        'DELETE FROM proyectos WHERE id = ? AND usuario_id = ?',
        [id, usuario_id]
    );
    return result.affectedRows > 0;
}

// fotogramas sin capas reciben una capa de fondo
function capaFondo(imagen_data) {
    return{ nombre: 'Fondo', visible: true, bloqueada: false, imagen_data };
}

async function guardarFrames(proyecto_id, frames) {
    const conexion = await pool.getConnection();
    try {
        await conexion.beginTransaction();
        await conexion.execute('DELETE FROM frames WHERE proyecto_id = ?', [proyecto_id]);
        for (const frame of frames) {
            const [insertado] = await conexion.execute(
                'INSERT INTO frames (proyecto_id, orden, imagen_data, duracion) VALUES (?, ?, ?, ?)',
                [proyecto_id, frame.orden, frame.imagen_data, frame.duracion]
            );
            await crudCapas.insertarCapas(conexion, insertado.insertId, [capaFondo(frame.imagen_data)]);
        };
        await conexion.execute(
            'UPDATE proyectos SET fecha_edicion = NOW() WHERE id = ?',
            [proyecto_id]
        );
        await conexion.commit();
        return true;
    }   catch (error) {
        await conexion.rollback();
        throw error;
    } finally {
        conexion.release(); // Conexión vuelve al pool
    }
}

async function obtenerIdsFrames(proyecto_id) {
    const [rows] = await pool.execute('SELECT id FROM frames WHERE proyecto_id = ?', [proyecto_id]);
    return rows.map((fila) => fila.id);
}

async function obtenerFrames(proyecto_id) {
    const [rows] = await pool.execute(
        'SELECT id, proyecto_id, orden, imagen_data, duracion FROM frames WHERE proyecto_id = ? ORDER BY orden ASC',
        [proyecto_id]
    );
    return rows;
};

async function reemplazarFrames(proyecto_id,nuevos) {
    const conexion = await pool.getConnection();
    try{
        await conexion.beginTransaction();
        await conexion.execute('SELECT id FROM proyectos WHERE id = ? FOR UPDATE', [proyecto_id]);
        const [OG] = await conexion.execute('SELECT id FROM frames WHERE proyecto_id = ?', [proyecto_id]);
        const idOG = new Set(OG.map((fila) => fila.id));
        const mayoridOG = OG.length ? Math.max(...idOG) : 0;

        for (let i= 0; i < nuevos.length; i++) {
            const frame = nuevos[i];
            if (frame.origen_id !== undefined) {
                if (!idOG.has(frame.origen_id)) {
                    const error = new Error ('Frame de origen inválido');
                    error.codigo= 'ORIGEN_INVALIDO';
                    throw error;
                }

                const [copia] = await conexion.execute(
                    `INSERT INTO frames (proyecto_id, orden, imagen_data, duracion)
                    SELECT proyecto_id, ?, imagen_data, ? FROM frames WHERE id = ? AND proyecto_id = ?`,
                    [i, frame.duracion, frame.origen_id, proyecto_id]
                );
                await crudCapas.copiarCapas(conexion, frame.origen_id, copia.insertId);
            }   else {
            const [nuevo] = await conexion.execute(
                'INSERT INTO frames (proyecto_id, orden, imagen_data, duracion) VALUES (?,?,?,?)',
                    [proyecto_id, i, frame.imagen_data, frame.duracion]
                );

                await crudCapas.insertarCapas(conexion, nuevo.insertId, frame.capas || [capaFondo(frame.imagen_data)]);
            }
        }
        if (OG.length) {
            await conexion.execute('DELETE FROM frames WHERE proyecto_id = ? AND id <= ?', [proyecto_id, mayoridOG]);
        }
            await conexion.execute('UPDATE proyectos SET fecha_edicion = NOW() WHERE id = ?', [proyecto_id]);
            await conexion.commit();
            return true;
        }   catch (error) {
            await conexion.rollback();
            throw error;
        }   finally {
            conexion.release();
    }
}

async function obtenerPrimerFrame(proyecto_id) {
        const [rows] = await pool.execute(
            'SELECT id, imagen_data FROM frames WHERE proyecto_id = ? ORDER BY orden ASC LIMIT 1',
            [proyecto_id]
        );
        return rows[0] || null;
    }

module.exports = {
    crearProyecto,
    obtenerProyectos,
    obtenerProyecto,
    actualizarProyecto,
    eliminarProyecto,
    guardarFrames,
    obtenerFrames,
    reemplazarFrames,
    obtenerPrimerFrame,
    guardarMiniatura,
    guardarTamanoLienzo,
    proyectosSinMiniatura,
    proyectosSinLienzo,
    obtenerIdsFrames,
};