export const CAMPO_OBLIGATORIO_MSG = 'Este campo es obligatorio';

export function validarObligatorio(valor) {
    return valor.trim() ? '' : CAMPO_OBLIGATORIO_MSG;
}

export function validarEmail(valor) {
    if (!valor.trim()) return CAMPO_OBLIGATORIO_MSG;
    const formaValida = /^\S+@\S+\.\S+$/.test(valor.trim());
    return formaValida ? '' : 'Ingresa un correo válido (nombre@dominio.com).';
}

export function validarContrasenaObligatoria(valor) {
    return valor ? '' : CAMPO_OBLIGATORIO_MSG;
}

export function validarContrasenaNueva(valor, largoMinimo = 8) {
if (!valor) return CAMPO_OBLIGATORIO_MSG;
return valor.length >= largoMinimo ? '' : `La contraseña debe tener al menos ${largoMinimo} caracteres.`;
}

export function validarConfirmacion(valor, contrasena) {
    if (!valor) return CAMPO_OBLIGATORIO_MSG;
    return valor === contrasena ? '' : 'Las contraseñas no coinciden';
}

export function hayErrores(errores) {
    return Object.values(errores).some(Boolean);
}

export function enfocarPrimerError(errores, ids) {
    const clave = Object.keys(ids).find((k) => errores[k]);
    if (clave) document.getElementById(ids[clave])?.focus();
}