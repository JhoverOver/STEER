const crudProyecto = require('../models/crudProyecto');
const crudCapas = require('../models/crudCapas');

function capaCliente(capa) {
    return {
        id: capa.id,
        nombre: capa.nombre,
        orden: capa.orden,
        visible: capa.visible,
        bloqueada: capa.bloqueada,
        imagen: `data:image/png;base64,${capa.imagen_data.toString('base64')}`,
    };
}

async function obtenerCapas(req, res) {
    const proyecto_id = Number(req.params.id);
    const frame_id = Number(req.params.frameId);
    const usuario_id = req.usuario_id;

    if (!Number.isInteger(proyecto_id) || !Number.isInteger(frame_id)) {
        return res.status(400).json({ error: 'Identificador no válido' });
    }

    try {
        const proyecto = await crudProyecto.obtenerProyecto(proyecto_id, usuario_id);
        if (!proyecto) {
            return res.status(404).json({ error: 'Proyecto no encontrado' });
        }
        // El frame debe ser de ESTE proyecto: si no, se podrían leer capas de otro usuario
        const idsFrames = await crudProyecto.obtenerIdsFrames(proyecto_id);
        if (!idsFrames.includes(frame_id)) {
            return res.status(404).json({ error: 'Frame no encontrado' });
        }
        const capas = await crudCapas.obtenerCapas(frame_id);
        return res.status(200).json({ capas: capas.map(capaCliente) });
    } catch (error) {
        console.error('Error en obtenerCapas:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
}

module.exports = {
    obtenerCapas,
};