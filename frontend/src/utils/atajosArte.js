// Atajos de teclado del editor de imagen (RF44 y RF45).
// Una combinación se escribe como texto: modificadores en orden "ctrl", "alt", "shift" y al final la tecla,
// todo en minúsculas y unido con "+". Ejemplos: "b", "ctrl+z", "ctrl+shift+z".

// Mismo límite que valida el servidor (config/limites.js)
export const LARGO_MAXIMO_ATAJO = 30;

// Todas las acciones del editor que tienen atajo. "id" es lo que se guarda en el servidor.
export const ACCIONES = [
    { id: 'pincel', nombre: 'Pincel', atajo: 'b' },
    { id: 'borrador', nombre: 'Borrador', atajo: 'e' },
    { id: 'seleccion', nombre: 'Selección', atajo: 's' },
    { id: 'mover', nombre: 'Mover', atajo: 'v' },
    { id: 'tamano_mas', nombre: 'Aumentar tamaño del pincel', atajo: '+' },
    { id: 'tamano_menos', nombre: 'Disminuir tamaño del pincel', atajo: '-' },
    { id: 'capa_nueva', nombre: 'Capa nueva', atajo: 'n' },
    { id: 'deshacer', nombre: 'Deshacer', atajo: 'ctrl+z' },
    { id: 'rehacer', nombre: 'Rehacer', atajo: 'ctrl+shift+z' },
    { id: 'borrar_seleccion', nombre: 'Borrar selección', atajo: 'delete' },
    { id: 'seleccionar_todo', nombre: 'Seleccionar todo', atajo: 'ctrl+a' },
    { id: 'quitar_seleccion', nombre: 'Quitar selección', atajo: 'escape' },
    { id: 'copiar_capa', nombre: 'Copiar capa', atajo: 'ctrl+c' },
    { id: 'pegar_capa', nombre: 'Pegar capa', atajo: 'ctrl+v' },
];

const MODIFICADORES = ['ctrl', 'alt', 'shift'];
const SINONIMOS = {
    control: 'ctrl', cmd: 'ctrl', meta: 'ctrl', option: 'alt',
    esc: 'escape', del: 'delete', supr: 'delete', espacio: 'space',
};
const TECLAS_QUE_SON_MODIFICADOR = ['control', 'shift', 'alt', 'meta', 'altgraph', 'os'];
const TIPOS_DE_TEXTO = ['text', 'search', 'number', 'email', 'password', 'url', 'tel'];

// Deja una combinación escrita a mano en su forma estándar; devuelve '' si no es válida
export function normalizarCombinacion(texto) {
    if (typeof texto !== 'string') return '';
    const bruto = texto.trim().toLowerCase();
    if (!bruto) return '';

    // La tecla "+" también se escribe con "+": "+", "ctrl++"
    let tecla;
    let resto;
    if (bruto === '+') {
        tecla = '+';
        resto = '';
    } else if (bruto.endsWith('++')) {
        tecla = '+';
        resto = bruto.slice(0, -2);
    } else {
        const partes = bruto.split('+');
        tecla = partes.pop().trim();
        resto = partes.join('+');
    }

    tecla = SINONIMOS[tecla] || tecla;
    if (!tecla || MODIFICADORES.includes(tecla)) return '';

    const modificadores = new Set();
    for (const parte of resto ? resto.split('+') : []) {
        const modificador = SINONIMOS[parte.trim()] || parte.trim();
        if (!MODIFICADORES.includes(modificador)) return '';
        modificadores.add(modificador);
    }
    return [...MODIFICADORES.filter((m) => modificadores.has(m)), tecla].join('+');
}

