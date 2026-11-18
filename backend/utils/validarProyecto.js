const PALETA = require('../config/paleta');
const { MAX_ETIQUETAS, LARGO_MAXIMO_ETIQUETA, LARGO_MAXIMO_NOMBRE } = require('../config/limites');

// Devuelve { valor } si está bien, o { error } con el motivo. `undefined` significa "no viene en la petición".
function validarEtiquetas(entrada) {
    if (entrada === undefined) return { valor: undefined };
    if (entrada === null) return { valor: [] };
    if (!Array.isArray(entrada)) return { error: 'Las etiquetas deben enviarse como una lista.' };
    if (entrada.length > MAX_ETIQUETAS) return { error: `Un proyecto admite como máximo ${MAX_ETIQUETAS} etiquetas.` };
    const limpias = [];
    for (const original of entrada) {
        if (typeof original !== 'string') return { error: 'Cada etiqueta debe ser un texto.' };
        const etiqueta = original.trim();
        if (!etiqueta) return { error: 'Las etiquetas no pueden estar vacías.' };
        if (etiqueta.length > LARGO_MAXIMO_ETIQUETA) {
            return { error: `Cada etiqueta puede tener como máximo ${LARGO_MAXIMO_ETIQUETA} caracteres.` };
        }
        if (limpias.some((e) => e.toLowerCase() === etiqueta.toLowerCase())) {
            return { error: `La etiqueta "${etiqueta}" está repetida.` };
        }
        limpias.push(etiqueta);
    }
    return { valor: limpias };
}

function validarColor(entrada) {
    if (entrada === undefined) return { valor: undefined };
    if (entrada === null || entrada === '') return { valor: null };
    if (!PALETA.includes(entrada)) return { error: `El color debe ser uno de: ${PALETA.join(', ')}.` };
    return { valor: entrada };
}

function validarDatosProyecto(cuerpo = {}, esNuevo) {
    const { nombre, descripcion } = cuerpo;
    if (esNuevo || nombre !== undefined) {
        if (typeof nombre !== 'string' || !nombre.trim()) return { error: 'El nombre del proyecto es obligatorio.' };
        if (nombre.trim().length > LARGO_MAXIMO_NOMBRE) {
            return { error: `El nombre puede tener como máximo ${LARGO_MAXIMO_NOMBRE} caracteres.` };
        }
    }
    if (descripcion !== undefined && descripcion !== null && typeof descripcion !== 'string') {
        return { error: 'La descripción debe ser un texto.' };
    }
    const etiquetas = validarEtiquetas(cuerpo.etiquetas);
    if (etiquetas.error) return etiquetas;
    const color = validarColor(cuerpo.color);
    if (color.error) return color;
    return {
        datos: {
            nombre: nombre === undefined ? undefined : nombre.trim(),
            descripcion,
            etiquetas: etiquetas.valor,
            color: color.valor,
        },
    };
}

module.exports = { validarDatosProyecto };
