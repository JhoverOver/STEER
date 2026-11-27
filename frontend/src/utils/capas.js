import { MAX_CAPAS, MAXIMO_NOMBRE_CAPA } from '../config/limites';
import { obtenerCapas } from '../services/servicioAPI';
import { limitar, siCambio } from './comunes';

let contadorClaves = 0;
export function crearClaveCapa() {
    contadorClaves += 1;
    return `capa-${contadorClaves}`;
}

// Capas que entrega el servidor
function desdeServidor(capasServidor) {
    return capasServidor.map((c) => ({
        clave: crearClaveCapa(),
        id: c.id,
        nombre: c.nombre,
        visible: c.visible,
        bloqueada: c.bloqueada,
        modificada: false,
        imagen: c.imagen,
        forma: c.forma || null, // texto o rectángulo editable (utils/formas.js)
        // Capa con keyframes en Video (utils/animacion.js): los recuerda para volver a editarlos
        ...(c.animacion ? { animacion: c.animacion } : {}),
    }));
}

// Las capas con las que se abre un fotograma:
//  - ya editado en esta sesión: las capas que dejó el editor la última vez (frame.capas)
//  - guardado en el servidor: se piden al abrir (RF: las capas se cargan solo al editar)
//  - nuevo, en blanco o desde un archivo: una sola capa "Fondo" (con la imagen del fotograma, si la tiene)
export async function capasDeFrame(proyectoId, frame) {
    if (frame.capas) return frame.capas;
    if (frame.origen_id != null) return desdeServidor(await obtenerCapas(proyectoId, frame.origen_id));
    const fondo = crearFondo();
    return [frame.vacio || !frame.imagen ? fondo : { ...fondo, imagen: frame.imagen }];
}

// Al abrir un frame en el editor, la capa de abajo (el fondo) empieza bloqueada: así no se dibuja encima por
// error y después no hay que borrar el fondo para quitar un trazo. Si el frame solo tiene esa capa, se agrega una
// vacía encima para dibujar. Devuelve { capas, activa }: activa es la clave de la capa de más arriba que se puede
// editar. Son ajustes de trabajo: el editor no los cuenta como cambios del frame.
export function prepararParaEditar(capas) {
    if (capas.length === 0) return { capas, activa: null };
    let lista = capas[0].bloqueada ? capas : [{ ...capas[0], bloqueada: true }, ...capas.slice(1)];
    if (lista.length === 1) lista = agregarCapa(lista, lista[0].clave);
    const editable = [...lista].reverse().find(capaEditable);
    return { capas: lista, activa: (editable || lista[lista.length - 1]).clave };
}


// Las capas de un fotograma que aún no se guardó
function crearFondo() {
    return { clave: crearClaveCapa(), nombre: 'Fondo', visible: true, bloqueada: false, modificada: true };
}

export function checkEspacio(capas, cantidad = 1) {
    return capas.length + cantidad <= MAX_CAPAS;
}

export function checkNombre(nombre) {
    const limpio = typeof nombre === 'string' ? nombre.trim() : '';
    return limpio.length >= 1 && limpio.length <= MAXIMO_NOMBRE_CAPA;
}

// nombres con el primer número que ninguna capa esté usando
function nombreNuevaCapa(capas) {
    const usados = new Set(capas.map((c) => c.nombre));
    let numero = 1;
    while (usados.has(`Capa ${numero}`)) numero += 1;
    return `Capa ${numero}`;
}

// La capa solo recibe trazos si está visible y desbloqueada
export function capaEditable(capa) {
    return Boolean(capa) && capa.visible && !capa.bloqueada;
}

function indiceDe(capas, clave) {
    return capas.findIndex((c) => c.clave === clave);
}

// Agrega una capa vacía justo encima de la capa "claveDebajo"
export function agregarCapa(capas, claveDebajo) {
    if (!checkEspacio(capas)) return capas;
    const indice = claveDebajo === undefined ? -1 : indiceDe(capas, claveDebajo);
    const posicion = indice === -1 ? capas.length : indice + 1;
    const nueva = { clave: crearClaveCapa(), nombre: nombreNuevaCapa(capas), visible: true, bloqueada: false, modificada: true };
    return [...capas.slice(0, posicion), nueva, ...capas.slice(posicion)];
}

// Una forma copiada a otra capa es independiente: no sigue a las demás copias de su grupo (Video)
export function copiaDeForma(forma) {
    if (!forma) return null;
    const { grupo, ...resto } = forma;
    return resto;
}

// "forma": la capa nueva es un texto o rectángulo editable (su imagen ya viene dibujada)
export function agregarCapaConImagen(capas, claveDebajo, { nombre, imagen, forma }) {
    if (!checkEspacio(capas)) return capas;
    const indice = claveDebajo === undefined ? -1 : indiceDe(capas, claveDebajo);
    const posicion = indice === -1 ? capas.length : indice + 1;
    const limpio = checkNombre(nombre) ? nombre.trim() : nombreNuevaCapa(capas);
    const nueva = { clave: crearClaveCapa(), nombre: limpio, visible: true, bloqueada: false, modificada: true, imagen };
    if (forma) nueva.forma = forma;
    return [...capas.slice(0, posicion), nueva, ...capas.slice(posicion)];
}

// Un fotograma siempre conserva al menos una capa
export function eliminarCapa(capas, clave) {
    if (capas.length <= 1 || indiceDe(capas, clave) === -1) return capas;
    return capas.filter((c) => c.clave !== clave);
}

// Copia la capa justo encima de la original. Esta función solo copia los datos de la capa
export function duplicarCapa(capas, clave) {
    const indice = indiceDe(capas, clave);
    if (indice === -1 || !checkEspacio(capas)) return capas;
    const original = capas[indice];
    const copia = {
        clave: crearClaveCapa(),
        nombre: `${original.nombre} copia`.slice(0, MAXIMO_NOMBRE_CAPA),
        visible: original.visible,
        bloqueada: original.bloqueada,
        modificada: true,
    };
    if (original.forma) copia.forma = copiaDeForma(original.forma);
    return [...capas.slice(0, indice + 1), copia, ...capas.slice(indice + 1)];
}

export function renombrarCapa(capas, clave, nombre) {
    if (!checkNombre(nombre)) return capas;
    const limpio = nombre.trim();
    return siCambio(capas, capas.map((c) => (c.clave === clave && c.nombre !== limpio ? { ...c, nombre: limpio } : c)));
}

export function cambiarVisibilidad(capas, clave) {
    return capas.map((c) => (c.clave === clave ? { ...c, visible: !c.visible } : c));
}

export function bloquearCapa(capas, clave) {
    return capas.map((c) => (c.clave === clave ? { ...c, bloqueada: !c.bloqueada } : c));
}

// Mueve la capa a la posición "destino" (0 = abajo del todo). 
export function reordenarCapas(capas, clave, destino) {
    const origen = indiceDe(capas, clave);
    if (origen === -1 || !Number.isInteger(destino)) return capas;
    const final = limitar(destino, 0, capas.length - 1);
    if (final === origen) return capas;
    const nueva = [...capas];
    const [movida] = nueva.splice(origen, 1);
    nueva.splice(final, 0, movida);
    return nueva;
}

// Avisa que los píxeles de la capa cambiaron: al guardar habrá que subir su PNG
export function marcarModificada(capas, clave) {
    return siCambio(capas, capas.map((c) => (c.clave === clave && !c.modificada ? { ...c, modificada: true } : c)));
}