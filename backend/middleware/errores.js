const multer = require('multer');
const { MAX_MB } = require('../config/limites');

// Error con el código HTTP que se le debe responder al usuario (400, 404...) y un mensaje para mostrarle.
// Se lanza con throw desde cualquier controlador o servicio; lo responde manejarErrores.
// "datos" (opcional) son campos extra para la respuesta, por ejemplo { verificar: true }.
function errorHttp(estado, mensaje, datos = null) {
    const error = new Error(mensaje);
    error.estado = estado;
    error.datos = datos;
    return error;
}

// Último middleware de la aplicación. Express 5 trae aquí cualquier error, también los de funciones async,
// así los controladores no necesitan try/catch para responder 500.
// eslint-disable-next-line no-unused-vars
function manejarErrores(error, req, res, next) {
    if (error.estado) {
        return res.status(error.estado).json({ ...(error.datos || {}), error: error.message });
    }
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ error: `El archivo excede el tamaño máximo permitido (${MAX_MB} MB)` });
        }
        if (error.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({ error: 'Se enviaron demasiados archivos' });
        }
        return res.status(400).json({ error: 'Error al subir el archivo' });
    }
    if (error.type === 'entity.parse.failed') {
        return res.status(400).json({ error: 'Los datos enviados no son un JSON válido.' });
    }
    console.error(`Error en ${req.method} ${req.originalUrl}:`, error);
    return res.status(500).json({ error: 'Error interno del servidor' });
}

module.exports = { errorHttp, manejarErrores };