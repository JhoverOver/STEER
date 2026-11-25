import { Fragment, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
    ESCALA_MAXIMA, ESCALA_MINIMA, limitarEscala, inicios, duracionTotal, aPixeles, aTiempo,
    intervaloRegla, formatearTiempo, duracionArrastrada,
} from '../utils/lineaTiempo';
import { filasDeCapas, miniaturaDeCapa } from '../utils/vistaCapas';
import { Maximize, ZoomIn, ZoomOut } from 'lucide-react';
import BotonIcono from './BotonIcono';
import { limitar } from '../utils/comunes';

const ANCHO_NOMBRES = 90; // columna fija con el nombre de cada pista
const MARGEN_INICIAL = 12; // espacio antes del momento 0, para que el rombo de un keyframe en 0 se vea entero
const INICIO_PISTAS = ANCHO_NOMBRES + MARGEN_INICIAL; // dónde está el momento 0, desde el borde izquierdo
const MARGEN_FINAL = 40; // espacio libre después del último frame
const FACTOR_ZOOM = 1.5;
const ANCHO_MINIMO_NUMERO = 24;
const DISTANCIA_IMAN = 8; // px

// Una celda de la vista de capas: la miniatura de una capa en un frame (vacía si el frame no tiene esa capa).
// Clic va al frame; doble clic lo abre en la pestaña Imagen
const CeldaCapa = memo(function CeldaCapa({ capa, ancho, anchoLienzo, altoLienzo, actual, indice, onPulsar, onDoble }) {
    const [miniatura, setMiniatura] = useState(null);
    const url = capa ? capa.imagen : null;
    useEffect(() => {
        let vigente = true;
        if (!url) {
            setMiniatura(null);
            return undefined;
        }
        miniaturaDeCapa(url, anchoLienzo, altoLienzo).then((u) => vigente && setMiniatura(u), () => {});
        return () => { vigente = false; };
    }, [url, anchoLienzo, altoLienzo]);

    const clases = ['celda-capa'];
    if (actual) clases.push('actual');
    if (!capa) clases.push('sin-capa');
    else {
        if (!capa.visible) clases.push('oculta');
        if (capa.bloqueada) clases.push('bloqueada');
    }
    const titulo = capa
        ? `Frame ${indice + 1} · ${capa.nombre}${capa.visible ? '' : ' (oculta)'}${capa.bloqueada ? ' (bloqueada)' : ''}`
        : `Frame ${indice + 1} · no tiene esta capa`;
    return (
        <div
            className={clases.join(' ')}
            style={{ width: ancho }}
            title={titulo}
            onClick={(evento) => onPulsar(indice, evento)}
            onDoubleClick={onDoble ? () => onDoble(indice) : undefined}
        >
            {capa && miniatura && <img src={miniatura} alt="" draggable="false" />}
        </div>
    );
});


