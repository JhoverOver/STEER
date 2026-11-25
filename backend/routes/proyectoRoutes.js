const express = require('express');
const { verificarToken } = require('../middleware/authMiddleware');
const { cargarProyecto } = require('../middleware/cargarProyecto');
const { subirArchivo, subirCapas } = require('../middleware/subirArchivo');
const controladorProyecto = require('../controllers/controladorProyecto');
const controladorFrames = require('../controllers/controladorFrames');

const router = express.Router();

router.use(verificarToken);
// Cada vez que una ruta tiene :id, primero se carga el proyecto (y se revisa que sea del usuario)
router.param('id', cargarProyecto);

router.post('/', controladorProyecto.crearProyecto);
router.get('/', controladorProyecto.obtenerProyectos);
router.get('/:id', controladorProyecto.obtenerProyecto);
router.put('/:id', controladorProyecto.actualizarProyecto);
router.delete('/:id', controladorProyecto.eliminarProyecto);

router.post('/:id/importar', subirArchivo, controladorFrames.importarArchivo);
router.get('/:id/frames', controladorFrames.obtenerFrames);
router.put('/:id/frames', subirCapas, controladorFrames.guardarFrames);
router.post('/:id/frames/vacio', controladorFrames.crearFrameVacio);
router.put('/:id/lienzo', controladorFrames.cambiarLienzo);
router.get('/:id/frames/:frameId/capas', controladorFrames.obtenerCapas);
router.get('/:id/exportar/gif', controladorFrames.exportarGIF);
router.get('/:id/exportar/mp4', controladorFrames.exportarMP4);

module.exports = router;