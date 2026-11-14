// Zona de trabajo del editor. El lienzo del proyecto (ancho x alto) está en el centro de una zona
// FACTOR_AREA veces más grande, con un lienzo de margen por cada lado. Así se puede mover contenido hacia
// afuera sin perderlo, y se vuelve a traer después. Las capas viven en toda la zona, no solo en el lienzo.
// Aquí están las cuentas que no dependen del canvas: medidas, zoom y qué se guarda.

// Mismo valor que FACTOR_AREA_TRABAJO del servidor (config/limites.js)
export const FACTOR_AREA = 3;

export const ZOOM_MINIMO = 0.1;
export const ZOOM_MAXIMO = 16;
const PASO_ZOOM = 1.25;

// Tamaño de toda la zona de trabajo
export function medidasArea(ancho, alto) {
    return { ancho: ancho * FACTOR_AREA, alto: alto * FACTOR_AREA };
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
        { x: 0, y: 0, ancho: ancho * FACTOR_AREA, alto },
        { x: 0, y: alto * 2, ancho: ancho * FACTOR_AREA, alto },
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