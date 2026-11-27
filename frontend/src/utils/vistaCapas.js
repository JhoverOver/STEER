// Vista de capas de la línea de tiempo (pestaña Video), al estilo de un editor de video: una fila por capa y una
// columna por frame. Cada celda muestra una miniatura de esa capa en ese frame. Las filas van por la posición de la
// capa en la pila, de la de más arriba a la de abajo (el Fondo al final).
import { FACTOR_AREA_TRABAJO } from '../config/limites';
import { aBlob, cargarImagen, crearCanvas } from './imagenes';

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
// arriba hacia abajo: [{ clave: 'capa-<posición>', nombre, celdas: [capa | null por frame], animada }]
// "animada": alguna capa de la fila tiene keyframes
export function filasDeCapas(capasPorFrame, indiceActual) {
    const listas = capasPorFrame.map((capas) => capas || []);
    const alto = Math.max(0, ...listas.map((capas) => capas.length));
    const filas = [];
    for (let posicion = alto - 1; posicion >= 0; posicion--) {
        const celdas = listas.map((capas) => capas[posicion] || null);
        filas.push({
            clave: `capa-${posicion}`,
            nombre: nombreDeFila(celdas, indiceActual, posicion),
            celdas,
            animada: celdas.some((capa) => capa?.animacion),
        });
    }
    return filas;
}

// ---- miniaturas ----

const ALTO_MINIATURA = 80; // px de la imagen (la celda se ve más chica: así queda nítida en pantallas densas)
const MAX_MINIATURAS = 1500; // 100 frames x 10 capas caben de sobra; cada una pesa unos 20 KB

// URL de la imagen original -> promesa con la URL de su miniatura. Las más viejas se liberan al pasar el máximo
const miniaturas = new Map();

// Miniatura de lo que la capa tiene dentro del lienzo. Una capa mide lo mismo que el lienzo o que toda la zona
// de trabajo (3 x 3 lienzos, con el lienzo al centro)
async function crearMiniatura(url, ancho, alto) {
    const imagen = await cargarImagen(url, false);
    const enZona = imagen.width === ancho * FACTOR_AREA_TRABAJO;
    const canvas = crearCanvas(Math.max(1, Math.round((ALTO_MINIATURA * ancho) / alto)), ALTO_MINIATURA);
    canvas.getContext('2d').drawImage(
        imagen,
        enZona ? ancho : 0, enZona ? alto : 0, ancho, alto,
        0, 0, canvas.width, canvas.height
    );
    return URL.createObjectURL(await aBlob(canvas));
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