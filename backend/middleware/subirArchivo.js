const multer = require('multer');

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE, files: 1 },
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
            return res.status(413).json({ error: 'El archivo excede el tamaño máximo permitido (10 MB)' });
        }
        res.status(400).json({ error: 'Error al subir el archivo' });
    });
}

module.exports = subirArchivo;