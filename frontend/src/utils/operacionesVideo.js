// Operaciones de la pestaña Video sobre todo el proyecto: actúan en una fila de capas (la capa que está en la misma
// posición en cada frame, como en la línea de tiempo) o agregan una capa nueva, en los frames que se indiquen.
//  - transformarFila: mueve, escala o gira lo que tiene la fila en cada frame. Las formas (texto o rectángulo)
//    siguen siendo formas: cambian su posición, tamaño y giro.
//  - agregarCapaEnFrames: un rectángulo, un texto o una imagen nueva, arriba de todas las capas de cada frame.
//  - editarFormaDeFila: cambia el contenido, el color... de las copias de una forma.
//  - eliminarFila: quita la capa de la fila de cada frame.
//  - aplicarAnimacion / quitarAnimacion: los keyframes de una fila (utils/animacion.js).
// Todas devuelven { frames, omitidos } y no tocan lo que reciben: la pestaña lo guarda en el historial.
// Coordenadas: píxeles del lienzo (0, 0 es su esquina superior izquierda; lo de afuera es la zona de trabajo).
import { FACTOR_AREA_TRABAJO, MAX_CAPAS } from '../config/limites';
import { crearClaveCapa } from './capas';
import { capasDeTodos, componer, conArchivo } from './capasProyecto';
import { aBlob, cajaVisible, cargarImagen, crearCanvas, origenEnZona } from './imagenes';
import { cajaForma, canvasDeForma, transformarForma } from './formas';
import { aLaCapa, estadosPorFrame, matrizDe } from './animacion';

// ---- filas (las mismas de la vista de capas: utils/vistaCapas.js) ----

// La capa de un frame que corresponde a la fila 'capa-<posición>' (desde abajo)
export function capaDeFila(capas, fila) {
    if (!capas || !fila) return null;
    return capas[Number(fila.slice('capa-'.length))] || null;
}

export function filaDeCapa(capas, capa) {
    return `capa-${capas.indexOf(capa)}`;
}

// Los frames a los que se aplica una operación: los marcados o, si no hay ninguno, todos
export function indicesObjetivo(frames, marcados) {
    const conMarca = frames.map((f, i) => (marcados.has(f.clave) ? i : -1)).filter((i) => i >= 0);
    return conMarca.length > 0 ? conMarca : frames.map((_, i) => i);
}

// ---- geometría ----

// Caja de lo visible de una imagen de capa, en píxeles del lienzo (null si está vacía). Se recuerda por URL
const cajas = new Map();
async function cajaDeImagen(url, ancho, alto) {
    const clave = `${ancho}x${alto}|${url}`;
    if (!cajas.has(clave)) {
        const imagen = await cargarImagen(url);
        const caja = cajaVisible(imagen, ancho, alto);
        cajas.set(clave, caja && { ...caja, x: caja.x - ancho, y: caja.y - alto });
        if (cajas.size > 500) cajas.delete(cajas.keys().next().value);
    }
    return cajas.get(clave);
}

function unir(a, b) {
    if (!a) return b;
    if (!b) return a;
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    return { x, y, ancho: Math.max(a.x + a.ancho, b.x + b.ancho) - x, alto: Math.max(a.y + a.alto, b.y + b.alto) - y };
}

// Caja que envuelve lo que la fila tiene en esos frames (solo capas visibles); null si no tiene nada
export async function cajaDeFila(capasPorFrame, fila, indices, ancho, alto) {
    let caja = null;
    for (const i of indices) {
        const capa = capaDeFila(capasPorFrame[i], fila);
        const url = capa && capa.imagen;
        if (!url || !capa.visible) continue;
        caja = unir(caja, await cajaDeImagen(url, ancho, alto));
    }
    return caja;
}

// Un punto después de la transformación de las manijas ({ dx, dy, escalaX, escalaY, angulo } alrededor del centro de
// "region")
export function transformarPunto(region, t, punto) {
    const cx = region.x + region.ancho / 2;
    const cy = region.y + region.alto / 2;
    const radianes = ((t.angulo || 0) * Math.PI) / 180;
    const rx = (punto.x - cx) * (t.escalaX ?? 1);
    const ry = (punto.y - cy) * (t.escalaY ?? 1);
    return {
        x: cx + (t.dx || 0) + rx * Math.cos(radianes) - ry * Math.sin(radianes),
        y: cy + (t.dy || 0) + rx * Math.sin(radianes) + ry * Math.cos(radianes),
    };
}

