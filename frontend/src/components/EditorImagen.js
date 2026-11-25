import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Lienzo from './Lienzo';
import BotonIcono from './BotonIcono';
import BarraHerramientas from './BarraHerramientas';
import PanelCapas from './PanelCapas';
import { obtenerMensajeError } from '../services/servicioAPI';
import { combinarAtajos, accionDeEvento, formatearCombinacion } from '../utils/atajosArte';
import { limitarTamano } from '../utils/herramientas';
import { checkContenido, copiarCapas, pegarCapas } from '../utils/portapapelesCapas';
import {
    capasDeFrame, agregarCapa, prepararParaEditar, eliminarCapa, duplicarCapa, renombrarCapa, reordenarCapas,
    cambiarVisibilidad, bloquearCapa, marcarModificada, agregarCapaConImagen,
} from '../utils/capas';
import { motivoRechazo, nombreDesdeArchivo, imagenACapaPNG, TIPOS_IMAGEN } from '../utils/importarImagen';
import PanelFlotante from './PanelFlotante';
import PanelTexto from './PanelTexto';
import { canvasDeTexto, problemaTexto } from '../utils/texto';
import {
    MAX_FRAMES_CEBOLLA, OPACIDAD_MINIMA_CEBOLLA, OPACIDAD_MAXIMA_CEBOLLA, COLOR_ANTERIORES, COLOR_SIGUIENTES,
    fantasmasCebolla, leerAjustesCebolla, guardarAjustesCebolla,
} from '../utils/papelCebolla';
import useTeclado from '../hooks/useTeclado';

const PASO_TAMANO = 5;
const SIN_VECINOS = { anteriores: [], siguientes: [] };

