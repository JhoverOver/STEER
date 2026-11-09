const express = require('express');
const router = express.Router();
const controladorProyecto = require('../controllers/controladorProyecto');
const authMiddleware = require('../middleware/authMiddleware');
const controladorArchivos = require('../controllers/controladorArchivos');
const { subirGIF, subirCapas } = require('../middleware/subirArchivo');
const controladorCapas = require('../controllers/controladorCapas');

router.use(authMiddleware.verificarToken);

router.post('/', controladorProyecto.crearProyecto);
router.get('/', controladorProyecto.obtenerProyectos);
router.get('/:id', controladorProyecto.obtenerProyecto);
router.put('/:id', controladorProyecto.actualizarProyecto);
router.delete('/:id', controladorProyecto.eliminarProyecto);
router.post('/:id/gif', subirGIF, controladorArchivos.subirGIF);
router.get('/:id/frames', controladorArchivos.obtenerFrames);
router.get('/:id/exportar/gif', controladorArchivos.exportarGIF);
router.get('/:id/exportar/mp4', controladorArchivos.exportarMP4);
router.put('/:id/frames', subirCapas, controladorArchivos. actualizarFrames);
router.get('/:id/frames/:frameId/capas', controladorCapas.obtenerCapas);

module.exports = router;