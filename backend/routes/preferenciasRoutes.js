const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const controladorPreferencias = require('../controllers/controladorPreferencias');

router.use(authMiddleware.verificarToken);

router.get('/', controladorPreferencias.obtenerPreferencias);
router.put('/', controladorPreferencias.guardarPreferencias);

module.exports = router;
