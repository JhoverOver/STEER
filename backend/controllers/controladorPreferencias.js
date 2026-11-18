const crudPreferencias = require('../models/crudPreferencias');
const { MAX_ATAJOS, LARGO_MAXIMO_ATAJO } = require('../config/limites');
const { errorHttp } = require('../middleware/errores');

// Valida los atajos: un objeto { accion: combinacion }
// Devuelve { atajos } limpio o { error }.
function validarAtajos(atajos) {
    if (!atajos || typeof atajos !== 'object' || Array.isArray(atajos)) {
        return { error: 'Los atajos deben enviarse como un objeto.' };
    }
    const acciones = Object.keys(atajos);
    if (acciones.length > MAX_ATAJOS) {
        return { error: `Se pueden personalizar hasta ${MAX_ATAJOS} atajos.` };
    }

    const limpios = {};
    const usadas = new Set();
    for (const accion of acciones) {
        const combinacion = typeof atajos[accion] === 'string' ? atajos[accion].trim() : '';
        if (!accion || accion.length > LARGO_MAXIMO_ATAJO) {
            return { error: `El nombre de la acción "${accion.slice(0, LARGO_MAXIMO_ATAJO)}" no es válido.` };
        }
        if (!combinacion || combinacion.length > LARGO_MAXIMO_ATAJO) {
            return { error: `La combinación de "${accion}" debe tener entre 1 y ${LARGO_MAXIMO_ATAJO} caracteres.` };
        }
        // Dos acciones no pueden usar la misma combinación
        const clave = combinacion.toLowerCase();
        if (usadas.has(clave)) {
            return { error: `La combinación "${combinacion}" está repetida.` };
        }
        usadas.add(clave);
        limpios[accion] = combinacion;
    }
    return { atajos: limpios };
}

// GET /atajos: solo los atajos que el usuario cambió (el navegador completa con los de fábrica)
async function obtenerAtajos(req, res) {
    return res.status(200).json({ atajos: await crudPreferencias.obtenerAtajos(req.usuario_id) });
}

// PUT /atajos
async function guardarAtajos(req, res) {
    const { atajos, error } = validarAtajos(req.body && req.body.atajos);
    if (error) throw errorHttp(400, error);
    await crudPreferencias.guardarAtajos(req.usuario_id, atajos);
    return res.status(200).json({ atajos });
}

module.exports = {
    obtenerAtajos,
    guardarAtajos,
};