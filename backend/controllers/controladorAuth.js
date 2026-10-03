const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crudUsuario = require('../models/crudUsuario');

const SALT_ROUNDS = 12;

async function registrar(req, res) {
    const {nombre, email, contrasena} = req.body;

    if (!nombre || !email || !contrasena) {
        return res.status(400).json({error:'Todos los campos son obligatorios.'})
    }
    if (contrasena.length < 8) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.'})
    }
    try {
        const existente = await crudUsuario.filtrarMail(email);
        if (existente) {
            return res.status(409).json({error: 'Ya existe una cuenta con ese mail.'});
        }

    const hash = await bcrypt.hash(contrasena, SALT_ROUNDS);
    const nuevoUsuario = await crudUsuario.crearUsuario(nombre, email, hash);

    return res.status(201).json({
        id: nuevoUsuario.id,
        nombre: nuevoUsuario.nombre,
        email: nuevoUsuario.email
    });

    } catch (error) {
        console.error('Error al registrar:', error);
        return res.status(500).json({error: 'Error interno al registrar el usuario.'});
    }
}

async function iniciarSesion(req, res) {
    const {email, contrasena} = req.body;

    if(!email || !contrasena) {
        return res.status(400).json ({ error: 'Ambos campos son obligatorios.'});
    }
    try {
        const usuario = await crudUsuario.filtrarMail(email);
        if (!usuario) {
            return res.status(401).json({ error: 'El email o contraseña es incorrecto.'});
        }

        const check = await bcrypt.compare(contrasena, usuario.contrasena);
        if (!check) {
            return res.status(401).json({ error: 'El email o contraseña es incorrecto.'})
        }

        const token =jwt.sign(
            {usuario_id: usuario.id},
            process.env.JWT_SECRET,
            { expiresIn: '2h' }
        );
        return res.status(200).json({
            token,
            usuario: {id:usuario.id, nombre: usuario.nombre, email:usuario.email }
        });
    } catch (error) {
        console.error('Error al iniciarSesion:', error);
        return res.status(500).json ({error: 'Error interno al iniciar sesión.'});
    }
}

async function cerrarSesion(req, res) {
    return res.status(200).json({ mensaje: 'Sesión cerrada correctamente.' });
}

module.exports = {
    registrar, 
    iniciarSesion, 
    cerrarSesion
};