// Aplica la transformación a un contexto cuyo origen es el del lienzo
export function aplicarTransformacion(ctx, region, t) {
    const cx = region.x + region.ancho / 2;
    const cy = region.y + region.alto / 2;
    ctx.translate(cx + (t.dx || 0), cy + (t.dy || 0));
    ctx.rotate(((t.angulo || 0) * Math.PI) / 180);
    ctx.scale(t.escalaX ?? 1, t.escalaY ?? 1);
    ctx.translate(-cx, -cy);
}

// Canvas del tamaño del lienzo si "caja" cabe en él; si no, de la zona de trabajo. Devuelve { canvas, ctx } con el
// origen del contexto en el del lienzo
export function canvasPara(caja, ancho, alto) {
    const cabe = caja.x >= 0 && caja.y >= 0 && caja.x + caja.ancho <= ancho && caja.y + caja.alto <= alto;
    const canvas = cabe ? crearCanvas(ancho, alto) : crearCanvas(ancho * FACTOR_AREA_TRABAJO, alto * FACTOR_AREA_TRABAJO);
    const ctx = canvas.getContext('2d');
    if (!cabe) ctx.translate(ancho, alto);
    return { canvas, ctx };
}

// PNG de una capa (no de texto) con la transformación aplicada; null si la capa está vacía
export async function transformarImagen(url, region, t, ancho, alto) {
    const caja = await cajaDeImagen(url, ancho, alto);
    if (!caja) return null;
    const imagen = await cargarImagen(url);
    const esquinas = [
        { x: caja.x, y: caja.y }, { x: caja.x + caja.ancho, y: caja.y },
        { x: caja.x, y: caja.y + caja.alto }, { x: caja.x + caja.ancho, y: caja.y + caja.alto },
    ].map((p) => transformarPunto(region, t, p));
    const xs = esquinas.map((p) => p.x);
    const ys = esquinas.map((p) => p.y);
    const destino = {
        x: Math.floor(Math.min(...xs)), y: Math.floor(Math.min(...ys)),
        ancho: Math.ceil(Math.max(...xs) - Math.min(...xs)) + 1, alto: Math.ceil(Math.max(...ys) - Math.min(...ys)) + 1,
    };
    const { canvas, ctx } = canvasPara(destino, ancho, alto);
    aplicarTransformacion(ctx, region, t);
    const origen = origenEnZona(imagen, ancho, alto);
    ctx.drawImage(imagen, origen.x - ancho, origen.y - alto);
    return aBlob(canvas);
}

// ---- frames ----

// Frame con sus capas nuevas y la imagen compuesta de nuevo
async function rehacerFrame(frame, capas, ancho, alto) {
    const conArchivos = await Promise.all(capas.map((capa) => conArchivo(capa, ancho, alto)));
    const imagen = URL.createObjectURL(await componer(conArchivos, ancho, alto));
    return { ...frame, capas: conArchivos, imagen, vacio: false };
}

function cambiarCapa(capas, capa, cambios) {
    return capas.map((c) => (c === capa ? { ...c, ...cambios, modificada: true } : c));
}

// Para no dibujar dos veces lo mismo (frames duplicados comparten imagen; las copias de un texto son iguales)
function memorizar() {
    const hechos = new Map();
    return (clave, crear) => {
        if (!hechos.has(clave)) hechos.set(clave, crear());
        return hechos.get(clave);
    };
}

async function conBlob(promesaBlob) {
    const blob = await promesaBlob;
    return blob && { blob, imagen: URL.createObjectURL(blob) };
}

