// Vista de capas de la línea de tiempo (pestaña Video), al estilo de un editor de video: una fila por capa y una
// columna por frame. Cada celda muestra una miniatura de esa capa en ese frame.
//  - Arriba, una fila por pista de keyframes, con la capa que la pista generó en cada frame: se ve el objeto
//    moviéndose de un frame a otro. Debajo de cada una va su riel de keyframes (LineaTiempo).
//  - Después, las demás capas por su posición en la pila, de la de más arriba a la de abajo (el Fondo al final).
import { FACTOR_AREA_TRABAJO } from '../config/limites';

// ---- filas ----

// Nombre de una fila de capas: el de la capa en el frame actual; si ese frame no la tiene, el nombre que más se
// repite en la fila
function nombreDeFila(celdas, indiceActual, posicion) {
    if (celdas[indiceActual]) return celdas[indiceActual].nombre;
    const cuenta = new Map();
    for (const capa of celdas) if (capa) cuenta.set(capa.nombre, (cuenta.get(capa.nombre) || 0) + 1);
    let mejor = null;
    for (const [nombre, veces] of cuenta) if (!mejor || veces > cuenta.get(mejor)) mejor = nombre;
    return mejor || `Capa ${posicion + 1}`;
}

// capasPorFrame[i]: capas del frame i, de abajo hacia arriba (como las guarda el editor). Devuelve las filas de
// arriba hacia abajo: [{ tipo: 'pista' | 'capa', clave, nombre, pista?, celdas: [capa | null por frame] }]
// Una capa que dice ser de una pista que ya no existe se muestra como capa normal.
export function filasDeCapas(capasPorFrame, pistas, indiceActual) {
    const clavesPistas = new Set(pistas.map((p) => p.clave));
    const filasPista = pistas.map((pista) => ({
        tipo: 'pista',
        clave: `pista-${pista.clave}`,
        pista: pista.clave,
        nombre: pista.nombre,
        celdas: capasPorFrame.map((capas) => (capas || []).find((capa) => capa.pista === pista.clave) || null),
    }));

    const normales = capasPorFrame.map((capas) => (capas || []).filter((capa) => !capa.pista || !clavesPistas.has(capa.pista)));
    const alto = Math.max(0, ...normales.map((capas) => capas.length));
    const filasCapa = [];
    for (let posicion = alto - 1; posicion >= 0; posicion--) {
        const celdas = normales.map((capas) => capas[posicion] || null);
        filasCapa.push({ tipo: 'capa', clave: `capa-${posicion}`, nombre: nombreDeFila(celdas, indiceActual, posicion), celdas });
    }
    return [...filasPista, ...filasCapa];
}

// ---- miniaturas ----

export const ALTO_MINIATURA = 80; // px de la imagen (la celda se ve más chica: así queda nítida en pantallas densas)
const MAX_MINIATURAS = 1500; // 100 frames x 10 capas + las pistas caben de sobra; cada una pesa unos 20 KB

// URL de la imagen original -> promesa con la URL de su miniatura. Las más viejas se liberan al pasar el máximo
const miniaturas = new Map();

function cargar(url) {
    return new Promise((resolver, rechazar) => {
        const imagen = new Image();
        imagen.onload = () => resolver(imagen);
        imagen.onerror = () => rechazar(new Error('No se pudo cargar la capa.'));
        imagen.src = url;
    });
}

// Miniatura de lo que la capa tiene dentro del lienzo. Una capa mide lo mismo que el lienzo o que toda la zona
// de trabajo (3 x 3 lienzos, con el lienzo al centro)
async function crearMiniatura(url, ancho, alto) {
    const imagen = await cargar(url);
    const enZona = imagen.width === ancho * FACTOR_AREA_TRABAJO;
    const canvas = document.createElement('canvas');
    canvas.height = ALTO_MINIATURA;
    canvas.width = Math.max(1, Math.round((ALTO_MINIATURA * ancho) / alto));
    canvas.getContext('2d').drawImage(
        imagen,
        enZona ? ancho : 0, enZona ? alto : 0, ancho, alto,
        0, 0, canvas.width, canvas.height
    );
    const blob = await new Promise((resolver) => canvas.toBlob(resolver, 'image/png'));
    if (!blob) throw new Error('No se pudo crear la miniatura.');
    return URL.createObjectURL(blob);
}

export function miniaturaDeCapa(url, ancho, alto) {
    const clave = `${ancho}x${alto}|${url}`;
    if (miniaturas.has(clave)) return miniaturas.get(clave);
    const promesa = crearMiniatura(url, ancho, alto);
    promesa.catch(() => miniaturas.delete(clave)); // si falla, se puede reintentar
    miniaturas.set(clave, promesa);
    if (miniaturas.size > MAX_MINIATURAS) {
        const [vieja, promesaVieja] = miniaturas.entries().next().value;
        miniaturas.delete(vieja);
        promesaVieja.then((u) => URL.revokeObjectURL(u), () => {});
    }
    return promesa;
}