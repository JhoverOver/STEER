const express = require('express');
const controladorAuth = require('../controllers/controladorAuth');

const router = express.Router();

router.post('/registrar', controladorAuth.registrar);
router.post('/iniciar-sesion', controladorAuth.iniciarSesion);

module.exports = router;