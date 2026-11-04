// Funciones puras del panel de proyectos: etiquetas, fechas y filtros (RF10, RF12, RF13).

export const MAX_ETIQUETAS = 5;
export const LARGO_MAXIMO_ETIQUETA = 20;

// Convierte "cine, loop" en ['cine', 'loop']. Devuelve { etiquetas, error }.
export function analizarEtiquetas(texto) {
    const partes = String(texto || '')
        .split(',')
        .map((parte) => parte.trim())
        .filter(Boolean);
    const unicas = [];
    for (const parte of partes) {
        if (parte.length > LARGO_MAXIMO_ETIQUETA) {
            return { etiquetas: [], error: `Cada etiqueta puede tener como máximo ${LARGO_MAXIMO_ETIQUETA} caracteres.` };
        }
        if (!unicas.some((e) => e.toLowerCase() === parte.toLowerCase())) unicas.push(parte);
    }
    if (unicas.length > MAX_ETIQUETAS) {
        return { etiquetas: [], error: `Puedes usar como máximo ${MAX_ETIQUETAS} etiquetas.` };
    }
    return { etiquetas: unicas, error: '' };
}

export function formatearFecha(valor) {
    if (!valor) return '';
    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) return '';
    return fecha.toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });
}

// Fecha de la última modificación: la de edición o, si nunca se editó, la de creación.
export function ultimaModificacion(proyecto) {
    return proyecto.fecha_edicion || proyecto.fecha_creacion;
}

export const FILTROS_VACIOS = { nombre: '', etiqueta: '', color: '', desde: '', hasta: '' };

export function hayFiltros(filtros) {
    return Object.values(filtros).some(Boolean);
}

// Todas las etiquetas distintas que usan los proyectos, ordenadas.
export function etiquetasDisponibles(proyectos) {
    const mapa = new Map();
    for (const proyecto of proyectos) {
        for (const etiqueta of proyecto.etiquetas || []) {
            if (!mapa.has(etiqueta.toLowerCase())) mapa.set(etiqueta.toLowerCase(), etiqueta);
        }
    }
    return [...mapa.values()].sort((a, b) => a.localeCompare(b, 'es'));
}

function inicioDelDia(texto) {
    const [a, m, d] = texto.split('-').map(Number);
    return new Date(a, m - 1, d, 0, 0, 0, 0);
}

function finDelDia(texto) {
    const [a, m, d] = texto.split('-').map(Number);
    return new Date(a, m - 1, d, 23, 59, 59, 999);
}

// Aplica los filtros combinados (todos deben cumplirse). Las fechas filtran por última modificación.
export function filtrarProyectos(proyectos, filtros) {
    const nombre = filtros.nombre.trim().toLowerCase();
    const desde = filtros.desde ? inicioDelDia(filtros.desde) : null;
    const hasta = filtros.hasta ? finDelDia(filtros.hasta) : null;

    return proyectos.filter((proyecto) => {
        if (nombre && !proyecto.nombre.toLowerCase().includes(nombre)) return false;
        if (filtros.etiqueta && !(proyecto.etiquetas || []).some((e) => e.toLowerCase() === filtros.etiqueta.toLowerCase())) return false;
        if (filtros.color === 'ninguno' && proyecto.color) return false;
        if (filtros.color && filtros.color !== 'ninguno' && proyecto.color !== filtros.color) return false;
        if (desde || hasta) {
            const fecha = new Date(ultimaModificacion(proyecto));
            if (desde && fecha < desde) return false;
            if (hasta && fecha > hasta) return false;
        }
        return true;
    });
}
