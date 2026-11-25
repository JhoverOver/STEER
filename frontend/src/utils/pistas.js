// Pistas de keyframes (pestaña Video). Una pista anima una capa: guarda su imagen y una lista de keyframes,
// y Steer genera en cada frame que cae entre el primer y el último keyframe una capa con la imagen movida,
// escalada, girada y con la opacidad que corresponde a ese momento.
//
// Pista:     { clave, id?, nombre, imagen (URL), blob? (solo si es nueva), keyframes: [...] }
// Keyframe:  { clave, tiempo (ms), x, y (px desde donde estaba), escala (%), rotacion (grados), opacidad (%), curva }
// La curva de un keyframe dice cómo se llega desde él al siguiente: 'lineal' (velocidad constante) o
// 'suave' (acelera al salir y frena al llegar).
import { MAX_KEYFRAMES, MAX_PISTAS, LADO_MAXIMO, FACTOR_AREA_TRABAJO } from '../config/limites';
import { limitar } from './comunes';

const VALORES_INICIALES = { x: 0, y: 0, escala: 100, rotacion: 0, opacidad: 100 };
const CAMPOS = Object.keys(VALORES_INICIALES);
// Los mismos rangos que revisa el servidor (be/utils/validarPistas.js)
const DESPLAZAMIENTO_MAXIMO = LADO_MAXIMO * FACTOR_AREA_TRABAJO;
export const RANGOS = {
    x: [-DESPLAZAMIENTO_MAXIMO, DESPLAZAMIENTO_MAXIMO],
    y: [-DESPLAZAMIENTO_MAXIMO, DESPLAZAMIENTO_MAXIMO],
    escala: [1, 1000],
    rotacion: [-3600, 3600],
    opacidad: [0, 100],
};

let contador = 0;
function claveNueva(prefijo) {
    contador += 1;
    return `${prefijo}${contador}`;
}

// La clave de una pista guardada sale de su id: así las capas que vienen del servidor la encuentran
export function claveDePista(id) {
    return `p${id}`;
}

export function hayEspacioParaPista(pistas) {
    return pistas.length < MAX_PISTAS;
}

// Un valor de keyframe (x, y, escala, rotación u opacidad), redondeado y dentro de su rango
export function limitarCampo(campo, valor) {
    return limitar(Math.round(valor), ...RANGOS[campo]);
}

export function crearKeyframe(tiempo, valores = VALORES_INICIALES, curva = 'lineal') {
    const keyframe = { clave: claveNueva('k'), tiempo: Math.max(Math.round(tiempo), 0), curva };
    for (const campo of CAMPOS) keyframe[campo] = limitarCampo(campo, valores[campo]);
    return keyframe;
}

// Pista nueva a partir de una capa, con un keyframe sin cambios en "tiempo"
export function crearPista({ nombre, imagen, blob, tiempo }) {
    return { clave: claveNueva('n'), nombre, imagen, blob, keyframes: [crearKeyframe(tiempo)] };
}

function ordenar(keyframes) {
    return [...keyframes].sort((a, b) => a.tiempo - b.tiempo);
}

function suavizar(p) {
    return p < 0.5 ? 2 * p * p : 1 - ((-2 * p + 2) ** 2) / 2;
}

// Los valores de la pista en un momento. Antes del primer keyframe valen los del primero; después del último,
// los del último
export function valoresEn(keyframes, tiempo) {
    const lista = ordenar(keyframes);
    const primero = lista[0];
    const ultimo = lista[lista.length - 1];
    const valores = {};
    if (tiempo <= primero.tiempo || lista.length === 1) {
        for (const campo of CAMPOS) valores[campo] = primero[campo];
        return valores;
    }
    if (tiempo >= ultimo.tiempo) {
        for (const campo of CAMPOS) valores[campo] = ultimo[campo];
        return valores;
    }
    const siguiente = lista.findIndex((k) => k.tiempo > tiempo);
    const a = lista[siguiente - 1];
    const b = lista[siguiente];
    let p = (tiempo - a.tiempo) / (b.tiempo - a.tiempo);
    if (a.curva === 'suave') p = suavizar(p);
    for (const campo of CAMPOS) valores[campo] = a[campo] + (b[campo] - a[campo]) * p;
    return valores;
}

