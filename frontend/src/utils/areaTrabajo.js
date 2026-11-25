// Zona de trabajo del editor. El lienzo del proyecto (ancho x alto) está en el centro de una zona
// FACTOR_AREA_TRABAJO veces más grande, con un lienzo de margen por cada lado. Así se puede mover contenido hacia
// afuera sin perderlo, y se vuelve a traer después. Las capas viven en toda la zona, no solo en el lienzo.
// Aquí están las cuentas que no dependen del canvas: medidas, zoom y qué se guarda.

import { FACTOR_AREA_TRABAJO } from '../config/limites';
import { limitar } from './comunes';

const ZOOM_MINIMO = 0.1;
const ZOOM_MAXIMO = 16;
const PASO_ZOOM = 1.25;

// Tamaño de toda la zona de trabajo
export function medidasArea(ancho, alto) {
    return { ancho: ancho * FACTOR_AREA_TRABAJO, alto: alto * FACTOR_AREA_TRABAJO };
}

// Dónde queda el lienzo del proyecto dentro de la zona: justo en el centro
export function rectLienzo(ancho, alto) {
    return { x: ancho, y: alto, ancho, alto };
}

export function limitarZoom(zoom) {
    const numero = Number(zoom);
    if (!Number.isFinite(numero)) return 1;
    return Math.min(ZOOM_MAXIMO, Math.max(ZOOM_MINIMO, numero));
}

// Zoom con el que el lienzo del proyecto cabe entero en el visor, con un poco de aire alrededor
export function zoomParaAjustar(visorAncho, visorAlto, ancho, alto, holgura = 24) {
    if (!(visorAncho > 0 && visorAlto > 0)) return 1;
    const zoom = Math.min((visorAncho - 2 * holgura) / ancho, (visorAlto - 2 * holgura) / alto);
    return limitarZoom(zoom > 0 ? zoom : ZOOM_MINIMO);
}

// Un paso de zoom hacia adentro (direccion > 0) o hacia afuera
export function siguienteZoom(zoom, direccion) {
    return limitarZoom(direccion > 0 ? zoom * PASO_ZOOM : zoom / PASO_ZOOM);
}

// Posición del scroll para que el punto "areaCoord" de la zona quede bajo "puntoVisor" (px dentro del visor)
export function scrollParaFijarPunto(areaCoord, puntoVisor, zoom) {
    return Math.max(0, Math.round(areaCoord * zoom - puntoVisor));
}

export function formatearZoom(zoom) {
    return `${Math.round(zoom * 100)} %`;
}

// Las cuatro franjas de la zona que quedan fuera del lienzo (arriba, abajo, izquierda y derecha)
export function franjasFuera(ancho, alto) {
    return [
        { x: 0, y: 0, ancho: ancho * FACTOR_AREA_TRABAJO, alto },
        { x: 0, y: alto * 2, ancho: ancho * FACTOR_AREA_TRABAJO, alto },
        { x: 0, y: alto, ancho, alto },
        { x: ancho * 2, y: alto, ancho, alto },
    ];
}

// Datos RGBA de un canvas: ¿hay algún píxel que no sea totalmente transparente?
export function hayPixelesVisibles(datos) {
    for (let i = 3; i < datos.length; i += 4) {
        if (datos[i] > 0) return true;
    }
    return false;
}

export function ajustarPosicion(rect, destinoX, destinoY, area, centro, umbral) {
    const eje = (destino, tamano, limite, inicioLienzo, tamanoLienzo) => {
        let valor = limitar(Math.round(destino), 0, limite - tamano);
        const lineas = [inicioLienzo, inicioLienzo + tamanoLienzo / 2, inicioLienzo + tamanoLienzo];
        const anclas = [0, tamano / 2, tamano];
        let mejor = null;
        for (const linea of lineas) {
            for (const ancla of anclas) {
                const distancia = Math.abs(valor + ancla - linea);
                if (distancia <= umbral && (!mejor || distancia < mejor.distancia)) {
                    mejor = { distancia, linea, ancla };
                }
            }
        }
        if (!mejor) return { valor, guias: [] };
        const pegado = Math.round(mejor.linea - mejor.ancla);
        if (pegado < 0 || pegado + tamano > limite) return { valor, guias: [] };
        return { valor: pegado, guias: [mejor.linea] };
    };
    const horizontal = eje(destinoX, rect.ancho, area.ancho, centro.x, centro.ancho);
    const vertical = eje(destinoY, rect.alto, area.alto, centro.y, centro.alto);
    return { x: horizontal.valor, y: vertical.valor, guiasX: horizontal.guias, guiasY: vertical.guias };
}