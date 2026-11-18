const multer = require('multer');
const { MAX_MB, MAX_FRAMES, MAX_CAPAS } = require('../config/limites');
const { errorHttp } = require('./errores');

// Los errores de multer (tamaño, cantidad, tipo) los responde middleware/errores.js

// Sube UN GIF en el campo "archivo"
const subirGIF = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_MB * 1024 * 1024, files: 1 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype !== 'image/gif') return cb(errorHttp(400, 'Solo se permiten archivos GIF'));
        cb(null, true);
    },
}).single('archivo');

// Sube los PNG de las capas modificadas al guardar
const subirCapas = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_MB * 1024 * 1024, files: MAX_FRAMES * MAX_CAPAS },
    fileFilter: (req, file, cb) => {
        if (file.mimetype !== 'image/png') return cb(errorHttp(400, 'Las capas deben ser imágenes PNG'));
        cb(null, true);
    },
}).any();

module.exports = { subirGIF, subirCapas };