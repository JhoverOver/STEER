const express = require('express');
const router = express.Router();
const controladorAuth = require('../controllers/controladorAuth');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/perfil', authMiddleware.verificarToken, (req, res) => {
    res.json({ message: 'Acceso permitido al perfil del usuario', usuario_id: req.usuario_id });
});
router.post('/registrar', controladorAuth.registrar);
router.post('/iniciar-sesion', controladorAuth.iniciarSesion);
router.post('/cerrar-sesion', controladorAuth.cerrarSesion);

module.exports = router;