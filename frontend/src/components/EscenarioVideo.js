import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cargarImagen, origenEnZona } from '../utils/imagenes';
import { aplicarTransformacion } from '../utils/operacionesVideo';
import { dibujarTexto } from '../utils/texto';
import { dibujarManijas } from '../utils/superpuesto';
import { esquinasTransformadas } from '../utils/herramientas';
import { manijaEnPunto, escalaPorEsquina, giroPorManija, esSinTransformacion, CURSOR_MANIJA, SIN_TRANSFORMACION } from '../utils/manijas';

const MARGEN = 40; // px de pantalla alrededor del lienzo: deja ver (y tomar) lo que queda un poco afuera
const ALTO_MAXIMO = 0.55; // del alto de la ventana

// Escenario de la pestaña Video: muestra el frame actual y, encima, las herramientas que actúan en todo el proyecto.
//  - Mover: clic en un objeto elige su fila (la misma capa en todos los frames); arrastrar la caja la mueve, las
//    esquinas la escalan (Shift: sin mantener la proporción) y la manija redonda la gira (Shift: de 15 en 15°).
//  - Rectángulo: arrastrar dibuja un rectángulo de color.
//  - Texto: clic donde va el texto.
// Lo que se hace se ve en vivo en el frame actual; al soltar, la pestaña lo aplica a todos los frames (o a los
// marcados). Coordenadas: píxeles del lienzo.
//
// Props:
//   imagen          imagen compuesta del frame (se usa mientras no hay capas)
//   capas           capas del frame actual, de abajo hacia arriba (null mientras cargan)
//   ancho, alto     tamaño del lienzo
//   herramienta     'mover' | 'rectangulo' | 'texto'
//   color           color del rectángulo
//   caja            caja de la fila elegida (o null);  capaFila: la capa de esa fila en este frame (o null)
//   ocultarFila     no dibujar la capa de la fila (mientras se ve en vivo un cambio de su texto)
//   textoVivo       texto que se está escribiendo, dibujado encima (o null)
//   ocupado         se está aplicando algo: no se puede empezar otra acción
//   onPunto(punto)  clic con Mover fuera de la caja (para elegir otra fila)
//   onTransformar(t), onRectangulo(rect), onTexto(punto)
function EscenarioVideo({
    imagen, capas, ancho, alto, herramienta, color, caja, capaFila, ocultarFila = false, textoVivo = null, ocupado = false,
    onPunto, onTransformar, onRectangulo, onTexto,
}) {
    const contenedor = useRef(null);
    const lienzo = useRef(null);
    const [zoom, setZoom] = useState(0);
    const [imagenes, setImagenes] = useState(() => new Map()); // URL -> imagen cargada
    const gesto = useRef(null);
    const fallidas = useRef(new Set()); // imágenes que no se pudieron cargar: no se reintentan
    const [vista, setVista] = useState({ t: null, rect: null }); // lo que se está arrastrando
    const [pendiente, setPendiente] = useState(null); // transformación ya soltada, mientras se aplica

    // El zoom sale del espacio disponible: el lienzo entero a la vista
    useLayoutEffect(() => {
        const elemento = contenedor.current;
        if (!elemento) return undefined;
        function medir() {
            const disponibleAncho = elemento.clientWidth - MARGEN * 2;
            const disponibleAlto = window.innerHeight * ALTO_MAXIMO - MARGEN * 2;
            setZoom(Math.max(0.05, Math.min(disponibleAncho / ancho, disponibleAlto / alto, 4)));
        }
        medir();
        const observador = new ResizeObserver(medir);
        observador.observe(elemento);
        window.addEventListener('resize', medir);
        return () => {
            observador.disconnect();
            window.removeEventListener('resize', medir);
        };
    }, [ancho, alto]);

    // Carga las imágenes de las capas (y la del frame) que todavía no tiene
    useEffect(() => {
        let vigente = true;
        const urls = [imagen, ...(capas || []).map((c) => c.imagen)].filter(Boolean);
        const faltan = urls.filter((url) => !imagenes.has(url) && !fallidas.current.has(url));
        if (faltan.length === 0) return undefined;
        Promise.all(faltan.map((url) => cargarImagen(url).then((img) => [url, img], () => {
            fallidas.current.add(url);
            return null;
        }))).then((cargadas) => {
            if (!vigente) return;
            setImagenes((actuales) => {
                const nuevas = new Map(actuales);
                cargadas.filter(Boolean).forEach(([url, img]) => nuevas.set(url, img));
                // Solo se guardan las del frame actual: así la memoria no crece al recorrer la animación
                const vigentes = new Set(urls);
                for (const url of nuevas.keys()) if (!vigentes.has(url)) nuevas.delete(url);
                return nuevas;
            });
        });
        return () => { vigente = false; };
    }, [imagen, capas, imagenes]);

    // Cuando llegan las capas nuevas (ya aplicado), se deja de mostrar la transformación pendiente
    useEffect(() => setPendiente(null), [capas]);
    useEffect(() => { if (!ocupado) setPendiente(null); }, [ocupado]);

    const transformacion = vista.t || pendiente;

    // ---- dibujo ----
    useLayoutEffect(() => {
        const canvas = lienzo.current;
        if (!canvas || !zoom) return;
        const ratio = window.devicePixelRatio || 1;
        const anchoPantalla = Math.round(ancho * zoom) + MARGEN * 2;
        const altoPantalla = Math.round(alto * zoom) + MARGEN * 2;
        canvas.width = anchoPantalla * ratio;
        canvas.height = altoPantalla * ratio;
        canvas.style.width = `${anchoPantalla}px`;
        canvas.style.height = `${altoPantalla}px`;
        const ctx = canvas.getContext('2d');
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        ctx.clearRect(0, 0, anchoPantalla, altoPantalla);

        ctx.save();
        ctx.translate(MARGEN, MARGEN);
        ctx.scale(zoom, zoom);
        // Fondo cuadriculado del lienzo
        const cuadro = 8 / zoom;
        for (let y = 0; y < alto; y += cuadro) {
            for (let x = 0; x < ancho; x += cuadro) {
                ctx.fillStyle = (Math.floor(x / cuadro) + Math.floor(y / cuadro)) % 2 ? '#2d2d2d' : '#3b3b3b';
                ctx.fillRect(x, y, Math.min(cuadro, ancho - x), Math.min(cuadro, alto - y));
            }
        }
        if (capas) {
            for (const capa of capas) {
                const img = capa.imagen && imagenes.get(capa.imagen);
                if (!capa.visible || !img) continue;
                if (capa === capaFila && ocultarFila) continue;
                const origen = origenEnZona(img, ancho, alto);
                ctx.save();
                if (capa === capaFila && transformacion && caja) aplicarTransformacion(ctx, caja, transformacion);
                ctx.drawImage(img, origen.x - ancho, origen.y - alto);
                ctx.restore();
            }
        } else if (imagen && imagenes.get(imagen)) {
            ctx.drawImage(imagenes.get(imagen), 0, 0, ancho, alto);
        }
        if (textoVivo) dibujarTexto(ctx, textoVivo);
        ctx.restore();

        // Lo que queda fuera del lienzo se oscurece, y el borde del lienzo se marca
        ctx.save();
        ctx.fillStyle = 'rgba(20, 20, 20, 0.7)';
        ctx.beginPath();
        ctx.rect(0, 0, anchoPantalla, altoPantalla);
        ctx.rect(MARGEN, MARGEN, ancho * zoom, alto * zoom);
        ctx.fill('evenodd');
        ctx.strokeStyle = '#5a5a5a';
        ctx.strokeRect(MARGEN - 0.5, MARGEN - 0.5, ancho * zoom + 1, alto * zoom + 1);
        ctx.restore();

        // Marcas: la caja de la fila con sus manijas, el contorno mientras se transforma y el rectángulo nuevo
        ctx.save();
        ctx.translate(MARGEN, MARGEN);
        ctx.scale(zoom, zoom);
        ctx.lineWidth = 1 / zoom;
        ctx.strokeStyle = '#4da3ff';
        if (caja && herramienta === 'mover') {
            if (transformacion) {
                const esquinas = esquinasTransformadas(caja, transformacion);
                ctx.beginPath();
                esquinas.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
                ctx.closePath();
                ctx.stroke();
            } else {
                ctx.strokeRect(caja.x, caja.y, caja.ancho, caja.alto);
                dibujarManijas(ctx, caja, zoom);
            }
        }
        if (vista.rect) {
            ctx.fillStyle = color;
            ctx.globalAlpha = 0.8;
            ctx.fillRect(vista.rect.x, vista.rect.y, vista.rect.ancho, vista.rect.alto);
            ctx.globalAlpha = 1;
            ctx.setLineDash([4 / zoom, 4 / zoom]);
            ctx.strokeRect(vista.rect.x, vista.rect.y, vista.rect.ancho, vista.rect.alto);
        }
        ctx.restore();
    }, [zoom, ancho, alto, capas, imagen, imagenes, capaFila, ocultarFila, transformacion, caja, herramienta, textoVivo, vista.rect, color]);

    // ---- mouse ----
    function punto(evento) {
        const rect = lienzo.current.getBoundingClientRect();
        return { x: (evento.clientX - rect.left - MARGEN) / zoom, y: (evento.clientY - rect.top - MARGEN) / zoom };
    }

    function dentroDeCaja(p) {
        return caja && p.x >= caja.x && p.x <= caja.x + caja.ancho && p.y >= caja.y && p.y <= caja.y + caja.alto;
    }

    function empezar(evento) {
        if (evento.button !== 0 || ocupado || !zoom) return;
        const p = punto(evento);
        if (herramienta === 'texto') {
            onTexto({ x: Math.round(p.x), y: Math.round(p.y) });
            return;
        }
        lienzo.current.setPointerCapture(evento.pointerId);
        if (herramienta === 'rectangulo') {
            gesto.current = { tipo: 'rectangulo', inicio: p };
            return;
        }
        const manija = caja && manijaEnPunto(caja, p, zoom);
        if (manija) {
            gesto.current = { tipo: manija === 'giro' ? 'girar' : 'escalar', manija, inicio: p };
        } else if (dentroDeCaja(p)) {
            gesto.current = { tipo: 'mover', inicio: p };
        } else {
            gesto.current = null;
            onPunto(p);
        }
    }

    function seguir(evento) {
        const p = punto(evento);
        const actual = gesto.current;
        if (!actual) {
            const manija = herramienta === 'mover' && caja && manijaEnPunto(caja, p, zoom);
            let cursor = 'default';
            if (herramienta === 'rectangulo' || herramienta === 'texto') cursor = herramienta === 'texto' ? 'text' : 'crosshair';
            else if (manija) cursor = CURSOR_MANIJA[manija];
            else if (dentroDeCaja(p)) cursor = 'move';
            lienzo.current.style.cursor = cursor;
            return;
        }
        if (actual.tipo === 'rectangulo') {
            const x = Math.round(Math.min(actual.inicio.x, p.x));
            const y = Math.round(Math.min(actual.inicio.y, p.y));
            setVista({ t: null, rect: { x, y, ancho: Math.round(Math.abs(p.x - actual.inicio.x)), alto: Math.round(Math.abs(p.y - actual.inicio.y)) } });
            return;
        }
        let t;
        if (actual.tipo === 'mover') {
            let dx = p.x - actual.inicio.x;
            let dy = p.y - actual.inicio.y;
            if (evento.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; } // solo en un eje
            t = { ...SIN_TRANSFORMACION, dx: Math.round(dx), dy: Math.round(dy) };
        } else if (actual.tipo === 'girar') {
            t = giroPorManija(caja, actual.inicio, p, evento.shiftKey);
        } else {
            t = escalaPorEsquina(caja, actual.manija, p, evento.shiftKey);
        }
        setVista({ t, rect: null });
    }

    function terminar() {
        const actual = gesto.current;
        gesto.current = null;
        const { t, rect } = vista;
        setVista({ t: null, rect: null });
        if (!actual) return;
        if (actual.tipo === 'rectangulo') {
            if (rect && rect.ancho >= 2 && rect.alto >= 2) onRectangulo(rect);
            return;
        }
        if (t && !esSinTransformacion(t)) {
            setPendiente(t);
            onTransformar(t);
        }
    }

    return (
        <div className="escenario-video" ref={contenedor}>
            <canvas
                ref={lienzo}
                className="escenario-lienzo"
                data-testid="escenario"
                onPointerDown={empezar}
                onPointerMove={seguir}
                onPointerUp={terminar}
                onPointerCancel={terminar}
            />
        </div>
    );
}

export default EscenarioVideo;
