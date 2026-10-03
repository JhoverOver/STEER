const express = require('express');
const router = express.Router();
const controladorProyecto = require('../controllers/controladorProyecto');
const authMiddleware = require('../middleware/authMiddleware');
const controladorArchivos = require('../controllers/controladorArchivos');
const subirArchivo = require('../middleware/subirArchivo');


router.use(authMiddleware.verificarToken);

router.post('/', controladorProyecto.crearProyecto);
router.get('/', controladorProyecto.obtenerProyectos);
router.get('/:id', controladorProyecto.obtenerProyecto);
router.put('/:id', controladorProyecto.actualizarProyecto);
router.delete('/:id', controladorProyecto.eliminarProyecto);
router.post('/:id/gif', subirArchivo, controladorArchivos.subirGIF);
router.get('/:id/frames', controladorArchivos.obtenerFrames);
router.get('/:id/exportar/gif', controladorArchivos.exportarGIF);
router.get('/:id/exportar/mp4', controladorArchivos.exportarMP4);

module.exports = router;