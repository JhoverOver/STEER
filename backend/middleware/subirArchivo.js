const multer = require('multer');
const { MAX_MB, MAX_FRAMES, MAX_CAPAS } = require('../config/limites');

// Sube UN GIF en el campo "archivo"
const recibirGIF = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_MB * 1024 * 1024, files: 1 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype !== 'image/gif') {
            return cb(new Error('Solo se permiten archivos GIF'));
        }
        cb(null, true);
    },
}).single('archivo');

// Subir PNG de las capas modificadas al guardar.
const recibirCapas = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_MB * 1024 * 1024, files: MAX_FRAMES * MAX_CAPAS },
    fileFilter: (req, file, cb) => {
        if (file.mimetype !== 'image/png') {
            return cb(new Error('Las capas deben ser imágenes PNG'));
        }
        cb(null, true);
    },
}).any();

// Envuelve un multer para responder con JSON en vez de dejar pasar el error
function conRespuestaDeError(recibir) {
    return (req, res, next) => {
        recibir(req, res, (err) => {
            if (!err) return next();
            if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
                return res.status(413).json({ error: `El archivo excede el tamaño máximo permitido (${MAX_MB} MB)` });
            }
            if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_COUNT') {
                return res.status(400).json({ error: 'Se enviaron demasiados archivos' });
            }
            if (!(err instanceof multer.MulterError)) {
                return res.status(400).json({ error: err.message });
            }
            res.status(400).json({ error: 'Error al subir el archivo' });
        });
    };
}

module.exports = {
    subirGIF: conRespuestaDeError(recibirGIF),
    subirCapas: conRespuestaDeError(recibirCapas),
};
