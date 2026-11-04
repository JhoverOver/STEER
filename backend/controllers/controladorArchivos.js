const crudProyecto =require('../models/crudProyecto');
const procesadorFrames = require('../services/procesadorFrames');
const sharp = require('sharp');

const {
    MAX_FRAMES,
    DURACION_MINIMA,
    DURACION_MAXIMA,
} = require('../config/limites');

function esGIF(buffer) {
    return buffer.length >= 6 && buffer.subarray(0, 4).toString('ascii') === 'GIF8';
}

function nombreSeguro(nombre) {
    return (nombre || 'proyecto').replace(/[^a-zA-Z0-9-_]+/g, '_');
}

function frameCliente(frame) {
    return {
        id: frame.id,
        orden: frame.orden,
        duracion: frame.duracion,
        imagen: `data:image/png;base64,${frame.imagen_data.toString('base64')}`,
    };
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

// Importa un GIF: valida, descompone, guarda y responde.
async function importar(req, res, { validarArchivo, descomponer, mensajeError }) {
    const { id } = req.params;
    const usuario_id = req.usuario_id;

    if (!req.file) {
        return res.status(400).json({ error: 'No se proporcionó ningún archivo' });
    }
    const errorArchivo = validarArchivo(req);
    if (errorArchivo) {
        return res.status(400).json({ error: errorArchivo });
    }

    try {
        const proyecto = await crudProyecto.obtenerProyecto(id, usuario_id);
        if (!proyecto) {
            return res.status(404).json({ error: 'Proyecto no encontrado' });
        }

        let resultado;
        try {
            resultado = await descomponer(req);
        } catch (error) {
            console.error(mensajeError, error);
            return res.status(400).json({ error: mensajeError });
        }

        const { frames } = resultado;
        if (frames.length > MAX_FRAMES) {
            return res.status(400).json({ error: `El archivo tiene demasiados frames. Máximo permitido: ${MAX_FRAMES}` });
        }

        await crudProyecto.guardarFrames(id, frames);
        await actualizarMiniatura(id);
        const guardados = await crudProyecto.obtenerFrames(id);
        return res.status(201).json({ frames: guardados.map(frameCliente) });
    } catch (error) {
        console.error('Error al importar:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
}

function subirGIF(req, res) {
    return importar(req, res, {
        validarArchivo: (r) => (esGIF(r.file.buffer) ? null : 'El archivo proporcionado no es un GIF válido'),
        descomponer: async (r) => ({ frames: await procesadorFrames.descomponerGIF(r.file.buffer) }),
        mensajeError: 'Error al procesar el GIF',
    });
}

async function obtenerFrames(req, res) {
    const { id } = req.params;
    const usuario_id = req.usuario_id;

    try {
        const proyecto = await crudProyecto.obtenerProyecto(id, usuario_id);
        if (!proyecto) {
            return res.status(404).json({ error: 'Proyecto no encontrado' });
        }
        const frames = await crudProyecto.obtenerFrames(id);
        return res.status(200).json({ frames: frames.map(frameCliente) });
    } catch (error) {
        console.error('Error en obtenerFrames:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
}

function validarListaFrames(cuerpo) {
    const lista = cuerpo && cuerpo.frames;
    if (!Array.isArray(lista)) {
        return {error: 'Debes enviar la lista de frames en el campo "frames".'};
    }
    if (lista.length > MAX_FRAMES) {
        return { error: `La lista tiene ${lista.length} frames y el máximo permitido es ${MAX_FRAMES}`};
    }

    const limpia = [];
    for (let i = 0; i < lista.length; i++) {
        const frame = lista[i]
        const numero = i + 1
        if (!frame || typeof frame !== 'object') {
        return {error: `El frame ${numero} no es válido.`};
        }
        const { duracion, origen_id} = frame;
        if (!Number.isInteger(duracion) || duracion < DURACION_MINIMA || duracion > DURACION_MAXIMA) {
            return {
                error: `La duración del frame ${numero} debe ser un número entero entre ${DURACION_MINIMA} y ${DURACION_MAXIMA} ms.`,
            };
        }

        const tieneOrigen = origen_id !== undefined;
        const esVacio = frame.vacio === true;
        if (tieneOrigen === esVacio) {
            return { error: `El frame ${numero} debe indicar "origen_id" o "vacio".`};
        }
        if (tieneOrigen && !Number.isInteger(origen_id)) {
            return { error: `El "origen_id" del frame ${numero} no es válido.`};
        }
        limpia.push(tieneOrigen ? { origen_id, duracion } : { vacio: true, duracion });
    }
    return { lista: limpia};
}

async function actualizarFrames(req, res) {
    const { id } = req.params;
    const usuario_id = req.usuario_id;

    const {lista, error } = validarListaFrames(req.body);
    if (error) {
        return res.status(400).json({ error });
    }

    try {
        const proyecto = await crudProyecto.obtenerProyecto(id, usuario_id);
        if (!proyecto) {
            return res.status(404).json({ error: 'Proyecto no encontrado.' });
        }
    
    let nuevos = lista;
    if (lista.some((frame)  => frame.vacio)) {
        const referencia = await crudProyecto.obtenerPrimerFrame(id);
        if (!referencia) {
            return res.status(400).json({
                error: 'No se puede crear un frame en blanco en un proyecto sin frames. Importa un GIF primero.',
            });
        }
        const { width, height } = await sharp(referencia.imagen_data).metadata();
        const Blank = await procesadorFrames.crearFrameVacio(width, height);
        nuevos = lista.map((frame) => (frame.vacio ? {imagen_data: Blank, duracion: frame.duracion} : frame));
    }

    try {
        await crudProyecto.reemplazarFrames(id, nuevos);
    }   catch (errorGuardado) {
        if (errorGuardado.codigo === 'ORIGEN_INVALIDO') {
            return res.status(400).json({ error: 'La lista incluye un frame que no pertenece a este proyecto.'});
        }
        throw errorGuardado;
    }
        await actualizarMiniatura(id);
        const guardados = await crudProyecto.obtenerFrames(id);
        return res.status(200).json({ frames: guardados.map(frameCliente)});
    }   catch (errorInterno) {
        console.error('Error en actualizarFrames:', errorInterno);
        return res.status(500).json({  error: 'Error interno al guardar los frames'});
    }
}

async function exportar(req, res, construir, tipoMime, extension) {
    const { id } = req.params;
    const usuario_id = req.usuario_id;

    try {
        const proyecto = await crudProyecto.obtenerProyecto(id, usuario_id);
        if (!proyecto) {
            return res.status(404).json({ error: 'Proyecto no encontrado' });
        }
        const frames = await crudProyecto.obtenerFrames(id);
        if (!frames.length) {
            return res.status(400).json({ error: 'No hay frames para exportar' });
        }

        const archivo = await construir(frames);
        res.set({
            'Content-Type': tipoMime,
            'Content-Disposition': `attachment; filename="${nombreSeguro(proyecto.nombre)}.${extension}"`,
        });
        return res.status(200).send(archivo);
    } catch (error) {
        console.error('Error en exportar:', error);
        return res.status(500).json({ error: `Error interno del servidor al exportar ${extension.toUpperCase()}` });
    }
}

function exportarGIF(req, res) {
    return exportar(req, res, procesadorFrames.reconstruirGIF, 'image/gif', 'gif');
}

function exportarMP4(req, res) {
    return exportar(req, res, procesadorFrames.reconstruirVideo, 'video/mp4', 'mp4');
}

module.exports = {
    subirGIF,
    obtenerFrames,
    exportarGIF,
    exportarMP4,
    actualizarFrames
};

