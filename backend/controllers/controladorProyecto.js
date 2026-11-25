const crudProyecto = require('../models/crudProyecto');
const { errorHttp } = require('../middleware/errores');
const { validarDatosProyecto } = require('../utils/validarProyecto');

// POST /: crea un proyecto vacío (sin frames ni tamaño de lienzo). El lienzo se fija después, en la pestaña Frames:
// al importar el primer archivo o al crear un frame en blanco (POST /:id/frames/vacio)
async function crearProyecto(req, res) {
    const { datos, error } = validarDatosProyecto(req.body, true);
    if (error) throw errorHttp(400, error);

    const { nombre, etiquetas, color } = datos;
    const nuevo = await crudProyecto.crearProyecto(req.usuario_id, nombre, etiquetas || [], color ?? null);
    return res.status(201).json(nuevo);
}

// GET /
async function obtenerProyectos(req, res) {
    return res.status(200).json(await crudProyecto.obtenerProyectos(req.usuario_id));
}

// GET /:id (el proyecto ya lo cargó middleware/cargarProyecto.js)
function obtenerProyecto(req, res) {
    return res.status(200).json(req.proyecto);
}

// PUT /:id: solo cambia los datos que vienen
async function actualizarProyecto(req, res) {
    const { datos, error } = validarDatosProyecto(req.body, false);
    if (error) throw errorHttp(400, error);
    if (Object.values(datos).every((valor) => valor === undefined)) {
        throw errorHttp(400, 'No enviaste ningún dato para actualizar.');
    }
    await crudProyecto.actualizarProyecto(req.proyecto.id, req.usuario_id, datos);
    return res.status(200).json(await crudProyecto.obtenerProyecto(req.proyecto.id, req.usuario_id));
}

// DELETE /:id
async function eliminarProyecto(req, res) {
    await crudProyecto.eliminarProyecto(req.proyecto.id, req.usuario_id);
    return res.status(200).json({ message: 'Proyecto eliminado correctamente' });
}

module.exports = {
    crearProyecto,
    obtenerProyectos,
    obtenerProyecto,
    actualizarProyecto,
    eliminarProyecto,
};