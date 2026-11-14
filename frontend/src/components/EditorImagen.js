import { useEffect, useRef, useState } from 'react';
import Lienzo from './Lienzo';
import BarraHerramientas from './BarraHerramientas';
import PanelCapas from './PanelCapas';
import { obtenerCapas, obtenerMensajeError } from '../services/servicioAPI';
import { combinarAtajos, accionDeEvento } from '../utils/atajosArte';
import { limitarTamano } from '../utils/herramientas';
import { checkContenido, copiarCapas, pegarCapas } from '../utils/portapapelesCapas';
import {
    desdeServidor, crearFondo, agregarCapa, eliminarCapa, duplicarCapa, renombrarCapa, reordenarCapas,
    cambiarVisibilidad, bloquearCapa, marcarModificada, agregarCapaConImagen,
} from '../utils/capas';
import { motivoRechazo, nombreDesdeArchivo, imagenACapaPNG } from '../utils/importarImagen';

const PASO_TAMANO = 5;

// Las capas con las que se abre el editor, según el fotograma:
//  - ya editado en esta sesión: las capas que dejó el editor la última vez (frame.capas)
//  - guardado en el servidor: se piden al abrir (RF: las capas se cargan solo al editar)
//  - nuevo, en blanco o importado: una sola capa "Fondo" (con la imagen del fotograma, si la tiene)
async function cargarCapas(proyectoId, frame) {
    if (frame.capas) return frame.capas;
    if (frame.origen_id !== undefined) return desdeServidor(await obtenerCapas(proyectoId, frame.origen_id));
    const fondo = crearFondo();
    return [frame.vacio || !frame.imagen ? fondo : { ...fondo, imagen: frame.imagen }];
}

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
function EditorImagen({ proyectoId, ancho, alto, frame, atajos = combinarAtajos({}), onTerminar, onCancelar }) {
    const lienzo = useRef(null);
    const [capas, setCapas] = useState(null); // null mientras cargan
    const [errorCarga, setErrorCarga] = useState('');
    const [intento, setIntento] = useState(0);
    const [claveActiva, setClaveActiva] = useState(null);
    const [herramienta, setHerramienta] = useState('pincel');
    const [color, setColor] = useState('#000000');
    const [tamano, setTamano] = useState(10);
    const [aviso, setAviso] = useState('');
    const [seleccion, setSeleccion] = useState(null);
    const [historial, setHistorial] = useState({ puedeDeshacer: false, puedeRehacer: false });
    const [sucio, setSucio] = useState(false); // hay cambios sin aplicar
    const [confirmandoSalida, setConfirmandoSalida] = useState(false);
    const [aplicando, setAplicando] = useState(false);
    const [hayContenido, setHayContenido] = useState(checkContenido());
    const [zoom, setZoom] = useState(1);

    // Carga las capas al abrir (y al reintentar si falló)
    useEffect(() => {
        let vigente = true;
        setErrorCarga('');
        cargarCapas(proyectoId, frame)
            .then((cargadas) => {
                if (!vigente) return;
                setCapas(cargadas);
                setClaveActiva(cargadas[cargadas.length - 1].clave);
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
        const blob = await lienzo.current.exportarCapa(capa.clave);
        if (copiarCapas([{ nombre: capa.nombre, visible: capa.visible, bloqueada: capa.bloqueada, blob }])) {
            setHayContenido(true);
            setAviso('');
        }
    } catch (error) {
        setAviso('No se pudo copiar la capa.');
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
    async function aplicar() {
        if (!sucio) {
            onCancelar();
            return;
        }
        setAplicando(true);
        try {
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
            onTerminar({ capas: finales, imagen });
        } catch (error) {
            setAviso('No se pudieron preparar los cambios. Inténtalo de nuevo.');
            setAplicando(false);
        }
    }

    function pedirCancelar() {
        if (sucio) setConfirmandoSalida(true);
        else onCancelar();
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
            <header className="editor-encabezado">
                <h2>Editar frame</h2>
                <div>
                    <button type="button" onClick={aplicar} disabled={aplicando}>
                        {aplicando ? 'Aplicando...' : 'Aplicar y cerrar'}
                    </button>
                    <button type="button" onClick={pedirCancelar} disabled={aplicando}>Cancelar</button>
                </div>
            </header>

            {confirmandoSalida && (
                <p role="alertdialog" aria-label="Descartar cambios">
                    Hay cambios sin aplicar. ¿Descartarlos?
                    <button type="button" onClick={onCancelar}>Sí, descartar</button>
                    <button type="button" onClick={() => setConfirmandoSalida(false)}>Seguir editando</button>
                </p>
            )}

            <div className="editor-aviso">{aviso && <p role="alert">{aviso}</p>}</div>

            <div className="editor-cuerpo">
                {/* Espacio reservado para las pestañas del Incremento 3 (todas las partes del proceso, en vertical) */}
                <aside className="editor-pestanas" aria-label="Pestañas del proceso" />

                <div className="editor-centro">
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
                        onTransformar={(parametros) => lienzo.current.transformar(parametros)}
                        zoom={zoom}
                        onAcercar={() => lienzo.current.acercar()}
                        onAlejar={() => lienzo.current.alejar()}
                        onZoomReal={() => lienzo.current.zoomReal()}
                        onAjustar={() => lienzo.current.ajustar()}
                    />
                    <Lienzo
                        ref={lienzo}
                        ancho={ancho}
                        alto={alto}
                        capas={capas}
                        claveActiva={claveActiva}
                        herramienta={herramienta}
                        color={color}
                        tamano={tamano}
                        onAviso={setAviso}
                        onHistorialCambia={setHistorial}
                        onSeleccionCambia={setSeleccion}
                        onCapaModificada={alModificarCapa}
                        onZoomCambia={setZoom}
                    />
                </div>
                <PanelCapas
                    capas={capas}
                    claveActiva={claveActiva}
                    onSeleccionar={(clave) => { setClaveActiva(clave); setAviso(''); }}
                    onAgregar={alAgregar}
                    onDuplicar={alDuplicar}
                    oncopiar={alCopiar}
                    onPegar={alPegar}
                    onImportar={alImportar}
                    hayContenido={hayContenido}
                    onEliminar={alEliminar}
                    onRenombrar={(clave, nombre) => cambiarCapas(renombrarCapa(capas, clave, nombre))}
                    onReordenar={(clave, destino) => cambiarCapas(reordenarCapas(capas, clave, destino))}
                    onVisibilidad={(clave) => cambiarCapas(cambiarVisibilidad(capas, clave))}
                    onBloqueo={(clave) => cambiarCapas(bloquearCapa(capas, clave))}
                />
            </div>
        </section>
    );
}

export default EditorImagen;