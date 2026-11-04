const PALETA = require('../config/paleta');
const { MAX_ETIQUETAS, LARGO_MAXIMO_ETIQUETA } = require('../config/limites');

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

module.exports = { validarEtiquetas, validarColor };
