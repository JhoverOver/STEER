const TLDS = new Set(require('tlds'));

const { LARGO_MINIMO_CONTRASENA, LARGO_MAXIMO_CONTRASENA } = require('../config/limites');
const LARGO_MAXIMO_EMAIL = 254;

const CONTRASENAS_COMUNES = new Set([
    'password', 'password1', 'password123', 'contrasena', 'contrasena1', 'contrasena123',
    '12345678', '123456789', '1234567890', 'qwerty123', 'qwertyuiop', 'abc12345',
    'admin123', 'iloveyou', 'letmein1', 'welcome1', 'steer123', 'chile123',
]);

const FORMA_LOCAL = /^[A-Za-z0-9](?:[A-Za-z0-9._%+-]*[A-Za-z0-9])?$/;
const FORMA_ETIQUETA = /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/;

const MENSAJE_EMAIL = 'Ingresa un correo válido (nombre@dominio.com).';

// Devuelve '' si el correo es válido o un mensaje de error.
function validarEmail(valor) {
    const email = String(valor ?? '').trim();
    if (!email) return 'El correo es obligatorio.';
    if (email.length > LARGO_MAXIMO_EMAIL) return MENSAJE_EMAIL;

    const partes = email.split('@');
    if (partes.length !== 2) return MENSAJE_EMAIL;
    const [local, dominio] = partes;

    if (!local || local.length > 64 || !FORMA_LOCAL.test(local) || local.includes('..')) {
        return MENSAJE_EMAIL;
    }

    const etiquetas = dominio.split('.');
    if (etiquetas.length < 2) return MENSAJE_EMAIL;
    if (!etiquetas.every((e) => e && e.length <= 63 && FORMA_ETIQUETA.test(e))) return MENSAJE_EMAIL;

    const tld = etiquetas[etiquetas.length - 1].toLowerCase();
    if (!TLDS.has(tld)) return `El dominio ".${tld}" no existe. Revisa que el correo esté bien escrito.`;

    return '';
}

// Devuelve '' si la contraseña cumple las reglas o un mensaje de error.
function validarContrasena(valor) {
    const contrasena = String(valor ?? '');
    if (!contrasena) return 'La contraseña es obligatoria.';
    if (contrasena.length < LARGO_MINIMO_CONTRASENA) {
        return `La contraseña debe tener al menos ${LARGO_MINIMO_CONTRASENA} caracteres.`;
    }
    if (Buffer.byteLength(contrasena, 'utf8') > LARGO_MAXIMO_CONTRASENA) {
        return `La contraseña no puede superar ${LARGO_MAXIMO_CONTRASENA} caracteres.`;
    }
    if (!/[a-z]/.test(contrasena) || !/[A-Z]/.test(contrasena) || !/[0-9]/.test(contrasena)) {
        return 'La contraseña debe incluir una mayúscula, una minúscula y un número.';
    }
    if (CONTRASENAS_COMUNES.has(contrasena.toLowerCase())) {
        return 'Esa contraseña es demasiado común. Elige otra.';
    }
    return '';
}

module.exports = {
    validarEmail,
    validarContrasena,
};