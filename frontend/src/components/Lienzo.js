import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import {
    mensajeCapaNoEditable, dibujarTrazo, borrarTrazo, borrarRegion, levantarGrupo, restaurarBase,
        rectanguloDeTrazo, rectanguloDeSeleccion, rectanguloTransformado, esquinasTransformadas, dibujarTransformado,
    unirRectangulos, limitarEscala, copiarCanvas, leerRegion, escribirRegion, pixelesDe, recortarAlLienzo, limitarTamano,
} from '../utils/herramientas';
import { objetoEnPunto, objetosEnRect, todosLosObjetos, grupoDeRegion } from '../utils/objetos';
import {
    manijaEnPunto, escalaPorEsquina, giroPorManija, esSinTransformacion, cabeEnArea, CURSOR_MANIJA, SIN_TRANSFORMACION,
} from '../utils/manijas';
import {
    crearHistorialEditor, registrarCambio, deshacer, rehacer, puedeDeshacer, puedeRehacer, descartarCapa,
} from '../utils/historialEditor';
import { medidasArea, rectLienzo, franjasFuera, hayPixelesVisibles, ajustarPosicion } from '../utils/areaTrabajo';
import { pintarSuperpuesto as dibujarSuperpuesto } from '../utils/superpuesto';
import useVistaLienzo from '../hooks/useVistaLienzo';
import { dibujarFantasma } from '../utils/papelCebolla';
import { cargarImagen, crearCanvas } from '../utils/imagenes';

// El lienzo del editor: muestra el fotograma compuesto por sus capas visibles (RF35) y recibe el mouse.
// Cada capa tiene su propio canvas oculto (los píxeles viven ahí, no en React); el canvas que se ve
// solo es la suma de los canvas de las capas visibles, de abajo hacia arriba. Un segundo canvas,
// transparente y encima, dibuja el borde de la selección sin ensuciar la imagen.
//
// Las capas no miden lo mismo que el lienzo del proyecto: miden una zona de trabajo más grande (utils/areaTrabajo.js)
// con el lienzo en el centro. Lo que se mueve hacia afuera queda en la capa y se puede volver a traer.
// Todas las coordenadas de este archivo son de la zona de trabajo, no del lienzo.
//
// La zona se ve dentro de un visor con zoom y desplazamiento (hooks/useVistaLienzo.js).
//
// Props:
//   ancho, alto      tamaño del lienzo en píxeles
//   capas            lista de capas (utils/capas.js); la primera es la de abajo
//   claveActiva      clave de la capa donde se dibuja
//   herramienta      'pincel', 'borrador', 'seleccion' o 'mover'.
//                    - seleccion: un rectángulo; pincel y borrador solo actúan dentro de él y se puede borrar o copiar su contenido.
//                      No mueve píxeles.
//                    - mover: clic sobre un objeto de la capa lo elige y lo arrastra; arrastrar en vacío dibuja un marco que elige
//                      todos los objetos que toca. Los elegidos se mueven juntos, sin salir de la zona de trabajo y pegándose
//                      (snap) a los bordes y al centro del lienzo.
//   color, tamano    color (#rrggbb) y grosor del pincel o borrador
//   onCapaModificada(clave, rect)   se llama al terminar un cambio en una capa (trazo, mover, deshacer...)
//   onHistorialCambia({ puedeDeshacer, puedeRehacer })
//   onSeleccionCambia(rect o null)  rectángulo seleccionado, o null si no hay selección
//   onAviso(mensaje) se llama si se intenta modificar una capa oculta o bloqueada (RF39)
//   onZoomCambia(zoom)  el zoom actual (1 = 100 %), cada vez que cambia
//   onTamano(numero)    con pincel o borrador, clic derecho y arrastrar a la derecha (o a la izquierda) cambia el tamaño
//
// Con pincel y borrador, un círculo bajo el mouse muestra el tamaño del trazo.

