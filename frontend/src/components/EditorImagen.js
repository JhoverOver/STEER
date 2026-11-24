import { useEffect, useMemo, useRef, useState } from 'react';
import Lienzo from './Lienzo';
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
import { motivoRechazo, nombreDesdeArchivo, imagenACapaPNG } from '../utils/importarImagen';
import PanelFlotante from './PanelFlotante';
import {
    MAX_FRAMES_CEBOLLA, OPACIDAD_MINIMA_CEBOLLA, OPACIDAD_MAXIMA_CEBOLLA,
    fantasmasCebolla, leerAjustesCebolla, guardarAjustesCebolla,
} from '../utils/papelCebolla';

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
    const motivo = motivoRechazo(archivo);
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

    function alModificarCapa(clave) {
        setAviso('');
        setSucio(true);
        setCapas((actuales) => marcarModificada(actuales, clave));
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

    // Atajos de teclado: accionDeEvento dice qué acción es; aquí se ejecuta
    const acciones = useRef({});
    acciones.current = {
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
    useEffect(() => {
        if (!capas) return undefined;
        function alTeclear(evento) {
            const accion = accionDeEvento(evento, atajos);
            if (!accion) return;
            evento.preventDefault();
            acciones.current[accion]();
        }
        window.addEventListener('keydown', alTeclear);
        return () => window.removeEventListener('keydown', alTeclear);
    }, [capas === null, atajos]); // eslint-disable-line react-hooks/exhaustive-deps

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
        return <section className="editor-imagen"><p role="status">Cargando capas...</p></section>;
    }

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
                onZoomCambia={setZoom}
            />

            <PanelFlotante id="proyecto" nombre="Proyecto" abierto={paneles.proyecto} onCerrar={() => alternarPanel('proyecto')}>
                {nombreProyecto && <h1 className="editor-proyecto">{nombreProyecto}</h1>}
                <h2>Editar frame</h2>
                                <div className="cambiar-frame">
                    {onCambiarFrame && (
                        <button
                            type="button"
                            onClick={() => irAFrame(-1)}
                            disabled={aplicando || !hayAnterior}
                            aria-label="Frame anterior"
                            title={`Frame anterior (${formatearCombinacion(atajos.frame_anterior)})`}
                        >
                            ◀
                        </button>
                    )}
                    {posicion && <p>{posicion}</p>}
                    {onCambiarFrame && (
                        <button
                            type="button"
                            onClick={() => irAFrame(1)}
                            disabled={aplicando || !haySiguiente}
                            aria-label="Frame siguiente"
                            title={`Frame siguiente (${formatearCombinacion(atajos.frame_siguiente)})`}
                        >
                            ▶
                        </button>
                    )}
                </div>
                {onCambiarFrame && sucio && <p>Al cambiar de frame se aplican los cambios de este.</p>}
                
                <fieldset className="papel-cebolla">
                    <legend>Papel cebolla</legend>
                    <label>
                        <input
                            type="checkbox"
                            checked={cebolla.activa}
                            onChange={(evento) => ajustarCebolla({ activa: evento.target.checked })}
                        />
                        Ver frames vecinos{atajos.papel_cebolla ? ` (${formatearCombinacion(atajos.papel_cebolla)})` : ''}
                    </label>
                    <label>
                        Frames a cada lado
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
                    {cebolla.activa && (
                        <p>
                            {hayVecinos ? 'Rojo: frames anteriores. Azul: siguientes.' : 'Este frame no tiene frames vecinos con imagen.'}
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
                />
            </PanelFlotante>

            {/* Botones para volver a abrir los paneles cerrados, cada uno en la esquina de su panel */}
            {[['proyecto', 'Proyecto'], ['herramientas', 'Herramientas'], ['capas', 'Capas']].map(([id, nombre]) => (
                !paneles[id] && (
                    <button key={id} type="button" className={`panel-reabrir reabrir-${id}`} onClick={() => alternarPanel(id)}>
                        {nombre}
                    </button>
                )
            ))}

            {/* Aplicar y cancelar se ven siempre, aunque se cierren los paneles */}
            <div className="editor-acciones">
                <button type="button" onClick={aplicar} disabled={aplicando}>
                    {aplicando ? 'Aplicando...' : 'Aplicar y cerrar'}
                </button>
                <button type="button" onClick={pedirCancelar} disabled={aplicando}>Cancelar</button>
            </div>

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