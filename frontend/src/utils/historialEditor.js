import { MAX_HISTORIAL } from './historial';

export function crearHistorialEditor() {
    return { pasado: [], futuro: [] };
}

export const puedeDeshacer = (historial) => historial.pasado.length > 0;
export const puedeRehacer = (historial) => historial.futuro.length > 0;

// Se llama justo después de un trazo o transformación, con los píxeles que había ANTES del cambio.
// Un cambio nuevo borra lo que se podía rehacer.
export function registrarCambio(historial, entrada) {
    const pasado = [...historial.pasado, entrada];
    if (pasado.length > MAX_HISTORIAL) pasado.shift();
    return { pasado, futuro: [] };
}

// Mueve un paso de una lista a la otra, intercambiando los píxeles guardados por los actuales.
// Un paso de una capa con forma también guarda la forma: se intercambia igual (leerForma da la actual)
function mover(desde, hacia, leerRegion, escribirRegion, leerForma) {
    const entrada = desde[desde.length - 1];
    const actuales = leerRegion(entrada.clave, entrada.x, entrada.y, entrada.ancho, entrada.alto);
    escribirRegion(entrada.clave, entrada.x, entrada.y, entrada.pixeles);
    const inverso = { ...entrada, pixeles: actuales };
    if ('forma' in entrada) inverso.forma = leerForma ? leerForma(entrada.clave) : null;
    return { entrada, desde: desde.slice(0, -1), hacia: [...hacia, inverso] };
}

// Devuelve { historial, entrada }: "entrada" dice qué capa y rectángulo cambiaron, para que el editor
// la vuelva a pintar y la marque como modificada. Si no hay nada que deshacer, devuelve el mismo historial.
export function deshacer(historial, leerRegion, escribirRegion, leerForma) {
    if (!puedeDeshacer(historial)) return { historial, entrada: null };
    const { entrada, desde, hacia } = mover(historial.pasado, historial.futuro, leerRegion, escribirRegion, leerForma);
    return { historial: { pasado: desde, futuro: hacia }, entrada };
}

export function rehacer(historial, leerRegion, escribirRegion, leerForma) {
    if (!puedeRehacer(historial)) return { historial, entrada: null };
    const { entrada, desde, hacia } = mover(historial.futuro, historial.pasado, leerRegion, escribirRegion, leerForma);
    return { historial: { pasado: hacia, futuro: desde }, entrada };
}

// Al eliminar una capa, sus pasos ya no sirven: no hay dónde volver a pintarlos
export function descartarCapa(historial, clave) {
    const sinCapa = (entrada) => entrada.clave !== clave;
    return { pasado: historial.pasado.filter(sinCapa), futuro: historial.futuro.filter(sinCapa) };
}