// Genera en los frames las capas de las pistas de keyframes (utils/pistas.js). Trabaja con canvas, así que
// todo es asíncrono: carga las capas de los frames que todavía no se abrieron, dibuja la capa de cada pista
// en cada frame y vuelve a componer la imagen de los frames que cambiaron.
import { FACTOR_AREA_TRABAJO, MAX_CAPAS } from '../config/limites';
import { capasDeFrame, crearClaveCapa } from './capas';
import { framesDePista, valoresEn } from './pistas';

const CARGAS_A_LA_VEZ = 6;

// Las imágenes se cargan una sola vez por URL
// Imágenes ya cargadas, por URL. La memoria guarda solo las últimas MAX_IMAGENES_EN_MEMORIA: cada imagen
// decodificada ocupa ancho x alto x 4 bytes (hasta 18 MB una capa de zona de trabajo de 2160 px), y una caché sin
// límite crecía con cada regeneración hasta pasar los 1000 MB de RAM del escenario de calidad 2 (riesgo R34).
// Las URL "blob:" (capas recién generadas) no se guardan: se usan una sola vez, al componer su frame.
const MAX_IMAGENES_EN_MEMORIA = 40;
const imagenes = new Map();
function cargarImagen(url) {
    if (imagenes.has(url)) {
        const guardada = imagenes.get(url);
        imagenes.delete(url); // vuelve al final: es la más reciente
        imagenes.set(url, guardada);
        return guardada;
    }
    const promesa = new Promise((resolver, rechazar) => {
        const imagen = new Image();
        imagen.onload = () => resolver(imagen);
        imagen.onerror = () => {
            imagenes.delete(url);
            rechazar(new Error('No se pudo cargar una imagen.'));
        };
        imagen.src = url;
    });
    if (!url.startsWith('blob:')) {
        imagenes.set(url, promesa);
        if (imagenes.size > MAX_IMAGENES_EN_MEMORIA) imagenes.delete(imagenes.keys().next().value);
    }
    return promesa;
}

function aBlob(canvas) {
    return new Promise((resolver, rechazar) => {
        canvas.toBlob((blob) => (blob ? resolver(blob) : rechazar(new Error('No se pudo crear la imagen.'))), 'image/png');
    });
}

function crearCanvas(ancho, alto) {
    const canvas = document.createElement('canvas');
    canvas.width = ancho;
    canvas.height = alto;
    return canvas;
}

// Una capa mide lo mismo que el lienzo o que toda la zona de trabajo. Devuelve dónde empieza su imagen
// dentro de la zona de trabajo (el lienzo está en el centro, en (ancho, alto))
function origenEnZona(imagen, ancho, alto) {
    return imagen.width === ancho * FACTOR_AREA_TRABAJO ? { x: 0, y: 0 } : { x: ancho, y: alto };
}

// Rectángulo con los píxeles visibles de la imagen, en coordenadas de la zona de trabajo (null si está vacía)
function cajaVisible(imagen, ancho, alto) {
    const canvas = crearCanvas(imagen.width, imagen.height);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(imagen, 0, 0);
    const { data } = ctx.getImageData(0, 0, imagen.width, imagen.height);
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -1;
    let y1 = -1;
    for (let y = 0; y < imagen.height; y++) {
        for (let x = 0; x < imagen.width; x++) {
            if (data[(y * imagen.width + x) * 4 + 3] === 0) continue;
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
        }
    }
    if (x1 < 0) return null;
    const origen = origenEnZona(imagen, ancho, alto);
    return { x: origen.x + x0, y: origen.y + y0, ancho: x1 - x0 + 1, alto: y1 - y0 + 1 };
}

// Aplica al contexto la transformación de unos valores: mueve (x, y), gira y escala alrededor del centro
// de los píxeles visibles
function transformar(ctx, caja, { x, y, escala, rotacion }) {
    const centroX = caja.x + caja.ancho / 2;
    const centroY = caja.y + caja.alto / 2;
    ctx.translate(centroX + x, centroY + y);
    ctx.rotate((rotacion * Math.PI) / 180);
    ctx.scale(escala / 100, escala / 100);
    ctx.translate(-centroX, -centroY);
}