function rangoDePista(pista) {
    const tiempos = pista.keyframes.map((k) => k.tiempo);
    return [Math.min(...tiempos), Math.max(...tiempos)];
}

// Los frames donde aparece la pista y en qué momento se toman sus valores: un frame aparece si su tiempo
// se cruza con el rango de la pista; sus valores son los del comienzo del frame (o los del primer keyframe,
// si este cae dentro del frame). Devuelve [{ indice, tiempo }]
export function framesDePista(frames, pista) {
    const [desde, hasta] = rangoDePista(pista);
    const resultado = [];
    let inicio = 0;
    frames.forEach((frame, indice) => {
        const fin = inicio + frame.duracion;
        if (fin > desde && inicio <= hasta) {
            resultado.push({ indice, tiempo: limitar(inicio, desde, hasta) });
        }
        inicio = fin;
    });
    return resultado;
}

// ---- cambios a una pista (devuelven la misma pista si no cambia nada) ----

// Agrega un keyframe en "tiempo" con los valores que la pista ya tiene en ese momento
export function agregarKeyframe(pista, tiempo) {
    const redondeado = Math.max(Math.round(tiempo), 0);
    if (pista.keyframes.length >= MAX_KEYFRAMES || pista.keyframes.some((k) => k.tiempo === redondeado)) return pista;
    const anterior = ordenar(pista.keyframes).filter((k) => k.tiempo <= redondeado).pop();
    const nuevo = crearKeyframe(redondeado, valoresEn(pista.keyframes, redondeado), anterior ? anterior.curva : 'lineal');
    return { ...pista, keyframes: ordenar([...pista.keyframes, nuevo]) };
}

// Cambia valores de un keyframe. Si el tiempo nuevo choca con otro keyframe, no cambia nada
export function cambiarKeyframe(pista, clave, cambios) {
    const actual = pista.keyframes.find((k) => k.clave === clave);
    if (!actual) return pista;
    const nuevo = { ...actual };
    if (cambios.tiempo !== undefined) nuevo.tiempo = Math.max(Math.round(cambios.tiempo), 0);
    if (cambios.curva !== undefined) nuevo.curva = cambios.curva === 'suave' ? 'suave' : 'lineal';
    for (const campo of CAMPOS) {
        if (cambios[campo] !== undefined && Number.isFinite(cambios[campo])) nuevo[campo] = limitarCampo(campo, cambios[campo]);
    }
    if (pista.keyframes.some((k) => k.clave !== clave && k.tiempo === nuevo.tiempo)) return pista;
    if (Object.keys(nuevo).every((campo) => nuevo[campo] === actual[campo])) return pista;
    return { ...pista, keyframes: ordenar(pista.keyframes.map((k) => (k.clave === clave ? nuevo : k))) };
}

// Una pista siempre conserva al menos un keyframe
export function eliminarKeyframe(pista, clave) {
    if (pista.keyframes.length <= 1) return pista;
    return { ...pista, keyframes: pista.keyframes.filter((k) => k.clave !== clave) };
}

// ---- servidor ----

// Pistas que entrega el servidor
export function pistasDesdeServidor(lista = []) {
    return lista.map((p) => ({
        clave: claveDePista(p.id),
        id: p.id,
        nombre: p.nombre,
        imagen: p.imagen,
        keyframes: ordenar(p.keyframes.map((k) => ({ ...k, clave: claveNueva('k') }))),
    }));
}

function campoDePista(indice) {
    return `pista-${indice}`;
}

// La lista que se envía al guardar: una pista guardada va por su id; una nueva, con su PNG como archivo
export function pistasLista(pistas) {
    return pistas.map((p, i) => ({
        clave: p.clave,
        ...(p.id !== undefined ? { id: p.id } : { archivo: campoDePista(i) }),
        nombre: p.nombre,
        keyframes: p.keyframes.map(({ clave, ...valores }) => valores),
    }));
}

export function archivosDePistas(pistas) {
    return pistas.flatMap((p, i) => (p.id === undefined ? [{ campo: campoDePista(i), blob: p.blob }] : []));
}

export function hayCambiosPistas(actuales, guardadas) {
    return JSON.stringify(pistasLista(actuales)) !== JSON.stringify(pistasLista(guardadas));
}
