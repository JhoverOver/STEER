import {useCallback, useEffect, useState} from 'react';
import {Link, useNavigate, useParams} from 'react-router-dom';
import {
    obtenerProyecto,
    obtenerFrames,
    subirGIF as subirGIFAPI,
    exportar as exportarAPI,
    obtenerMensajeError,
} from '../services/servicioAPI'

const TAMANO_MAXIMO_MB = 10;

function descargarBlob(blob, nombreArchivo) {
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url; 
    enlace.download = nombreArchivo;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function VisualizacionFrames() {
    const {id} = useParams();
    const navigate = useNavigate();

    const [proyecto, setProyecto] = useState(null);
    const [frames, setFrames] = useState([]);
    const [indice, setIndice] = useState(0);
    const [reproduciendo, setReproduciendo] = useState(false);
    const [cargando, setCargando] = useState(true);
    const [subiendo, setSubiendo] = useState(false);
    const [exportando, setExportando] = useState('');
    const [error, setError] = useState('');

    const manejarErrorAPI = useCallback(
        (err) => {
            if (err.response?.status === 401) {
                navigate('/login');
                return;
            }
            setError(obtenerMensajeError(err));
        },
        [navigate]
    );

    const cargarFrames = useCallback( async () => {
        try {
            const [datosProyecto, listaFrames] = await Promise.all([obtenerProyecto(id), obtenerFrames(id)]);
            setProyecto(datosProyecto);
            setFrames(listaFrames);
            setIndice(0);
        } catch (err) {
        manejarErrorAPI(err);
        } finally {
            setCargando(false);
        }
    }, [id, manejarErrorAPI]);

    useEffect(() => {
        cargarFrames();
    }, [cargarFrames]);


    useEffect(() => {
        if (!reproduciendo || frames.length === 0) return;
        const espera = frames[indice]?.duracion || 100;
        const timer = setTimeout(() => {
            setIndice((actual) => (actual +1) % frames.length);
        }, espera);
        return () => clearTimeout(timer);
    }, [reproduciendo, indice, frames]);

    function alternarReproduccion() {
        setReproduciendo((actual) => !actual);
    }

    function irAFrame(nuevoIndice) {
        setReproduciendo(false);
        setIndice(nuevoIndice);
    }


    async function subirGIF(evento) {
        const archivo =evento.target.files[0];
        evento.target.value = '';
        if (!archivo) return;

        setError('');
        if (archivo.type !== 'image/gif') {
            setError('Solo se permiten archivos GIF.');
            return;
        }
        if (archivo.size > TAMANO_MAXIMO_MB *1024 *1024) {
            return;
        }
        if (frames.length > 0 && !window.confirm('Subir un GIF reemplazará los frames actuales de este proyecto. ¿Estas seguro?')) {
            return;
        }

        setSubiendo(true);
        setReproduciendo(false);
        try {
            const nuevos = await subirGIFAPI(id,archivo);
            setFrames(nuevos);
            setIndice(0);
        }   catch (err) {
            manejarErrorAPI(err);
        }   finally {
            setSubiendo(false);
        }
    }

    async function exportar(formato) {
        setError('');
        setExportando(formato);
        try {
            const blob = await exportarAPI(id,formato);
            descargarBlob(blob, `proyecto-${id}.${formato}`);
        } catch (err) {
            manejarErrorAPI(err);
        } finally {
            setExportando('');
        }
    }

    const frameActual = frames[indice];

    return (
        <main>
            <header>
                <Link to="/proyectos">Volver</Link>
                <h1>{proyecto ? proyecto.nombre : 'Proyecto'}</h1>
                {proyecto?.descripcion && <p>{proyecto.descripcion}</p>}
            </header>

            {error && <p role="alert">{error}</p>}

            {cargando ? (
                <p>Cargando proyecto...</p>
            ) : !proyecto ? (
                <p>No se pudo cargar el proeycto.</p>
            ) : (
                <>
                <section aria-labelledby="titulo-subir">
                    <h2 id="titulo-subir">Importar GIF</h2>
                    <label htmlFor="archivo-gif">Elige un archivo GIF</label>
                    <input id= "archivo-gif" type="file" accept="image/gif" onChange={subirGIF} disabled={subiendo} />
                    <p>Máximo {TAMANO_MAXIMO_MB} MB y 100 frames. Reemplaza los frames actuales del proyecto.</p>
                    {subiendo && <p role="status">Procesando el GIF...</p>}
                </section>


                <section aria-labelledby="titulo-secuencia">
                    <h2 id="titulo-secuendia">Animación</h2>
                    {frames.length === 0 ? (
                        <p>Este proyecto todavía no tiene frames. Importa un GIF para empezar.</p>
                    ) : (
                        <>
                        <img src={frameActual.imagen} alt={`{Frame$indice +1} de ${frames.length}`} />
                        <p>Frame {indice +1} de {frames.length} - {frameActual.duracion} ms</p>

                        <div>
                            <button type="button" onClick={() => irAFrame((indice - 1+ frames.length) % frames.length)}>Anterior</button>
                            <button type="button" onClick={alternarReproduccion}>{reproduciendo ? 'Pausar' : 'Reproducir'}</button>
                            <button type="button" onClick={() => irAFrame((indice + 1) % frames.length)}>Siguiente</button>
                        </div>

                        <ol aria-label="Frames del proyecto">
                            {frames.map((frame, i) => (
                                <li key={frame.id}>
                                    <button
                                    type="button"
                                    onClick={() => irAFrame(i)}
                                    aria-label={`Ir al frame ${i + 1}`}
                                    aria-current={i === indice ? 'true' : undefined}
                                    >
                                        <img src={frame.imagen} alt="" width="64" />
                                    </button>
                                </li>
                            ))}
                        </ol>
                        </>
                    )}
                </section>

                <section aria-labelledby="titulo-exportar">
                    <h2 id="titulo-exportar">Exportar</h2>
                    <button type="button" onClick={() => exportar('gif')} disabled={frames.length === 0 || Boolean(exportando)}>
                        {exportando === 'gif' ? 'Generando GIF...' : 'Exportar GIF'}
                    </button>
                    <button type="button" onClick={() => exportar('mp4')} disabled={frames.length === 0 || Boolean(exportando)}>
                        {exportando === 'mp4' ? 'Generando MP4...' : 'Exportar MP4'}
                    </button>
                </section>
                </>
            )}
        </main>
    )
}

export default VisualizacionFrames;