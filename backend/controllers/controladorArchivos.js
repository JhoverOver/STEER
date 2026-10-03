const crudProyecto =require('../models/crudProyecto');
const procesadorFrames = require('../services/procesadorFrames');

const MAX_FRAMES = 100; // Número máximo de frames permitidos

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

async function subirGIF(req, res) {
    const { id } = req.params;
    const usuario_id = req.usuario_id;

    if (!req.file) {
        return res.status(400).json({ error: 'No se proporcionó ningún archivo' });
    }
    if (!esGIF(req.file.buffer)) {
        return res.status(400).json({ error: 'El archivo proporcionado no es un GIF válido' });
    }

    try {
        const proyecto = await crudProyecto.obtenerProyecto(id, usuario_id);
        if (!proyecto) {
            return res.status(404).json({ error: 'Proyecto no encontrado' });
        }

    let frames;
    try {
        frames = await procesadorFrames.descomponerGIF(req.file.buffer);
    } catch (error) {
        console.error('Error al procesar el GIF:', error);
        return res.status(400).json({ error: 'Error al procesar el GIF' });
    }

    if (frames.length > MAX_FRAMES) {
        return res.status(400).json({ error: `El GIF tiene demasiados frames. Máximo permitido: ${MAX_FRAMES}` });
    }

    await crudProyecto.guardarFrames(id, frames);
    const framesguardados = await crudProyecto.obtenerFrames(id);
    return res.status(201).json({ frames: framesguardados.map(frameCliente) });
} catch (error) {
    console.error('Error en subirGIF:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
}
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
    exportarMP4
};

