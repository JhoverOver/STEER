const crudProyecto = require('../models/crudProyecto');
const { validarEtiquetas, validarColor } = require('../utils/validarProyecto');

const LARGO_MAXIMO_NOMBRE = 150;

async function crearProyecto(req, res) {
    const { nombre, descripcion } = req.body;
    const usuario_id = req.usuario_id;

    if (!nombre || typeof nombre !== 'string' || !nombre.trim()) {
        return res.status(400).json({ error: 'El nombre del proyecto es obligatorio' });
    }
    if (nombre.trim().length > LARGO_MAXIMO_NOMBRE) {
        return res.status(400).json({ error: `El nombre puede tener como máximo ${LARGO_MAXIMO_NOMBRE} caracteres.` });
    }
    const etiquetas = validarEtiquetas(req.body.etiquetas);
    if (etiquetas.error) return res.status(400).json({ error: etiquetas.error });
    const color = validarColor(req.body.color);
    if (color.error) return res.status(400).json({ error: color.error });

    try {
        const nuevoProyecto = await crudProyecto.crearProyecto(
            usuario_id, nombre.trim(), descripcion, etiquetas.valor || [], color.valor ?? null
        );
        res.status(201).json(nuevoProyecto);
    } catch (error) {
        console.error('Error al crear el proyecto:', error);
        res.status(500).json({ error: 'Error interno al crear el proyecto' });
    }
}

async function obtenerProyectos(req, res) {
    const usuario_id = req.usuario_id;

    try {
        const proyectos = await crudProyecto.obtenerProyectos(usuario_id);
        res.status(200).json(proyectos);
    } catch (error) {
        console.error('Error al obtener los proyectos:', error);
        res.status(500).json({ error: 'Error interno al obtener los proyectos' });
    }
}

async function obtenerProyecto(req, res) {
    const { id } = req.params;
    const usuario_id = req.usuario_id;

    try {
        const proyecto = await crudProyecto.obtenerProyecto(id, usuario_id);
        if (!proyecto) {
            return res.status(404).json({ error: 'Proyecto no encontrado' });
        }
        res.status(200).json(proyecto);
    } catch (error) {
        console.error('Error al obtener el proyecto:', error);
        res.status(500).json({ error: 'Error interno al obtener el proyecto' });
    }
}

async function actualizarProyecto(req, res) {
    const { id } = req.params;
    const usuario_id = req.usuario_id;
    const { nombre, descripcion } = req.body;

    if (nombre !== undefined) {
        if (typeof nombre !== 'string' || !nombre.trim()) {
            return res.status(400).json({ error: 'El nombre del proyecto no puede estar vacío.' });
        }
        if (nombre.trim().length > LARGO_MAXIMO_NOMBRE) {
            return res.status(400).json({ error: `El nombre puede tener como máximo ${LARGO_MAXIMO_NOMBRE} caracteres.` });
        }
    }
    if (descripcion !== undefined && descripcion !== null && typeof descripcion !== 'string') {
        return res.status(400).json({ error: 'La descripción debe ser un texto.' });
    }
    const etiquetas = validarEtiquetas(req.body.etiquetas);
    if (etiquetas.error) return res.status(400).json({ error: etiquetas.error });
    const color = validarColor(req.body.color);
    if (color.error) return res.status(400).json({ error: color.error });

    const datos = {
        nombre: nombre === undefined ? undefined : nombre.trim(),
        descripcion,
        etiquetas: etiquetas.valor,
        color: color.valor,
    };
    if (Object.values(datos).every((valor) => valor === undefined)) {
        return res.status(400).json({ error: 'No enviaste ningún dato para actualizar.' });
    }

    try {
        const actualizado = await crudProyecto.actualizarProyecto(id, usuario_id, datos);
        if (!actualizado) {
            return res.status(404).json({ error: 'Proyecto no encontrado o no autorizado' });
        }
        const proyecto = await crudProyecto.obtenerProyecto(id, usuario_id);
        return res.status(200).json(proyecto);
    } catch (error) {
        console.error('Error al actualizar el proyecto:', error);
        res.status(500).json({ error: 'Error interno al actualizar el proyecto' });
    }
}

async function eliminarProyecto(req, res) {
    const { id } = req.params;
    const usuario_id = req.usuario_id;

    try {
        const eliminado = await crudProyecto.eliminarProyecto(id, usuario_id);
        if (!eliminado) {
            return res.status(404).json({ error: 'Proyecto no encontrado o no autorizado' });
        }
        return res.status(200).json({ message: 'Proyecto eliminado correctamente' });
    } catch (error) {
        console.error('Error al eliminar el proyecto:', error);
        res.status(500).json({ error: 'Error interno al eliminar el proyecto' });
    }
}

module.exports = {
    crearProyecto,
    obtenerProyectos,
    obtenerProyecto,
    actualizarProyecto,
    eliminarProyecto
}
