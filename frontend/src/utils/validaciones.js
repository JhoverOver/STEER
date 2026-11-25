// Validaciones de los formularios. Cada función devuelve '' si el valor es válido o el mensaje de error.
import tlds from 'tlds';
import { LARGO_MINIMO_CONTRASENA, LARGO_MAXIMO_CONTRASENA } from '../config/limites';

const CAMPO_OBLIGATORIO_MSG = 'Este campo es obligatorio';
const MENSAJE_EMAIL = 'Ingresa un correo válido (nombre@dominio.com).';

const TLDS = new Set(tlds); // extensiones de dominio que existen (.com, .cl, ...)
const LARGO_MAXIMO_EMAIL = 254;
const FORMA_LOCAL = /^[A-Za-z0-9](?:[A-Za-z0-9._%+-]*[A-Za-z0-9])?$/;
const FORMA_ETIQUETA = /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/;
const CONTRASENAS_COMUNES = new Set([
    'password', 'password1', 'password123', 'contrasena', 'contrasena1', 'contrasena123',
    '12345678', '123456789', '1234567890', 'qwerty123', 'qwertyuiop', 'abc12345',
    'admin123', 'iloveyou', 'letmein1', 'welcome1', 'steer123', 'chile123',
]);

export function validarObligatorio(valor) {
    return valor.trim() ? '' : CAMPO_OBLIGATORIO_MSG;
}

// Inicio de sesión: solo revisa la forma básica, para no dejar fuera cuentas creadas antes de las reglas nuevas
export function validarEmail(valor) {
    if (!valor.trim()) return CAMPO_OBLIGATORIO_MSG;
    return /^\S+@\S+\.\S+$/.test(valor.trim()) ? '' : MENSAJE_EMAIL;
}

// Registro: forma completa y extensión de dominio real (las mismas reglas que valida el servidor)
export function validarEmailEstricto(valor) {
    const email = String(valor ?? '').trim();
    if (!email) return CAMPO_OBLIGATORIO_MSG;
    if (email.length > LARGO_MAXIMO_EMAIL) return MENSAJE_EMAIL;

    const partes = email.split('@');
    if (partes.length !== 2) return MENSAJE_EMAIL;
    const [local, dominio] = partes;
    if (!local || local.length > 64 || !FORMA_LOCAL.test(local) || local.includes('..')) return MENSAJE_EMAIL;

    const etiquetas = dominio.split('.');
    if (etiquetas.length < 2) return MENSAJE_EMAIL;
    if (!etiquetas.every((e) => e && e.length <= 63 && FORMA_ETIQUETA.test(e))) return MENSAJE_EMAIL;

    const tld = etiquetas[etiquetas.length - 1].toLowerCase();
    if (!TLDS.has(tld)) return `El dominio ".${tld}" no existe. Revisa que el correo esté bien escrito.`;
    return '';
}

export function validarContrasenaObligatoria(valor) {
    return valor ? '' : CAMPO_OBLIGATORIO_MSG;
}

// Registro: largo, mayúscula, minúscula y número, y que no sea una contraseña común
export function validarContrasenaSegura(valor) {
    const contrasena = String(valor ?? '');
    if (!contrasena) return CAMPO_OBLIGATORIO_MSG;
    if (contrasena.length < LARGO_MINIMO_CONTRASENA) {
        return `La contraseña debe tener al menos ${LARGO_MINIMO_CONTRASENA} caracteres.`;
    }
    if (new TextEncoder().encode(contrasena).length > LARGO_MAXIMO_CONTRASENA) {
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

export function validarConfirmacion(valor, contrasena) {
    if (!valor) return CAMPO_OBLIGATORIO_MSG;
    return valor === contrasena ? '' : 'Las contraseñas no coinciden';
}

export function hayErrores(errores) {
    return Object.values(errores).some(Boolean);
}
