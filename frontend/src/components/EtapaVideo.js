import { useEffect, useRef, useState } from 'react';
import { SkipBack, SkipForward, StepBack, StepForward, Pause, Play } from 'lucide-react';
import LineaTiempo from './LineaTiempo';
import PanelPista from './PanelPista';
import BarraVideo, { HERRAMIENTAS_VIDEO } from './BarraVideo';
import EscenarioVideo from './EscenarioVideo';
import LateralVideo from './LateralVideo';
import BotonIcono from './BotonIcono';
import {
    agregarCapaEnFrames, cajaDeFila, capaDeFila, capaEnPunto, editarTextoDeFila, eliminarFila,
    canvasPara, filaDeCapa, indicesObjetivo, transformarFila,
} from '../utils/operacionesVideo';
import { problemaTexto, textoInicial } from '../utils/texto';
import { canvasDeForma, grupoNuevo, rectanguloEntre } from '../utils/formas';
import { TIPO_ARCHIVO } from './PanelArchivos';
import { calcularAjuste, nombreDesdeArchivo } from '../utils/importarImagen';
import { checkDuracion, cambiarDuracion } from '../utils/operacionesFrames';
import { accionDeEdicion, esCampoDeTexto } from '../utils/atajosArte';
import useTeclado from '../hooks/useTeclado';
import { inicios, formatearTiempo } from '../utils/lineaTiempo';
import useCabezal from '../hooks/useCabezal';
import {
    crearPista, agregarKeyframe, cambiarKeyframe, eliminarKeyframe, hayEspacioParaPista,
} from '../utils/pistas';
import { regenerarPistas, capasConMemoria, capasDeFrames, tieneContenido, desvincularPista } from '../utils/generarPistas';
import { MAX_CAPAS } from '../config/limites';

