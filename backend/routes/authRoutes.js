const express = require('express');
const controladorAuth = require('../controllers/controladorAuth');

const router = express.Router();

router.post('/registrar', controladorAuth.registrar);
router.post('/iniciar-sesion', controladorAuth.iniciarSesion);
router.post('/verificar', controladorAuth.verificar);
router.post('/reenviar-codigo', controladorAuth.reenviarCodigo);

module.exports = router;