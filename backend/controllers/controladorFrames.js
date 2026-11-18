const crudProyecto = require('../models/crudProyecto');
const crudCapas = require('../models/crudCapas');
const procesadorFrames = require('../services/procesadorFrames');
const { errorHttp } = require('../middleware/errores');
const { leerLista, validarListaFrames } = require('../utils/validarFrames');
const { FACTOR_AREA_TRABAJO } = require('../config/limites');

// Frames del proyecto: importar un GIF, leerlos, guardarlos, leer las capas de uno y exportar.
// El proyecto ya viene revisado en req.proyecto (middleware/cargarProyecto.js).

function esGIF(buffer) {
    return buffer.length >= 6 && buffer.subarray(0, 4).toString('ascii') === 'GIF8';
}

function nombreSeguro(nombre) {
    return (nombre || 'proyecto').replace(/[^a-zA-Z0-9-_]+/g, '_');
}

function aImagenCliente(buffer) {
    return `data:image/png;base64,${buffer.toString('base64')}`;
}

function frameCliente(frame) {
    return { id: frame.id, orden: frame.orden, duracion: frame.duracion, imagen: aImagenCliente(frame.imagen_data) };
}

function capaCliente(capa) {
    const { id, nombre, orden, visible, bloqueada } = capa;
    return { id, nombre, orden, visible, bloqueada, imagen: aImagenCliente(capa.imagen_data) };
}

// Regenera la miniatura del proyecto a partir de su primer frame.
// Un fallo aquí nunca debe romper la petición principal.
async function actualizarMiniatura(id) {
    try {
        const primero = await crudProyecto.obtenerPrimerFrame(id);
        if (!primero) return;
        const miniatura = await procesadorFrames.generarMiniatura(primero.imagen_data);
        await crudProyecto.guardarMiniatura(id, miniatura);
    } catch (error) {
        console.error('No se pudo generar la miniatura del proyecto', id, error.message);
    }
}

// Responde la lista de frames tal como quedó guardada
async function responderFrames(res, estado, id, extra = {}) {
    const frames = await crudProyecto.obtenerFrames(id);
    return res.status(estado).json({ frames: frames.map(frameCliente), ...extra });
}

// POST /:id/gif: reemplaza los frames del proyecto por los del GIF (RF14) y fija el tamaño del lienzo
async function importarGIF(req, res) {
    if (!req.file) throw errorHttp(400, 'No se proporcionó ningún archivo');
    if (!esGIF(req.file.buffer)) throw errorHttp(400, 'El archivo proporcionado no es un GIF válido');

    const { id } = req.proyecto;
    const { frames, ancho, alto } = await procesadorFrames.descomponerGIF(req.file.buffer);
    await crudProyecto.reemplazarFrames(id, frames, { ancho, alto });
    await actualizarMiniatura(id);
    return responderFrames(res, 201, id, { ancho, alto });
}

// GET /:id/frames
async function obtenerFrames(req, res) {
    return responderFrames(res, 200, req.proyecto.id);
}

