import  { useCallback, useEffect, useState } from 'react';
import {useNavigate} from 'react-router-dom';
import {
    obtenerProyectos,
    crearProyecto as crearProyectoAPI,
    eliminarProyecto as eliminarProyectoAPI,
    borrarToken,
    obtenerMensajeError,
} from '../services/servicioAPI';
import CampoFormulario from '../components/CampoFormulario';
import {validarObligatorio,enfocarPrimerError } from '../utils/validaciones';


function PanelProyectos() {
    const [proyectos, setProyectos] = useState([]);
    const [nombre, setNombre] = useState('');
    const [descripcion, setDescripcion] = useState('');
    const [error, setError] = useState('');
    const [cargando, setCargando] = useState(true);
    const [creando, setCreando] = useState(false);
    const [errorNombre, setErrorNombre] = useState('');

    const navigate = useNavigate();

    const manejarErrorAPI= useCallback(
        (err) => {
            if (err.response?.status === 401) {
                navigate ('/login');
                return;
            }
            setError(obtenerMensajeError(err));
        },
        [navigate]
    );

    const cargarProyectos = useCallback(async () => {
        try {
            const lista = await obtenerProyectos();
            setProyectos(lista);
        } catch (err) {
            manejarErrorAPI(err);
        } finally {
            setCargando(false);
        }
    }, [manejarErrorAPI]);

    useEffect(() => {
        cargarProyectos();
    }, [cargarProyectos]);

    async function crearProyecto(evento) {
        evento.preventDefault();
        setError('');
        const problema = validarObligatorio(nombre);
        setErrorNombre(problema);
        if (problema) {
            enfocarPrimerError({ nombre: problema }, {nombre: 'nombre-proyecto'});
            return;
        }
        setCreando(true);
        try {
            await crearProyectoAPI(nombre.trim(), descripcion.trim());
            setNombre('');
            setDescripcion('');
            await cargarProyectos();
        } catch (err) {
            manejarErrorAPI(err);
        } finally {
            setCreando(false);
        }
    }

    function abrirProyecto(id) {
        navigate(`/proyectos/${id}`);
    }


    async function eliminarProyecto(proyecto) {
        const check = window.confirm(`¿Quieres borrar "${proyecto.nombre}" y todos sus frames? Esta acción no se puede deshacer.`);
        if (!check) return;
        setError('');
        try {
            await eliminarProyectoAPI(proyecto.id);
            setProyectos((actuales) => actuales.filter((p) => p.id !== proyecto.id));
        }   catch (err) {
            manejarErrorAPI(err);
            if (err.response?.status === 404) cargarProyectos();
        }
    }
    function cerrarSesion() {
        borrarToken();
        navigate('/login');
    }

    return (
        <main>
            <header>
                <h1>Mis proyectos</h1>
                <button type="button" onClick={cerrarSesion}>Cerrar sesión</button>
            </header>

            <section aria-labelledby="titulo-nuevo">
                <h2 id="titulo-nuevo">Nuevo proyecto</h2>
                <form onSubmit={crearProyecto} noValidate>
                    <CampoFormulario
                    id="nombre-proyecto"
                    etiqueta="Nombre"
                    valor={nombre}
                    onChange={(v) => { setNombre(v); setErrorNombre('');}}
                    error={errorNombre}
                    maxLength={150}
                    />

                    <CampoFormulario
                    id="descripcion-proyecto"
                    etiqueta="Descripción (opcional)"
                    valor={descripcion}
                    onChange={setDescripcion}
                    multilinea
                    />

                    <button type="submit" disabled={creando}>
                        {creando ? 'Creando...' : 'Crear proyecto'}
                    </button>
                </form>
            </section>

            {error && <p role="alert">{error}</p>}

            <section aria-labelledby="titulo-lista">
                <h2 id="titulo-lista">Tus proyectos</h2>
                {cargando ? (
                    <p>Cargando proyectos...</p>
                ) : proyectos.length === 0 ? (
                    <p> Todavía no tienes proyectos.</p>
                ) : (
                    <ul>
                        {proyectos.map((proyecto) => (
                            <li key={proyecto.id}>
                                <h3>{proyecto.nombre}</h3>
                                {proyecto.descripcion && <p>{proyecto.descripcion}</p>}
                                <button type="button" onClick={() => abrirProyecto(proyecto.id)}>Abrir</button>
                                <button type="button" className="boton-peligro" onClick={() => eliminarProyecto(proyecto)}>Eliminar</button>
                            </li>
                        ))}
                    </ul>
                )}  
            </section>
        </main>
    );
}


export default PanelProyectos;