// La combinación que representa un evento de teclado, o null si solo se presionó un modificador
export function combinacionDeEvento(evento) {
    const key = evento && evento.key;
    if (!key || TECLAS_QUE_SON_MODIFICADOR.includes(key.toLowerCase()) || key === 'Dead' || key === 'Unidentified') {
        return null;
    }
    const tecla = key === ' ' ? 'space' : key.toLowerCase();
    // En teclados latinoamericanos, AltGr se reporta como Ctrl + Alt: no es un atajo
    const altGr = typeof evento.getModifierState === 'function' && evento.getModifierState('AltGraph');
    const partes = [];
    if ((evento.ctrlKey || evento.metaKey) && !altGr) partes.push('ctrl');
    if (evento.altKey && !altGr) partes.push('alt');
    // Un símbolo como "+" o "?" ya incluye el Shift en la tecla misma: no se cuenta aparte
    const esSimbolo = tecla.length === 1 && !/[a-z0-9]/.test(tecla);
    if (evento.shiftKey && !esSimbolo) partes.push('shift');
    partes.push(tecla);
    return normalizarCombinacion(partes.join('+'));
}

// Los atajos vigentes: los de fábrica, cambiados por los que el usuario personalizó (guardados en el servidor)
export function combinarAtajos(guardados = {}) {
    const atajos = {};
    for (const accion of ACCIONES) {
        const propio = normalizarCombinacion(guardados && guardados[accion.id]);
        atajos[accion.id] = propio || accion.atajo;
    }
    return atajos;
}

// Solo lo que se aparta de los atajos de fábrica: es lo que se guarda en el servidor
export function atajosParaGuardar(atajos) {
    const cambios = {};
    for (const accion of ACCIONES) {
        const combinacion = normalizarCombinacion(atajos[accion.id]);
        if (combinacion && combinacion !== accion.atajo) cambios[accion.id] = combinacion;
    }
    return cambios;
}

// Mensaje de error si "combinacion" no puede asignarse a la acción; null si está bien
export function validarAtajo(accionId, combinacion, atajos) {
    const normalizada = normalizarCombinacion(combinacion);
    if (!normalizada) return 'Presiona una tecla (sola o con Ctrl, Alt o Shift).';
    if (normalizada.length > LARGO_MAXIMO_ATAJO) return `La combinación no puede superar ${LARGO_MAXIMO_ATAJO} caracteres.`;
    const otra = ACCIONES.find((a) => a.id !== accionId && normalizarCombinacion(atajos[a.id]) === normalizada);
    if (otra) return `"${formatearCombinacion(normalizada)}" ya está asignado a "${otra.nombre}".`;
    return null;
}

// Cómo se muestra al usuario: "ctrl+shift+z" → "Ctrl + Shift + Z"
export function formatearCombinacion(combinacion) {
    const nombres = { ctrl: 'Ctrl', alt: 'Alt', shift: 'Shift', space: 'Espacio', escape: 'Esc', delete: 'Supr' };
    const normalizada = normalizarCombinacion(combinacion);
    if (!normalizada) return '';
    const partes = normalizada.endsWith('++') || normalizada === '+'
        ? [...normalizada.slice(0, -1).split('+').filter(Boolean), '+']
        : normalizada.split('+');
    return partes.map((p) => nombres[p] || p.toUpperCase()).join(' + ');
}

// Mientras el usuario escribe en un campo de texto, las teclas no deben activar herramientas
export function esCampoDeTexto(elemento) {
    if (!elemento) return false;
    if (elemento.isContentEditable) return true;
    const etiqueta = (elemento.tagName || '').toLowerCase();
    if (etiqueta === 'textarea' || etiqueta === 'select') return true;
    return etiqueta === 'input' && TIPOS_DE_TEXTO.includes((elemento.type || 'text').toLowerCase());
}

// El id de la acción que corresponde a un evento de teclado, o null si no es un atajo
export function accionDeEvento(evento, atajos) {
    if (esCampoDeTexto(evento.target)) return null;
    const combinacion = combinacionDeEvento(evento);
    if (!combinacion) return null;
    const accion = ACCIONES.find((a) => normalizarCombinacion(atajos[a.id]) === combinacion);
    return accion ? accion.id : null;
}