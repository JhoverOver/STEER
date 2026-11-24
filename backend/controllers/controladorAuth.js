const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crudUsuario = require('../models/crudUsuario');
const { validarEmail, validarContrasena } = require('../utils/validarCredenciales');
const { validarCorreoReal } = require('../utils/validarCorreoReal');
const { enviarCodigoVerificacion } = require('../services/correo');
const { errorHttp } = require('../middleware/errores');

const SALT_ROUNDS = 12;
const SALT_ROUNDS_CODIGO = 8; // el código vence en minutos y tiene pocos intentos: no necesita tanto costo
const MINUTOS_CODIGO = 15; // vigencia de un código de verificación
const MAX_INTENTOS_CODIGO = 5; // después hay que pedir uno nuevo
const SEGUNDOS_ENTRE_ENVIOS = 60; // espera mínima para pedir otro código

const FORMA_CODIGO = /^\d{6}$/;
const MENSAJE_NO_VERIFICADA = 'Tu correo aún no está verificado. Ingresa el código que te enviamos.';

function crearToken(usuario) {
    return jwt.sign({ usuario_id: usuario.id }, process.env.JWT_SECRET, { expiresIn: '2h' });
}

function respuestaSesion(usuario) {
    return { token: crearToken(usuario), usuario: { id: usuario.id, email: usuario.email } };
}

// Genera un código de 6 dígitos, guarda su hash y lo envía por correo
async function enviarCodigoNuevo(usuario) {
    const codigo = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    await crudUsuario.guardarCodigo(usuario.id, await bcrypt.hash(codigo, SALT_ROUNDS_CODIGO), MINUTOS_CODIGO);
    await enviarCodigoVerificacion(usuario.email, codigo, MINUTOS_CODIGO);
}

// POST /registrar  { email, contrasena }
// Crea la cuenta sin verificar y envía un código al correo. Si el correo ya tiene una cuenta sin verificar
// (por ejemplo, el código nunca llegó), se actualiza su contraseña y se envía un código nuevo.
async function registrar(req, res) {
    const { email, contrasena } = req.body;
    if (!email || !contrasena) throw errorHttp(400, 'Todos los campos son obligatorios.');
    const errorDatos = validarEmail(email) || validarContrasena(contrasena);
    if (errorDatos) throw errorHttp(400, errorDatos);
    const correo = String(email).trim();
    const errorCorreo = await validarCorreoReal(correo);
    if (errorCorreo) throw errorHttp(400, errorCorreo);

    const existente = await crudUsuario.filtrarMail(correo);
    if (existente && existente.verificado) throw errorHttp(409, 'Ya existe una cuenta con ese mail.');

    const hash = await bcrypt.hash(contrasena, SALT_ROUNDS);
    if (existente) {
        await crudUsuario.actualizarContrasena(existente.id, hash);
        // Si se acaba de enviar un código, se reutiliza (evita enviar varios correos con doble clic)
        if (existente.segundos_desde_envio === null || existente.segundos_desde_envio >= SEGUNDOS_ENTRE_ENVIOS) {
            await enviarCodigoNuevo(existente);
        }
        return res.status(201).json({ email: existente.email, verificacion: true });
    }

    const nuevo = await crudUsuario.crearUsuario(correo, hash);
    await enviarCodigoNuevo(nuevo);
    return res.status(201).json({ email: nuevo.email, verificacion: true });
}

// POST /verificar  { email, codigo }
// Si el código es correcto activa la cuenta y deja la sesión iniciada (devuelve el token, como iniciar sesión).
async function verificar(req, res) {
    const { email, codigo } = req.body;
    const texto = String(codigo ?? '').trim();
    if (!email || !FORMA_CODIGO.test(texto)) throw errorHttp(400, 'Ingresa el código de 6 dígitos que te enviamos.');

    const usuario = await crudUsuario.filtrarMail(String(email).trim());
    // Mismo mensaje si el correo no existe: no se revela qué correos tienen cuenta
    if (!usuario || (!usuario.verificado && !usuario.codigo_hash)) throw errorHttp(400, 'El código no es válido. Pide uno nuevo.');
    if (usuario.verificado) throw errorHttp(409, 'Esta cuenta ya está verificada. Inicia sesión.');
    if (usuario.codigo_intentos >= MAX_INTENTOS_CODIGO) {
        throw errorHttp(429, 'Ingresaste un código incorrecto demasiadas veces. Pide uno nuevo.');
    }
    if (!usuario.codigo_vigente) throw errorHttp(400, 'El código venció. Pide uno nuevo.');

    if (!(await bcrypt.compare(texto, usuario.codigo_hash))) {
        await crudUsuario.sumarIntentoFallido(usuario.id);
        const quedan = MAX_INTENTOS_CODIGO - usuario.codigo_intentos - 1;
        throw errorHttp(400, quedan > 0
            ? `El código no es correcto. Te quedan ${quedan} intento(s).`
            : 'El código no es correcto. Pide uno nuevo.');
    }
    await crudUsuario.marcarVerificado(usuario.id);
    return res.status(200).json(respuestaSesion(usuario));
}

// POST /reenviar-codigo  { email }
// Responde lo mismo si el correo no tiene cuenta o ya está verificada: no se revela qué correos existen.
async function reenviarCodigo(req, res) {
    const { email } = req.body;
    if (!email) throw errorHttp(400, 'El correo es obligatorio.');
    const usuario = await crudUsuario.filtrarMail(String(email).trim());
    if (usuario && !usuario.verificado) {
        const pasaron = usuario.segundos_desde_envio;
        if (pasaron !== null && pasaron < SEGUNDOS_ENTRE_ENVIOS) {
                        const faltan = SEGUNDOS_ENTRE_ENVIOS - pasaron;
            throw errorHttp(429, `Espera ${faltan} s para pedir otro código.`, { espera: faltan });
        }
        await enviarCodigoNuevo(usuario);
    }
    return res.status(200).json({ mensaje: 'Si el correo tiene una cuenta sin verificar, te enviamos un código nuevo.' });
}

// POST /iniciar-sesion
async function iniciarSesion(req, res) {
    const { email, contrasena } = req.body;
    if (!email || !contrasena) throw errorHttp(400, 'Ambos campos son obligatorios.');

    // Mismo mensaje si el mail no existe o la contraseña no calza: no se revela qué mails tienen cuenta
    const usuario = await crudUsuario.filtrarMail(String(email).trim());
    if (!usuario || !(await bcrypt.compare(contrasena, usuario.contrasena))) {
        throw errorHttp(401, 'El email o contraseña es incorrecto.');
    }
    // La contraseña es correcta pero falta verificar: el frontend lleva a la página del código ("verificar": true)
    if (!usuario.verificado) throw errorHttp(403, MENSAJE_NO_VERIFICADA, { verificar: true });

    return res.status(200).json(respuestaSesion(usuario));
}

module.exports = {
    registrar,
    verificar,
    reenviarCodigo,
    iniciarSesion,
    MAX_INTENTOS_CODIGO,
};