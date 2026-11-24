import { useEffect, useRef, useState } from 'react';
import LineaTiempo from './LineaTiempo';
import PanelPista from './PanelPista';
import { checkDuracion, cambiarDuracion } from '../utils/operacionesFrames';
import { esCampoDeTexto } from '../utils/atajosArte';
import { inicios, duracionTotal, indiceEnTiempo, formatearTiempo } from '../utils/lineaTiempo';
import {
    crearPista, agregarKeyframe, cambiarKeyframe, eliminarKeyframe, hayEspacioParaPista,
} from '../utils/pistas';
import { regenerarPistas, capasConMemoria, capasDeFrames, tieneContenido, desvincularPista } from '../utils/generarPistas';
import { MAX_CAPAS } from '../config/limites';

// Pestaña "Video": la animación en el tiempo. Vista previa, controles de reproducción, la línea de tiempo y
// las pistas de keyframes. La reproducción es continua (el cabezal avanza en milisegundos, no de frame en
// frame), y los keyframes se pueden poner en cualquier momento.
//
// Cada cambio a una pista vuelve a generar sus capas en los frames (utils/generarPistas.js) y queda en el
// historial junto con esos frames: Ctrl + Z deshace las dos cosas a la vez.
//
// Props:
//   datos          lo que devuelve useProyectoFrames
//   reproduccion   lo que devuelve useReproduccion: se abre en el frame que se estaba viendo y se le avisa
//                  cada vez que cambia el frame, para que la pestaña Frames siga en el mismo
//   proporcion     "ancho / alto" del lienzo, para los frames en blanco
//   onEditar(clave)   abrir un frame en la pestaña Imagen (opcional)
function EtapaVideo({ datos, reproduccion, proporcion, onEditar }) {
    const { proyecto, frames, pistas } = datos;
    const total = duracionTotal(frames);
    const [tiempo, setTiempo] = useState(() => inicios(frames)[reproduccion.indice] || 0);
    const [reproduciendo, setReproduciendo] = useState(false);
    const [seleccion, setSeleccion] = useState({ pista: null, keyframe: null });
    const [generando, setGenerando] = useState(false);
    const memoriaCapas = useRef(new Map()); // capas ya pedidas al servidor, por id de frame guardado
    const [capasPorFrame, setCapasPorFrame] = useState(null); // vista de capas: Map clave del frame -> capas
    const ocupado = datos.ocupado || generando;

    const pistaElegida = pistas.find((p) => p.clave === seleccion.pista) || null;
    const keyframeElegido = pistaElegida ? pistaElegida.keyframes.find((k) => k.clave === seleccion.keyframe) || null : null;
    const contexto = { proyectoId: proyecto.id, ancho: proyecto.ancho, alto: proyecto.alto, memoria: memoriaCapas.current };

    // Si los frames se acortan, el cabezal no puede quedar después del final
    const tiempoSeguro = Math.min(tiempo, Math.max(total - 1, 0));
    const indice = indiceEnTiempo(frames, tiempoSeguro);
    const frame = frames[indice];

    // Reproducción continua: en cada cuadro de pantalla el cabezal avanza lo que pasó desde el anterior.
    // Al llegar al final vuelve al comienzo
    useEffect(() => {
        if (!reproduciendo || total <= 0) return undefined;
        let anterior = performance.now();
        let pedido;
        function avanzar(ahora) {
            const pasado = ahora - anterior;
            anterior = ahora;
            setTiempo((actual) => (Math.min(actual, total) + pasado) % total);
            pedido = requestAnimationFrame(avanzar);
        }
        pedido = requestAnimationFrame(avanzar);
        return () => cancelAnimationFrame(pedido);
    }, [reproduciendo, total]);

    // Capas de todos los frames para la vista de capas de la línea de tiempo. Las de los frames guardados se piden
    // al servidor una sola vez (memoriaCapas); las de los frames editados o con pistas ya están en el navegador.
    // Mientras cargan las nuevas se sigue mostrando lo anterior
    const proyectoId = proyecto.id;
    useEffect(() => {
        let vigente = true;
        capasDeFrames(frames, proyectoId, memoriaCapas.current)
            .then((mapa) => {
                if (vigente) setCapasPorFrame(mapa);
            })
            .catch(() => {
                if (vigente) setCapasPorFrame((actual) => actual || new Map());
            });
        return () => { vigente = false; };
    }, [frames, proyectoId]);


    // La pestaña Frames queda en el mismo frame que se ve aquí
    const { indice: indiceCompartido, irA } = reproduccion;
    useEffect(() => {
        if (indice !== indiceCompartido) irA(indice);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [indice]);

    // Mover el cabezal a mano detiene la reproducción
    function buscar(nuevo) {
        setReproduciendo(false);
        setTiempo(nuevo);
    }

    function irAFrame(nuevoIndice) {
        const limitado = Math.min(Math.max(nuevoIndice, 0), frames.length - 1);
        buscar(inicios(frames)[limitado]);
    }

    // ---- pistas ----

    // Genera las capas de las pistas "claves" sobre "base" ({ frames, pistas }) y lo deja en el historial
    // como un solo cambio. "opciones" se pasa a regenerarPistas (por ejemplo, la capa a ocultar)
    async function generar(base, claves, opciones = {}) {
        if (ocupado) return false;
        setGenerando(true);
        try {
            const { frames: nuevos, omitidos } = await regenerarPistas(base, claves, { ...contexto, ...opciones });
            datos.aplicarTodo(() => ({ frames: nuevos, pistas: base.pistas }));
            if (omitidos) {
                datos.avisar(`En ${omitidos} frame(s) no se agregó la capa de la pista: ya tenían el máximo de ${MAX_CAPAS} capas.`);
            }
            return true;
        } catch (error) {
            datos.avisar(`No se pudieron generar las capas de la pista. ${error.message}`);
            return false;
        } finally {
            setGenerando(false);
        }
    }

    // Cambia una pista con "transformar(pista)" y vuelve a generar sus capas. Si no cambió nada, no hace nada
    function cambiarPista(clave, transformar) {
        const pista = pistas.find((p) => p.clave === clave);
        if (!pista) return Promise.resolve(false);
        const nueva = transformar(pista);
        if (nueva === pista) return Promise.resolve(false);
        return generar({ frames, pistas: pistas.map((p) => (p.clave === clave ? nueva : p)) }, new Set([clave]));
    }

    // Las capas del frame actual que se pueden animar: las que tienen dibujo y no son de otra pista
    async function capasParaPista() {
        try {
            const capas = await capasConMemoria(frame, proyecto.id, memoriaCapas.current);
            const candidatas = capas.filter((capa) => !capa.pista && capa.imagen);
            const conDibujo = await Promise.all(candidatas.map((capa) => tieneContenido(capa.imagen, proyecto.ancho, proyecto.alto)));
            return candidatas.filter((_, i) => conDibujo[i]);
        } catch (error) {
            datos.avisar(`No se pudieron cargar las capas del frame. ${error.message}`);
            return [];
        }
    }

    // Pista nueva con una capa del frame actual: empieza con un keyframe al comienzo del frame, sin cambios.
    // La capa original se oculta en ese frame, porque la pista genera una igual encima
    async function crearPistaConCapa(capa) {
        const blob = capa.blob || await (await fetch(capa.imagen)).blob();
        const nueva = crearPista({ nombre: capa.nombre, imagen: capa.imagen, blob, tiempo: inicios(frames)[indice] });
        const listo = await generar(
            { frames, pistas: [...pistas, nueva] },
            new Set([nueva.clave]),
            { ocultar: { frame: frame.clave, capa: capa.clave } }
        );
        if (listo) setSeleccion({ pista: nueva.clave, keyframe: nueva.keyframes[0].clave });
    }

    function elegir(pistaClave, keyframeClave) {
        setSeleccion({ pista: pistaClave, keyframe: keyframeClave });
        const pista = pistas.find((p) => p.clave === pistaClave);
        const keyframe = pista && pista.keyframes.find((k) => k.clave === keyframeClave);
        if (keyframe) buscar(Math.min(keyframe.tiempo, Math.max(total - 1, 0))); // la vista previa muestra ese momento
    }

    // Agrega un keyframe con los valores que la pista tiene en ese momento y lo deja elegido
    async function agregarKeyframeEn(pistaClave, momento) {
        const pista = pistas.find((p) => p.clave === pistaClave);
        const redondeado = Math.round(momento);
        const nueva = pista && agregarKeyframe(pista, redondeado);
        if (!pista || nueva === pista) return;
        const keyframe = nueva.keyframes.find((k) => k.tiempo === redondeado);
        const listo = await generar({ frames, pistas: pistas.map((p) => (p === pista ? nueva : p)) }, new Set([pistaClave]));
        if (listo) setSeleccion({ pista: pistaClave, keyframe: keyframe.clave });
    }

    // Las capas que generó la pista se quedan en los frames como capas normales (ver desvincularPista)
    function eliminarPista() {
        if (!pistaElegida || ocupado) return;
        const aviso = `¿Eliminar la pista "${pistaElegida.nombre}"? Sus capas se quedan en los frames como capas normales, sin animación.`;
        if (!window.confirm(aviso)) return;
        const clave = pistaElegida.clave;
        datos.aplicarTodo(() => ({ frames: desvincularPista(frames, clave), pistas: pistas.filter((p) => p.clave !== clave) }));
        setSeleccion({ pista: null, keyframe: null });
    }

    // Devuelve false si la duración no es válida. Si hay pistas, sus capas se vuelven a generar con las
    // duraciones nuevas (los frames que caen entre los keyframes pueden cambiar)
    function cambiarDuracionDeUno(clave, valor) {
        if (ocupado || !checkDuracion(valor)) return false;
        if (pistas.length === 0) {
            datos.aplicar((f) => cambiarDuracion(f, [clave], valor));
        } else {
            generar({ frames: cambiarDuracion(frames, [clave], valor), pistas }, new Set(pistas.map((p) => p.clave)));
        }
        return true;
    }

    // Atajos de esta pestaña: espacio reproduce o pausa, las flechas cambian de frame,
    // Inicio y Fin van a los extremos, y Ctrl + Z / Y / S como en la pestaña Frames
    const acciones = useRef({});
    acciones.current = {
        alternar: () => setReproduciendo((actual) => !actual),
        anterior: () => irAFrame(indice - 1),
        siguiente: () => irAFrame(indice + 1),
        inicio: () => irAFrame(0),
        fin: () => irAFrame(frames.length - 1),
        deshacer: () => !generando && datos.deshacer(),
        rehacer: () => !generando && datos.rehacer(),
        guardar: () => !generando && datos.guardar(),
    };
    useEffect(() => {
        function alPulsar(evento) {
            if (esCampoDeTexto(evento.target)) return;
            const a = acciones.current;
            const control = evento.ctrlKey || evento.metaKey;
            const tecla = evento.key.toLowerCase();
            const porTecla = {
                ' ': a.alternar,
                arrowleft: a.anterior,
                arrowright: a.siguiente,
                home: a.inicio,
                end: a.fin,
            };
            let accion = null;
            if (control && tecla === 'z' && !evento.shiftKey) accion = a.deshacer;
            else if (control && (tecla === 'y' || (tecla === 'z' && evento.shiftKey))) accion = a.rehacer;
            else if (control && tecla === 's') accion = a.guardar;
            else if (!control && !evento.altKey) accion = porTecla[tecla];
            if (!accion) return;
            evento.preventDefault();
            accion();
        }
        document.addEventListener('keydown', alPulsar);
        return () => document.removeEventListener('keydown', alPulsar);
    }, []);

    if (frames.length === 0) {
        return <p>Este proyecto todavía no tiene frames. Ve a la pestaña Importar para subir un GIF o imagen.</p>;
    }

    const nombre = `Frame ${indice + 1} de ${frames.length}`;
    return (
        <section className="etapa-video" aria-labelledby="titulo-video">
            <h2 id="titulo-video">Video</h2>

            {frame.vacio ? (
                <div
                    className="frame-vacio vista-previa"
                    role="img"
                    aria-label={`${nombre} (en blanco)`}
                    style={proporcion ? { aspectRatio: proporcion } : undefined}
                >
                    En blanco
                </div>
            ) : (
                <img className="vista-previa" src={frame.imagen} alt={nombre} />
            )}

            <div className="controles-video">
                <button type="button" onClick={() => irAFrame(0)} aria-label="Ir al inicio" title="Ir al inicio (Inicio)">⏮</button>
                <button type="button" onClick={() => irAFrame(indice - 1)} aria-label="Frame anterior" title="Frame anterior (←)">◀</button>
                <button type="button" className="boton-reproducir" onClick={acciones.current.alternar} title="Reproducir o pausar (Espacio)">
                    {reproduciendo ? 'Pausar' : 'Reproducir'}
                </button>
                <button type="button" onClick={() => irAFrame(indice + 1)} aria-label="Frame siguiente" title="Frame siguiente (→)">▶</button>
                <span className="tiempo-video">
                    {formatearTiempo(tiempoSeguro)} / {formatearTiempo(total)} · {nombre} · {frame.duracion} ms
                </span>
            </div>

            <LineaTiempo
                frames={frames}
                tiempo={tiempoSeguro}
                indiceActual={indice}
                seguir={reproduciendo}
                bloqueada={ocupado}
                onBuscar={buscar}
                onDuracion={cambiarDuracionDeUno}
                onEditar={onEditar}
                pistas={pistas}
                seleccion={seleccion}
                onSeleccionar={elegir}
                onMoverKeyframe={(pista, keyframe, ms) => cambiarPista(pista, (p) => cambiarKeyframe(p, keyframe, { tiempo: ms }))}
                onAgregarKeyframe={agregarKeyframeEn}
                capasDeFrames={capasPorFrame}
                anchoLienzo={proyecto.ancho}
                altoLienzo={proyecto.alto}
            />
            {/* Los cambios de duración hechos aquí se deshacen y se guardan igual que en la pestaña Frames */}
            <div className="estado-video">
                <button type="button" onClick={datos.deshacer} disabled={ocupado || !datos.puedeDeshacer}>Deshacer</button>
                <button type="button" onClick={datos.rehacer} disabled={ocupado || !datos.puedeRehacer}>Rehacer</button>
                <button type="button" onClick={datos.guardar} disabled={ocupado || !datos.sinGuardar}>
                    {datos.guardando ? 'Guardando...' : 'Guardar'}
                </button>
                <span className={datos.sinGuardar ? 'estado-sin-guardar' : 'estado-guardado'}>
                    {generando ? 'Generando capas de la pista...' : datos.sinGuardar ? 'Hay cambios sin guardar' : 'Todo guardado'}
                </span>
            </div>

            <PanelPista
                pista={pistaElegida}
                keyframe={keyframeElegido}
                tiempo={tiempoSeguro}
                ocupado={ocupado}
                puedeCrear={hayEspacioParaPista(pistas)}
                onPedirCapas={capasParaPista}
                onCrear={crearPistaConCapa}
                onCambiarKeyframe={(cambios) => cambiarPista(pistaElegida.clave, (p) => cambiarKeyframe(p, keyframeElegido.clave, cambios))}
                onAgregarKeyframe={() => agregarKeyframeEn(pistaElegida.clave, tiempoSeguro)}
                onEliminarKeyframe={() => {
                    cambiarPista(pistaElegida.clave, (p) => eliminarKeyframe(p, keyframeElegido.clave));
                    setSeleccion({ pista: pistaElegida.clave, keyframe: null });
                }}
                onRenombrar={(nombre) => cambiarPista(pistaElegida.clave, (p) => ({ ...p, nombre }))}
                onRegenerar={() => generar({ frames, pistas }, new Set([pistaElegida.clave]))}
                onEliminar={eliminarPista}
                onCerrar={() => setSeleccion({ pista: null, keyframe: null })}
            />
            <p className="ayuda-video">
                Clic en la regla, en un frame o en una capa para ir a ese momento. Arrastra el borde derecho de un frame para
                cambiar su duración. Doble clic en un frame o en una capa para editarlo. Las capas ocultas se ven atenuadas.
            </p>
        </section>
    );
}

export default EtapaVideo;
