export const MAX_HISTORIAL = 100;

export function crearHistorial(presente) {
    return { pasado: [], presente, futuro: [] };
}

export function registrarCambio(historial, nuevo) {
    if (nuevo === historial.presente) return historial;
    const pasado = [...historial.pasado, historial.presente].slice(-MAX_HISTORIAL);
    return { pasado, presente: nuevo, futuro: [] };
}

export function deshacer(historial) {
    if (historial.pasado.length === 0) return historial;
    const anterior = historial.pasado[historial.pasado.length -1];
    return {
        pasado: historial.pasado.slice(0, -1),
        presente: anterior,
        futuro: [historial.presente, ...historial.futuro],
    };
}

export function rehacer(historial) {
    if (historial.futuro.length === 0) return historial;
    const [siguiente, ...resto] = historial.futuro;
    return {
        pasado: [...historial.pasado, historial.presente],
        presente: siguiente,
        futuro: resto,
    };
}

export const puedeDeshacer = (historial) => historial.pasado.length > 0;
export const puedeRehacer = (historial) => historial.futuro.length > 0;