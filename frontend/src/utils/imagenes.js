// Funciones de imagen y canvas que usa toda la app: cargar una imagen (con memoria), crear un canvas, pasarlo a
// archivo, y ubicar una capa en la zona de trabajo. Antes cada parte tenía su propia copia de estas funciones.
import { FACTOR_AREA_TRABAJO } from '../config/limites';

// Imágenes ya cargadas, por URL. La memoria guarda solo las últimas MAX_IMAGENES_EN_MEMORIA: cada imagen
// decodificada ocupa ancho x alto x 4 bytes (hasta 18 MB una capa de zona de trabajo de 2160 px), y una caché sin
// límite crecía con cada regeneración hasta pasar los 1000 MB de RAM del escenario de calidad 2 (riesgo R34).
// Las URL "blob:" (capas recién generadas) no se guardan: se usan una sola vez, al componer su frame.
const MAX_IMAGENES_EN_MEMORIA = 40;
const imagenes = new Map();
// "recordar" en false la carga sin guardarla (para imágenes que se usan una sola vez, como las miniaturas)
export function cargarImagen(url, recordar = true) {
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
    if (recordar && !url.startsWith('blob:')) {
        imagenes.set(url, promesa);
        if (imagenes.size > MAX_IMAGENES_EN_MEMORIA) imagenes.delete(imagenes.keys().next().value);
    }
    return promesa;
}

// El contenido del canvas como archivo (PNG por defecto; "calidad" sirve para WEBP y JPG)
export function aBlob(canvas, tipo = 'image/png', calidad) {
    return new Promise((resolver, rechazar) => {
        canvas.toBlob((blob) => (blob ? resolver(blob) : rechazar(new Error('No se pudo crear la imagen.'))), tipo, calidad);
    });
}

export function crearCanvas(ancho, alto) {
    const canvas = document.createElement('canvas');
    canvas.width = ancho;
    canvas.height = alto;
    return canvas;
}

// Una capa mide lo mismo que el lienzo o que toda la zona de trabajo. Devuelve dónde empieza su imagen
// dentro de la zona de trabajo (el lienzo está en el centro, en (ancho, alto))
export function origenEnZona(imagen, ancho, alto) {
    return imagen.width === ancho * FACTOR_AREA_TRABAJO ? { x: 0, y: 0 } : { x: ancho, y: alto };
}

// Rectángulo con los píxeles visibles de la imagen, en coordenadas de la zona de trabajo (null si está vacía)
export function cajaVisible(imagen, ancho, alto) {
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