// Convierte la lista validada en los frames que se guardan: busca la imagen de cada capa y compone la imagen
// final de cada frame. Si algo no calza, lanza un error 400.
async function armarFrames(lista, proyecto, archivos) {
    const { ancho, alto } = proyecto;
    const necesitaLienzo = lista.some((frame) => frame.vacio || frame.capas);
    if (necesitaLienzo && !(ancho && alto)) {
        throw errorHttp(400, 'No se puede crear ni editar un frame en un proyecto sin frames. Importa un GIF primero.');
    }

    const nuevos = [];
    let blanco = null;
    for (let i = 0; i < lista.length; i++) {
        const frame = lista[i];
        const numero = i + 1;

        if (frame.vacio) {
            blanco = blanco || await procesadorFrames.crearFrameVacio(ancho, alto);
            nuevos.push({ imagen_data: blanco, duracion: frame.duracion });
        } else if (!frame.capas) {
            nuevos.push({ origen_id: frame.origen_id, duracion: frame.duracion });
        } else {
            // Capas ya guardadas de ESE frame (solo se piden si alguna capa las usa)
            const usaGuardadas = frame.capas.some((capa) => capa.id !== undefined);
            const guardadas = new Map();
            if (usaGuardadas) {
                (await crudCapas.obtenerCapasDelProyecto(frame.origen_id, proyecto.id)).forEach((capa) => guardadas.set(capa.id, capa));
            }

            const capas = [];
            for (let j = 0; j < frame.capas.length; j++) {
                const capa = frame.capas[j];
                const etiqueta = `La capa ${j + 1} del frame ${numero}`;
                let imagen_data;
                if (capa.id !== undefined) {
                    const guardada = guardadas.get(capa.id);
                    if (!guardada) {
                        throw errorHttp(400, `${etiqueta} no pertenece a su frame de origen.`);
                    }
                    imagen_data = guardada.imagen_data;
                } else {
                    imagen_data = archivos.get(capa.archivo);
                    if (!imagen_data) {
                        throw errorHttp(400, `Falta el archivo de ${etiqueta.toLowerCase()}.`);
                    }
                    if (!(await procesadorFrames.validarCapaPNG(imagen_data, ancho, alto))) {
                        throw errorHttp(400, `${etiqueta} debe ser un PNG de ${ancho} × ${alto} px (o de ${ancho * FACTOR_AREA_TRABAJO} × ${alto * FACTOR_AREA_TRABAJO} px si guarda contenido fuera del lienzo).`);
                    }
                }
                capas.push({ nombre: capa.nombre, visible: capa.visible, bloqueada: capa.bloqueada, imagen_data });
            }
            const compuesta = await procesadorFrames.componerCapas(capas, ancho, alto);
            nuevos.push({ imagen_data: compuesta, duracion: frame.duracion, capas });
        }
    }
    return nuevos;
}

// PUT /:id/frames: guarda la lista completa de frames (orden, duraciones, copias, nuevos y editados)
async function guardarFrames(req, res) {
    const { lista, error } = validarListaFrames(leerLista(req));
    if (error) throw errorHttp(400, error);

    const { proyecto } = req;
    // Los PNG subidos, por el nombre del campo con que llegó cada uno
    const archivos = new Map((req.files || []).map((archivo) => [archivo.fieldname, archivo.buffer]));
    // Las copias se revisan dentro de reemplazarFrames y las capas guardadas con obtenerCapasDelProyecto:
    // un frame o una capa de otro proyecto nunca se puede usar
    const nuevos = await armarFrames(lista, proyecto, archivos);
    await crudProyecto.reemplazarFrames(proyecto.id, nuevos);
    await actualizarMiniatura(proyecto.id);
    return responderFrames(res, 200, proyecto.id);
}

// GET /:id/frames/:frameId/capas: capas de un frame guardado, para abrirlo en el editor
async function obtenerCapas(req, res) {
    const frameId = Number(req.params.frameId);
    if (!Number.isInteger(frameId)) throw errorHttp(400, 'Identificador no válido');
    // Solo devuelve capas si el frame es de ESTE proyecto: si no, se podrían leer capas de otro usuario
    const capas = await crudCapas.obtenerCapasDelProyecto(frameId, req.proyecto.id);
    if (!capas.length) throw errorHttp(404, 'Frame no encontrado');
    return res.status(200).json({ capas: capas.map(capaCliente) });
}

async function exportar(req, res, construir, tipoMime, extension) {
    const frames = await crudProyecto.obtenerFrames(req.proyecto.id);
    if (!frames.length) throw errorHttp(400, 'No hay frames para exportar');

    const archivo = await construir(frames);
    res.set({
        'Content-Type': tipoMime,
        'Content-Disposition': `attachment; filename="${nombreSeguro(req.proyecto.nombre)}.${extension}"`,
    });
    return res.status(200).send(archivo);
}

function exportarGIF(req, res) {
    return exportar(req, res, procesadorFrames.reconstruirGIF, 'image/gif', 'gif');
}

function exportarMP4(req, res) {
    return exportar(req, res, procesadorFrames.reconstruirVideo, 'video/mp4', 'mp4');
}

module.exports = {
    importarGIF,
    obtenerFrames,
    guardarFrames,
    obtenerCapas,
    exportarGIF,
    exportarMP4,
};