// Mueve, escala o gira la fila en los frames "indices". "region" es la caja de la fila (centro de la transformación)
export async function transformarFila({ frames }, fila, region, t, indices, { proyectoId, ancho, alto, memoria }) {
    const todas = await capasDeTodos(frames, proyectoId, memoria);
    const objetivo = new Set(indices);
    const recordar = memorizar();
    const nuevos = [];
    for (let i = 0; i < frames.length; i++) {
        const capa = objetivo.has(i) ? capaDeFila(todas[i], fila) : null;
        if (!capa || !capa.imagen) {
            nuevos.push(frames[i]);
            continue;
        }
        let cambios;
        if (capa.forma) {
            const forma = transformarForma(capa.forma, region, t);
            const dibujo = await recordar(JSON.stringify(forma), () => conBlob(aBlob(canvasDeForma(forma, ancho, alto))));
            cambios = { ...dibujo, forma };
        } else {
            cambios = await recordar(capa.imagen, () => conBlob(transformarImagen(capa.imagen, region, t, ancho, alto)));
        }
        nuevos.push(cambios ? await rehacerFrame(frames[i], cambiarCapa(todas[i], capa, cambios), ancho, alto) : frames[i]);
    }
    return { frames: nuevos, omitidos: 0 };
}

// Agrega en cada frame de "indices" una capa nueva, arriba de todas, con el dibujo de "canvas" (y su forma, si es
// un texto o un rectángulo). Los frames que ya tienen el máximo de capas se saltan (omitidos)
export async function agregarCapaEnFrames({ frames }, indices, { nombre, canvas, forma }, { proyectoId, ancho, alto, memoria }) {
    const blob = await aBlob(canvas);
    const imagen = URL.createObjectURL(blob);
    const todas = await capasDeTodos(frames, proyectoId, memoria);
    const objetivo = new Set(indices);
    let omitidos = 0;
    const nuevos = [];
    for (let i = 0; i < frames.length; i++) {
        if (!objetivo.has(i)) {
            nuevos.push(frames[i]);
            continue;
        }
        if (todas[i].length >= MAX_CAPAS) {
            omitidos += 1;
            nuevos.push(frames[i]);
            continue;
        }
        const nueva = {
            clave: crearClaveCapa(), nombre, visible: true, bloqueada: false, modificada: true, blob, imagen,
            ...(forma ? { forma } : {}),
        };
        nuevos.push(await rehacerFrame(frames[i], [...todas[i], nueva], ancho, alto));
    }
    return { frames: nuevos, omitidos };
}

// Cambia lo que no es posición, tamaño ni giro (contenido, fuente, color...) de las formas de la fila que sean copias
// de la misma ("grupo") en los frames "indices"
export async function editarFormaDeFila({ frames }, fila, grupo, cambios, indices, { proyectoId, ancho, alto, memoria }) {
    const todas = await capasDeTodos(frames, proyectoId, memoria);
    const objetivo = new Set(indices);
    const recordar = memorizar();
    const nuevos = [];
    for (let i = 0; i < frames.length; i++) {
        const capa = objetivo.has(i) ? capaDeFila(todas[i], fila) : null;
        if (!capa?.forma || (grupo && capa.forma.grupo !== grupo)) {
            nuevos.push(frames[i]);
            continue;
        }
        const forma = { ...capa.forma, ...cambios };
        const dibujo = await recordar(JSON.stringify(forma), () => conBlob(aBlob(canvasDeForma(forma, ancho, alto))));
        const nombre = forma.tipo === 'texto' && cambios.contenido
            ? cambios.contenido.split('\n')[0].trim().slice(0, 40) || capa.nombre
            : capa.nombre;
        nuevos.push(await rehacerFrame(frames[i], cambiarCapa(todas[i], capa, { ...dibujo, forma, nombre }), ancho, alto));
    }
    return { frames: nuevos, omitidos: 0 };
}

// Quita la capa de la fila en los frames "indices". Un frame siempre conserva al menos una capa (omitidos)
export async function eliminarFila({ frames }, fila, indices, { proyectoId, ancho, alto, memoria }) {
    const todas = await capasDeTodos(frames, proyectoId, memoria);
    const objetivo = new Set(indices);
    let omitidos = 0;
    const nuevos = [];
    for (let i = 0; i < frames.length; i++) {
        const capa = objetivo.has(i) ? capaDeFila(todas[i], fila) : null;
        if (!capa) {
            nuevos.push(frames[i]);
            continue;
        }
        if (todas[i].length <= 1) {
            omitidos += 1;
            nuevos.push(frames[i]);
            continue;
        }
        nuevos.push(await rehacerFrame(frames[i], todas[i].filter((c) => c !== capa), ancho, alto));
    }
    return { frames: nuevos, omitidos };
}

