// Dibujo del canvas superpuesto del editor: va encima de la imagen y nunca se guarda.
// Oscurece lo que queda fuera del lienzo del proyecto, marca su borde y dibuja las marcas de la herramienta activa.
// Todas las líneas miden 1 px en pantalla, sea cual sea el zoom.
//
// marcas: { seleccion, marco, caja, guias: { x: [], y: [] } }
//   seleccion  rectángulo de la herramienta Selección (punteado blanco y negro)
//   marco      marco que se arrastra con Mover en un espacio vacío (punteado azul)
//   caja       caja de los objetos elegidos con Mover (línea azul)
//   guias      líneas del lienzo a las que se pegó lo que se mueve (magenta)
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
        ctx.strokeStyle = '#4da3ff';
        ctx.strokeRect(x - grosor / 2, y - grosor / 2, ancho + grosor, alto + grosor);
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
}