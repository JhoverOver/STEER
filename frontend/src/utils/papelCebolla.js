// Papel cebolla del editor de imagen: muestra los frames vecinos semitransparentes encima del que se edita,
// para dibujar el movimiento sin perder de vista dónde estaba y dónde estará. Nunca se guarda en el frame.
// Los anteriores se tiñen de rojo y los siguientes de azul; mientras más lejos está un frame, más tenue se ve.
import { crearCanvas } from './imagenes';
import { limitar } from './comunes';

export const MAX_FRAMES_CEBOLLA = 3;
export const OPACIDAD_MINIMA_CEBOLLA = 10;
export const OPACIDAD_MAXIMA_CEBOLLA = 80;
export const COLOR_ANTERIORES = '#ff3b30';
export const COLOR_SIGUIENTES = '#2f7bff';

const CLAVE_GUARDADO = 'steer.papelCebolla';
const AJUSTES_INICIALES = { activa: false, cantidad: 1, opacidad: 40 };


// Las imágenes de los frames vecinos al editado, del más cercano al más lejano (null si un frame está en blanco)
export function vecinosDe(frames, frame) {
    const indice = frames.indexOf(frame);
    const imagenDe = (f) => (f.vacio ? null : f.imagen || null);
    return {
        anteriores: frames.slice(Math.max(0, indice - MAX_FRAMES_CEBOLLA), indice).reverse().map(imagenDe),
        siguientes: frames.slice(indice + 1, indice + 1 + MAX_FRAMES_CEBOLLA).map(imagenDe),
    };
}

// Lo que hay que dibujar según los ajustes: [{ imagen, color, opacidad (0 a 1) }], del más lejano al más cercano
// para que los cercanos queden encima
export function fantasmasCebolla(vecinos, { activa, cantidad, opacidad }) {
    if (!activa) return [];
    const fantasmas = [];
    for (let distancia = cantidad; distancia >= 1; distancia--) {
        const tenue = (opacidad / 100) * ((cantidad - distancia + 1) / cantidad);
        const anterior = vecinos.anteriores[distancia - 1];
        const siguiente = vecinos.siguientes[distancia - 1];
        if (anterior) fantasmas.push({ imagen: anterior, color: COLOR_ANTERIORES, opacidad: tenue });
        if (siguiente) fantasmas.push({ imagen: siguiente, color: COLOR_SIGUIENTES, opacidad: tenue });
    }
    return fantasmas;
}

// Los ajustes se recuerdan en este navegador. Si no hay o están dañados, se usan los iniciales
export function leerAjustesCebolla() {
    try {
        const guardados = JSON.parse(localStorage.getItem(CLAVE_GUARDADO)) || {};
        return {
            activa: guardados.activa === true,
            cantidad: limitar(Math.round(Number(guardados.cantidad)) || AJUSTES_INICIALES.cantidad, 1, MAX_FRAMES_CEBOLLA),
            opacidad: limitar(Math.round(Number(guardados.opacidad)) || AJUSTES_INICIALES.opacidad,
                OPACIDAD_MINIMA_CEBOLLA, OPACIDAD_MAXIMA_CEBOLLA),
        };
    } catch (error) {
        return { ...AJUSTES_INICIALES };
    }
}

export function guardarAjustesCebolla(ajustes) {
    try {
        localStorage.setItem(CLAVE_GUARDADO, JSON.stringify(ajustes));
    } catch (error) {
        // Sin almacenamiento (modo privado, por ejemplo) los ajustes duran solo mientras el editor está abierto
    }
}

// Dibuja un frame vecino teñido de su color, en la posición del lienzo dentro de la zona de trabajo
export function dibujarFantasma(ctx, imagen, { color, opacidad }, centro) {
    const tenido = crearCanvas(centro.ancho, centro.alto);
    const tctx = tenido.getContext('2d');
    tctx.drawImage(imagen, 0, 0, centro.ancho, centro.alto);
    // Tiñe solo donde el frame tiene píxeles, a medias para que se sigan viendo sus detalles
    tctx.globalCompositeOperation = 'source-atop';
    tctx.globalAlpha = 0.5;
    tctx.fillStyle = color;
    tctx.fillRect(0, 0, centro.ancho, centro.alto);

    ctx.save();
    ctx.globalAlpha = opacidad;
    ctx.drawImage(tenido, centro.x, centro.y);
    ctx.restore();
}