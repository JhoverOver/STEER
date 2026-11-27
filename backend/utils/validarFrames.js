const {
    MAX_FRAMES,
    DURACION_MINIMA,
    DURACION_MAXIMA,
    MAX_CAPAS,
    MAXIMO_NOMBRE_CAPA,
} = require('../config/limites');
const { validarForma } = require('./validarForma');

const NOMBRE_FORMA = { texto: 'El texto', rectangulo: 'El rectángulo' };

// Validación de la lista de frames que envía el navegador al guardar (PUT /api/proyectos/:id/frames).
// Solo revisa la forma de los datos; que los frames y capas existan lo revisa el controlador.

// Lista de frames: llega como texto JSON en el campo "lista" (junto a los PNG) o como JSON { frames: [...] }
function leerLista(req) {
    const cuerpo = req.body || {};
    if (typeof cuerpo.lista === 'string') {
        try {
            return JSON.parse(cuerpo.lista);
        } catch {
            return null;
        }
    }
    return cuerpo.frames;
}

// Valida las capas de un solo frame: forma, nombre y banderas. Devuelve { capas } o { error }.
// "clavesPistas" son las claves de las pistas que se guardan junto con los frames: una capa generada
// por una pista la indica en "pista".
function validarCapas(capas, numero, tieneOrigen, clavesPistas) {
    if (!Array.isArray(capas) || capas.length < 1 || capas.length > MAX_CAPAS) {
        return { error: `El frame ${numero} debe tener entre 1 y ${MAX_CAPAS} capas.` };
    }
    const limpias = [];
    for (let j = 0; j < capas.length; j++) {
        const capa = capas[j];
        const etiqueta = `La capa ${j + 1} del frame ${numero}`;
        if (!capa || typeof capa !== 'object') {
            return { error: `${etiqueta} no es válida.` };
        }
        const nombre = typeof capa.nombre === 'string' ? capa.nombre.trim() : '';
        if (!nombre || nombre.length > MAXIMO_NOMBRE_CAPA) {
            return { error: `${etiqueta} debe tener un nombre de 1 a ${MAXIMO_NOMBRE_CAPA} caracteres.` };
        }
        if (typeof capa.visible !== 'boolean' || typeof capa.bloqueada !== 'boolean') {
            return { error: `${etiqueta} debe indicar si está visible y si está bloqueada.` };
        }
        const tieneId = capa.id !== undefined;
        const tieneArchivo = capa.archivo !== undefined;
        if (tieneId === tieneArchivo) {
            return { error: `${etiqueta} debe indicar "id" o "archivo".` };
        }
        // Una capa con "id" es una capa ya guardada: solo existe si el frame viene de otro frame guardado
        if (tieneId && (!Number.isInteger(capa.id) || !tieneOrigen)) {
            return { error: `El "id" de ${etiqueta.toLowerCase()} no es válido.` };
        }
        if (tieneArchivo && (typeof capa.archivo !== 'string' || !capa.archivo)) {
            return { error: `El "archivo" de ${etiqueta.toLowerCase()} no es válido.` };
        }
        if (capa.pista !== undefined && !clavesPistas.has(capa.pista)) {
            return { error: `${etiqueta} indica una pista que no está en la lista de pistas.` };
        }
        const limpia = tieneId
            ? { nombre, visible: capa.visible, bloqueada: capa.bloqueada, id: capa.id }
            : { nombre, visible: capa.visible, bloqueada: capa.bloqueada, archivo: capa.archivo };
        if (capa.pista !== undefined) limpia.pista = capa.pista;
        const forma = validarForma(capa.forma);
        if (forma.error) {
            return { error: `${NOMBRE_FORMA[capa.forma?.tipo] || 'La forma'} de ${etiqueta.toLowerCase()} ${forma.error}` };
        }
        if (forma.valor !== undefined) limpia.forma = forma.valor;
        limpias.push(limpia);
    }
    return { capas: limpias };
}

function validarListaFrames(crudo, clavesPistas = new Set()) {
    if (!Array.isArray(crudo)) {
        return { error: 'Debes enviar la lista de frames.' };
    }
    if (crudo.length > MAX_FRAMES) {
        return { error: `La lista tiene ${crudo.length} frames y el máximo permitido es ${MAX_FRAMES}` };
    }

    const limpia = [];
    for (let i = 0; i < crudo.length; i++) {
        const frame = crudo[i];
        const numero = i + 1;
        if (!frame || typeof frame !== 'object') {
            return { error: `El frame ${numero} no es válido.` };
        }
        const { duracion, origen_id, capas } = frame;
        if (!Number.isInteger(duracion) || duracion < DURACION_MINIMA || duracion > DURACION_MAXIMA) {
            return {
                error: `La duración del frame ${numero} debe ser un número entero entre ${DURACION_MINIMA} y ${DURACION_MAXIMA} ms.`,
            };
        }

        const tieneOrigen = origen_id !== undefined;
        const esVacio = frame.vacio === true;
        if (tieneOrigen && !Number.isInteger(origen_id)) {
            return { error: `El "origen_id" del frame ${numero} no es válido.` };
        }

        if (capas !== undefined) {
            // Frame editado: trae sus capas
            if (esVacio) {
                return { error: `El frame ${numero} no puede ser vacío y traer capas a la vez.` };
            }
            const resultado = validarCapas(capas, numero, tieneOrigen, clavesPistas);            
            if (resultado.error) return resultado;
            limpia.push(tieneOrigen
                ? { origen_id, duracion, capas: resultado.capas }
                : { duracion, capas: resultado.capas });
        } else {
            if (tieneOrigen === esVacio) {
                return { error: `El frame ${numero} debe indicar "origen_id" o "vacio".` };
            }
            limpia.push(tieneOrigen ? { origen_id, duracion } : { vacio: true, duracion });
        }
    }
    return { lista: limpia };
}

module.exports = { leerLista, validarListaFrames };