const Lienzo = forwardRef(function Lienzo(
    {
        ancho, alto, capas, claveActiva, herramienta, color, tamano,
        onCapaModificada, onHistorialCambia, onSeleccionCambia, onAviso, onZoomCambia, onCapaCargada, onTamano,
        cebolla = []
    },
    ref
) {
    const area = medidasArea(ancho, alto); // tamaño de la zona de trabajo
    const centro = rectLienzo(ancho, alto); // donde queda el lienzo del proyecto dentro de la zona
    const visorRef = useRef(null);
    const visibleRef = useRef(null);
    const superpuestoRef = useRef(null);
    const cebollaRef = useRef(null);
    const canvasCapas = useRef(new Map()); // clave de la capa -> su canvas oculto
    const historial = useRef(crearHistorialEditor());
    const gesto = useRef(null); // lo que se está haciendo con el mouse: trazo, selección o mover
    const seleccion = useRef(null); // rectángulo seleccionado de la capa activa, o null
        // Al arrastrar con "mover": { clave, base, flotante, x, y }; al arrastrar una manija: { clave, base, flotante, rect, transformacion }
    const vistaPrevia = useRef(null);
    const grupo = useRef(null); // objetos elegidos con "mover": { rect, mascara } (utils/objetos.js)
    // Lo que se dibuja en el canvas superpuesto (utils/superpuesto.js)
        const marcas = useRef({ seleccion: null, marco: null, caja: null, manijas: false, contorno: null, guias: { x: [], y: [] } });
    // El canvas de una capa; si no existe todavía, lo crea vacío
    const obtenerCanvas = useCallback((clave) => {
        let canvas = canvasCapas.current.get(clave);
        if (!canvas) {
            canvas = crearCanvas(area.ancho, area.alto);
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
                if (previa.transformacion) dibujarTransformado(ctx, previa.flotante, previa.rect, previa.transformacion);
                else ctx.drawImage(previa.flotante, previa.x, previa.y);
            } else {
                ctx.drawImage(canvas, 0, 0);
            }
        }
    }, [capas, area.ancho, area.alto]);

    // Dibuja encima de la imagen, sin ensuciarla: el borde del lienzo y las marcas de la herramienta
    const pintarSuperpuesto = useCallback(() => {
        const superpuesto = superpuestoRef.current;
        if (superpuesto) dibujarSuperpuesto(superpuesto.getContext('2d'), area, centro, vista.zoomRef.current, marcas.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [area.ancho, area.alto, centro.x, centro.y, centro.ancho, centro.alto]);
    const vista = useVistaLienzo(visorRef, { ancho, alto, area }, (zoom) => {
        pintarSuperpuesto(); // el grosor de las líneas depende del zoom
        if (onZoomCambia) onZoomCambia(zoom);
    });

    function dibujarSeleccion(rect) {
        marcas.current.seleccion = rect;
        pintarSuperpuesto();
    }

    // La selección rectangular y el grupo de objetos de "mover" son excluyentes: al elegir una, se quita la otra.
    // Al editor le llega siempre el rectángulo de lo que está elegido (o null)
    function fijarSeleccion(rect) {
        if (rect) {
            grupo.current = null;
            marcas.current.caja = null;
        }
        seleccion.current = rect;
        dibujarSeleccion(rect);
        if (onSeleccionCambia) onSeleccionCambia(rect);
    }

    function fijarGrupo(nuevo) {
        if (nuevo) {
            seleccion.current = null;
            marcas.current.seleccion = null;
        }
        grupo.current = nuevo;
        marcas.current.caja = nuevo ? nuevo.rect : null;
        marcas.current.manijas = Boolean(nuevo);
        pintarSuperpuesto();
        if (onSeleccionCambia) onSeleccionCambia(nuevo ? nuevo.rect : seleccion.current);
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
                cargarImagen(capa.imagen, false).then((imagen) => {
                    // La capa pudo eliminarse mientras la imagen cargaba
                    if (canvasCapas.current.get(capa.clave) !== canvas) return;
                    // Una capa guardada con contenido fuera del lienzo mide toda la zona; las demás miden solo
                    // el lienzo y van al centro
                    const completa = imagen.naturalWidth === area.ancho && imagen.naturalHeight === area.alto;
                    canvas.getContext('2d').drawImage(imagen, completa ? 0 : centro.x, completa ? 0 : centro.y);
                    redibujar();
                    if (onCapaCargada) onCapaCargada(capa.clave);
                }, () => {});
            }
        }
        redibujar();
        avisarHistorial();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [capas, obtenerCanvas, redibujar]);


        // Papel cebolla: dibuja los frames vecinos en su propio canvas, entre la imagen y el superpuesto.
    // Va aparte para que nunca se mezcle con las capas ni con la imagen que se guarda
    useEffect(() => {
        let vigente = true;
        // Si una no carga, se muestran las demás
        Promise.all(cebolla.map((fantasma) => cargarImagen(fantasma.imagen).catch(() => null))).then((imagenes) => {
            const canvas = cebollaRef.current;
            if (!vigente || !canvas) return;
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, area.ancho, area.alto);
            imagenes.forEach((imagen, i) => {
                if (imagen) dibujarFantasma(ctx, imagen, cebolla[i], centro);
            });
        });
        return () => { vigente = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cebolla]);

    // La selección pertenece a una capa: al cambiar de capa activa se quita
    useEffect(() => {
        if (seleccion.current) fijarSeleccion(null);
        if (grupo.current) fijarGrupo(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [claveActiva]);

    // Los objetos elegidos solo valen mientras se usa "mover": al cambiar de herramienta se sueltan
    useEffect(() => {
        if (herramienta !== 'mover' && grupo.current) fijarGrupo(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [herramienta]);

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

    const esPincel = herramienta === 'pincel' || herramienta === 'borrador';

    // El círculo del tamaño del trazo (null lo quita)
    function mostrarPincel(punto, tamanoCirculo) {
        marcas.current.pincel = punto ? { x: punto.x, y: punto.y, tamano: tamanoCirculo } : null;
        pintarSuperpuesto();
    }

    // Al cambiar de herramienta, el círculo se va hasta que el mouse se vuelva a mover
    useEffect(() => {
        if (!esPincel && marcas.current.pincel) mostrarPincel(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [esPincel]);

    // Pincel y borrador: si hay una selección, solo actúan dentro de ella
    function dibujarTramo(ctx, desde, hasta) {
        const region = seleccion.current;
        if (region) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(region.x, region.y, region.ancho, region.alto);
            ctx.clip();
        }
        if (herramienta === 'borrador') borrarTrazo(ctx, desde, hasta, tamano);
        else dibujarTrazo(ctx, desde, hasta, color, tamano);
        if (region) ctx.restore();
    }

    function empezarGesto(evento) {
        // Botón central, o barra espaciadora: se mueve la vista en vez de dibujar
        if (vista.paneo.empezar(evento)) return;
        const punto = posicion(evento);

        // Pincel o borrador con clic derecho: arrastrar a la derecha agranda el trazo y a la izquierda lo achica.
        // El círculo queda fijo donde se hizo clic, para ver el tamaño nuevo
        if (evento.button === 2 && esPincel && onTamano) {
            evento.currentTarget.setPointerCapture(evento.pointerId);
            gesto.current = { tipo: 'tamano', inicioX: evento.clientX, tamanoInicial: tamano, punto };
            mostrarPincel(punto, tamano);
            return;
        }
        if (evento.button !== 0) return;

        if (herramienta === 'seleccion') {
            evento.currentTarget.setPointerCapture(evento.pointerId);
            gesto.current = { tipo: 'seleccion', inicio: punto, rect: null };
            return;
        }

        if (!capaEditableOAviso()) return;
        evento.currentTarget.setPointerCapture(evento.pointerId);
        const canvas = obtenerCanvas(claveActiva);

            if (herramienta === 'mover') {
            // Una manija de la caja: escalar desde una esquina o girar
            const manija = grupo.current && manijaEnPunto(grupo.current.rect, punto, vista.zoomRef.current);
            if (manija) {
                const { base, flotante } = levantarGrupo(canvas, grupo.current);
                gesto.current = {
                    tipo: manija === 'giro' ? 'girar' : 'escalar',
                    manija, clave: claveActiva, inicio: punto, grupo: grupo.current, transformacion: SIN_TRANSFORMACION,
                };
                vistaPrevia.current = { clave: claveActiva, base, flotante, rect: grupo.current.rect, transformacion: SIN_TRANSFORMACION };
                return;
            }
            const radio = Math.ceil(6 / vista.zoomRef.current); // margen para agarrar líneas finas
            const dentroDelGrupo = grupo.current
                && punto.x >= grupo.current.rect.x && punto.x < grupo.current.rect.x + grupo.current.rect.ancho
                && punto.y >= grupo.current.rect.y && punto.y < grupo.current.rect.y + grupo.current.rect.alto;
            if (!dentroDelGrupo) {
                // Clic sobre un objeto: se elige y se puede arrastrar de inmediato. Clic en vacío: empieza un marco
                const objeto = objetoEnPunto(pixelesDe(canvas), area.ancho, area.alto, punto.x, punto.y, radio);
                if (!objeto) {
                    fijarGrupo(null);
                    gesto.current = { tipo: 'marco', inicio: punto, rect: null };
                    return;
                }
                fijarGrupo(objeto);
            }
            const { base, flotante } = levantarGrupo(canvas, grupo.current);
            const origen = grupo.current.rect;
            gesto.current = { tipo: 'mover', clave: claveActiva, inicio: punto, grupo: grupo.current, x: origen.x, y: origen.y };
            vistaPrevia.current = { clave: claveActiva, base, flotante, x: origen.x, y: origen.y };
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
        if (vista.paneo.seguir(evento)) return;
        const actual = gesto.current;
        const punto = posicion(evento);

        if (actual && actual.tipo === 'tamano') {
            // 2 px de mouse = 1 px de pincel: todo el rango (1 a 100) cabe en un arrastre corto
            const nuevo = limitarTamano(actual.tamanoInicial + (evento.clientX - actual.inicioX) / 2);
            if (nuevo !== tamano) onTamano(nuevo);
            mostrarPincel(actual.punto, nuevo);
            return;
        }
        if (esPincel) mostrarPincel(punto, tamano);

        if (!actual) {
            // Sin arrastrar: el cursor cambia sobre las manijas para mostrar que se pueden tomar
            const manija = herramienta === 'mover' && grupo.current && manijaEnPunto(grupo.current.rect, punto, vista.zoomRef.current);
            superpuestoRef.current.style.cursor = manija ? CURSOR_MANIJA[manija] : '';
            return;
        }

        if (actual.tipo === 'seleccion') {
            actual.rect = rectanguloDeSeleccion(actual.inicio, punto, area.ancho, area.alto);
            dibujarSeleccion(actual.rect);
        } else if (actual.tipo === 'marco') {
            actual.rect = rectanguloDeSeleccion(actual.inicio, punto, area.ancho, area.alto);
            marcas.current.marco = actual.rect;
            pintarSuperpuesto();
        } else if (actual.tipo === 'mover') {
            // La caja sigue al mouse, sin salir de la zona de trabajo y pegándose al lienzo si está cerca
            const origen = actual.grupo.rect;
            const ajuste = ajustarPosicion(
                origen, origen.x + (punto.x - actual.inicio.x), origen.y + (punto.y - actual.inicio.y),
                area, centro, 8 / vista.zoomRef.current
            );
            actual.x = ajuste.x;
            actual.y = ajuste.y;
            vistaPrevia.current.x = ajuste.x;
            vistaPrevia.current.y = ajuste.y;
            marcas.current.caja = { ...origen, x: ajuste.x, y: ajuste.y };
            marcas.current.guias = { x: ajuste.guiasX, y: ajuste.guiasY };
            pintarSuperpuesto();
            redibujar();
        } else if (actual.tipo === 'escalar' || actual.tipo === 'girar') {
            const rect = actual.grupo.rect;
            const transformacion = actual.tipo === 'girar'
                ? giroPorManija(rect, actual.inicio, punto, evento.shiftKey)
                : escalaPorEsquina(rect, actual.manija, punto, evento.shiftKey);
            // Si se saldría de la zona de trabajo, se queda en lo último que cabía (no se pierde nada)
            if (!cabeEnArea(rectanguloTransformado(rect, transformacion), area)) return;
            actual.transformacion = transformacion;
            vistaPrevia.current.transformacion = transformacion;
            marcas.current.caja = null;
            marcas.current.contorno = esquinasTransformadas(rect, transformacion);
            pintarSuperpuesto();
            redibujar();
        } else {
            dibujarTramo(obtenerCanvas(actual.clave).getContext('2d'), actual.ultimo, punto);
            actual.rect = unirRectangulos(actual.rect, rectanguloDeTrazo(actual.ultimo, punto, tamano, area.ancho, area.alto));
            actual.ultimo = punto;
            redibujar();
        }
    }

    function terminarGesto() {
        if (vista.paneo.terminar()) return;
        const actual = gesto.current;
        gesto.current = null;
        if (!actual) return;

        if (actual.tipo === 'seleccion') {
            fijarSeleccion(actual.rect);
        } else if (actual.tipo === 'marco') {
            marcas.current.marco = null;
            const rect = actual.rect;
            if (rect && (rect.ancho > 2 || rect.alto > 2)) {
                fijarGrupo(objetosEnRect(pixelesDe(obtenerCanvas(claveActiva)), area.ancho, area.alto, rect));
            } else {
                fijarGrupo(null);
            }
        } else if (actual.tipo === 'mover') {
            const origen = actual.grupo.rect;
            const { base, flotante } = vistaPrevia.current;
            vistaPrevia.current = null;
            marcas.current.guias = { x: [], y: [] };
            if (actual.x === origen.x && actual.y === origen.y) {
                marcas.current.caja = origen;
                pintarSuperpuesto();
                redibujar();
                return;
            }
            const destino = { ...origen, x: actual.x, y: actual.y };
            const rect = unirRectangulos(origen, destino);
            aplicarCambio(actual.clave, rect, (ctx) => {
                restaurarBase(ctx, base, rect);
                ctx.drawImage(flotante, destino.x, destino.y);
            });
            fijarGrupo({ rect: destino, mascara: actual.grupo.mascara });
        } else if (actual.tipo === 'escalar' || actual.tipo === 'girar') {
            vistaPrevia.current = null;
            marcas.current.contorno = null;
            if (esSinTransformacion(actual.transformacion)) {
                marcas.current.caja = actual.grupo.rect;
                pintarSuperpuesto();
                redibujar();
                return;
            }
            aplicarTransformacion(actual.clave, actual.grupo, actual.transformacion);
        } else if (actual.rect) {
            const antes = leerRegion(actual.copia.getContext('2d'), actual.rect);
            historial.current = registrarCambio(historial.current, { clave: actual.clave, ...actual.rect, pixeles: antes });
            if (onCapaModificada) onCapaModificada(actual.clave, actual.rect);
            avisarHistorial();
        }
    }

    // PNG de un canvas de zona de trabajo. Si no tiene nada fuera del lienzo se guarda solo el lienzo
    // (igual que antes); si lo tiene, se guarda toda la zona para no perderlo
    function blobDeCanvas(canvas) {
        const ctx = canvas.getContext('2d');
        const hayFuera = franjasFuera(ancho, alto).some((f) => hayPixelesVisibles(leerRegion(ctx, f).data));
        return new Promise((resolver) => (hayFuera ? canvas : recortarAlLienzo(canvas, centro)).toBlob(resolver, 'image/png'));
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
        if (grupo.current) fijarGrupo(null); // los píxeles cambiaron: el grupo ya no es válido
        if (onCapaModificada) onCapaModificada(entrada.clave, { x: entrada.x, y: entrada.y, ancho: entrada.ancho, alto: entrada.alto });
        avisarHistorial();
    }

    // Escala y gira desde el centro (RF41 a RF43) los objetos elegidos con "mover" o, si no hay ninguno, todo lo que
    // hay en la capa. Si el resultado se saldría de la zona de trabajo no se hace, para no perder nada
    function transformar(parametros) {
        if (gesto.current || !capaEditableOAviso()) return false;
        const canvas = obtenerCanvas(claveActiva);
        const objetos = grupo.current
            || todosLosObjetos(pixelesDe(canvas), area.ancho, area.alto);
        if (!objetos) {
            if (onAviso) onAviso('No hay nada que transformar en esta capa.');
            return false;
        }
        const escala = limitarEscala(parametros.escala ?? 1);
        const transformacion = { ...SIN_TRANSFORMACION, escalaX: escala, escalaY: escala, angulo: parametros.angulo || 0 };
        if (!cabeEnArea(rectanguloTransformado(objetos.rect, transformacion), area)) {
            if (onAviso) onAviso('Esa transformación sacaría el contenido de la zona de trabajo.');
            return false;
        }
        aplicarTransformacion(claveActiva, objetos, transformacion);
        return true;
    }

    // Escala o gira los objetos en la capa (se puede deshacer). Con "mover", lo transformado queda elegido con sus
    // manijas para seguir ajustándolo
    function aplicarTransformacion(clave, objetos, transformacion) {
        const destino = rectanguloTransformado(objetos.rect, transformacion);
        const rect = unirRectangulos(objetos.rect, destino);
        const { base, flotante } = levantarGrupo(obtenerCanvas(clave), objetos);
        aplicarCambio(clave, rect, (ctx) => {
            restaurarBase(ctx, base, rect);
            dibujarTransformado(ctx, flotante, objetos.rect, transformacion);
        });
        if (herramienta !== 'mover') return;
        // Solo lo transformado, en un canvas del tamaño de su caja: de ahí sale el grupo nuevo
        const solo = crearCanvas(destino.ancho, destino.alto);
        const ctxSolo = solo.getContext('2d');
        ctxSolo.translate(-destino.x, -destino.y);
        dibujarTransformado(ctxSolo, flotante, objetos.rect, transformacion);
        fijarGrupo(grupoDeRegion(pixelesDe(solo), destino));
    }

    // Borra lo elegido: el contenido del rectángulo de selección o los objetos del grupo (RF38)
    function borrarSeleccion() {
        if (gesto.current || !(seleccion.current || grupo.current) || !capaEditableOAviso()) return false;
        if (grupo.current) {
            const objetos = grupo.current;
            const { base } = levantarGrupo(obtenerCanvas(claveActiva), objetos);
            const { rect } = objetos;
            aplicarCambio(claveActiva, rect, (ctx) => restaurarBase(ctx, base, rect));
            fijarGrupo(null);
            return true;
        }
        aplicarCambio(claveActiva, seleccion.current, (ctx) => borrarRegion(ctx, seleccion.current));
        return true;
    }

    // Lo que el editor puede pedirle al lienzo
    useImperativeHandle(ref, () => ({
        deshacer: () => recorrerHistorial(deshacer),
        rehacer: () => recorrerHistorial(rehacer),
        transformar,
        borrarSeleccion,
        // Con "mover": todos los objetos de la capa. Con las demás herramientas: un rectángulo sobre todo el lienzo del proyecto
        seleccionarTodo: () => {
            if (herramienta !== 'mover') {
                fijarSeleccion({ ...centro });
                return;
            }
            fijarGrupo(todosLosObjetos(pixelesDe(obtenerCanvas(claveActiva)), area.ancho, area.alto));
        },
        acercar: vista.acercar,
        alejar: vista.alejar,
        zoomReal: vista.zoomReal,
        ajustar: vista.ajustar,
        quitarSeleccion: () => {
            fijarSeleccion(null);
            fijarGrupo(null);
        },

                // Vista previa de una capa para el panel de capas: dibuja en "destino" (un canvas chico) lo que la capa tiene
        // dentro del lienzo del proyecto, achicado
        dibujarMiniatura: (clave, destino) => {
            const ctx = destino.getContext('2d');
            ctx.clearRect(0, 0, destino.width, destino.height);
            const canvas = canvasCapas.current.get(clave);
            if (canvas) ctx.drawImage(canvas, centro.x, centro.y, centro.ancho, centro.alto, 0, 0, destino.width, destino.height);
        },
        
        // Reemplaza todo el dibujo de una capa por "fuente" (un canvas del tamaño del lienzo o de la zona de trabajo).
        // Se usa al cambiar una capa de texto: no queda en el historial de deshacer (el texto se cambia desde su panel)
        reemplazarImagen: (clave, fuente) => {
            const canvas = obtenerCanvas(clave);
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const enZona = fuente.width === area.ancho;
            ctx.drawImage(fuente, enZona ? 0 : centro.x, enZona ? 0 : centro.y);
            redibujar();
            if (onCapaModificada) onCapaModificada(clave, { x: 0, y: 0, ancho: area.ancho, alto: area.alto });
        },
        // Copia los píxeles de una capa a otra (al duplicar una capa)
        copiarPixeles: (origen, destino) => {
            obtenerCanvas(destino).getContext('2d').drawImage(obtenerCanvas(origen), 0, 0);
            redibujar();
        },
        // PNG de una capa, para subirlo al guardar. Si no tiene nada fuera del lienzo se guarda solo el lienzo
        // (igual que antes); si lo tiene, se guarda toda la zona de trabajo para no perderlo
        exportarCapa: (clave) => blobDeCanvas(obtenerCanvas(clave)),
        // PNG con solo lo que hay dentro de la selección de la capa activa (el resto, transparente); null si no hay selección
        exportarSeleccion: (clave) => {
            const region = seleccion.current;
            const solo = crearCanvas(area.ancho, area.alto);
            if (grupo.current) {
                // Solo los píxeles de los objetos elegidos, aunque haya otros dentro de su caja
                solo.getContext('2d').drawImage(levantarGrupo(obtenerCanvas(clave), grupo.current).flotante, grupo.current.rect.x, grupo.current.rect.y);
                return blobDeCanvas(solo);
            }
            if (!region) return Promise.resolve(null);
            solo.getContext('2d').drawImage(
                obtenerCanvas(clave), region.x, region.y, region.ancho, region.alto, region.x, region.y, region.ancho, region.alto
            );
            return blobDeCanvas(solo);
        },
        // PNG de todas las capas visibles juntas, solo la parte que cae dentro del lienzo: es la imagen que
        // recibe la vista de fotogramas al cerrar el editor
        componer: () => new Promise((resolver) => recortarAlLienzo(visibleRef.current, centro).toBlob(resolver, 'image/png')),
    }));

    const tamanoVisible = { width: area.ancho * vista.zoom, height: area.alto * vista.zoom };
    return (
        <div className="visor-lienzo" ref={visorRef} data-testid="visor-lienzo">
            <div className="area-lienzo" style={tamanoVisible}>
                <canvas ref={visibleRef} className="lienzo" width={area.ancho} height={area.alto} />
                <canvas ref={cebollaRef} className="lienzo-cebolla" width={area.ancho} height={area.alto} />
                <canvas
                    ref={superpuestoRef}
                    className={`lienzo-superpuesto${vista.espacio ? ' lienzo-mano' : ''}`}
                    width={area.ancho}
                    height={area.alto}
                    onPointerDown={empezarGesto}
                    onPointerMove={seguirGesto}
                    onPointerUp={terminarGesto}
                    onPointerCancel={terminarGesto}
                    onPointerLeave={() => { if (!gesto.current && marcas.current.pincel) mostrarPincel(null); }}
                    onContextMenu={(evento) => evento.preventDefault()}
                    onAuxClick={(evento) => evento.preventDefault()}
                />
            </div>
        </div>
    );
});

export default Lienzo;