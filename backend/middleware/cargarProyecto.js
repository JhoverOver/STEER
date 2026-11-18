const crudProyecto = require('../models/crudProyecto');
const { errorHttp } = require('./errores');

// Para toda ruta /api/proyectos/:id/...: comprueba que el proyecto exista y sea del usuario de la sesión,
// y lo deja en req.proyecto. Así ningún controlador repite esa revisión.
async function cargarProyecto(req, res, next, valor) {
    const id = Number(valor);
    if (!Number.isInteger(id)) throw errorHttp(400, 'Identificador no válido');
    const proyecto = await crudProyecto.obtenerProyecto(id, req.usuario_id);
    if (!proyecto) throw errorHttp(404, 'Proyecto no encontrado');
    req.proyecto = proyecto;
    next();
}

module.exports = { cargarProyecto };