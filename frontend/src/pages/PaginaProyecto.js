import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Clapperboard, Download, Film, Paintbrush } from 'lucide-react';
import { obtenerAtajos } from '../services/servicioAPI';
import { aplicarEdicion } from '../utils/operacionesFrames';
import { combinarAtajos } from '../utils/atajosArte';
import useProyectoFrames from '../hooks/useProyectoFrames';
import useSeleccionFrames from '../hooks/useSeleccionFrames';
import useArchivos from '../hooks/useArchivos';
import useReproduccion from '../hooks/useReproduccion';
import BarraProyecto from '../components/BarraProyecto';
import MenuPerfil from '../components/MenuPerfil';
import BotonIcono from '../components/BotonIcono';
import PanelArchivos from '../components/PanelArchivos';
import EtapaFrames from '../components/EtapaFrames';
import EtapaImagen from '../components/EtapaImagen';
import EtapaVideo from '../components/EtapaVideo';

// Etapas del proyecto, de lo general a lo específico. Todas menos Frames necesitan frames (y con ellos, el lienzo).
// Subir archivos no es una etapa: es la ventana Archivos, que se abre desde cualquier parte
const ETAPAS = [
    { id: 'frames', nombre: 'Frames', icono: Film },
    { id: 'video', nombre: 'Video', icono: Clapperboard, conFrames: true },
    { id: 'imagen', nombre: 'Imagen', icono: Paintbrush, conFrames: true },
    { id: 'exportar', nombre: 'Exportar', icono: Download, conFrames: true },
];

const MENSAJE_EDITOR = 'Hay cambios sin aplicar en el editor de imagen. ¿Descartarlos?';