// Pestaña "Video": la animación en el tiempo y lo que afecta a todo el proyecto. Escenario con herramientas
// (mover, escalar y girar una fila de capas en todos los frames; agregar un rectángulo o un texto en todos), controles
// de reproducción, la línea de tiempo y las pistas de keyframes. Lo que se hace aquí se aplica a todos los frames o,
// si hay frames marcados (Shift + clic en la línea de tiempo), solo a esos; después se puede revisar cada frame en la
// pestaña Imagen. La reproducción es continua (el cabezal avanza en milisegundos, no de frame en frame), y los
// keyframes se pueden poner en cualquier momento.
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
//   seleccion      lo que devuelve useSeleccionFrames: los frames marcados (los mismos de la pestaña Frames)
//   control        ref donde la pestaña deja { agregarImagen(archivo, punto?) }, para usar uno de los archivos del proyecto
//   fileDeArchivo(id)   el File de uno de los archivos del proyecto (al soltarlo en el escenario)
function EtapaVideo({ datos, reproduccion, proporcion, onEditar, seleccion, control, fileDeArchivo }) {
    const { proyecto, frames, pistas } = datos;
    const { tiempo: tiempoSeguro, indice, total, reproduciendo, alternar, buscar, irAFrame } = useCabezal(frames, reproduccion.indice);
    const [seleccionPista, setSeleccionPista] = useState({ pista: null, keyframe: null });
    const [generando, setGenerando] = useState(false);
    const memoriaCapas = useRef(new Map()); // capas ya pedidas al servidor, por id de frame guardado
    const [capasPorFrame, setCapasPorFrame] = useState(null); // vista de capas: Map clave del frame -> capas
    const ocupado = datos.ocupado || generando;
    // Herramientas del escenario
    const [herramienta, setHerramienta] = useState('mover');
    const [color, setColor] = useState('#d4a72c');
    const [fila, setFila] = useState(null); // fila de capas elegida ('capa-<n>' o 'pista-<clave>')
    const [cajaFila, setCajaFila] = useState(null);
    const [textoNuevo, setTextoNuevo] = useState(null); // texto que se está escribiendo (todavía no es una capa)
    const [textoFila, setTextoFila] = useState(null); // cambios al texto de la fila elegida, antes de aplicarlos
    const marcados = seleccion ? seleccion.activa : new Set();
    const claveMarcados = seleccion ? seleccion.claves.join(',') : '';

    const pistaElegida = pistas.find((p) => p.clave === seleccionPista.pista) || null;
    const keyframeElegido = pistaElegida ? pistaElegida.keyframes.find((k) => k.clave === seleccionPista.keyframe) || null : null;
    const contexto = { proyectoId: proyecto.id, ancho: proyecto.ancho, alto: proyecto.alto, memoria: memoriaCapas.current };

    const frame = frames[indice];
    const { ancho, alto } = proyecto;
    const indices = indicesObjetivo(frames, marcados);
    const capasActual = (frame && capasPorFrame && capasPorFrame.get(frame.clave)) || null;
    const capaFila = capaDeFila(capasActual, pistas, fila);
    const esFilaPista = Boolean(fila && fila.startsWith('pista-'));

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

    // Caja de la fila elegida: lo que tiene en los frames a los que se aplica (todos o los marcados)
    useEffect(() => {
        let vigente = true;
        if (!fila || !capasPorFrame) {
            setCajaFila(null);
            return undefined;
        }
        const capasLista = frames.map((f) => capasPorFrame.get(f.clave) || null);
        cajaDeFila(capasLista, pistas, fila, indicesObjetivo(frames, marcados), ancho, alto)
            .then((caja) => vigente && setCajaFila(caja), () => vigente && setCajaFila(null));
        return () => { vigente = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fila, capasPorFrame, frames, pistas, claveMarcados, ancho, alto]);

    // Al cambiar de fila, se olvidan los cambios de texto sin aplicar
    useEffect(() => setTextoFila(null), [fila]);

    // ---- herramientas del escenario ----

    // Hace una operación sobre todo el proyecto ({ frames, pistas } -> { frames, pistas, omitidos }) y la deja en el
    // historial como un solo cambio: Ctrl + Z la deshace entera. Todo lo de esta pestaña pasa por aquí: las
    // herramientas del escenario y los cambios a las pistas. Devuelve true si se hizo
    async function ejecutar(operacion, motivo, base = { frames, pistas }) {
        if (ocupado) return false;
        setGenerando(true);
        try {
            const resultado = await operacion(base);
            datos.aplicarTodo(() => ({ frames: resultado.frames, pistas: resultado.pistas }));
            if (resultado.omitidos) {
                datos.avisar(`En ${resultado.omitidos} frame(s) no se pudo: ya tenían el máximo de ${MAX_CAPAS} capas (o una sola, al quitar).`);
            }
            return true;
        } catch (error) {
            datos.avisar(`${motivo}. ${error.message}`);
            return false;
        } finally {
            setGenerando(false);
        }
    }

    // Posición (desde abajo) que tendrá una capa agregada arriba de todas en el frame actual
    function filaNueva() {
        const pistasActuales = new Set(pistas.map((p) => p.clave));
        const normales = (capasActual || []).filter((c) => !c.pista || !pistasActuales.has(c.pista));
        return `capa-${normales.length}`;
    }

    async function elegirEnPunto(punto) {
        setTextoNuevo(null);
        if (!capasActual) return;
        const capa = await capaEnPunto(capasActual, punto, ancho, alto);
        setFila(capa ? filaDeCapa(capasActual, pistas, capa) : null);
    }

    function transformar(t) {
        if (!fila || !cajaFila) return;
        ejecutar((base) => transformarFila(base, fila, cajaFila, t, indices, contexto), 'No se pudo cambiar la capa');
    }

    async function agregarCapa(datosCapa) {
        const nueva = filaNueva();
        const listo = await ejecutar((base) => agregarCapaEnFrames(base, indices, datosCapa, contexto), 'No se pudo agregar la capa');
        if (listo) {
            setFila(nueva);
            setHerramienta('mover');
        }
        return listo;
    }

    // El rectángulo queda como forma: se puede volver a mover, escalar, girar o cambiar de color sin perder calidad
    function crearRectangulo(rect) {
        const forma = {
            ...rectanguloEntre({ x: rect.x, y: rect.y }, { x: rect.x + rect.ancho, y: rect.y + rect.alto }, color),
            grupo: grupoNuevo(),
        };
        agregarCapa({ nombre: 'Rectángulo', canvas: canvasDeForma(forma, ancho, alto), forma });
    }

    function empezarTexto(punto) {
        setFila(null);
        setTextoNuevo(textoInicial(punto.x, punto.y, '#ffffff'));
    }

    async function agregarTexto() {
        if (!textoNuevo || problemaTexto(textoNuevo)) return;
        const forma = { ...textoNuevo, grupo: grupoNuevo() };
        const nombre = forma.contenido.split('\n')[0].trim().slice(0, 40) || 'Texto';
        if (await agregarCapa({ nombre, canvas: canvasDeForma(forma, ancho, alto), forma })) setTextoNuevo(null);
    }

    async function aplicarTextoFila() {
        if (!textoFila || capaFila?.forma?.tipo !== 'texto' || problemaTexto(textoFila)) return;
        const { contenido, fuente, tamano, color: colorTexto, negrita, cursiva, alineacion } = textoFila;
        const cambios = { contenido, fuente, tamano, color: colorTexto, negrita, cursiva, alineacion };
        const listo = await ejecutar(
            (base) => editarTextoDeFila(base, fila, capaFila.forma.grupo, cambios, indices, contexto),
            'No se pudo cambiar el texto'
        );
        if (listo) setTextoFila(null);
    }

    async function quitarFila() {
        if (!fila || esFilaPista || !capaFila) return;
        const donde = marcados.size > 0 ? `de los ${indices.length} frames marcados` : 'de todos los frames';
        if (!window.confirm(`¿Quitar la capa "${capaFila.nombre}" ${donde}?`)) return;
        if (await ejecutar((base) => eliminarFila(base, fila, indices, contexto), 'No se pudo quitar la capa')) setFila(null);
    }

    // Una imagen de Archivos como capa nueva en los frames: se achica si no cabe y queda centrada (o en "punto")
    async function agregarImagen(archivo, punto = null) {
        try {
            const imagen = await createImageBitmap(archivo);
            const { ancho: w, alto: h } = calcularAjuste(imagen.width, imagen.height, ancho, alto);
            const centro = punto || { x: ancho / 2, y: alto / 2 };
            const rect = { x: Math.round(centro.x - w / 2), y: Math.round(centro.y - h / 2), ancho: w, alto: h };
            const { canvas, ctx } = canvasPara(rect, ancho, alto);
            ctx.drawImage(imagen, rect.x, rect.y, w, h);
            if (imagen.close) imagen.close();
            return agregarCapa({ nombre: nombreDesdeArchivo(archivo.name), canvas });
        } catch (error) {
            datos.avisar(`No se pudo leer la imagen. ${error.message}`);
            return false;
        }
    }
    if (control) control.current = { agregarImagen };

    // ---- pistas ----

    // Genera las capas de las pistas "claves" sobre "base" ({ frames, pistas }). "opciones" se pasa a
    // regenerarPistas (por ejemplo, la capa a ocultar)
    function generar(base, claves, opciones = {}) {
        return ejecutar(
            async (b) => ({ ...(await regenerarPistas(b, claves, { ...contexto, ...opciones })), pistas: b.pistas }),
            'No se pudieron generar las capas de la pista',
            base
        );
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
        if (listo) setSeleccionPista({ pista: nueva.clave, keyframe: nueva.keyframes[0].clave });
    }

    function elegir(pistaClave, keyframeClave) {
        setSeleccionPista({ pista: pistaClave, keyframe: keyframeClave });
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
        if (listo) setSeleccionPista({ pista: pistaClave, keyframe: keyframe.clave });
    }

    // Las capas que generó la pista se quedan en los frames como capas normales (ver desvincularPista)
    function eliminarPista() {
        if (!pistaElegida || ocupado) return;
        const aviso = `¿Eliminar la pista "${pistaElegida.nombre}"? Sus capas se quedan en los frames como capas normales, sin animación.`;
        if (!window.confirm(aviso)) return;
        const clave = pistaElegida.clave;
        datos.aplicarTodo(() => ({ frames: desvincularPista(frames, clave), pistas: pistas.filter((p) => p.clave !== clave) }));
        setSeleccionPista({ pista: null, keyframe: null });
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

    // Atajos de esta pestaña: espacio reproduce o pausa, las flechas cambian de frame, Inicio y Fin van a los
    // extremos, V / R / T eligen herramienta, Esc suelta la capa, Supr la quita, y Ctrl + Z / Y / S como en Frames
    useTeclado((evento) => {
        if (esCampoDeTexto(evento.target)) return null;
        const edicion = accionDeEdicion(evento);
        if (edicion) return () => { if (!generando) datos[edicion](); };
        if (evento.ctrlKey || evento.metaKey || evento.altKey) return null;
        const tecla = evento.key.toLowerCase();
        const herramientaElegida = HERRAMIENTAS_VIDEO.find((h) => h.atajo.toLowerCase() === tecla);
        if (herramientaElegida) return () => setHerramienta(herramientaElegida.id);
        const porTecla = {
            ' ': alternar,
            arrowleft: () => irAFrame(indice - 1),
            arrowright: () => irAFrame(indice + 1),
            home: () => irAFrame(0),
            end: () => irAFrame(frames.length - 1),
            escape: () => { setFila(null); setTextoNuevo(null); setTextoFila(null); },
            delete: quitarFila,
        };
        return porTecla[tecla] || null;
    });

    if (frames.length === 0) {
        return <p>Sin frames.</p>;
    }

    const nombre = `Frame ${indice + 1} de ${frames.length}`;
    return (
        <div className="etapa-con-barra">
            <BarraVideo
                herramienta={herramienta}
                onHerramienta={(id) => { setHerramienta(id); if (id !== 'texto') setTextoNuevo(null); }}
                color={color}
                onColor={setColor}
                ocupado={ocupado}
                datos={datos}
            />
            <section className="etapa-video" aria-labelledby="titulo-video">
                <h2 id="titulo-video" className="solo-lector">Video</h2>

                <div className="video-escena">
                    <div
                        className="video-escenario-zona"
                        onDragOver={(e) => { if (fileDeArchivo && Array.from(e.dataTransfer?.types || []).includes(TIPO_ARCHIVO)) e.preventDefault(); }}
                        onDrop={(e) => {
                            const id = Number(e.dataTransfer?.getData(TIPO_ARCHIVO));
                            const archivo = id && fileDeArchivo ? fileDeArchivo(id) : null;
                            if (!archivo) return;
                            e.preventDefault();
                            agregarImagen(archivo);
                        }}
                    >
                        <EscenarioVideo
                            imagen={frame.vacio ? null : frame.imagen}
                            capas={capasActual}
                            ancho={ancho}
                            alto={alto}
                            herramienta={herramienta}
                            color={color}
                            caja={cajaFila}
                            capaFila={capaFila}
                            ocultarFila={Boolean(textoFila)}
                            textoVivo={textoNuevo || textoFila}
                            ocupado={ocupado}
                            onPunto={elegirEnPunto}
                            onTransformar={transformar}
                            onRectangulo={crearRectangulo}
                            onTexto={empezarTexto}
                        />
                    </div>
                    <LateralVideo
                        marcados={marcados.size > 0 ? indices.length : 0}
                        onQuitarMarcas={() => seleccion.quitar()}
                        textoNuevo={textoNuevo}
                        onTextoNuevo={setTextoNuevo}
                        onAgregarTexto={agregarTexto}
                        fila={fila}
                        capa={capaFila}
                        esPista={esFilaPista}
                        textoFila={textoFila}
                        onTextoFila={setTextoFila}
                        onAplicarTexto={aplicarTextoFila}
                        onSoltar={() => setFila(null)}
                        onQuitar={quitarFila}
                        ocupado={ocupado}
                        generando={generando}
                    />
                </div>

                <div className="controles-video">
                    <BotonIcono icono={SkipBack} texto="Ir al inicio" atajo="Inicio" onClick={() => irAFrame(0)} />
                    <BotonIcono icono={StepBack} texto="Frame anterior" atajo="←" onClick={() => irAFrame(indice - 1)} />
                    <BotonIcono
                        icono={reproduciendo ? Pause : Play}
                        texto={reproduciendo ? 'Pausar' : 'Reproducir'}
                        atajo="Espacio"
                        principal
                        className="boton-grande"
                        onClick={alternar}
                    />
                    <BotonIcono icono={StepForward} texto="Frame siguiente" atajo="→" onClick={() => irAFrame(indice + 1)} />
                    <BotonIcono icono={SkipForward} texto="Ir al final" atajo="Fin" onClick={() => irAFrame(frames.length - 1)} />
                    <span className="tiempo-video">
                        {formatearTiempo(tiempoSeguro)} / {formatearTiempo(total)} · {nombre} · {frame.duracion} ms
                    </span>
                    {(generando || datos.sinGuardar) && (
                        <span className="estado-sin-guardar" aria-busy={generando}>{generando ? 'Aplicando...' : 'Sin guardar'}</span>
                    )}
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
                    seleccion={seleccionPista}
                    onSeleccionar={elegir}
                    onMoverKeyframe={(pista, keyframe, ms) => cambiarPista(pista, (p) => cambiarKeyframe(p, keyframe, { tiempo: ms }))}
                    onAgregarKeyframe={agregarKeyframeEn}
                    capasDeFrames={capasPorFrame}
                    anchoLienzo={ancho}
                    altoLienzo={alto}
                    filaElegida={fila}
                    onElegirFila={(clave) => { setTextoNuevo(null); setHerramienta('mover'); setFila(clave); }}
                    marcados={marcados}
                    onMarcar={seleccion ? seleccion.alternar : undefined}
                />

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
                        setSeleccionPista({ pista: pistaElegida.clave, keyframe: null });
                    }}
                    onRenombrar={(nombrePista) => cambiarPista(pistaElegida.clave, (p) => ({ ...p, nombre: nombrePista }))}
                    onRegenerar={() => generar({ frames, pistas }, new Set([pistaElegida.clave]))}
                    onEliminar={eliminarPista}
                    onCerrar={() => setSeleccionPista({ pista: null, keyframe: null })}
                />
            </section>
        </div>
    );
}

export default EtapaVideo;
