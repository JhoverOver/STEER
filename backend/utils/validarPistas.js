const {
    MAX_PISTAS,
    MAX_KEYFRAMES,
    MAXIMO_NOMBRE_CAPA,
    MAX_FRAMES,
    DURACION_MAXIMA,
    LADO_MAXIMO,
    FACTOR_AREA_TRABAJO,
} = require('../config/limites');

// Validación de las pistas de keyframes que envía el navegador al guardar (junto con la lista de frames).
// Solo revisa la forma de los datos; que una pista guardada sea del proyecto lo revisa crudPistas.

const LARGO_MAXIMO_CLAVE = 40;
const CURVAS = ['lineal', 'suave'];
const DESPLAZAMIENTO_MAXIMO = LADO_MAXIMO * FACTOR_AREA_TRABAJO;
// Valores de un keyframe: todos enteros, dentro de estos rangos
const RANGOS = {
    tiempo: [0, MAX_FRAMES * DURACION_MAXIMA], // ms
    x: [-DESPLAZAMIENTO_MAXIMO, DESPLAZAMIENTO_MAXIMO], // px que se mueve desde donde estaba
    y: [-DESPLAZAMIENTO_MAXIMO, DESPLAZAMIENTO_MAXIMO],
    escala: [1, 1000], // %
    rotacion: [-3600, 3600], // grados
    opacidad: [0, 100], // %
};

// Las pistas llegan como texto JSON en el campo "pistas" (junto a los PNG) o como arreglo en { pistas: [...] }.
// Si no llegan, devuelve undefined: las pistas guardadas no se tocan.
function leerPistas(req) {
    const cuerpo = req.body || {};
    if (typeof cuerpo.pistas === 'string') {
        try {
            return JSON.parse(cuerpo.pistas);
        } catch {
            return null;
        }
    }
    return cuerpo.pistas;
}

function validarKeyframes(keyframes, etiqueta) {
    if (!Array.isArray(keyframes) || keyframes.length < 1 || keyframes.length > MAX_KEYFRAMES) {
        return { error: `${etiqueta} debe tener entre 1 y ${MAX_KEYFRAMES} keyframes.` };
    }
    const limpios = [];
    for (let k = 0; k < keyframes.length; k++) {
        const keyframe = keyframes[k];
        const nombre = `El keyframe ${k + 1} de ${etiqueta.toLowerCase()}`;
        if (!keyframe || typeof keyframe !== 'object') return { error: `${nombre} no es válido.` };
        const limpio = {};
        for (const [campo, [minimo, maximo]] of Object.entries(RANGOS)) {
            const valor = keyframe[campo];
            if (!Number.isInteger(valor) || valor < minimo || valor > maximo) {
                return { error: `${nombre}: "${campo}" debe ser un número entero entre ${minimo} y ${maximo}.` };
            }
            limpio[campo] = valor;
        }
        if (!CURVAS.includes(keyframe.curva)) {
            return { error: `${nombre}: la curva debe ser "lineal" o "suave".` };
        }
        limpio.curva = keyframe.curva;
        limpios.push(limpio);
    }
    limpios.sort((a, b) => a.tiempo - b.tiempo);
    if (limpios.some((keyframe, k) => k > 0 && keyframe.tiempo === limpios[k - 1].tiempo)) {
        return { error: `${etiqueta} tiene dos keyframes en el mismo momento.` };
    }
    return { keyframes: limpios };
}

// Devuelve { pistas } limpias o { error }
function validarPistas(crudo) {
    if (!Array.isArray(crudo)) return { error: 'La lista de pistas no es válida.' };
    if (crudo.length > MAX_PISTAS) return { error: `Un proyecto admite como máximo ${MAX_PISTAS} pistas.` };

    const limpias = [];
    const claves = new Set();
    for (let i = 0; i < crudo.length; i++) {
        const pista = crudo[i];
        const etiqueta = `La pista ${i + 1}`;
        if (!pista || typeof pista !== 'object') return { error: `${etiqueta} no es válida.` };

        const { clave } = pista;
        if (typeof clave !== 'string' || !clave || clave.length > LARGO_MAXIMO_CLAVE || claves.has(clave)) {
            return { error: `${etiqueta} no tiene una clave válida.` };
        }
        claves.add(clave);

        const nombre = typeof pista.nombre === 'string' ? pista.nombre.trim() : '';
        if (!nombre || nombre.length > MAXIMO_NOMBRE_CAPA) {
            return { error: `${etiqueta} debe tener un nombre de 1 a ${MAXIMO_NOMBRE_CAPA} caracteres.` };
        }

        // Una pista guardada se indica por su id; una nueva trae el PNG de su imagen como archivo
        const tieneId = pista.id !== undefined;
        const tieneArchivo = pista.archivo !== undefined;
        if (tieneId === tieneArchivo) return { error: `${etiqueta} debe indicar "id" o "archivo".` };
        if (tieneId && !Number.isInteger(pista.id)) return { error: `El "id" de ${etiqueta.toLowerCase()} no es válido.` };
        if (tieneArchivo && (typeof pista.archivo !== 'string' || !pista.archivo)) {
            return { error: `El "archivo" de ${etiqueta.toLowerCase()} no es válido.` };
        }

        const resultado = validarKeyframes(pista.keyframes, etiqueta);
        if (resultado.error) return resultado;

        limpias.push(tieneId
            ? { clave, id: pista.id, nombre, keyframes: resultado.keyframes }
            : { clave, archivo: pista.archivo, nombre, keyframes: resultado.keyframes });
    }
    return { pistas: limpias };
}

module.exports = { leerPistas, validarPistas };