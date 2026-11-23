import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { obtenerAtajos } from '../services/servicioAPI';
import { aplicarEdicion } from '../utils/operacionesFrames';
import { combinarAtajos } from '../utils/atajosArte';
import { MAX_FRAMES, MAX_MB, LADO_MAXIMO } from '../config/limites';
import useProyectoFrames, { TIPOS_IMPORTABLES } from '../hooks/useProyectoFrames';
import useSeleccionFrames from '../hooks/useSeleccionFrames';
import { useReproduccion } from '../components/VistaPrevia';
import EtapaFrames from '../components/EtapaFrames';
import EtapaImagen from '../components/EtapaImagen';
import EtapaVideo from '../components/EtapaVideo';

// Etapas del proyecto, de lo general a lo específico. "requiere" dice qué hace falta para abrirla
const ETAPAS = [
    { id: 'importar', nombre: 'Importar' },
    { id: 'frames', nombre: 'Frames' },
    { id: 'video', nombre: 'Video', requiere: 'lienzo' },
    { id: 'imagen', nombre: 'Imagen', requiere: 'lienzo' },
    { id: 'exportar', nombre: 'Exportar', requiere: 'frames' },
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
    const [modoImportar, setModoImportar] = useState('agregar');
    const editorConCambios = useRef(false);
    const [atajosGuardados, setAtajosGuardados] = useState({});
    const atajos = useMemo(() => combinarAtajos(atajosGuardados), [atajosGuardados]);

    const frameEditando = claveEditando === null ? null : frames.find((f) => f.clave === claveEditando) || null;
    const puedeEditar = Boolean(proyecto && proyecto.ancho && proyecto.alto);
    // Proporción de las miniaturas y la vista previa: la del lienzo del proyecto
    const proporcion = proyecto?.ancho ? `${proyecto.ancho} / ${proyecto.alto}` : '';

    function disponible(etapa) {
        if (etapa.requiere === 'lienzo') return puedeEditar && frames.length > 0;
        if (etapa.requiere === 'frames') return frames.length > 0;
        return true;
    }

    // Sin etapa en la dirección (o una que no existe): Frames si hay frames, Importar si no
    const etapa = ETAPAS.find((e) => e.id === etapaRuta);
    useEffect(() => {
        if (datos.cargando || !proyecto) return;
        if (!etapa || !disponible(etapa)) {
            const inicial = datos.guardado.length > 0 ? 'frames' : 'importar';
            navigate(`/proyectos/${id}/${inicial}`, { replace: true });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [etapa, datos.cargando, proyecto, frames.length, puedeEditar]);

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

    function volver(evento) {
        if (datos.sinGuardar && !window.confirm('Tienes cambios sin guardar. ¿Salir sin guardar?')) {
            evento.preventDefault();
        }
    }

    function elegirArchivo(evento) {
        const archivo = evento.target.files[0];
        evento.target.value = ''; // permite elegir el mismo archivo otra vez
        if (!archivo) return;
        // Sin frames no hay nada que conservar: el archivo fija el lienzo del proyecto
        const modo = frames.length > 0 ? modoImportar : 'reemplazar';
        datos.importarArchivo(archivo, modo).then((importado) => {
            if (importado) navigate(`/proyectos/${id}/frames`);
        });
    }

    function contenido() {
        if (datos.cargando) return <p>Cargando proyecto...</p>;
        if (!proyecto) return <p>No se pudo cargar el proyecto.</p>;

        switch (etapa?.id) {
                        case 'importar':
                return (
                    <section aria-labelledby="titulo-subir" className="etapa-importar">
                        <h2 id="titulo-subir">Importar archivo</h2>
                        {frames.length > 0 && (
                            <fieldset disabled={datos.ocupado}>
                                <legend>¿Qué hacer con los {frames.length} frames actuales?</legend>
                                <label>
                                    <input
                                        type="radio"
                                        name="modo-importar"
                                        value="agregar"
                                        checked={modoImportar === 'agregar'}
                                        onChange={() => setModoImportar('agregar')}
                                    />
                                    Agregar al final (se ajusta al lienzo de {proyecto.ancho} × {proyecto.alto} px)
                                </label>
                                <label>
                                    <input
                                        type="radio"
                                        name="modo-importar"
                                        value="reemplazar"
                                        checked={modoImportar === 'reemplazar'}
                                        onChange={() => setModoImportar('reemplazar')}
                                    />
                                    Reemplazar todo (borra los frames y keyframes actuales)
                                </label>
                            </fieldset>
                        )}
                        <label htmlFor="archivo-importar">Elige un GIF o una imagen (PNG, JPG o WEBP)</label>
                        <input
                            id="archivo-importar"
                            type="file"
                            accept={TIPOS_IMPORTABLES.join(',')}
                            onChange={elegirArchivo}
                            disabled={datos.ocupado}
                        />
                        <p>
                            Máximo {MAX_MB} MB y {MAX_FRAMES} frames en total. Si el proyecto no tiene frames, el archivo
                            fija el tamaño del lienzo (hasta {LADO_MAXIMO} × {LADO_MAXIMO} px; si es más grande, se reduce).
                        </p>
                        {datos.subiendo && <p role="status">Procesando el archivo...</p>}
                    </section>
                );
            case 'frames':
                return (
                    <EtapaFrames
                        datos={datos}
                        seleccion={seleccion}
                        reproduccion={reproduccion}
                        puedeEditar={puedeEditar}
                        proporcion={proporcion}
                        onEditar={editar}
                    />
                );
            case 'video':
                return (
                    <EtapaVideo
                        datos={datos}
                        reproduccion={reproduccion}
                        proporcion={proporcion}
                        onEditar={editar}
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
                        {['gif', 'mp4'].map((formato) => (
                            <button
                                key={formato}
                                type="button"
                                className="boton-principal"
                                onClick={() => datos.exportar(formato)}
                                disabled={frames.length === 0 || datos.ocupado}
                            >
                                {datos.exportando === formato
                                    ? `Generando ${formato.toUpperCase()}...`
                                    : `Exportar ${formato.toUpperCase()}`}
                            </button>
                        ))}
                        {datos.sinGuardar && <p>Se exporta lo guardado; al exportar se te pedirá guardar los cambios.</p>}
                    </section>
                );
            default:
                return null;
        }
    }

    return (
        <main className="pagina-editor">
            <nav className="barra-etapas" aria-label="Etapas del proyecto">
                {ETAPAS.map((e) => (
                    <button
                        key={e.id}
                        type="button"
                        aria-current={e.id === etapa?.id ? 'page' : undefined}
                        disabled={!proyecto || !disponible(e)}
                        onClick={() => irAEtapa(e.id)}
                    >
                        {e.nombre}
                    </button>
                ))}
            </nav>
            <header>
                <Link to="/proyectos" onClick={volver}>Volver a mis proyectos</Link>
                <h1>{proyecto ? proyecto.nombre : 'Proyecto'}</h1>
                {proyecto?.descripcion && <p>{proyecto.descripcion}</p>}
            </header>

            {datos.error && <p role="alert">{datos.error}</p>}
            {datos.mensaje && <p role="status">{datos.mensaje}</p>}

            {contenido()}
        </main>
    );
}

export default PaginaProyecto;