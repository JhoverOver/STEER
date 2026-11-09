import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import {
    mensajeCapaNoEditable, dibujarTrazo, borrarTrazo, borrarRegion, transformarRegion,
    rectanguloDeTrazo, rectanguloDeSeleccion, rectanguloAfectado, rectanguloTransformado,
    recortarARectangulo, unirRectangulos, limitarEscala, copiarCanvas, leerRegion, escribirRegion,
} from '../utils/herramientas';
import {
    crearHistorialEditor, registrarCambio, deshacer, rehacer, puedeDeshacer, puedeRehacer, descartarCapa,
} from '../utils/historialEditor';

// El lienzo del editor: muestra el fotograma compuesto por sus capas visibles (RF35) y recibe el mouse.
// Cada capa tiene su propio canvas oculto (los píxeles viven ahí, no en React); el canvas que se ve
// solo es la suma de los canvas de las capas visibles, de abajo hacia arriba. Un segundo canvas,
// transparente y encima, dibuja el borde de la selección sin ensuciar la imagen.
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
const Lienzo = forwardRef(function Lienzo(
    {
        ancho, alto, capas, claveActiva, herramienta, color, tamano,
        onCapaModificada, onHistorialCambia, onSeleccionCambia, onAviso,
    },
    ref
) {
    const visibleRef = useRef(null);
    const superpuestoRef = useRef(null);
    const canvasCapas = useRef(new Map()); // clave de la capa -> su canvas oculto
    const historial = useRef(crearHistorialEditor());
    const gesto = useRef(null); // lo que se está haciendo con el mouse: trazo, selección o mover
    const seleccion = useRef(null); // rectángulo seleccionado de la capa activa, o null
    const vistaPrevia = useRef(null); // al arrastrar con "mover": { clave, base, flotante, x, y }

    // El canvas de una capa; si no existe todavía, lo crea vacío
    const obtenerCanvas = useCallback((clave) => {
        let canvas = canvasCapas.current.get(clave);
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.width = ancho;
            canvas.height = alto;
            canvas.getContext('2d', { willReadFrequently: true });
            canvasCapas.current.set(clave, canvas);
        }
        return canvas;
    }, [ancho, alto]);

    // Vuelve a dibujar el canvas visible: las capas visibles, de abajo hacia arriba.
    // Mientras se arrastra con "mover", la capa movida se dibuja desde la vista previa.
    const redibujar = useCallback(() => {
        const visible = visibleRef.current;
        if (!visible) return;
        const ctx = visible.getContext('2d');
        ctx.clearRect(0, 0, ancho, alto);
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
    }, [capas, ancho, alto]);

    // Dibuja el borde de la selección (línea punteada blanca y negra para verse sobre cualquier color)
    function dibujarSeleccion(rect) {
        const superpuesto = superpuestoRef.current;
        if (!superpuesto) return;
        const ctx = superpuesto.getContext('2d');
        ctx.clearRect(0, 0, ancho, alto);
        if (!rect) return;
        ctx.save();
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 6]);
        ctx.strokeStyle = '#000000';
        ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.ancho - 1, rect.alto - 1);
        ctx.lineDashOffset = 6;
        ctx.strokeStyle = '#ffffff';
        ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.ancho - 1, rect.alto - 1);
        ctx.restore();
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
                        canvas.getContext('2d').drawImage(imagen, 0, 0);
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

    // Posición del mouse en píxeles del lienzo (el canvas puede verse más chico que su tamaño real)
    function posicion(evento) {
        const caja = superpuestoRef.current.getBoundingClientRect();
        return {
            x: ((evento.clientX - caja.left) * ancho) / caja.width,
            y: ((evento.clientY - caja.top) * alto) / caja.height,
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
            const region = seleccion.current || { x: 0, y: 0, ancho, alto };
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
            rect: rectanguloDeTrazo(punto, punto, tamano, ancho, alto),
            copia: copiarCanvas(canvas),
        };
        dibujarTramo(canvas.getContext('2d'), punto, punto);
        redibujar();
    }

    function seguirGesto(evento) {
        const actual = gesto.current;
        if (!actual) return;
        const punto = posicion(evento);

        if (actual.tipo === 'seleccion') {
            actual.rect = rectanguloDeSeleccion(actual.inicio, punto, ancho, alto);
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
            actual.rect = unirRectangulos(actual.rect, rectanguloDeTrazo(actual.ultimo, punto, tamano, ancho, alto));
            actual.ultimo = punto;
            redibujar();
        }
    }

    function terminarGesto() {
        const actual = gesto.current;
        gesto.current = null;
        if (!actual) return;

        if (actual.tipo === 'seleccion') {
            fijarSeleccion(actual.rect);
        } else if (actual.tipo === 'mover') {
            vistaPrevia.current = null;
            if (actual.dx === 0 && actual.dy === 0) {
                redibujar();
                return;
            }
            const movimiento = { dx: actual.dx, dy: actual.dy };
            const rect = rectanguloAfectado(actual.region, movimiento, ancho, alto);
            aplicarCambio(actual.clave, rect, (ctx) => transformarRegion(ctx, actual.region, movimiento));
            if (seleccion.current) {
                fijarSeleccion(recortarARectangulo(rectanguloTransformado(actual.region, movimiento), ancho, alto));
            }
        } else if (actual.rect) {
            const antes = leerRegion(actual.copia.getContext('2d'), actual.rect);
            historial.current = registrarCambio(historial.current, { clave: actual.clave, ...actual.rect, pixeles: antes });
            if (onCapaModificada) onCapaModificada(actual.clave, actual.rect);
            avisarHistorial();
        }
    }

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
        const region = seleccion.current || { x: 0, y: 0, ancho, alto };
        const { dx = 0, dy = 0, angulo = 0 } = parametros;
        const transformacion = { dx: Math.round(dx), dy: Math.round(dy), angulo, escala: limitarEscala(parametros.escala ?? 1) };
        const rect = rectanguloAfectado(region, transformacion, ancho, alto);
        if (!rect) return false;
        aplicarCambio(claveActiva, rect, (ctx) => transformarRegion(ctx, region, transformacion));
        if (seleccion.current) {
            // Al girar, el rectángulo que envuelve el contenido ya no coincide con él: se quita la selección
            fijarSeleccion(angulo === 0
                ? recortarARectangulo(rectanguloTransformado(region, transformacion), ancho, alto)
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
        seleccionarTodo: () => fijarSeleccion({ x: 0, y: 0, ancho, alto }),
        quitarSeleccion: () => fijarSeleccion(null),
        // Copia los píxeles de una capa a otra (al duplicar una capa)
        copiarPixeles: (origen, destino) => {
            obtenerCanvas(destino).getContext('2d').drawImage(obtenerCanvas(origen), 0, 0);
            redibujar();
        },
        // PNG de una capa, para subirlo al guardar
        exportarCapa: (clave) => new Promise((resolver) => obtenerCanvas(clave).toBlob(resolver, 'image/png')),
        // PNG de todas las capas visibles juntas: la imagen que recibe la vista de fotogramas al cerrar el editor
        componer: () => new Promise((resolver) => visibleRef.current.toBlob(resolver, 'image/png')),
    }));

    return (
        <div className="area-lienzo">
            <canvas ref={visibleRef} className="lienzo" width={ancho} height={alto} />
            <canvas
                ref={superpuestoRef}
                className="lienzo-superpuesto"
                width={ancho}
                height={alto}
                onPointerDown={empezarGesto}
                onPointerMove={seguirGesto}
                onPointerUp={terminarGesto}
                onPointerCancel={terminarGesto}
            />
        </div>
    );
});

export default Lienzo;