// ¿La caja, ya transformada, queda completa dentro del lienzo? Se calcula con sus cuatro esquinas
function quedaEnLienzo(caja, valores, ancho, alto) {
    const matriz = new DOMMatrix();
    const centroX = caja.x + caja.ancho / 2;
    const centroY = caja.y + caja.alto / 2;
    matriz.translateSelf(centroX + valores.x, centroY + valores.y);
    matriz.rotateSelf(valores.rotacion);
    matriz.scaleSelf(valores.escala / 100, valores.escala / 100);
    matriz.translateSelf(-centroX, -centroY);
    const esquinas = [
        [caja.x, caja.y], [caja.x + caja.ancho, caja.y], [caja.x, caja.y + caja.alto], [caja.x + caja.ancho, caja.y + caja.alto],
    ].map(([x, y]) => matriz.transformPoint(new DOMPoint(x, y)));
    return esquinas.every((p) => p.x >= ancho && p.x <= ancho * 2 && p.y >= alto && p.y <= alto * 2);
}

// PNG de la capa de una pista en un momento. Si todo queda dentro del lienzo mide lo que el lienzo; si no,
// lo que la zona de trabajo, para no perder lo que queda afuera (igual que las capas del editor)
async function dibujarCapa(imagen, caja, valores, ancho, alto) {
    const enLienzo = quedaEnLienzo(caja, valores, ancho, alto);
    const canvas = enLienzo ? crearCanvas(ancho, alto) : crearCanvas(ancho * FACTOR_AREA_TRABAJO, alto * FACTOR_AREA_TRABAJO);
    const ctx = canvas.getContext('2d');
    if (enLienzo) ctx.translate(-ancho, -alto);
    transformar(ctx, caja, valores);
    ctx.globalAlpha = valores.opacidad / 100;
    const origen = origenEnZona(imagen, ancho, alto);
    ctx.drawImage(imagen, origen.x, origen.y);
    return aBlob(canvas);
}

// Imagen del frame: las capas visibles juntas, solo lo que cae dentro del lienzo
async function componer(capas, ancho, alto) {
    const canvas = crearCanvas(ancho, alto);
    const ctx = canvas.getContext('2d');
    for (const capa of capas) {
        if (!capa.visible || !capa.imagen) continue;
        const imagen = await cargarImagen(capa.imagen);
        const origen = origenEnZona(imagen, ancho, alto);
        ctx.drawImage(imagen, origen.x - ancho, origen.y - alto);
    }
    return aBlob(canvas);
}

// Al guardar, cada capa va por su id (ya guardada) o con su PNG. Una capa nueva que todavía no tiene PNG
// (el "Fondo" de un frame en blanco, por ejemplo) lo recibe aquí
async function conArchivo(capa, ancho, alto) {
    if (capa.id !== undefined || capa.blob) return capa;
    const blob = capa.imagen ? await (await fetch(capa.imagen)).blob() : await aBlob(crearCanvas(ancho, alto));
    return { ...capa, blob, imagen: capa.imagen || URL.createObjectURL(blob) };
}

// Las capas de todos los frames. Las de los frames que no se han abierto se piden al servidor (de a varias a
// la vez) y se recuerdan en "memoria" por el id del frame guardado, para no pedirlas otra vez
async function capasDeTodos(frames, proyectoId, memoria) {
    const resultado = new Array(frames.length);
    let siguiente = 0;
    async function trabajar() {
        while (siguiente < frames.length) {
            const i = siguiente;
            siguiente += 1;
            const frame = frames[i];
            if (frame.capas) {
                resultado[i] = frame.capas;
            } else if (frame.origen_id != null && memoria.has(frame.origen_id)) {
                resultado[i] = memoria.get(frame.origen_id);
            } else {
                resultado[i] = await capasDeFrame(proyectoId, frame);
                if (frame.origen_id != null) memoria.set(frame.origen_id, resultado[i]);
            }
        }
    }
    await Promise.all(Array.from({ length: CARGAS_A_LA_VEZ }, trabajar));
    return resultado;
}

// Las capas de todos los frames, usando la misma memoria que regenerarPistas (para la vista de capas de la
// línea de tiempo). Devuelve un Map: clave del frame -> sus capas
export async function capasDeFrames(frames, proyectoId, memoria) {
    const capas = await capasDeTodos(frames, proyectoId, memoria);
    return new Map(frames.map((frame, i) => [frame.clave, capas[i]]));
}


// Las capas de un frame, usando la misma memoria que regenerarPistas (así las claves coinciden)
export async function capasConMemoria(frame, proyectoId, memoria) {
    const [capas] = await capasDeTodos([frame], proyectoId, memoria);
    return capas;
}

// ¿La imagen tiene algún píxel visible?
export async function tieneContenido(url, ancho, alto) {
    return cajaVisible(await cargarImagen(url), ancho, alto) !== null;
}

