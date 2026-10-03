const crudProyecto = require('../models/crudProyecto');

async function crearProyecto(req, res) {
    const {nombre, descripcion } = req.body;
    const usuario_id = req.usuario_id;

    if (!nombre) {
        return res.status(400).json({ error: 'El nombre del proyecto es obligatorio' });
    }

    try {
        const nuevoProyecto = await crudProyecto.crearProyecto(usuario_id, nombre, descripcion);
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
    const { nombre, descripcion, etiqueta, color } = req.body;

    try {
        const actualizado = await crudProyecto.actualizarProyecto(id, usuario_id, { nombre, descripcion, etiqueta, color });
        if (!actualizado) {
            return res.status(404).json({ error: 'Proyecto no encontrado o no autorizado' });
        }
        return res.status(200).json({ message: 'Proyecto actualizado correctamente' });
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