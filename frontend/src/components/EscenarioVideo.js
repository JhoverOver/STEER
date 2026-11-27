import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cargarImagen, origenEnZona } from '../utils/imagenes';
import { dibujarManijas } from '../utils/superpuesto';
import { esquinasTransformadas } from '../utils/herramientas';
import { manijaEnPunto, escalaPorEsquina, giroPorManija, esSinTransformacion, CURSOR_MANIJA, SIN_TRANSFORMACION } from '../utils/manijas';

const MARGEN = 40; // px de pantalla alrededor del lienzo: deja ver (y tomar) lo que queda un poco afuera
const ALTO_MAXIMO = 0.55; // del alto de la ventana
const IMAN = 8; // px de pantalla: a esta distancia, lo que se mueve se pega a los bordes y al centro del lienzo

// Pega la caja movida (dx, dy) a los bordes y al centro del lienzo si pasa cerca. Devuelve { dx, dy, guias }
export function pegarAlLienzo(caja, dx, dy, ancho, alto, umbral) {
    const eje = (inicio, tamano, desplazamiento, lado) => {
        let mejor = null;
        for (const linea of [0, lado / 2, lado]) {
            for (const ancla of [0, tamano / 2, tamano]) {
                const distancia = Math.abs(inicio + desplazamiento + ancla - linea);
                if (distancia <= umbral && (!mejor || distancia < mejor.distancia)) mejor = { distancia, linea, ancla };
            }
        }
        return mejor ? { valor: mejor.linea - mejor.ancla - inicio, guia: mejor.linea } : { valor: desplazamiento, guia: null };
    };
    const x = eje(caja.x, caja.ancho, dx, ancho);
    const y = eje(caja.y, caja.alto, dy, alto);
    return { dx: Math.round(x.valor), dy: Math.round(y.valor), guias: { x: x.guia, y: y.guia } };
}

