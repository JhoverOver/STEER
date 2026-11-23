const multer = require('multer');
const { MAX_MB, MAX_FRAMES, MAX_CAPAS } = require('../config/limites');
const { errorHttp } = require('./errores');

// Los errores de multer (tamaño, cantidad, tipo) los responde middleware/errores.js

// Tipos que se pueden importar como frames (el contenido real lo revisa procesadorFrames.descomponerArchivo)
const TIPOS_IMPORTABLES = ['image/gif', 'image/png', 'image/jpeg', 'image/webp'];

// Sube UN archivo (GIF, PNG, JPG o WEBP) en el campo "archivo". El campo de texto "modo" llega en req.body
const subirArchivo = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_MB * 1024 * 1024, files: 1 },
    fileFilter: (req, file, cb) => {
        if (!TIPOS_IMPORTABLES.includes(file.mimetype)) return cb(errorHttp(400, 'Solo se permiten archivos GIF, PNG, JPG o WEBP'));
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

module.exports = { subirArchivo, subirCapas };