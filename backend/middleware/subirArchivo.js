const multer = require('multer');
const { MAX_MB } = require('../config/limites');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_MB * 1024 * 1024, files: 1 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype !== 'image/gif') {
            return cb(new Error('Solo se permiten archivos GIF'));
        }
        cb(null, true);
    },
}).single('archivo');

function subirArchivo(req, res, next) {
    upload(req, res, (err) => {
        if (!err) return next();
        if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ error: `El archivo excede el tamaño máximo permitido (${MAX_MB} MB)` });
        }
        if (!(err instanceof multer.MulterError)) {
            return res.status(400).json({ error: err.message });
        }
        res.status(400).json({ error: 'Error al subir el archivo' });
    });
}

module.exports = subirArchivo;