// Editor de imagen de UN fotograma (RF26 a RF45): une el lienzo, la barra de herramientas, el panel de capas
// y los atajos de teclado. Todo lo que se dibuja vive en el lienzo; aquí solo se coordinan las partes.
//
// Props:
//   proyectoId, ancho, alto   proyecto al que pertenece el fotograma y tamaño de su lienzo
//   frame                     el fotograma { origen_id?, imagen?, vacio?, capas? }
//   atajos                    atajos vigentes { accion: combinacion } (por defecto, los de fábrica)
//   onTerminar({ capas, imagen })   el usuario aplicó los cambios: capas finales (las modificadas traen
//                                   "blob" con su PNG) e "imagen", el PNG de las capas visibles juntas
//   onCancelar()                    se cerró sin aplicar cambios
function EditorImagen({
    proyectoId, nombreProyecto, posicion, ancho, alto, frame, atajos = combinarAtajos({}), onTerminar, onCancelar,
        onCambiosSinAplicar, vecinos = SIN_VECINOS, onCambiarFrame, ajustesIniciales = {}, onAjustes,
}) {
    const lienzo = useRef(null);
    const [capas, setCapas] = useState(null); // null mientras cargan
    const [errorCarga, setErrorCarga] = useState('');
    const [intento, setIntento] = useState(0);
    const [claveActiva, setClaveActiva] = useState(null);
    const [herramienta, setHerramienta] = useState(ajustesIniciales.herramienta || 'pincel');
    const [color, setColor] = useState(ajustesIniciales.color || '#000000');
    const [tamano, setTamano] = useState(ajustesIniciales.tamano || 10);
    const [aviso, setAviso] = useState('');
    const [seleccion, setSeleccion] = useState(null);
    const [historial, setHistorial] = useState({ puedeDeshacer: false, puedeRehacer: false });
    const [sucio, setSucio] = useState(false); // hay cambios sin aplicar
    const [confirmandoSalida, setConfirmandoSalida] = useState(false);
    const [aplicando, setAplicando] = useState(false);
        // Sube cada vez que cambian los píxeles de alguna capa: las miniaturas del panel de capas se vuelven a dibujar
    const [versionPixeles, setVersionPixeles] = useState(0);
    const pixelesCambiaron = useCallback(() => setVersionPixeles((v) => v + 1), []);
    const dibujarMiniatura = useCallback((clave, destino) => lienzo.current?.dibujarMiniatura?.(clave, destino), []);
    const [hayContenido, setHayContenido] = useState(checkContenido());
    const [paneles, setPaneles] = useState(ajustesIniciales.paneles || { proyecto: true, herramientas: true, capas: true });
    const [zoom, setZoom] = useState(1);
        const [cebolla, setCebolla] = useState(leerAjustesCebolla);

    // Los ajustes del papel cebolla se recuerdan para la próxima vez que se abra el editor
    useEffect(() => guardarAjustesCebolla(cebolla), [cebolla]);

    // Solo se vuelve a calcular si cambian los ajustes o las imágenes vecinas, no en cada render
    const imagenesVecinas = [...vecinos.anteriores, '|', ...vecinos.siguientes].join(',');
    const fantasmas = useMemo(
        () => fantasmasCebolla(vecinos, cebolla),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [imagenesVecinas, cebolla]
    );
    const hayVecinos = vecinos.anteriores.some(Boolean) || vecinos.siguientes.some(Boolean);

    function ajustarCebolla(cambios) {
        setCebolla((actuales) => ({ ...actuales, ...cambios }));
    }

        // Avisa los ajustes de trabajo para que el próximo frame se abra igual
    useEffect(() => {
        if (onAjustes) onAjustes({ herramienta, color, tamano, paneles });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [herramienta, color, tamano, paneles]);

    // Quien abrió el editor necesita saber si hay cambios sin aplicar (por ejemplo, para avisar al cambiar de pestaña)
    useEffect(() => {
        if (onCambiosSinAplicar) onCambiosSinAplicar(sucio);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sucio]);

    // Carga las capas al abrir (y al reintentar si falló)
    useEffect(() => {
        let vigente = true;
        setErrorCarga('');
        capasDeFrame(proyectoId, frame)
            .then((cargadas) => {
                if (!vigente) return;
                // El fondo empieza bloqueado y queda activa una capa donde se puede dibujar (no cuenta como cambio)
                const preparadas = prepararParaEditar(cargadas);
                setCapas(preparadas.capas);
                setClaveActiva(preparadas.activa);
            })
            .catch((error) => {
                if (vigente) setErrorCarga(obtenerMensajeError(error));
            });
        return () => { vigente = false; };
        // Solo al abrir el editor o al reintentar: "frame" no cambia mientras se edita
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [intento]);

    // Cambia la lista de capas (agregar, eliminar, renombrar...) y marca el fotograma como modificado
    function cambiarCapas(nuevas) {
        if (nuevas === capas) return;
        setCapas(nuevas);
        setSucio(true);
    }

    function alAgregar() {
        const nuevas = agregarCapa(capas, claveActiva);
        if (nuevas === capas) return;
        cambiarCapas(nuevas);
        setClaveActiva(nuevas.find((c) => !capas.includes(c)).clave);
    }

    function alDuplicar() {
        const nuevas = duplicarCapa(capas, claveActiva);
        const copia = nuevas.find((c) => !capas.includes(c));
        if (!copia) return;
        lienzo.current.copiarPixeles(claveActiva, copia.clave);
        cambiarCapas(nuevas);
        setClaveActiva(copia.clave);
    }

    async function alCopiar() {
        const capa = capas.find((c) => c.clave === claveActiva);
        if (!capa) return;
        try {
            const deSeleccion = Boolean(seleccion);
            const blob = deSeleccion
                ? await lienzo.current.exportarSeleccion(capa.clave)
                : await lienzo.current.exportarCapa(capa.clave);
            const nombre = deSeleccion ? `Selección de ${capa.nombre}` : capa.nombre;
            if (copiarCapas([{ nombre, visible: capa.visible, bloqueada: capa.bloqueada, blob }])) {
                setHayContenido(true);
                setAviso('');
            }
        } catch (error) {
            setAviso('No se pudo copiar.');
        }
    }

    // Pega la capa copiada sobre la activa (puede venir de otro fotograma)
    function alPegar() {
        const resultado = pegarCapas(capas, claveActiva);
        if (resultado.capas === capas) return;
            cambiarCapas(resultado.capas);
            setClaveActiva(resultado.claves[resultado.claves.length - 1]);
    }

    // Importa una imagen del computador como capa nueva sobre la activa
async function alImportar(archivo) {
    const motivo = motivoRechazo(archivo, TIPOS_IMAGEN);
    if (motivo) {
        setAviso(motivo);
        return;
    }
    try {
        const blob = await imagenACapaPNG(archivo, ancho, alto);
        const nuevas = agregarCapaConImagen(capas, claveActiva, {
            nombre: nombreDesdeArchivo(archivo.name),
            imagen: URL.createObjectURL(blob),
        });
        if (nuevas === capas) return;
        setAviso('');
        cambiarCapas(nuevas);
        setClaveActiva(nuevas.find((c) => !capas.includes(c)).clave);
    } catch (error) {
        setAviso('No se pudo importar la imagen.');
    }
}

    function alEliminar(clave) {
        const nuevas = eliminarCapa(capas, clave);
        if (nuevas === capas) return;
        cambiarCapas(nuevas);
        // Si se eliminó la activa, pasa a ser la de arriba
        if (clave === claveActiva) setClaveActiva(nuevas[nuevas.length - 1].clave);
    }

    // Capa de texto: cada cambio en su panel la vuelve a dibujar. "Convertir en imagen" la deja como capa normal
    function cambiarTexto(texto) {
        const activa = capas.find((c) => c.clave === claveActiva);
        if (!activa || !activa.texto) return;
        if (!problemaTexto(texto)) lienzo.current.reemplazarImagen(activa.clave, canvasDeTexto(texto, ancho, alto));
        const nombre = texto.contenido.split('\n')[0].trim().slice(0, 40) || activa.nombre;
        setCapas((actuales) => actuales.map((c) => (c.clave === activa.clave ? { ...c, texto, nombre, modificada: true } : c)));
    }

    function convertirEnImagen() {
        setCapas((actuales) => actuales.map((c) => (c.clave === claveActiva ? { ...c, texto: null, modificada: true } : c)));
        setSucio(true);
        setAviso('');
    }

    function alModificarCapa(clave) {
        setAviso('');
        setSucio(true);
        setCapas((actuales) => marcarModificada(actuales, clave));
        pixelesCambiaron();
    }

    // Aplica los cambios: exporta la imagen compuesta y el PNG de cada capa modificada
        // Los cambios listos para entregar: la imagen compuesta y el PNG de cada capa modificada
    async function prepararCambios() {
        const imagen = await lienzo.current.componer();
        const finales = [];
        for (const capa of capas) {
            if (!capa.modificada) {
                finales.push(capa);
                continue;
            }
            const blob = await lienzo.current.exportarCapa(capa.clave);
            finales.push({ ...capa, blob, imagen: URL.createObjectURL(blob) });
        }
        return { capas: finales, imagen };
    }

    // "Aplicar y cerrar" y pasar a otro frame entregan los cambios igual; solo cambia lo que pasa después.
    // Sin cambios no hay nada que preparar: se sigue de inmediato con null
    async function entregar(despues) {
        if (!sucio) {
            despues(null);
            return;
        }
        if (aplicando) return;
        setAplicando(true);
        try {
            despues(await prepararCambios());
        } catch (error) {
            setAviso('No se pudieron preparar los cambios. Inténtalo de nuevo.');
            setAplicando(false);
        }
    }

    function aplicar() {
        entregar((resultado) => (resultado ? onTerminar(resultado) : onCancelar()));
    }

    // Pasa al frame anterior (-1) o siguiente (1); los cambios de este quedan aplicados
    const hayAnterior = Boolean(onCambiarFrame) && vecinos.anteriores.length > 0;
    const haySiguiente = Boolean(onCambiarFrame) && vecinos.siguientes.length > 0;
    function irAFrame(paso) {
        if (paso < 0 ? !hayAnterior : !haySiguiente) return;
        entregar((resultado) => onCambiarFrame(paso, resultado));
    }

    function pedirCancelar() {
        if (sucio) setConfirmandoSalida(true);
        else onCancelar();
    }

        function alternarPanel(id) {
        setPaneles((actuales) => ({ ...actuales, [id]: !actuales[id] }));
    }

    // Si hay algún panel abierto se cierran todos; si no hay ninguno, se abren todos
    function alternarTodosLosPaneles() {
        setPaneles((actuales) => {
            const algunoAbierto = Object.values(actuales).some(Boolean);
            return { proyecto: !algunoAbierto, herramientas: !algunoAbierto, capas: !algunoAbierto };
        });
    }

    // Atajos de teclado: accionDeEvento dice qué acción es (según los atajos del usuario); aquí se ejecuta
    const acciones = {
        pincel: () => setHerramienta('pincel'),
        borrador: () => setHerramienta('borrador'),
        seleccion: () => setHerramienta('seleccion'),
        mover: () => setHerramienta('mover'),
        tamano_mas: () => setTamano((t) => limitarTamano(t + PASO_TAMANO)),
        tamano_menos: () => setTamano((t) => limitarTamano(t - PASO_TAMANO)),
        capa_nueva: alAgregar,
        deshacer: () => lienzo.current.deshacer(),
        rehacer: () => lienzo.current.rehacer(),
        borrar_seleccion: () => lienzo.current.borrarSeleccion(),
        seleccionar_todo: () => lienzo.current.seleccionarTodo(),
        quitar_seleccion: () => lienzo.current.quitarSeleccion(),
        alternar_paneles: alternarTodosLosPaneles,
        papel_cebolla: () => setCebolla((actuales) => ({ ...actuales, activa: !actuales.activa })),
        frame_anterior: () => irAFrame(-1),
        frame_siguiente: () => irAFrame(1),
        copiar_capa: alCopiar,
        pegar_capa: alPegar,
    };
    useTeclado((evento) => {
        const accion = accionDeEvento(evento, atajos);
        return accion ? () => { acciones[accion](); } : null;
    }, Boolean(capas));

    if (errorCarga) {
        return (
            <section className="editor-imagen">
                <p role="alert">No se pudieron cargar las capas: {errorCarga}</p>
                <button type="button" onClick={() => setIntento((n) => n + 1)}>Reintentar</button>
                <button type="button" onClick={onCancelar}>Volver</button>
            </section>
        );
    }
    if (!capas) {
        return <section className="editor-imagen"><p role="status" aria-busy="true">Cargando...</p></section>
    }
    const capaActiva = capas.find((c) => c.clave === claveActiva) || null;

    // Aplicar y cancelar van con lo del frame en general (panel Proyecto, arriba a la izquierda).
    // Cancelar primero y Aplicar al final, a la derecha: lo que más se usa queda en el extremo
    const accionesFrame = (
        <div className="editor-acciones">
            <button type="button" onClick={pedirCancelar} disabled={aplicando}>Cancelar</button>
            <button type="button" className="boton-principal" onClick={aplicar} disabled={aplicando} aria-busy={aplicando}>
                {aplicando ? 'Aplicando...' : 'Aplicar y cerrar'}
            </button>
        </div>
    );

    return (
        <section className="editor-imagen" aria-label="Editor de imagen">
            {/* El lienzo es el fondo de toda la pantalla; todo lo demás flota encima */}
            <Lienzo
                ref={lienzo}
                ancho={ancho}
                alto={alto}
                capas={capas}
                claveActiva={claveActiva}
                herramienta={herramienta}
                color={color}
                tamano={tamano}
                cebolla={fantasmas}
                onAviso={setAviso}
                onHistorialCambia={setHistorial}
                onSeleccionCambia={setSeleccion}
                onCapaModificada={alModificarCapa}
                onCapaCargada={pixelesCambiaron}
                onZoomCambia={setZoom}
                onTamano={setTamano}
            />

            <PanelFlotante id="proyecto" nombre="Proyecto" abierto={paneles.proyecto} onCerrar={() => alternarPanel('proyecto')}>
                {nombreProyecto && <h1 className="editor-proyecto">{nombreProyecto}</h1>}
                <h2 className="solo-lector">Editar frame</h2>
                <div className="cambiar-frame">
                    {onCambiarFrame && (
                        <BotonIcono
                            icono={ChevronLeft}
                            texto="Frame anterior"
                            atajo={formatearCombinacion(atajos.frame_anterior)}
                            lado="abajo"
                            onClick={() => irAFrame(-1)}
                            disabled={aplicando || !hayAnterior}
                        />
                    )}
                    {posicion && <p>{posicion}</p>}
                    {onCambiarFrame && (
                        <BotonIcono
                            icono={ChevronRight}
                            texto="Frame siguiente"
                            atajo={formatearCombinacion(atajos.frame_siguiente)}
                            lado="abajo"
                            onClick={() => irAFrame(1)}
                            disabled={aplicando || !haySiguiente}
                        />
                    )}
                </div>
                {accionesFrame}

                <fieldset className="papel-cebolla">
                    <legend>Papel cebolla</legend>
                    <label>
                        <input
                            type="checkbox"
                            checked={cebolla.activa}
                            onChange={(evento) => ajustarCebolla({ activa: evento.target.checked })}
                        />
                        <span title={atajos.papel_cebolla ? formatearCombinacion(atajos.papel_cebolla) : undefined}>Ver vecinos</span>
                    </label>
                    <label>
                        A cada lado
                        <select
                            value={cebolla.cantidad}
                            onChange={(evento) => ajustarCebolla({ cantidad: Number(evento.target.value) })}
                        >
                            {Array.from({ length: MAX_FRAMES_CEBOLLA }, (_, i) => i + 1).map((n) => (
                                <option key={n} value={n}>{n}</option>
                            ))}
                        </select>
                    </label>
                    <label>
                        Opacidad
                        <input
                            type="range"
                            min={OPACIDAD_MINIMA_CEBOLLA}
                            max={OPACIDAD_MAXIMA_CEBOLLA}
                            step="5"
                            value={cebolla.opacidad}
                            onChange={(evento) => ajustarCebolla({ opacidad: Number(evento.target.value) })}
                        />
                        {cebolla.opacidad} %
                    </label>
                    {cebolla.activa && hayVecinos && (
                        <p className="leyenda-cebolla">
                            <span className="muestra-cebolla" style={{ background: COLOR_ANTERIORES }} aria-hidden="true" /> Anteriores
                            <span className="muestra-cebolla" style={{ background: COLOR_SIGUIENTES }} aria-hidden="true" /> Siguientes
                        </p>
                    )}
                </fieldset>
            </PanelFlotante>

            <PanelFlotante id="herramientas" nombre="Herramientas" abierto={paneles.herramientas} onCerrar={() => alternarPanel('herramientas')}>
                <BarraHerramientas
                    herramienta={herramienta}
                    onHerramienta={setHerramienta}
                    color={color}
                    onColor={setColor}
                    tamano={tamano}
                    onTamano={setTamano}
                    atajos={atajos}
                    puedeDeshacer={historial.puedeDeshacer}
                    puedeRehacer={historial.puedeRehacer}
                    onDeshacer={() => lienzo.current.deshacer()}
                    onRehacer={() => lienzo.current.rehacer()}
                    haySeleccion={Boolean(seleccion)}
                    onSeleccionarTodo={() => lienzo.current.seleccionarTodo()}
                    onQuitarSeleccion={() => lienzo.current.quitarSeleccion()}
                    onBorrarSeleccion={() => lienzo.current.borrarSeleccion()}
                    onCopiarSeleccion={alCopiar}
                    onTransformar={(parametros) => lienzo.current.transformar(parametros)}
                    zoom={zoom}
                    onAcercar={() => lienzo.current.acercar()}
                    onAlejar={() => lienzo.current.alejar()}
                    onZoomReal={() => lienzo.current.zoomReal()}
                    onAjustar={() => lienzo.current.ajustar()}
                />
            </PanelFlotante>

            <PanelFlotante id="capas" nombre="Capas" abierto={paneles.capas} onCerrar={() => alternarPanel('capas')}>
                <PanelCapas
                    capas={capas}
                    claveActiva={claveActiva}
                    onSeleccionar={(clave) => { setClaveActiva(clave); setAviso(''); }}
                    onAgregar={alAgregar}
                    onDuplicar={alDuplicar}
                    onCopiar={alCopiar}
                    onPegar={alPegar}
                    onImportar={alImportar}
                    hayContenido={hayContenido}
                    onEliminar={alEliminar}
                    onRenombrar={(clave, nombre) => cambiarCapas(renombrarCapa(capas, clave, nombre))}
                    onReordenar={(clave, destino) => cambiarCapas(reordenarCapas(capas, clave, destino))}
                    onVisibilidad={(clave) => cambiarCapas(cambiarVisibilidad(capas, clave))}
                    onBloqueo={(clave) => cambiarCapas(bloquearCapa(capas, clave))}
                    ancho={ancho}
                    alto={alto}
                    dibujarMiniatura={dibujarMiniatura}
                    versionPixeles={versionPixeles}
                />
                {capaActiva && capaActiva.texto && (
                    <section className="texto-de-capa" aria-label="Texto de la capa">
                        <h2>Texto</h2>
                        <PanelTexto prefijo="texto-capa" texto={capaActiva.texto} onCambiar={cambiarTexto}>
                            <button type="button" onClick={convertirEnImagen} title="Para dibujar sobre el texto">Convertir en imagen</button>
                        </PanelTexto>
                    </section>
                )}
            </PanelFlotante>

            {/* Botones para volver a abrir los paneles cerrados, cada uno en la esquina de su panel */}
            {[['proyecto', 'Proyecto'], ['herramientas', 'Herramientas'], ['capas', 'Capas']].map(([id, nombre]) => (
                !paneles[id] && (
                    <button key={id} type="button" className={`panel-reabrir reabrir-${id}`} onClick={() => alternarPanel(id)}>
                        {nombre}
                    </button>
                )
            ))}

            {/* Aplicar y cancelar se ven siempre: si el panel Proyecto está cerrado, quedan junto a su botón */}
            {!paneles.proyecto && <div className="acciones-sueltas">{accionesFrame}</div>}

            <div className="editor-mensajes">
                {confirmandoSalida && (
                    <p role="alertdialog" aria-label="Descartar cambios">
                        Hay cambios sin aplicar. ¿Descartarlos?
                        <button type="button" onClick={onCancelar}>Sí, descartar</button>
                        <button type="button" onClick={() => setConfirmandoSalida(false)}>Seguir editando</button>
                    </p>
                )}
                {aviso && <p role="alert">{aviso}</p>}
            </div>
        </section>
    );
}

export default EditorImagen;