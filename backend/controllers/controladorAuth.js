const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crudUsuario = require('../models/crudUsuario');
const { validarEmail, validarContrasena } = require('../utils/validarCredenciales');
const { errorHttp } = require('../middleware/errores');

const SALT_ROUNDS = 12;

// POST /registrar
async function registrar(req, res) {
    const { nombre, email, contrasena } = req.body;
    if (!nombre || !email || !contrasena) throw errorHttp(400, 'Todos los campos son obligatorios.');
    const errorDatos = validarEmail(email) || validarContrasena(contrasena);
    if (errorDatos) throw errorHttp(400, errorDatos);
    if (await crudUsuario.filtrarMail(email)) throw errorHttp(409, 'Ya existe una cuenta con ese mail.');

    const hash = await bcrypt.hash(contrasena, SALT_ROUNDS);
    const nuevoUsuario = await crudUsuario.crearUsuario(nombre, email, hash);
    return res.status(201).json({ id: nuevoUsuario.id, nombre: nuevoUsuario.nombre, email: nuevoUsuario.email });
}

// POST /iniciar-sesion
async function iniciarSesion(req, res) {
    const { email, contrasena } = req.body;
    if (!email || !contrasena) throw errorHttp(400, 'Ambos campos son obligatorios.');

    // Mismo mensaje si el mail no existe o la contraseña no calza: no se revela qué mails tienen cuenta
    const usuario = await crudUsuario.filtrarMail(email);
    if (!usuario || !(await bcrypt.compare(contrasena, usuario.contrasena))) {
        throw errorHttp(401, 'El email o contraseña es incorrecto.');
    }

    const token = jwt.sign({ usuario_id: usuario.id }, process.env.JWT_SECRET, { expiresIn: '2h' });
    return res.status(200).json({
        token,
        usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email },
    });
}

module.exports = {
    registrar,
    iniciarSesion,
};