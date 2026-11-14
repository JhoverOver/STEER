import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import {
    mensajeCapaNoEditable, dibujarTrazo, borrarTrazo, borrarRegion, transformarRegion,
    rectanguloDeTrazo, rectanguloDeSeleccion, rectanguloAfectado, rectanguloTransformado,
    recortarARectangulo, unirRectangulos, limitarEscala, copiarCanvas, leerRegion, escribirRegion,
} from '../utils/herramientas';
import {
    crearHistorialEditor, registrarCambio, deshacer, rehacer, puedeDeshacer, puedeRehacer, descartarCapa,
} from '../utils/historialEditor';
import {
    medidasArea, rectLienzo, limitarZoom, zoomParaAjustar, siguienteZoom, scrollParaFijarPunto,
    franjasFuera, hayPixelesVisibles,
} from '../utils/areaTrabajo';

// El lienzo del editor: muestra el fotograma compuesto por sus capas visibles (RF35) y recibe el mouse.
// Cada capa tiene su propio canvas oculto (los píxeles viven ahí, no en React); el canvas que se ve
// solo es la suma de los canvas de las capas visibles, de abajo hacia arriba. Un segundo canvas,
// transparente y encima, dibuja el borde de la selección sin ensuciar la imagen.
//
// Las capas no miden lo mismo que el lienzo del proyecto: miden una zona de trabajo más grande (utils/areaTrabajo.js)
// con el lienzo en el centro. Lo que se mueve hacia afuera queda en la capa y se puede volver a traer.
// Todas las coordenadas de este archivo son de la zona de trabajo, no del lienzo.
//
// La zona se ve dentro de un visor con zoom (rueda del mouse) y desplazamiento (barra espaciadora o botón
// central del mouse y arrastrar).
//
// Props:
//   ancho, alto      tamaño del lienzo en píxeles
//   capas            lista de capas (utils/capas.js); la primera es la de abajo
//   claveActiva      clave de la capa donde se dibuja
//   herramienta      'pincel', 'borrador', 'seleccion' o 'mover'
//   color, tamano    color (#rrggbb) y grosor del pincel o borrador
//   onCapaModificada(clave, rect)   se llama al terminar un cambio en una capa (trazo, mover, deshacer...)
//   onHistorialCambia({ puedeDeshacer, puedeRehacer })
//   onSeleccionCambia(rect o null)  rectángulo seleccionado, o null si no hay selección
//   onAviso(mensaje) se llama si se intenta modificar una capa oculta o bloqueada (RF39)
//   onZoomCambia(zoom)  el zoom actual (1 = 100 %), cada vez que cambia
const Lienzo = forwardRef(function Lienzo(
    {
        ancho, alto, capas, claveActiva, herramienta, color, tamano,
        onCapaModificada, onHistorialCambia, onSeleccionCambia, onAviso, onZoomCambia,
    },
    ref
) {
    const area = medidasArea(ancho, alto); // tamaño de la zona de trabajo
    const centro = rectLienzo(ancho, alto); // donde queda el lienzo del proyecto dentro de la zona
    const visorRef = useRef(null);
    const visibleRef = useRef(null);
    const superpuestoRef = useRef(null);
    const canvasCapas = useRef(new Map()); // clave de la capa -> su canvas oculto
    const historial = useRef(crearHistorialEditor());
    const gesto = useRef(null); // lo que se está haciendo con el mouse: trazo, selección o mover
    const seleccion = useRef(null); // rectángulo seleccionado de la capa activa, o null
    const vistaPrevia = useRef(null); // al arrastrar con "mover": { clave, base, flotante, x, y }
    const rectVisual = useRef(null); // rectángulo de selección que se está dibujando
    const [zoom, setZoom] = useState(1);
    const zoomRef = useRef(1);
    const zoomPintado = useRef(1); // el zoom con el que está dibujado el visor ahora mismo
    const fijarPunto = useRef(null); // tras cambiar el zoom: qué punto de la zona debe quedar bajo el cursor
    const [espacio, setEspacio] = useState(false); // barra espaciadora presionada: arrastrar mueve la vista
    const espacioRef = useRef(false);

    // El canvas de una capa; si no existe todavía, lo crea vacío
    const obtenerCanvas = useCallback((clave) => {
        let canvas = canvasCapas.current.get(clave);
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.width = area.ancho;
            canvas.height = area.alto;
            canvas.getContext('2d', { willReadFrequently: true });
            canvasCapas.current.set(clave, canvas);
        }
        return canvas;
    }, [area.ancho, area.alto]);

    // Vuelve a dibujar el canvas visible: las capas visibles, de abajo hacia arriba.
    // Mientras se arrastra con "mover", la capa movida se dibuja desde la vista previa.
    const redibujar = useCallback(() => {
        const visible = visibleRef.current;
        if (!visible) return;
        const ctx = visible.getContext('2d');
        ctx.clearRect(0, 0, area.ancho, area.alto);
        for (const capa of capas) {
            const canvas = canvasCapas.current.get(capa.clave);
            if (!capa.visible || !canvas) continue;
            const previa = vistaPrevia.current;
            if (previa && previa.clave === capa.clave) {
                ctx.drawImage(previa.base, 0, 0);
                ctx.drawImage(previa.flotante, previa.x, previa.y);
            } else {
                ctx.drawImage(canvas, 0, 0);
            }
        }
    }, [capas, area.ancho, area.alto]);

    // Dibuja encima de la imagen, sin ensuciarla: oscurece lo que queda fuera del lienzo, marca el borde del
    // lienzo y dibuja el borde de la selección (línea punteada blanca y negra para verse sobre cualquier color)
    const pintarSuperpuesto = useCallback(() => {
        const superpuesto = superpuestoRef.current;
        if (!superpuesto) return;
        const ctx = superpuesto.getContext('2d');
        const grosor = 1 / zoomRef.current; // 1 px en pantalla, sea cual sea el zoom
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

        const rect = rectVisual.current;
        if (!rect) return;
        ctx.save();
        ctx.lineWidth = grosor;
        ctx.setLineDash([6 * grosor, 6 * grosor]);
        ctx.strokeStyle = '#000000';
        ctx.strokeRect(rect.x + grosor / 2, rect.y + grosor / 2, rect.ancho - grosor, rect.alto - grosor);
        ctx.lineDashOffset = 6 * grosor;
        ctx.strokeStyle = '#ffffff';
        ctx.strokeRect(rect.x + grosor / 2, rect.y + grosor / 2, rect.ancho - grosor, rect.alto - grosor);
        ctx.restore();
    }, [area.ancho, area.alto, centro.x, centro.y, centro.ancho, centro.alto]);

    function dibujarSeleccion(rect) {
        rectVisual.current = rect;
        pintarSuperpuesto();
    }

    function fijarSeleccion(rect) {
        seleccion.current = rect;
        dibujarSeleccion(rect);
        if (onSeleccionCambia) onSeleccionCambia(rect);
    }

    function avisarHistorial() {
        if (onHistorialCambia) {
            onHistorialCambia({ puedeDeshacer: puedeDeshacer(historial.current), puedeRehacer: puedeRehacer(historial.current) });
        }
    }

    // Mantiene un canvas por capa: crea los que faltan (cargando la imagen que llegó del servidor)
    // y descarta los de las capas que ya no existen
    useEffect(() => {
        const vigentes = new Set(capas.map((capa) => capa.clave));
        for (const clave of [...canvasCapas.current.keys()]) {
            if (!vigentes.has(clave)) {
                canvasCapas.current.delete(clave);
                historial.current = descartarCapa(historial.current, clave);
            }
        }
        for (const capa of capas) {
            const existe = canvasCapas.current.has(capa.clave);
            const canvas = obtenerCanvas(capa.clave);
            if (!existe && capa.imagen) {
                const imagen = new Image();
                imagen.onload = () => {
                    // La capa pudo eliminarse mientras la imagen cargaba
                    if (canvasCapas.current.get(capa.clave) === canvas) {
                        // Una capa guardada con contenido fuera del lienzo mide toda la zona; las demás miden solo
                        // el lienzo y van al centro
                        const completa = imagen.naturalWidth === area.ancho && imagen.naturalHeight === area.alto;
                        canvas.getContext('2d').drawImage(imagen, completa ? 0 : centro.x, completa ? 0 : centro.y);
                        redibujar();
                    }
                };
                imagen.src = capa.imagen;
            }
        }
        redibujar();
        avisarHistorial();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [capas, obtenerCanvas, redibujar]);

    // La selección pertenece a una capa: al cambiar de capa activa se quita
    useEffect(() => {
        if (seleccion.current) fijarSeleccion(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [claveActiva]);

    // Posición del mouse en píxeles de la zona de trabajo (con zoom el canvas se ve más grande o más chico que su tamaño real)
    function posicion(evento) {
        const caja = superpuestoRef.current.getBoundingClientRect();
        return {
            x: ((evento.clientX - caja.left) * area.ancho) / caja.width,
            y: ((evento.clientY - caja.top) * area.alto) / caja.height,
        };
    }

    // La capa activa, solo si se puede modificar; si no, avisa y devuelve null (RF39)
    function capaEditableOAviso() {
        const activa = capas.find((capa) => capa.clave === claveActiva);
        const aviso = mensajeCapaNoEditable(activa);
        if (aviso) {
            if (onAviso) onAviso(aviso);
            return null;
        }
        return activa;
    }

    // Guarda en el historial los píxeles de "rect" y aplica el cambio con "operar(ctx)"
    function aplicarCambio(clave, rect, operar) {
        const ctx = obtenerCanvas(clave).getContext('2d');
        const antes = leerRegion(ctx, rect);
        operar(ctx);
        historial.current = registrarCambio(historial.current, { clave, ...rect, pixeles: antes });
        redibujar();
        if (onCapaModificada) onCapaModificada(clave, rect);
        avisarHistorial();
    }

    // ---------- Mouse ----------

    function dibujarTramo(ctx, desde, hasta) {
        if (herramienta === 'borrador') borrarTrazo(ctx, desde, hasta, tamano);
        else dibujarTrazo(ctx, desde, hasta, color, tamano);
    }

    function empezarGesto(evento) {
        // Botón central, o barra espaciadora: se mueve la vista en vez de dibujar
        if (evento.button === 1 || (evento.button === 0 && espacioRef.current)) {
            evento.preventDefault();
            evento.currentTarget.setPointerCapture(evento.pointerId);
            const visor = visorRef.current;
            gesto.current = {
                tipo: 'vista', x: evento.clientX, y: evento.clientY, izquierda: visor.scrollLeft, arriba: visor.scrollTop,
            };
            return;
        }
        if (evento.button !== 0) return;
        const punto = posicion(evento);

        if (herramienta === 'seleccion') {
            evento.currentTarget.setPointerCapture(evento.pointerId);
            gesto.current = { tipo: 'seleccion', inicio: punto, rect: null };
            return;
        }

        if (!capaEditableOAviso()) return;
        evento.currentTarget.setPointerCapture(evento.pointerId);
        const canvas = obtenerCanvas(claveActiva);

        if (herramienta === 'mover') {
            // El contenido que se mueve: la selección, o toda la capa si no hay selección
            const region = seleccion.current || { x: 0, y: 0, ancho: area.ancho, alto: area.alto };
            const base = copiarCanvas(canvas);
            base.getContext('2d').clearRect(region.x, region.y, region.ancho, region.alto);
            gesto.current = {
                tipo: 'mover', clave: claveActiva, inicio: punto, region, dx: 0, dy: 0,
            };
            vistaPrevia.current = { clave: claveActiva, base, flotante: copiarCanvas(canvas, region), x: region.x, y: region.y };
            return;
        }

        // Pincel o borrador: foto de la capa antes del trazo, de ahí sale lo que se guarda para deshacer
        gesto.current = {
            tipo: 'trazo',
            clave: claveActiva,
            ultimo: punto,
            rect: rectanguloDeTrazo(punto, punto, tamano, area.ancho, area.alto),
            copia: copiarCanvas(canvas),
        };
        dibujarTramo(canvas.getContext('2d'), punto, punto);
        redibujar();
    }

    function seguirGesto(evento) {
        const actual = gesto.current;
        if (!actual) return;

        if (actual.tipo === 'vista') {
            visorRef.current.scrollLeft = actual.izquierda - (evento.clientX - actual.x);
            visorRef.current.scrollTop = actual.arriba - (evento.clientY - actual.y);
            return;
        }
        const punto = posicion(evento);

        if (actual.tipo === 'seleccion') {
            actual.rect = rectanguloDeSeleccion(actual.inicio, punto, area.ancho, area.alto);
            dibujarSeleccion(actual.rect);
        } else if (actual.tipo === 'mover') {
            actual.dx = Math.round(punto.x - actual.inicio.x);
            actual.dy = Math.round(punto.y - actual.inicio.y);
            vistaPrevia.current.x = actual.region.x + actual.dx;
            vistaPrevia.current.y = actual.region.y + actual.dy;
            if (seleccion.current) {
                dibujarSeleccion({ ...actual.region, x: actual.region.x + actual.dx, y: actual.region.y + actual.dy });
            }
            redibujar();
        } else {
            dibujarTramo(obtenerCanvas(actual.clave).getContext('2d'), actual.ultimo, punto);
            actual.rect = unirRectangulos(actual.rect, rectanguloDeTrazo(actual.ultimo, punto, tamano, area.ancho, area.alto));
            actual.ultimo = punto;
            redibujar();
        }
    }

    function terminarGesto() {
        const actual = gesto.current;
        gesto.current = null;
        if (!actual) return;

        if (actual.tipo === 'vista') return;
        if (actual.tipo === 'seleccion') {
            fijarSeleccion(actual.rect);
        } else if (actual.tipo === 'mover') {
            vistaPrevia.current = null;
            if (actual.dx === 0 && actual.dy === 0) {
                redibujar();
                return;
            }
            const movimiento = { dx: actual.dx, dy: actual.dy };
            const rect = rectanguloAfectado(actual.region, movimiento, area.ancho, area.alto);
            aplicarCambio(actual.clave, rect, (ctx) => transformarRegion(ctx, actual.region, movimiento));
            if (seleccion.current) {
                fijarSeleccion(recortarARectangulo(rectanguloTransformado(actual.region, movimiento), area.ancho, area.alto));
            }
        } else if (actual.rect) {
            const antes = leerRegion(actual.copia.getContext('2d'), actual.rect);
            historial.current = registrarCambio(historial.current, { clave: actual.clave, ...actual.rect, pixeles: antes });
            if (onCapaModificada) onCapaModificada(actual.clave, actual.rect);
            avisarHistorial();
        }
    }

    // Copia a un canvas nuevo solo lo que cae dentro del lienzo del proyecto
    function recortarAlLienzo(origen) {
        const recorte = document.createElement('canvas');
        recorte.width = ancho;
        recorte.height = alto;
        recorte.getContext('2d').drawImage(origen, -centro.x, -centro.y);
        return recorte;
    }

    // ---------- Zoom y vista ----------

    // Cambia el zoom dejando quieto el punto de la zona que está bajo el cursor (o el centro del visor)
    function cambiarZoom(nuevo, cliente) {
        const visor = visorRef.current;
        const limitado = limitarZoom(nuevo);
        if (!visor || limitado === zoomRef.current) return;
        const caja = visor.getBoundingClientRect();
        const puntoX = cliente ? cliente.x - caja.left : visor.clientWidth / 2;
        const puntoY = cliente ? cliente.y - caja.top : visor.clientHeight / 2;
        fijarPunto.current = {
            x: (visor.scrollLeft + puntoX) / zoomRef.current,
            y: (visor.scrollTop + puntoY) / zoomRef.current,
            pantallaX: puntoX,
            pantallaY: puntoY,
        };
        zoomRef.current = limitado;
        setZoom(limitado);
    }

    // Hace caber el lienzo del proyecto en el visor y lo deja centrado
    function ajustar() {
        const visor = visorRef.current;
        if (!visor) return;
        const ajustado = zoomParaAjustar(visor.clientWidth, visor.clientHeight, ancho, alto);
        fijarPunto.current = {
            x: area.ancho / 2, y: area.alto / 2, pantallaX: visor.clientWidth / 2, pantallaY: visor.clientHeight / 2,
        };
        if (ajustado === zoomRef.current && zoomPintado.current === ajustado) {
            // El zoom no cambia y el visor ya está dibujado con él, así que no habrá nuevo dibujo que corrija el scroll: se centra aquí
            visor.scrollLeft = scrollParaFijarPunto(fijarPunto.current.x, fijarPunto.current.pantallaX, ajustado);
            visor.scrollTop = scrollParaFijarPunto(fijarPunto.current.y, fijarPunto.current.pantallaY, ajustado);
            fijarPunto.current = null;
            return;
        }
        zoomRef.current = ajustado;
        setZoom(ajustado);
    }

    // Después de cambiar el zoom, el scroll se corrige para que el punto fijado no se mueva
    useLayoutEffect(() => {
        zoomPintado.current = zoom;
        const visor = visorRef.current;
        const punto = fijarPunto.current;
        if (visor && punto) {
            visor.scrollLeft = scrollParaFijarPunto(punto.x, punto.pantallaX, zoom);
            visor.scrollTop = scrollParaFijarPunto(punto.y, punto.pantallaY, zoom);
            fijarPunto.current = null;
        }
        pintarSuperpuesto(); // el grosor de las líneas depende del zoom
        if (onZoomCambia) onZoomCambia(zoom);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [zoom, pintarSuperpuesto]);

    // Al abrir, el lienzo del proyecto se ve entero y centrado
    useLayoutEffect(() => {
        ajustar();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Rueda del mouse: zoom hacia el cursor. Se registra a mano porque React la trata como pasiva y
    // entonces no podría evitar que la página se desplace.
    useEffect(() => {
        const visor = visorRef.current;
        if (!visor) return undefined;
        function alRodar(evento) {
            evento.preventDefault();
            const factor = evento.deltaY < 0 ? 1.1 : 1 / 1.1;
            cambiarZoom(zoomRef.current * factor, { x: evento.clientX, y: evento.clientY });
        }
        visor.addEventListener('wheel', alRodar, { passive: false });
        return () => visor.removeEventListener('wheel', alRodar);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Barra espaciadora: mientras está presionada, arrastrar mueve la vista
    useEffect(() => {
        const escribiendo = (evento) => {
            const destino = evento.target;
            return destino && (destino.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(destino.tagName));
        };
        function alPresionar(evento) {
            if (evento.code !== 'Space' || escribiendo(evento)) return;
            evento.preventDefault();
            espacioRef.current = true;
            setEspacio(true);
        }
        function alSoltar(evento) {
            if (evento.code !== 'Space') return;
            espacioRef.current = false;
            setEspacio(false);
        }
        window.addEventListener('keydown', alPresionar);
        window.addEventListener('keyup', alSoltar);
        return () => {
            window.removeEventListener('keydown', alPresionar);
            window.removeEventListener('keyup', alSoltar);
        };
    }, []);

    // ---------- Operaciones que pide el editor ----------

    function recorrerHistorial(accion) {
        if (gesto.current) return;
        const leer = (clave, x, y, w, h) => leerRegion(obtenerCanvas(clave).getContext('2d'), { x, y, ancho: w, alto: h });
        const escribir = (clave, x, y, pixeles) => escribirRegion(obtenerCanvas(clave).getContext('2d'), x, y, pixeles);
        const { historial: nuevo, entrada } = accion(historial.current, leer, escribir);
        if (!entrada) return;
        historial.current = nuevo;
        redibujar();
        if (seleccion.current) fijarSeleccion(null);
        if (onCapaModificada) onCapaModificada(entrada.clave, { x: entrada.x, y: entrada.y, ancho: entrada.ancho, alto: entrada.alto });
        avisarHistorial();
    }

    // Escala y gira desde el centro, y mueve, el contenido de la selección o de toda la capa (RF41 a RF43)
    function transformar(parametros) {
        if (gesto.current || !capaEditableOAviso()) return false;
        const region = seleccion.current || { x: 0, y: 0, ancho: area.ancho, alto: area.alto };
        const { dx = 0, dy = 0, angulo = 0 } = parametros;
        const transformacion = { dx: Math.round(dx), dy: Math.round(dy), angulo, escala: limitarEscala(parametros.escala ?? 1) };
        const rect = rectanguloAfectado(region, transformacion, area.ancho, area.alto);
        if (!rect) return false;
        aplicarCambio(claveActiva, rect, (ctx) => transformarRegion(ctx, region, transformacion));
        if (seleccion.current) {
            // Al girar, el rectángulo que envuelve el contenido ya no coincide con él: se quita la selección
            fijarSeleccion(angulo === 0
                ? recortarARectangulo(rectanguloTransformado(region, transformacion), area.ancho, area.alto)
                : null);
        }
        return true;
    }

    // Borra el contenido de la selección (RF38)
    function borrarSeleccion() {
        if (gesto.current || !seleccion.current || !capaEditableOAviso()) return false;
        aplicarCambio(claveActiva, seleccion.current, (ctx) => borrarRegion(ctx, seleccion.current));
        return true;
    }

    // Lo que el editor puede pedirle al lienzo
    useImperativeHandle(ref, () => ({
        deshacer: () => recorrerHistorial(deshacer),
        rehacer: () => recorrerHistorial(rehacer),
        transformar,
        borrarSeleccion,
        seleccionarTodo: () => fijarSeleccion({ ...centro }), // todo el lienzo del proyecto
        acercar: () => cambiarZoom(siguienteZoom(zoomRef.current, 1)),
        alejar: () => cambiarZoom(siguienteZoom(zoomRef.current, -1)),
        zoomReal: () => cambiarZoom(1),
        ajustar,
        quitarSeleccion: () => fijarSeleccion(null),
        // Copia los píxeles de una capa a otra (al duplicar una capa)
        copiarPixeles: (origen, destino) => {
            obtenerCanvas(destino).getContext('2d').drawImage(obtenerCanvas(origen), 0, 0);
            redibujar();
        },
        // PNG de una capa, para subirlo al guardar. Si no tiene nada fuera del lienzo se guarda solo el lienzo
        // (igual que antes); si lo tiene, se guarda toda la zona de trabajo para no perderlo
        exportarCapa: (clave) => {
            const canvas = obtenerCanvas(clave);
            const ctx = canvas.getContext('2d');
            const hayFuera = franjasFuera(ancho, alto).some((f) => hayPixelesVisibles(leerRegion(ctx, f).data));
            return new Promise((resolver) => (hayFuera ? canvas : recortarAlLienzo(canvas)).toBlob(resolver, 'image/png'));
        },
        // PNG de todas las capas visibles juntas, solo la parte que cae dentro del lienzo: es la imagen que
        // recibe la vista de fotogramas al cerrar el editor
        componer: () => new Promise((resolver) => recortarAlLienzo(visibleRef.current).toBlob(resolver, 'image/png')),
    }));

    const tamanoVisible = { width: area.ancho * zoom, height: area.alto * zoom };
    return (
        <div className="visor-lienzo" ref={visorRef} data-testid="visor-lienzo">
            <div className="area-lienzo" style={tamanoVisible}>
                <canvas ref={visibleRef} className="lienzo" width={area.ancho} height={area.alto} />
                <canvas
                    ref={superpuestoRef}
                    className={`lienzo-superpuesto${espacio ? ' lienzo-mano' : ''}`}
                    width={area.ancho}
                    height={area.alto}
                    onPointerDown={empezarGesto}
                    onPointerMove={seguirGesto}
                    onPointerUp={terminarGesto}
                    onPointerCancel={terminarGesto}
                    onAuxClick={(evento) => evento.preventDefault()}
                />
            </div>
        </div>
    );
});

export default Lienzo;