// Línea de tiempo de la pestaña Video: una regla con los segundos, la pista de frames (cada uno tan ancho como
// su duración) y el cabezal que marca el momento actual.
//  - Clic o arrastre en la regla: mueve el cabezal.
//  - Clic en un frame: va a su inicio. Doble clic: lo abre en la pestaña Imagen.
//  - Arrastrar el borde derecho de un frame: cambia su duración (se aplica al soltar, se puede deshacer).
//  - Zoom con los botones o con Ctrl + rueda, centrado en el mouse.
//
// Props:
//   frames, tiempo (ms), indiceActual
//   seguir                 mantener el cabezal a la vista (mientras se reproduce)
//   bloqueada              no se pueden cambiar duraciones (mientras se guarda, por ejemplo)
//   onBuscar(tiempo)       el usuario movió el cabezal
//   onDuracion(clave, ms)  el usuario cambió la duración de un frame
//   onEditar(clave)        doble clic en un frame (opcional)
//   pistas                 pistas de keyframes: una fila por pista, con un rombo por keyframe
//   seleccion              { pista, keyframe }: claves de lo elegido (o null)
//   onSeleccionar(pista, keyframe)          clic en el nombre de una pista o en un keyframe
//   onMoverKeyframe(pista, keyframe, ms)    se arrastró un keyframe (se aplica al soltar)
//   onAgregarKeyframe(pista, ms)            doble clic en un espacio vacío de la fila de una pista
//   filaElegida, onElegirFila(clave)        clic en el nombre de una fila de capas: la elige para la pestaña Video
//   marcados (Set de claves), onMarcar(clave, rango)   Shift + clic en un frame lo marca (Ctrl + Shift: un rango)
function LineaTiempo({
    frames, tiempo, indiceActual, seguir, bloqueada, onBuscar, onDuracion, onEditar,
    pistas = [], seleccion = {}, onSeleccionar, onMoverKeyframe, onAgregarKeyframe,
    capasDeFrames = null, anchoLienzo, altoLienzo,
    filaElegida = null, onElegirFila, marcados = new Set(), onMarcar,
}) {
    const visorRef = useRef(null);
    const reglaRef = useRef(null);
    const anclaZoom = useRef(null); // { tiempo, x }: el momento que debe quedar bajo el mouse después de un zoom
    const [escala, setEscala] = useState(200);
    const [arrastre, setArrastre] = useState(null); // { clave, inicial, x0, valor } al cambiar una duración
    const [arrastreKeyframe, setArrastreKeyframe] = useState(null); // { pista, keyframe, inicial, x0, valor }

    // Los avisos al padre se leen desde aquí para que la pista memorizada siempre llame a los vigentes
    const avisos = useRef({});
    avisos.current = { onBuscar, onDuracion, onEditar, onMarcar };

    const total = duracionTotal(frames);
    const comienzos = useMemo(() => inicios(frames), [frames]);
        const datosCeldas = useRef({});
    datosCeldas.current = { frames, comienzos };
    // Las celdas de la vista de capas reciben siempre las mismas funciones (así no se vuelven a dibujar todas)
    // Clic: va al frame. Shift + clic: lo marca (Ctrl + Shift: marca un rango)
    const pulsarFrame = useCallback((i, evento) => {
        const { frames: lista, comienzos: inicio } = datosCeldas.current;
        if (evento?.shiftKey && avisos.current.onMarcar) {
            avisos.current.onMarcar(lista[i].clave, evento.ctrlKey || evento.metaKey);
            return;
        }
        avisos.current.onBuscar(inicio[i]);
    }, []);
    const irAFrameDeCelda = pulsarFrame;
    const editarFrameDeCelda = useCallback((i) => avisos.current.onEditar(datosCeldas.current.frames[i].clave), []);
    const duracionDe = (frame) => (arrastre && arrastre.clave === frame.clave ? arrastre.valor : frame.duracion);
    const totalVisible = arrastre ? total - arrastre.inicial + arrastre.valor : total;
    const anchoPistas = aPixeles(totalVisible, escala) + MARGEN_FINAL;

    // ---- zoom ----
    function cambiarEscala(nueva, xEnVisor) {
        const visor = visorRef.current;
        const limitada = limitarEscala(nueva);
        if (!visor || limitada === escala) return;
        const x = xEnVisor - INICIO_PISTAS;
        anclaZoom.current = { tiempo: aTiempo(visor.scrollLeft + x, escala), x };
        setEscala(limitada);
    }

    // Después de un zoom, desplaza para que el momento anclado siga en el mismo lugar de la pantalla
    useLayoutEffect(() => {
        const ancla = anclaZoom.current;
        if (!ancla || !visorRef.current) return;
        visorRef.current.scrollLeft = aPixeles(ancla.tiempo, escala) - ancla.x;
        anclaZoom.current = null;
    }, [escala]);

    function zoom(factor, xEnVisor) {
        cambiarEscala(escala * factor, xEnVisor);
    }

    // Los botones hacen zoom centrado en el cabezal si se ve; si no, en el centro de la línea
    function xDelCabezal() {
        const visor = visorRef.current;
        const x = INICIO_PISTAS + aPixeles(tiempo, escala) - visor.scrollLeft;
        return x > INICIO_PISTAS && x < visor.clientWidth ? x : (INICIO_PISTAS + visor.clientWidth) / 2;
    }

    // Toda la animación a lo ancho de la línea
    function ajustar() {
        const visor = visorRef.current;
        if (!visor || total <= 0) return;
        const disponible = visor.clientWidth - INICIO_PISTAS - MARGEN_FINAL;
        setEscala(limitarEscala(disponible / (total / 1000)));
        visor.scrollLeft = 0;
    }

    // Al abrir la pestaña se ve toda la animación
    useLayoutEffect(() => {
        ajustar();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Ctrl + rueda: zoom. Tiene que ser un listener propio para poder evitar el zoom del navegador
    const zoomRef = useRef(zoom);
    zoomRef.current = zoom;
    useEffect(() => {
        const visor = visorRef.current;
        function alRodar(evento) {
            if (!evento.ctrlKey && !evento.metaKey) return;
            evento.preventDefault();
            const x = evento.clientX - visor.getBoundingClientRect().left;
            zoomRef.current(evento.deltaY < 0 ? FACTOR_ZOOM : 1 / FACTOR_ZOOM, x);
        }
        visor.addEventListener('wheel', alRodar, { passive: false });
        return () => visor.removeEventListener('wheel', alRodar);
    }, []);

    // Mientras se reproduce, la línea avanza para que el cabezal no se salga de la vista
    useEffect(() => {
        const visor = visorRef.current;
        if (!seguir || !visor) return;
        const x = aPixeles(tiempo, escala);
        const visible = visor.clientWidth - INICIO_PISTAS;
        if (x < visor.scrollLeft || x > visor.scrollLeft + visible - 20) visor.scrollLeft = Math.max(x - 20, 0);
    }, [tiempo, seguir, escala]);

    // ---- cabezal ----
    function tiempoEnPuntero(evento) {
        const x = evento.clientX - reglaRef.current.getBoundingClientRect().left;
        return limitar(aTiempo(x, escala), 0, Math.max(total - 1, 0));
    }

    function empezarBusqueda(evento) {
        if (evento.button !== 0) return;
        evento.currentTarget.setPointerCapture(evento.pointerId);
        onBuscar(tiempoEnPuntero(evento));
    }

    function seguirBusqueda(evento) {
        if (evento.currentTarget.hasPointerCapture(evento.pointerId)) onBuscar(tiempoEnPuntero(evento));
    }

    // ---- duración ----
    function empezarArrastre(evento, frame) {
        if (evento.button !== 0 || bloqueada) return;
        evento.stopPropagation();
        evento.currentTarget.setPointerCapture(evento.pointerId);
        setArrastre({ clave: frame.clave, inicial: frame.duracion, x0: evento.clientX, valor: frame.duracion });
    }

    function seguirArrastre(evento) {
        if (!arrastre) return;
        const valor = duracionArrastrada(arrastre.inicial, evento.clientX - arrastre.x0, escala);
        if (valor !== arrastre.valor) setArrastre({ ...arrastre, valor });
    }

    function terminarArrastre() {
        if (!arrastre) return;
        if (arrastre.valor !== arrastre.inicial) avisos.current.onDuracion(arrastre.clave, arrastre.valor);
        setArrastre(null);
    }

    // ---- keyframes ----
    // Al arrastrar, el keyframe se pega al comienzo de un frame si pasa a menos de 8 px; si no, avanza de 10 en 10 ms
    function tiempoDeKeyframe(inicial, desplazamiento) {
        const bruto = limitar(inicial + aTiempo(desplazamiento, escala), 0, total);
        const cercano = [...comienzos, total].reduce((mejor, t) => (Math.abs(t - bruto) < Math.abs(mejor - bruto) ? t : mejor), 0);
        if (aPixeles(Math.abs(cercano - bruto), escala) <= DISTANCIA_IMAN) return cercano;
        return Math.round(bruto / 10) * 10;
    }

    function empezarArrastreKeyframe(evento, pista, keyframe) {
        if (evento.button !== 0) return;
        evento.stopPropagation();
        onSeleccionar(pista.clave, keyframe.clave);
        if (bloqueada) return;
        evento.currentTarget.setPointerCapture(evento.pointerId);
        setArrastreKeyframe({ pista: pista.clave, keyframe: keyframe.clave, inicial: keyframe.tiempo, x0: evento.clientX, valor: keyframe.tiempo });
    }

    function seguirArrastreKeyframe(evento) {
        if (!arrastreKeyframe) return;
        const valor = tiempoDeKeyframe(arrastreKeyframe.inicial, evento.clientX - arrastreKeyframe.x0);
        if (valor !== arrastreKeyframe.valor) setArrastreKeyframe({ ...arrastreKeyframe, valor });
    }

    function terminarArrastreKeyframe() {
        if (!arrastreKeyframe) return;
        const { pista, keyframe, inicial, valor } = arrastreKeyframe;
        if (valor !== inicial) onMoverKeyframe(pista, keyframe, valor);
        setArrastreKeyframe(null);
    }

    function filaDePista(pista) {
        const elegida = seleccion.pista === pista.clave;
        const keyframes = pista.keyframes.map((k) => (
            arrastreKeyframe && arrastreKeyframe.keyframe === k.clave ? { ...k, tiempo: arrastreKeyframe.valor } : k
        ));
        const tiempos = keyframes.map((k) => k.tiempo);
        const desde = Math.min(...tiempos);
        const hasta = Math.max(...tiempos);
        return (
            <div key={pista.clave} className={`fila-tiempo fila-pista${elegida ? ' elegida' : ''}`}>
                <button type="button" className="fila-nombre fila-nombre-riel" onClick={() => onSeleccionar(pista.clave, null)} title={`Keyframes de ${pista.nombre}`}>
                    Keyframes
                </button>
                <div
                    className="pista pista-keyframes"
                    style={{ width: anchoPistas }}
                    onDoubleClick={(evento) => {
                        if (bloqueada || evento.target.closest('.keyframe')) return;
                        onAgregarKeyframe(pista.clave, tiempoEnPuntero(evento));
                    }}
                >
                    <span className="tramo-pista" style={{ left: aPixeles(desde, escala), width: aPixeles(hasta - desde, escala) }} />
                    {keyframes.map((k) => (
                        <button
                            key={k.clave}
                            type="button"
                            className={`keyframe${elegida && seleccion.keyframe === k.clave ? ' elegido' : ''}${k.curva === 'suave' ? ' suave' : ''}`}
                            style={{ left: aPixeles(k.tiempo, escala) }}
                            aria-label={`Keyframe de ${pista.nombre} en ${formatearTiempo(k.tiempo)}`}
                            title={formatearTiempo(k.tiempo)}
                            onPointerDown={(evento) => empezarArrastreKeyframe(evento, pista, k)}
                            onPointerMove={seguirArrastreKeyframe}
                            onPointerUp={terminarArrastreKeyframe}
                            onPointerCancel={() => setArrastreKeyframe(null)}
                        />
                    ))}
                </div>
            </div>
        );
    }

    // ---- regla ----
    const intervalo = intervaloRegla(escala);
    const marcas = [];
    for (let ms = 0; ms <= totalVisible; ms += intervalo) marcas.push(ms);

    // La pista de frames solo se vuelve a armar si cambia algo de ella, no en cada paso del cabezal
    const bloques = useMemo(() => frames.map((frame, i) => {
        const duracion = duracionDe(frame);
        const arrastrando = arrastre && arrastre.clave === frame.clave;
        const ancho = aPixeles(duracion, escala);
        return (
            <div
                key={frame.clave}
                className={`bloque-frame${i === indiceActual ? ' actual' : ''}${arrastrando ? ' arrastrando' : ''}${marcados.has(frame.clave) ? ' marcado' : ''}`}
                style={{ width: ancho }}
            >
                <button
                    type="button"
                    onClick={(evento) => pulsarFrame(i, evento)}
                    onDoubleClick={onEditar ? () => avisos.current.onEditar(frame.clave) : undefined}
                    aria-label={`Frame ${i + 1}, ${duracion} ms${marcados.has(frame.clave) ? ', marcado' : ''}`}
                    aria-pressed={onMarcar ? marcados.has(frame.clave) : undefined}
                    title={`Frame ${i + 1} · ${duracion} ms`}
                >
                    {frame.vacio ? <span className="bloque-vacio" /> : <img src={frame.imagen} alt="" draggable="false" />}
                    {/* En frames muy angostos el número no cabe: se ve al pasar el mouse (title) */}
                    {(arrastrando || ancho >= ANCHO_MINIMO_NUMERO) && (
                        <span className="bloque-numero">{arrastrando ? `${duracion} ms` : i + 1}</span>
                    )}
                </button>
                <span
                    className="tirador-duracion"
                    onPointerDown={(evento) => empezarArrastre(evento, frame)}
                    onPointerMove={seguirArrastre}
                    onPointerUp={terminarArrastre}
                    onPointerCancel={() => setArrastre(null)}
                />
            </div>
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [frames, escala, arrastre, indiceActual, bloqueada, Boolean(onEditar), marcados]);

        // ---- vista de capas ----
    const filas = useMemo(() => {
        if (!capasDeFrames) return null;
        return filasDeCapas(frames.map((frame) => capasDeFrames.get(frame.clave) || null), pistas, indiceActual);
    }, [capasDeFrames, frames, pistas, indiceActual]);

    // Las filas de capas solo se vuelven a armar si cambia algo de ellas, no en cada paso del cabezal
    const filasCapas = useMemo(() => {
        if (!filas) return { porPista: new Map(), capas: [] };
        const armar = (fila) => {
            const esPista = fila.tipo === 'pista';
            const elegida = fila.clave === filaElegida || (esPista && seleccion.pista === fila.pista);
            const elegir = () => {
                if (esPista) onSeleccionar(fila.pista, null);
                if (onElegirFila) onElegirFila(fila.clave);
            };
            return (
                <div key={fila.clave} className={`fila-tiempo fila-capas${esPista ? ' fila-capas-pista' : ''}${elegida ? ' elegida' : ''}`}>
                    <button
                        type="button"
                        className="fila-nombre"
                        onClick={elegir}
                        aria-pressed={elegida}
                        title={fila.nombre}
                    >
                        {fila.nombre}
                    </button>
                    <div className="pista pista-capas" style={{ width: anchoPistas }} aria-hidden="true">
                        {frames.map((frame, i) => (
                            <CeldaCapa
                                key={frame.clave}
                                capa={fila.celdas[i]}
                                ancho={aPixeles(duracionDe(frame), escala)}
                                anchoLienzo={anchoLienzo}
                                altoLienzo={altoLienzo}
                                actual={i === indiceActual}
                                indice={i}
                                onPulsar={irAFrameDeCelda}
                                onDoble={onEditar ? editarFrameDeCelda : undefined}
                            />
                        ))}
                    </div>
                </div>
            );
        };
        const porPista = new Map();
        const capas = [];
        for (const fila of filas) {
            if (fila.tipo === 'pista') porPista.set(fila.pista, armar(fila));
            else capas.push(armar(fila));
        }
        return { porPista, capas };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filas, frames, escala, arrastre, indiceActual, seleccion.pista, anchoLienzo, altoLienzo, anchoPistas, Boolean(onEditar), filaElegida]);


    return (
        <div className="linea-tiempo" style={{ '--ancho-nombres': `${ANCHO_NOMBRES}px`, '--margen-inicial': `${MARGEN_INICIAL}px` }}>
            <div className="linea-tiempo-zoom" role="group" aria-label="Zoom de la línea de tiempo">
                <BotonIcono icono={ZoomOut} texto="Alejar" atajo="Ctrl + rueda" onClick={() => zoom(1 / FACTOR_ZOOM, xDelCabezal())} disabled={escala <= ESCALA_MINIMA} />
                <BotonIcono icono={ZoomIn} texto="Acercar" atajo="Ctrl + rueda" onClick={() => zoom(FACTOR_ZOOM, xDelCabezal())} disabled={escala >= ESCALA_MAXIMA} />
                <BotonIcono icono={Maximize} texto="Ver todo" onClick={ajustar} />
            </div>

            <div className="linea-tiempo-visor" ref={visorRef}>
                <div className="linea-tiempo-contenido" style={{ width: INICIO_PISTAS + anchoPistas }}>
                    <div className="fila-tiempo fila-regla">
                        <div className="fila-nombre">{formatearTiempo(tiempo)}</div>
                        <div
                            className="regla"
                            ref={reglaRef}
                            style={{ width: anchoPistas }}
                            onPointerDown={empezarBusqueda}
                            onPointerMove={seguirBusqueda}
                            data-testid="regla"
                        >
                            {marcas.map((ms) => (
                                <span key={ms} className="marca" style={{ left: aPixeles(ms, escala) }}>
                                    {formatearTiempo(ms)}
                                </span>
                            ))}
                        </div>
                    </div>

                    <div className="fila-tiempo">
                        <div className="fila-nombre">Frames</div>
                        <div className="pista" style={{ width: anchoPistas }}>{bloques}</div>
                    </div>

                    {pistas.map((pista) => (
                        <Fragment key={pista.clave}>
                            {filasCapas.porPista.get(pista.clave)}
                            {filaDePista(pista)}
                        </Fragment>
                    ))}
                    {filas === null ? (
                        <div className="fila-tiempo">
                            <div className="fila-nombre">Capas</div>
                            <div className="pista pista-capas cargando-capas" style={{ width: anchoPistas }} aria-busy="true">Cargando capas...</div>
                        </div>
                    ) : filasCapas.capas}

                    <div className="cabezal" style={{ left: INICIO_PISTAS + aPixeles(tiempo, escala) }} />
                </div>
            </div>
        </div>
    );
}

export default LineaTiempo;
