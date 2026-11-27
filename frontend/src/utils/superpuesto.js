// marcas: { seleccion, marco, caja, manijas, contorno, guias: { x: [], y: [] } }
//   seleccion  rectángulo de la herramienta Selección (punteado blanco y negro)
//   marco      marco que se arrastra con Mover en un espacio vacío (punteado azul)
//   caja       caja de los objetos elegidos con Mover (línea azul)
//   manijas    true: la caja lleva las esquinas para escalar y la manija para girar (utils/manijas.js)
//   manijasSeleccion  true: la selección lleva sus esquinas (para agrandarla o achicarla; no gira)
//   contorno   las 4 esquinas de lo que se está escalando o girando, mientras se arrastra una manija
//   guias      líneas del lienzo a las que se pegó lo que se mueve (magenta)
//   pincel     { x, y, tamano }: el círculo del pincel o borrador bajo el mouse
import { posicionesManijas, ESQUINAS, LADO_MANIJA } from './manijas';

const AZUL = '#4da3ff';

export function dibujarManijas(ctx, caja, zoom, conGiro = true) {
    const grosor = 1 / zoom;
    const lado = LADO_MANIJA / zoom;
    const p = posicionesManijas(caja, zoom);
    ctx.save();
    ctx.lineWidth = grosor;
    ctx.strokeStyle = AZUL;
    ctx.fillStyle = '#ffffff';
    // Línea de la caja a la manija de giro, y la manija redonda
    if (conGiro) {
        ctx.beginPath();
        ctx.moveTo(p.borde.x, p.borde.y);
        ctx.lineTo(p.giro.x, p.giro.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(p.giro.x, p.giro.y, lado / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    }
    // Cuadraditos en las esquinas
    for (const id of ESQUINAS) {
        ctx.fillRect(p[id].x - lado / 2, p[id].y - lado / 2, lado, lado);
        ctx.strokeRect(p[id].x - lado / 2, p[id].y - lado / 2, lado, lado);
    }
    ctx.restore();
}

export function pintarSuperpuesto(ctx, area, centro, zoom, marcas) {
    const grosor = 1 / zoom;
    ctx.clearRect(0, 0, area.ancho, area.alto);

    ctx.save();
    ctx.fillStyle = 'rgba(20, 20, 20, 0.55)';
    ctx.beginPath();
    ctx.rect(0, 0, area.ancho, area.alto);
    ctx.rect(centro.x, centro.y, centro.ancho, centro.alto);
    ctx.fill('evenodd');
    ctx.lineWidth = grosor;
    ctx.strokeStyle = '#ffffff';
    ctx.strokeRect(centro.x, centro.y, centro.ancho, centro.alto);
    ctx.restore();

    // Borde punteado de dos colores: se ve sobre cualquier fondo
    const punteado = (rect, colorA, colorB) => {
        ctx.save();
        ctx.lineWidth = grosor;
        ctx.setLineDash([6 * grosor, 6 * grosor]);
        ctx.strokeStyle = colorA;
        ctx.strokeRect(rect.x + grosor / 2, rect.y + grosor / 2, rect.ancho - grosor, rect.alto - grosor);
        ctx.lineDashOffset = 6 * grosor;
        ctx.strokeStyle = colorB;
        ctx.strokeRect(rect.x + grosor / 2, rect.y + grosor / 2, rect.ancho - grosor, rect.alto - grosor);
        ctx.restore();
    };
    if (marcas.seleccion) punteado(marcas.seleccion, '#000000', '#ffffff');
    if (marcas.marco) punteado(marcas.marco, '#0b3d91', '#7fb4ff');

    ctx.save();
    ctx.lineWidth = grosor;
    if (marcas.caja) {
        const { x, y, ancho, alto } = marcas.caja;
        ctx.strokeStyle = AZUL;
        ctx.strokeRect(x - grosor / 2, y - grosor / 2, ancho + grosor, alto + grosor);
    }
    if (marcas.contorno) {
        ctx.strokeStyle = AZUL;
        ctx.beginPath();
        marcas.contorno.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
        ctx.closePath();
        ctx.stroke();
    }
    ctx.strokeStyle = '#ff3df2';
    for (const x of marcas.guias.x) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, area.alto);
        ctx.stroke();
    }
    for (const y of marcas.guias.y) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(area.ancho, y);
        ctx.stroke();
    }
    ctx.restore();
    if (marcas.caja && marcas.manijas) dibujarManijas(ctx, marcas.caja, zoom);
    if (marcas.seleccion && marcas.manijasSeleccion) dibujarManijas(ctx, marcas.seleccion, zoom, false);
    if (marcas.pincel) dibujarPincel(ctx, marcas.pincel, zoom);
}

// Círculo del tamaño del pincel o borrador, en negro y blanco para que se vea sobre cualquier color.
// pincel: { x, y, tamano }
function dibujarPincel(ctx, { x, y, tamano }, zoom) {
    const radio = Math.max(tamano / 2, 1 / zoom);
    ctx.save();
    ctx.lineWidth = 1 / zoom;
    ctx.strokeStyle = '#000000';
    ctx.beginPath();
    ctx.arc(x, y, radio + 0.5 / zoom, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, Math.max(radio - 0.5 / zoom, 0.5 / zoom), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
}