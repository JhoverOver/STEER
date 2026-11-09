const express = require('express');
const router = express.Router();
const controladorPreferencias = require('../controllers/controladorPreferencias');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware.verificarToken);

router.get('/atajos', controladorPreferencias.obtenerAtajos);
router.put('/atajos', controladorPreferencias.guardarAtajos);

module.exports = router;
