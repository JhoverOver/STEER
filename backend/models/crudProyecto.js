const pool = require('../config/db');
const crudCapas = require('./crudCapas');
const crudPistas = require('./crudPistas');
const { errorHttp } = require('../middleware/errores');
// Columnas que se entregan al cliente
const COLUMNAS = 'id, usuario_id, nombre, etiquetas, color, ancho, alto, fecha_creacion, fecha_edicion';


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

async function crearProyecto(usuario_id, nombre, etiquetas = [], color = null) {
    const [result] = await pool.execute(
        'INSERT INTO proyectos (usuario_id, nombre, etiquetas, color) VALUES (?, ?, ?, ?)',
        [usuario_id, nombre, JSON.stringify(etiquetas), color]
    );
    return { id: result.insertId, usuario_id, nombre, etiquetas, color };
}

async function obtenerProyectos(usuario_id) {
    // El proyecto sin ediciones queda con fecha_edicion vacía: se ordena por la fecha más reciente de las dos
    const [rows] = await pool.execute(
        `SELECT ${COLUMNAS}, miniatura,
            (SELECT COUNT(*) FROM frames f WHERE f.proyecto_id = proyectos.id) AS cantidad_frames
        FROM proyectos WHERE usuario_id = ?
        ORDER BY COALESCE(fecha_edicion, fecha_creacion) DESC, id DESC`,
        [usuario_id]
    );
    return rows.map((fila) => ({
        ...aProyecto(fila),
        miniatura: fila.miniatura ? `data:image/webp;base64,${fila.miniatura.toString('base64')}` : null,
        cantidad_frames: Number(fila.cantidad_frames) || 0,
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

async function obtenerFrames(proyecto_id) {
    const [rows] = await pool.execute(
        'SELECT id, proyecto_id, orden, imagen_data, duracion FROM frames WHERE proyecto_id = ? ORDER BY orden ASC',
        [proyecto_id]
    );
    return rows;
};

// Solo el id y la duración de cada frame, en orden (sin imágenes): para agregar frames al final
async function obtenerListaFrames(proyecto_id) {
    const [rows] = await pool.execute(
        'SELECT id, duracion FROM frames WHERE proyecto_id = ? ORDER BY orden ASC',
        [proyecto_id]
    );
    return rows;
}


// Reemplaza todos los frames del proyecto por "nuevos", en una sola transacción (si algo falla, no cambia nada).
// Cada frame nuevo es uno de estos:
//   { origen_id, duracion }                copia de un frame guardado del proyecto (con sus capas)
//   { imagen_data, duracion, capas? }      frame nuevo; sin "capas" recibe una capa "Fondo" con su imagen
// "lienzo" ({ ancho, alto }, opcional) fija además el tamaño del lienzo: se usa al importar un GIF o crear desde cero.
// "pistas" (opcional) es la lista completa de pistas de keyframes del proyecto (ver crudPistas.guardarPistas). Las
// capas que generó una pista la indican con "pista", la clave que el navegador le dio en esa lista.
async function reemplazarFrames(proyecto_id, nuevos, lienzo, pistas) {
    const conexion = await pool.getConnection();
    try {
        await conexion.beginTransaction();
        await conexion.execute('SELECT id FROM proyectos WHERE id = ? FOR UPDATE', [proyecto_id]);
        const [anteriores] = await conexion.execute('SELECT id FROM frames WHERE proyecto_id = ?', [proyecto_id]);
        const idsAnteriores = new Set(anteriores.map((fila) => fila.id));
        const mayorAnterior = anteriores.length ? Math.max(...idsAnteriores) : 0;
                // Primero las pistas: así las capas nuevas ya pueden apuntar al id de su pista
        const idsPistas = pistas ? await crudPistas.guardarPistas(conexion, proyecto_id, pistas) : new Map();
        const conPista = (capas) => capas.map((capa) => ({ ...capa, pista_id: capa.pista ? idsPistas.get(capa.pista) : null }));

        for (let i = 0; i < nuevos.length; i++) {
            const frame = nuevos[i];
            if (frame.origen_id !== undefined) {
                if (!idsAnteriores.has(frame.origen_id)) {
                    throw errorHttp(400, 'La lista incluye un frame que no pertenece a este proyecto.');
                }
                const [copia] = await conexion.execute(
                    `INSERT INTO frames (proyecto_id, orden, imagen_data, duracion)
                    SELECT proyecto_id, ?, imagen_data, ? FROM frames WHERE id = ? AND proyecto_id = ?`,
                    [i, frame.duracion, frame.origen_id, proyecto_id]
                );
                await crudCapas.copiarCapas(conexion, frame.origen_id, copia.insertId);
            } else {
                const [nuevo] = await conexion.execute(
                    'INSERT INTO frames (proyecto_id, orden, imagen_data, duracion) VALUES (?, ?, ?, ?)',
                    [proyecto_id, i, frame.imagen_data, frame.duracion]
                );
                await crudCapas.insertarCapas(conexion, nuevo.insertId, frame.capas ? conPista(frame.capas) : [capaFondo(frame.imagen_data)]);            }
        }
        // Los frames nuevos tienen id mayores que todos los anteriores: así se borran solo los anteriores
        if (anteriores.length) {
            await conexion.execute('DELETE FROM frames WHERE proyecto_id = ? AND id <= ?', [proyecto_id, mayorAnterior]);
        }
        if (lienzo) {
            await conexion.execute('UPDATE proyectos SET ancho = ?, alto = ? WHERE id = ?', [lienzo.ancho, lienzo.alto, proyecto_id]);
        }
        await conexion.execute('UPDATE proyectos SET fecha_edicion = NOW() WHERE id = ?', [proyecto_id]);
        await conexion.commit();
    } catch (error) {
        await conexion.rollback();
        throw error;
    } finally {
        conexion.release(); // la conexión vuelve al pool
    }
}

// Cambia el tamaño del lienzo del proyecto (pestaña Frames). "reubicar(imagen)" devuelve la imagen de una capa o de
// una pista ya acomodada al lienzo nuevo y "componer(capas)" la imagen final de un frame. Todo pasa en una sola
// transacción: si algo falla, el proyecto queda como estaba.
async function cambiarLienzo(proyecto_id, lienzo, reubicar, componer, moverTexto) {
    const conexion = await pool.getConnection();
    try {
        await conexion.beginTransaction();
        await conexion.execute('SELECT id FROM proyectos WHERE id = ? FOR UPDATE', [proyecto_id]);
        const [frames] = await conexion.execute('SELECT id FROM frames WHERE proyecto_id = ? ORDER BY orden', [proyecto_id]);
        for (const { id } of frames) {
            const [capas] = await conexion.execute(
                'SELECT id, visible, imagen_data, texto FROM capas WHERE frame_id = ? ORDER BY orden', [id]
            );
            const nuevas = [];
            for (const capa of capas) {
                const imagen_data = await reubicar(capa.imagen_data);
                const texto = typeof capa.texto === 'string' ? JSON.parse(capa.texto) : capa.texto;
                await conexion.execute(
                    'UPDATE capas SET imagen_data = ?, texto = ? WHERE id = ?',
                    [imagen_data, texto ? JSON.stringify(moverTexto(texto)) : null, capa.id]
                );
                nuevas.push({ visible: Boolean(capa.visible), imagen_data });
            }
            await conexion.execute('UPDATE frames SET imagen_data = ? WHERE id = ?', [await componer(nuevas), id]);
        }
        const [pistas] = await conexion.execute('SELECT id, imagen_data FROM pistas WHERE proyecto_id = ?', [proyecto_id]);
        for (const pista of pistas) {
            await conexion.execute('UPDATE pistas SET imagen_data = ? WHERE id = ?', [await reubicar(pista.imagen_data), pista.id]);
        }
        await conexion.execute(
            'UPDATE proyectos SET ancho = ?, alto = ?, fecha_edicion = NOW() WHERE id = ?',
            [lienzo.ancho, lienzo.alto, proyecto_id]
        );
        await conexion.commit();
    } catch (error) {
        await conexion.rollback();
        throw error;
    } finally {
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
    cambiarLienzo,
    crearProyecto,
    obtenerProyectos,
    obtenerProyecto,
    actualizarProyecto,
    eliminarProyecto,
    obtenerFrames,
    obtenerListaFrames,
    reemplazarFrames,
    obtenerPrimerFrame,
    guardarMiniatura,
};