// Vuelve a generar las capas de las pistas indicadas en "claves" en todos los frames: primero quita las que
// ya tenían y después agrega una capa nueva (bloqueada, encima de las demás) en cada frame donde aparece la
// pista. Una clave que ya no está en "pistas" solo quita sus capas (pista eliminada).
//
// opciones: { proyectoId, ancho, alto, memoria (Map), ocultar? { frame, capa } capa que se oculta (la original
//            de una pista recién creada) }
// Devuelve { frames, omitidos }: los frames nuevos (los que no cambiaron son los mismos objetos) y cuántas
// capas no se pudieron agregar porque el frame ya tenía el máximo de capas.
export async function regenerarPistas({ frames, pistas }, claves, { proyectoId, ancho, alto, memoria, ocultar }) {
    const todas = await capasDeTodos(frames, proyectoId, memoria);

    // Qué dibujar en cada frame: { indice -> [{ pista, valores }] }
    const porFrame = new Map();
    const preparadas = new Map();
    for (const pista of pistas) {
        if (!claves.has(pista.clave)) continue;
        const imagen = await cargarImagen(pista.imagen);
        const caja = cajaVisible(imagen, ancho, alto);
        if (!caja) continue; // capa vacía: no hay nada que animar
        preparadas.set(pista.clave, { imagen, caja, origen: pista.imagen });
        for (const { indice, tiempo } of framesDePista(frames, pista)) {
            if (!porFrame.has(indice)) porFrame.set(indice, []);
            porFrame.get(indice).push({ pista, valores: valoresEn(pista.keyframes, tiempo) });
        }
    }

    let omitidos = 0;
    const nuevos = [];
    for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];
        const originales = todas[i];
        let capas = originales.filter((capa) => !(capa.pista && claves.has(capa.pista)));
        let cambio = capas.length !== originales.length;

        if (ocultar && ocultar.frame === frame.clave) {
            capas = capas.map((capa) => (capa.clave === ocultar.capa ? { ...capa, visible: false } : capa));
            cambio = true;
        }

        // La capa original de una pista suele estar copiada en otros frames (frames duplicados). Donde aparece la
        // pista, esas copias idénticas se ocultan para no ver el objeto dos veces; donde no aparece, se muestran:
        // así el objeto queda quieto antes del primer keyframe y después del último
        for (const [clave, { origen }] of preparadas) {
            const visible = !(porFrame.get(i) || []).some(({ pista }) => pista.clave === clave);
            const copia = (capa) => !capa.pista && capa.imagen === origen && capa.visible !== visible;
            if (capas.some(copia)) {
                capas = capas.map((capa) => (copia(capa) ? { ...capa, visible } : capa));
                cambio = true;
            }
        }

        for (const { pista, valores } of porFrame.get(i) || []) {
            if (capas.length >= MAX_CAPAS) {
                omitidos += 1;
                continue;
            }
            const { imagen, caja } = preparadas.get(pista.clave);
            const blob = await dibujarCapa(imagen, caja, valores, ancho, alto);
            capas = [...capas, {
                clave: crearClaveCapa(),
                nombre: pista.nombre,
                visible: true,
                bloqueada: true, // para no dibujar en ella por error: se reemplaza cada vez que se regenera la pista
                modificada: true,
                blob,
                imagen: URL.createObjectURL(blob),
                pista: pista.clave,
            }];
            cambio = true;
        }

        if (!cambio) {
            nuevos.push(frame);
            continue;
        }
        const conArchivos = await Promise.all(capas.map((capa) => conArchivo(capa, ancho, alto)));
        const imagen = URL.createObjectURL(await componer(conArchivos, ancho, alto));
        nuevos.push({ ...frame, capas: conArchivos, imagen, vacio: false });
    }
    return { frames: nuevos, omitidos };
}

// Al eliminar una pista, las capas que generó quedan en los frames como capas normales (sin pista y
// desbloqueadas). Así no se pierde el dibujo del frame donde se creó la pista, cuya capa original quedó oculta.
// Los frames guardados que no se han abierto conservan su capa en el servidor, que la desvincula al guardar
// (la columna pista_id queda en NULL al borrar la pista).
export function desvincularPista(frames, clave) {
    return frames.map((frame) => {
        if (!frame.capas || !frame.capas.some((capa) => capa.pista === clave)) return frame;
        const capas = frame.capas.map((capa) => {
            if (capa.pista !== clave) return capa;
            const { pista, ...resto } = capa;
            return { ...resto, bloqueada: false };
        });
        return { ...frame, capas };
    });
}