// Pantalla de un proyecto (/proyectos/:id/:etapa). El proyecto se carga una sola vez y todas las etapas lo
// comparten: los frames, el historial, el guardado, la selección y la reproducción viven aquí.
function PaginaProyecto() {
    const { id, etapa: etapaRuta } = useParams();
    const navigate = useNavigate();
    const datos = useProyectoFrames(id);
    const { proyecto, frames, aplicar } = datos;
    const seleccion = useSeleccionFrames(frames);
    const reproduccion = useReproduccion(frames);

    const [claveEditando, setClaveEditando] = useState(null);
    const archivos = useArchivos(id);
    const [archivosAbierto, setArchivosAbierto] = useState(false);
    const editorConCambios = useRef(false);
    const [atajosGuardados, setAtajosGuardados] = useState({});
    const atajos = useMemo(() => combinarAtajos(atajosGuardados), [atajosGuardados]);

    const frameEditando = claveEditando === null ? null : frames.find((f) => f.clave === claveEditando) || null;
    const puedeEditar = Boolean(proyecto && proyecto.ancho && proyecto.alto);
    // Proporción de las miniaturas y la vista previa: la del lienzo del proyecto
    const proporcion = proyecto?.ancho ? `${proyecto.ancho} / ${proyecto.alto}` : '';

    const disponible = (etapa) => !etapa.conFrames || (puedeEditar && frames.length > 0);

    // Sin etapa en la dirección (o una que no existe, como la antigua "importar"): Frames
    const etapa = ETAPAS.find((e) => e.id === etapaRuta);
    useEffect(() => {
        if (datos.cargando || !proyecto) return;
        if (!etapa || !disponible(etapa)) navigate(`/proyectos/${id}/frames`, { replace: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [etapa, datos.cargando, proyecto, frames.length, puedeEditar]);

    // Un proyecto sin frames abre con Archivos a la vista: es lo primero que hay que hacer
    useEffect(() => {
        if (!datos.cargando && proyecto && datos.guardado.length === 0) setArchivosAbierto(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [datos.cargando, proyecto]);

    // Cada vez que la lista viene del servidor (cargar, guardar, importar) se parte sin selección y en el frame 1
    const { limpiar: limpiarSeleccion } = seleccion;
    const { irA } = reproduccion;
    useEffect(() => {
        limpiarSeleccion();
        irA(0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [datos.reinicios]);

    // Atajos personalizados del usuario (los usa el editor de imagen)
    useEffect(() => {
        let vigente = true;
        (async () => {
            try {
                const guardados = await obtenerAtajos();
                if (vigente && guardados) setAtajosGuardados(guardados);
            } catch {
                // sin atajos propios: se usan los de fábrica
            }
        })();
        return () => { vigente = false; };
    }, []);

    // Cambiar de etapa. Si el editor tiene cambios sin aplicar, primero pregunta
    function irAEtapa(destino) {
        if (destino === etapa?.id) return;
        if (etapa?.id === 'imagen' && editorConCambios.current && !window.confirm(MENSAJE_EDITOR)) return;
        editorConCambios.current = false;
        datos.limpiarMensajes();
        navigate(`/proyectos/${id}/${destino}`);
    }

    function editar(clave) {
        if (datos.ocupado || !puedeEditar) return;
        irA(reproduccion.indice); // detiene la reproducción
        setClaveEditando(clave);
        irAEtapa('imagen');
    }

    function cerrarEditor() {
        editorConCambios.current = false;
        setClaveEditando(null);
        irAEtapa('frames');
    }

    // El editor entregó sus cambios: el frame queda con sus capas y su imagen nueva (se puede deshacer)
    function aplicarResultado(resultado) {
        const clave = claveEditando;
        const imagen = URL.createObjectURL(resultado.imagen);
        aplicar((f) => aplicarEdicion(f, clave, { capas: resultado.capas, imagen }));
    }

    function terminarEdicion(resultado) {
        aplicarResultado(resultado);
        cerrarEditor();
    }

    // El editor pasó al frame anterior o siguiente: aplica los cambios que traía (si hay) y abre el otro frame
    function cambiarFrameEditando(paso, resultado) {
        const destino = frames[frames.findIndex((f) => f.clave === claveEditando) + paso];
        if (!destino) return;
        if (resultado) aplicarResultado(resultado);
        editorConCambios.current = false;
        setClaveEditando(destino.clave);
    }

    // Antes de salir del proyecto (volver, preferencias o cerrar sesión): los cambios sin guardar se pierden
    function puedeSalir() {
        return !datos.sinGuardar || window.confirm('Tienes cambios sin guardar. ¿Salir sin guardar?');
    }

    function volver(evento) {
        if (!puedeSalir()) evento.preventDefault();
    }

    // Dónde quedan los frames de un archivo según cómo se use. En Frames se puede agregar al final, insertar
    // después de la selección o reemplazar todo
    const enFrames = etapa?.id === 'frames';
    const sinFrames = frames.length === 0 && datos.guardado.length === 0;
    let usosArchivos = [];
    if (enFrames) usosArchivos = sinFrames ? ['final'] : ['final', ...(seleccion.claves.length > 0 ? ['seleccion'] : []), 'reemplazar'];
    // En Video, un archivo se agrega como capa en todos los frames (o en los marcados)
    if (etapa?.id === 'video' && !sinFrames) usosArchivos = ['capa'];
    const controlVideo = useRef(null);

    function posicionDespuesDeSeleccion() {
        const ultima = seleccion.claves[seleccion.claves.length - 1];
        return frames.findIndex((f) => f.clave === ultima) + 1;
    }

    // Usa un archivo en el proyecto. Sin frames no hay nada que conservar: el archivo fija el lienzo del proyecto
    function usarArchivo(archivo, uso, posicion = null) {
        const file = archivos.aFile(archivo);
        if (uso === 'capa') {
            if (controlVideo.current) controlVideo.current.agregarImagen(file);
            return;
        }
        if (sinFrames || uso === 'reemplazar') {
            datos.importarArchivo(file, 'reemplazar');
        } else if (uso === 'seleccion') {
            datos.importarArchivo(file, 'agregar', posicionDespuesDeSeleccion());
        } else {
            datos.importarArchivo(file, 'agregar', posicion);
        }
    }

    // Un archivo soltado en un hueco de la lista de frames
    function soltarArchivo(idArchivo, posicion) {
        const archivo = archivos.porId(idArchivo);
        if (archivo) usarArchivo(archivo, 'final', posicion);
    }

    function contenido() {
        if (datos.cargando) return <p role="status" aria-busy="true">Cargando proyecto...</p>;
        if (!proyecto) return <p>No se pudo cargar el proyecto.</p>;

        switch (etapa?.id) {
            case 'frames':
                return (
                    <EtapaFrames
                        datos={datos}
                        seleccion={seleccion}
                        reproduccion={reproduccion}
                        puedeEditar={puedeEditar}
                        proporcion={proporcion}
                        onEditar={editar}
                        onSoltarArchivo={soltarArchivo}
                        onAbrirArchivos={() => setArchivosAbierto(true)}
                    />
                );
            case 'video':
                return (
                    <EtapaVideo
                        datos={datos}
                        reproduccion={reproduccion}
                        proporcion={proporcion}
                        onEditar={editar}
                        seleccion={seleccion}
                        control={controlVideo}
                        fileDeArchivo={(idArchivo) => {
                            const archivo = archivos.porId(idArchivo);
                            return archivo ? archivos.aFile(archivo) : null;
                        }}
                    />
                );
            case 'imagen':
                return (
                    <EtapaImagen
                        proyecto={proyecto}
                        frames={frames}
                        atajos={atajos}
                        frame={frameEditando}
                        proporcion={proporcion}
                        onElegir={setClaveEditando}
                        onTerminar={terminarEdicion}
                        onCancelar={cerrarEditor}
                        onCambiarFrame={cambiarFrameEditando}
                        onCambiosSinAplicar={(hay) => { editorConCambios.current = hay; }}
                    />
                );
            case 'exportar':
                return (
                    <section aria-labelledby="titulo-exportar">
                        <h2 id="titulo-exportar">Exportar</h2>
                        <div className="botones-exportar">
                            {['gif', 'mp4'].map((formato) => (
                                <BotonIcono
                                    key={formato}
                                    icono={Download}
                                    texto={datos.exportando === formato
                                        ? `Generando ${formato.toUpperCase()}...`
                                        : `Exportar como ${formato.toUpperCase()}`}
                                    insignia={formato.toUpperCase()}
                                    principal
                                    className="boton-grande"
                                    onClick={() => datos.exportar(formato)}
                                    disabled={frames.length === 0 || datos.ocupado}
                                    aria-busy={datos.exportando === formato}
                                />
                            ))}
                        </div>
                    </section>
                );
            default:
                return null;
        }
    }

    return (
        <main className={`pagina-editor${archivosAbierto ? ' con-archivos' : ''}`}>
            <BarraProyecto
                etapas={ETAPAS.map((e) => ({
                    ...e,
                    disponible: Boolean(proyecto) && disponible(e),
                    actual: e.id === etapa?.id,
                }))}
                onEtapa={irAEtapa}
                archivosAbierto={archivosAbierto}
                cantidadArchivos={archivos.lista.length}
                onArchivos={() => setArchivosAbierto((abierto) => !abierto)}
                perfil={<MenuPerfil posicion="izquierda" puedeSalir={puedeSalir} />}
            />
            {archivosAbierto && (
                <PanelArchivos
                    archivos={archivos}
                    usos={usosArchivos}
                    ocupado={datos.ocupado}
                    onUsar={(archivo, uso) => usarArchivo(archivo, uso)}
                    onCerrar={() => setArchivosAbierto(false)}
                />
            )}
            <header>
                <Link
                    to="/proyectos"
                    onClick={volver}
                    className="boton-icono ayuda-abajo"
                    aria-label="Volver a mis proyectos"
                    data-ayuda="Volver a mis proyectos"
                >
                    <ArrowLeft aria-hidden="true" size={18} />
                </Link>
                <h1>{proyecto ? proyecto.nombre : 'Proyecto'}</h1>
                {proyecto?.ancho && <span className="tamano-proyecto">{proyecto.ancho} × {proyecto.alto} px</span>}
            </header>

            {datos.subiendo && <p role="status" aria-busy="true">Procesando...</p>}
            {datos.error && <p role="alert">{datos.error}</p>}
            {datos.mensaje && <p role="status">{datos.mensaje}</p>}

            {contenido()}
        </main>
    );
}

export default PaginaProyecto;