// La capa visible de más arriba que tiene dibujo en "punto" (null si no hay ninguna)
export async function capaEnPunto(capas, punto, ancho, alto) {
    const prueba = crearCanvas(1, 1);
    const ctx = prueba.getContext('2d', { willReadFrequently: true });
    for (let i = capas.length - 1; i >= 0; i--) {
        const capa = capas[i];
        if (!capa.visible || !capa.imagen) continue;
        const imagen = await cargarImagen(capa.imagen);
        const origen = origenEnZona(imagen, ancho, alto);
        // Una capa con keyframes se ve transformada: el punto se lleva a la capa sin transformar
        const enCapa = aLaCapa(matrizDe(capa.animacion), punto);
        ctx.clearRect(0, 0, 1, 1);
        ctx.drawImage(imagen, -(enCapa.x - (origen.x - ancho)), -(enCapa.y - (origen.y - alto)));
        if (ctx.getImageData(0, 0, 1, 1).data[3] > 0) return capa;
    }
    return null;
}


// ---- keyframes ----

// Dónde está lo que tiene la capa: la caja de su forma o de sus píxeles visibles (en píxeles del lienzo), o null
export async function cajaDeCapa(capa, ancho, alto) {
    if (capa.forma) return cajaForma(capa.forma);
    return capa.imagen ? cajaDeImagen(capa.imagen, ancho, alto) : null;
}

// Aplica los keyframes a la fila: cada capa de la fila, en cada frame desde el primer keyframe, guarda la animación
// con el estado del punto en ese frame ("actual"); su dibujo no cambia, solo cómo se muestra. Las de los frames de
// antes del primer keyframe la dejan de tener
export async function aplicarAnimacion({ frames }, fila, animacion, { proyectoId, ancho, alto, memoria }) {
    const todas = await capasDeTodos(frames, proyectoId, memoria);
    const porFrame = estadosPorFrame(frames, animacion);
    const { actual, ...sinActual } = animacion;
    const nuevos = [];
    for (let i = 0; i < frames.length; i++) {
        const capa = capaDeFila(todas[i], fila);
        const estado = porFrame.get(i);
        if (!capa || (!estado && capa.animacion?.id !== animacion.id)) {
            nuevos.push(frames[i]);
            continue;
        }
        const cambio = { animacion: estado ? { ...sinActual, actual: estado } : null };
        nuevos.push(await rehacerFrame(frames[i], cambiarCapa(todas[i], capa, cambio), ancho, alto));
    }
    return { frames: nuevos, omitidos: 0 };
}

// Quita los keyframes "id" de la fila: cada capa se vuelve a ver tal cual es
export async function quitarAnimacion({ frames }, fila, id, { proyectoId, ancho, alto, memoria }) {
    const todas = await capasDeTodos(frames, proyectoId, memoria);
    const nuevos = [];
    for (let i = 0; i < frames.length; i++) {
        const capa = capaDeFila(todas[i], fila);
        nuevos.push(capa?.animacion?.id === id
            ? await rehacerFrame(frames[i], cambiarCapa(todas[i], capa, { animacion: null }), ancho, alto)
            : frames[i]);
    }
    return { frames: nuevos, omitidos: 0 };
}

// Vuelve a aplicar los keyframes de todas las filas (después de cambiar duraciones, los frames caen en otros momentos)
export async function reaplicarAnimaciones(base, contexto) {
    let resultado = { frames: base.frames, omitidos: 0 };
    const todas = await capasDeTodos(base.frames, contexto.proyectoId, contexto.memoria);
    const alto = Math.max(0, ...todas.map((capas) => capas.length));
    for (let posicion = 0; posicion < alto; posicion++) {
        const capa = todas.map((capas) => capas[posicion]).find((c) => c?.animacion);
        if (capa) resultado = await aplicarAnimacion(resultado, `capa-${posicion}`, capa.animacion, contexto);
    }
    return resultado;
}
