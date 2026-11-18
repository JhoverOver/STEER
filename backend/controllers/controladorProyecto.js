const crudProyecto = require('../models/crudProyecto');
const procesadorFrames = require('../services/procesadorFrames');
const { errorHttp } = require('../middleware/errores');
const { validarDatosProyecto } = require('../utils/validarProyecto');
const { LADO_INICIAL, DURACION_INICIAL } = require('../config/limites');

// POST /: crea un proyecto. Con desde_cero: true empieza con un frame en blanco de LADO_INICIAL x LADO_INICIAL
async function crearProyecto(req, res) {
    const { datos, error } = validarDatosProyecto(req.body, true);
    if (error) throw errorHttp(400, error);

    const { nombre, descripcion, etiquetas, color } = datos;
    const nuevo = await crudProyecto.crearProyecto(req.usuario_id, nombre, descripcion, etiquetas || [], color ?? null);
    if (req.body.desde_cero === true) {
        try {
            const vacio = await procesadorFrames.crearFrameVacio(LADO_INICIAL, LADO_INICIAL);
            const lienzo = { ancho: LADO_INICIAL, alto: LADO_INICIAL };
            await crudProyecto.reemplazarFrames(nuevo.id, [{ imagen_data: vacio, duracion: DURACION_INICIAL }], lienzo);
            Object.assign(nuevo, lienzo);
        } catch (errorLienzo) {
            // No debe quedar un proyecto a medio crear
            await crudProyecto.eliminarProyecto(nuevo.id, req.usuario_id);
            throw errorLienzo;
        }
    }
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