// Escenario de la pestaña Video: muestra el frame actual y, encima, lo que se está cambiando sin aplicar.
//  - Mover: clic en un objeto elige su capa; arrastrar dentro de la caja la mueve (se pega a los bordes y al centro
//    del lienzo; Shift: solo en un eje), las esquinas la escalan (Shift: sin mantener la proporción) y la manija
//    redonda la gira (Shift: de 15 en 15°).
//  - Rectángulo: arrastrar dibuja un rectángulo de color.  Texto: clic donde va el texto.
// Lo que se arrastra se ve en vivo; al soltar se avisa con onGesto, y la pestaña lo deja pendiente hasta aplicarlo.
// Coordenadas: píxeles del lienzo.
//
// Props:
//   imagen          imagen compuesta del frame (se usa mientras no hay capas)
//   capas           capas del frame actual, de abajo hacia arriba (null mientras cargan)
//   ancho, alto     tamaño del lienzo
//   herramienta     'mover' | 'rectangulo' | 'texto';  color: el del rectángulo nuevo
//   caja            caja con manijas de lo que se está cambiando (o null);  contorno: sus 4 esquinas, si está girada
//   capaOculta      capa que no se dibuja (la pestaña la dibuja con sus cambios en dibujarEncima)
//   dibujarEncima(ctx, gesto, imagenes)   dibuja lo pendiente; "gesto" es lo que se está arrastrando (o sin cambios)
//   urlsExtra       otras imágenes que dibujarEncima necesita cargadas
//   ocupado         se está aplicando algo: no se puede empezar otra acción
//   onPunto(punto)  clic con Mover fuera de la caja;  onGesto(t) al soltar;  onRectangulo(rect);  onTexto(punto)
function EscenarioVideo({
    imagen, capas, ancho, alto, herramienta, color, caja, contorno = null, capaOculta = null, dibujarEncima,
    urlsExtra = [], ocupado = false, onPunto, onGesto, onRectangulo, onTexto,
}) {
    const contenedor = useRef(null);
    const lienzo = useRef(null);
    const [zoom, setZoom] = useState(0);
    const [imagenes, setImagenes] = useState(() => new Map()); // URL -> imagen cargada
    const gesto = useRef(null);
    const fallidas = useRef(new Set()); // imágenes que no se pudieron cargar: no se reintentan
    const [vista, setVista] = useState({ t: null, rect: null, guias: null }); // lo que se está arrastrando

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

    // Carga las imágenes de las capas, la del frame y las extra que todavía no tiene
    const claveUrls = [imagen, ...(capas || []).map((c) => c.imagen), ...urlsExtra].filter(Boolean).join('|');
    useEffect(() => {
        let vigente = true;
        const urls = claveUrls ? claveUrls.split('|') : [];
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
                // Solo se guardan las que se usan ahora: así la memoria no crece al recorrer la animación
                const vigentes = new Set(urls);
                for (const url of nuevas.keys()) if (!vigentes.has(url)) nuevas.delete(url);
                return nuevas;
            });
        });
        return () => { vigente = false; };
    }, [claveUrls, imagenes]);

    const gestoVivo = vista.t || SIN_TRANSFORMACION;

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
        let encimaDibujado = false;
        const encima = () => {
            if (encimaDibujado || !dibujarEncima) return;
            encimaDibujado = true;
            ctx.save();
            dibujarEncima(ctx, gestoVivo, imagenes);
            ctx.restore();
        };
        if (capas) {
            for (const capa of capas) {
                // Lo pendiente de una capa se dibuja en su lugar de la pila
                if (capa === capaOculta) {
                    encima();
                    continue;
                }
                const img = capa.imagen && imagenes.get(capa.imagen);
                if (!capa.visible || !img) continue;
                const origen = origenEnZona(img, ancho, alto);
                ctx.drawImage(img, origen.x - ancho, origen.y - alto);
            }
        } else if (imagen && imagenes.get(imagen)) {
            ctx.drawImage(imagenes.get(imagen), 0, 0, ancho, alto);
        }
        encima();
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

        // Marcas: la caja con sus manijas (o su contorno mientras se arrastra), las guías del imán y el rectángulo nuevo
        ctx.save();
        ctx.translate(MARGEN, MARGEN);
        ctx.scale(zoom, zoom);
        ctx.lineWidth = 1 / zoom;
        ctx.strokeStyle = '#4da3ff';
        const poligono = (puntos) => {
            ctx.beginPath();
            puntos.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
            ctx.closePath();
            ctx.stroke();
        };
        if (caja && herramienta === 'mover') {
            if (vista.t) {
                poligono(esquinasTransformadas(caja, vista.t));
            } else {
                if (contorno) poligono(contorno);
                else ctx.strokeRect(caja.x, caja.y, caja.ancho, caja.alto);
                dibujarManijas(ctx, caja, zoom);
            }
        }
        if (vista.guias) {
            ctx.strokeStyle = '#ff3df2';
            if (vista.guias.x !== null) {
                ctx.beginPath();
                ctx.moveTo(vista.guias.x, -MARGEN / zoom);
                ctx.lineTo(vista.guias.x, alto + MARGEN / zoom);
                ctx.stroke();
            }
            if (vista.guias.y !== null) {
                ctx.beginPath();
                ctx.moveTo(-MARGEN / zoom, vista.guias.y);
                ctx.lineTo(ancho + MARGEN / zoom, vista.guias.y);
                ctx.stroke();
            }
        }
        if (vista.rect) {
            ctx.strokeStyle = '#4da3ff';
            ctx.fillStyle = color;
            ctx.globalAlpha = 0.8;
            ctx.fillRect(vista.rect.x, vista.rect.y, vista.rect.ancho, vista.rect.alto);
            ctx.globalAlpha = 1;
            ctx.setLineDash([4 / zoom, 4 / zoom]);
            ctx.strokeRect(vista.rect.x, vista.rect.y, vista.rect.ancho, vista.rect.alto);
        }
        ctx.restore();
    });

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
            const rect = { x, y, ancho: Math.round(Math.abs(p.x - actual.inicio.x)), alto: Math.round(Math.abs(p.y - actual.inicio.y)) };
            setVista({ t: null, rect, guias: null });
            return;
        }
        let t;
        let guias = null;
        if (actual.tipo === 'mover') {
            let dx = p.x - actual.inicio.x;
            let dy = p.y - actual.inicio.y;
            if (evento.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; } // solo en un eje
            const pegado = pegarAlLienzo(caja, dx, dy, ancho, alto, IMAN / zoom);
            if (!evento.shiftKey || dx !== 0) dx = pegado.dx;
            if (!evento.shiftKey || dy !== 0) dy = pegado.dy;
            guias = pegado.guias;
            t = { ...SIN_TRANSFORMACION, dx: Math.round(dx), dy: Math.round(dy) };
        } else if (actual.tipo === 'girar') {
            t = giroPorManija(caja, actual.inicio, p, evento.shiftKey);
        } else {
            t = escalaPorEsquina(caja, actual.manija, p, evento.shiftKey);
        }
        setVista({ t, rect: null, guias });
    }

    function terminar() {
        const actual = gesto.current;
        gesto.current = null;
        const { t, rect } = vista;
        setVista({ t: null, rect: null, guias: null });
        if (!actual) return;
        if (actual.tipo === 'rectangulo') {
            if (rect && rect.ancho >= 2 && rect.alto >= 2) onRectangulo(rect);
            return;
        }
        if (t && !esSinTransformacion(t)) onGesto(t);
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
