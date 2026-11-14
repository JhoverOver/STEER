import  { useCallback, useEffect, useMemo, useState } from 'react';
import {useNavigate} from 'react-router-dom';
import {
    obtenerProyectos,
    crearProyecto as crearProyectoAPI,
    actualizarProyecto as actualizarProyectoAPI,
    eliminarProyecto as eliminarProyectoAPI,
    borrarToken,
    obtenerMensajeError,
} from '../services/servicioAPI';
import FormularioProyecto from '../components/FormularioProyecto';
import { COLORES, hexDeColor } from '../utils/colores';
import {
    FILTROS_VACIOS,
    etiquetasDisponibles,
    filtrarProyectos,
    formatearFecha,
    hayFiltros,
} from '../utils/proyectos';


function PanelProyectos() {
    const [proyectos, setProyectos] = useState([]);
    const [error, setError] = useState('');
    const [cargando, setCargando] = useState(true);
    const [creando, setCreando] = useState(false);
    const [editandoId, setEditandoId] = useState(null);
    const [guardandoEdicion, setGuardandoEdicion] = useState(false);
    const [filtros, setFiltros] = useState(FILTROS_VACIOS);
    const [versionFormulario, setVersionFormulario] = useState(0); // al cambiar, el formulario de creación se vacía

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

    const visibles = useMemo(() => filtrarProyectos(proyectos, filtros), [proyectos, filtros]);
    const etiquetas = useMemo(() => etiquetasDisponibles(proyectos), [proyectos]);

    function cambiarFiltro(campo, valor) {
        setFiltros((actuales) => ({ ...actuales, [campo]: valor }));
    }

    async function crearProyecto(datos) {
        setError('');
        setCreando(true);
        try {
            await crearProyectoAPI(
                datos.nombre, datos.descripcion, datos.etiquetas, datos.color, datos.desdeCero);
            setVersionFormulario((v) => v + 1);
            await cargarProyectos();
        } catch (err) {
            manejarErrorAPI(err);
        } finally {
            setCreando(false);
        }
    }

    async function guardarEdicion(proyecto, datos) {
        setError('');
        setGuardandoEdicion(true);
        try {
            await actualizarProyectoAPI(proyecto.id, datos);
            setEditandoId(null);
            await cargarProyectos();
        } catch (err) {
            manejarErrorAPI(err);
            if (err.response?.status === 404) cargarProyectos();
        } finally {
            setGuardandoEdicion(false);
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
                <button type="button" onClick={() => navigate('/preferencias')}>Preferencias</button>
                <button type="button" onClick={cerrarSesion}>Cerrar sesión</button>
            </header>

            <section aria-labelledby="titulo-nuevo">
                <h2 id="titulo-nuevo">Nuevo proyecto</h2>
                <FormularioProyecto
                    key={versionFormulario}
                    prefijo="nuevo"
                    permiteDesdeCero
                    textoEnviar="Crear proyecto"
                    textoEnviando="Creando..."
                    enviando={creando}
                    onEnviar={crearProyecto}
                />
            </section>

            {error && <p role="alert">{error}</p>}

            <section aria-labelledby="titulo-lista">
                <h2 id="titulo-lista">Tus proyectos</h2>

                {proyectos.length > 0 && (
                    <form className="filtros" role="search" aria-label="Filtrar proyectos" onSubmit={(e) => e.preventDefault()}>
                        <div className="campo">
                            <label htmlFor="filtro-nombre">Nombre</label>
                            <input id="filtro-nombre" type="text" value={filtros.nombre} onChange={(e) => cambiarFiltro('nombre', e.target.value)} />
                        </div>
                        <div className="campo">
                            <label htmlFor="filtro-etiqueta">Etiqueta</label>
                            <select id="filtro-etiqueta" value={filtros.etiqueta} onChange={(e) => cambiarFiltro('etiqueta', e.target.value)}>
                                <option value="">Todas</option>
                                {etiquetas.map((e) => <option key={e} value={e}>{e}</option>)}
                            </select>
                        </div>
                        <div className="campo">
                            <label htmlFor="filtro-color">Color</label>
                            <select id="filtro-color" value={filtros.color} onChange={(e) => cambiarFiltro('color', e.target.value)}>
                                <option value="">Todos</option>
                                <option value="ninguno">Sin color</option>
                                {COLORES.map((c) => <option key={c.nombre} value={c.nombre}>{c.etiqueta}</option>)}
                            </select>
                        </div>
                        <div className="campo">
                            <label htmlFor="filtro-desde">Modificado desde</label>
                            <input id="filtro-desde" type="date" value={filtros.desde} max={filtros.hasta || undefined} onChange={(e) => cambiarFiltro('desde', e.target.value)} />
                        </div>
                        <div className="campo">
                            <label htmlFor="filtro-hasta">Modificado hasta</label>
                            <input id="filtro-hasta" type="date" value={filtros.hasta} min={filtros.desde || undefined} onChange={(e) => cambiarFiltro('hasta', e.target.value)} />
                        </div>
                        <button type="button" onClick={() => setFiltros(FILTROS_VACIOS)} disabled={!hayFiltros(filtros)}>
                            Limpiar filtros
                        </button>
                    </form>
                )}

                {cargando ? (
                    <p>Cargando proyectos...</p>
                ) : proyectos.length === 0 ? (
                    <p> Todavía no tienes proyectos.</p>
                ) : (
                    <>
                    <p role="status">Mostrando {visibles.length} de {proyectos.length} proyectos.</p>
                    {visibles.length === 0 && <p>Ningún proyecto coincide con los filtros.</p>}
                    <ul className="lista-proyectos">
                        {visibles.map((proyecto) => (
                            <li
                                key={proyecto.id}
                                className="tarjeta-proyecto"
                                style={proyecto.color ? { borderLeft: `6px solid ${hexDeColor(proyecto.color)}` } : undefined}
                            >
                                {editandoId === proyecto.id ? (
                                    <FormularioProyecto
                                        prefijo={`editar-${proyecto.id}`}
                                        inicial={proyecto}
                                        textoEnviar="Guardar cambios"
                                        textoEnviando="Guardando..."
                                        enviando={guardandoEdicion}
                                        onEnviar={(datos) => guardarEdicion(proyecto, datos)}
                                        onCancelar={() => setEditandoId(null)}
                                    />
                                ) : (
                                    <>
                                    {proyecto.miniatura ? (
                                        <img className="miniatura-proyecto" src={proyecto.miniatura} alt={`Primer frame de ${proyecto.nombre}`} />
                                    ) : (
                                        <div className="miniatura-proyecto miniatura-vacia" role="img" aria-label="Proyecto sin vista previa">Sin vista previa</div>
                                    )}
                                    <div className="datos-proyecto">
                                        <h3>{proyecto.nombre}</h3>
                                        {proyecto.color && (
                                            <p className="texto-color">
                                                Color: {COLORES.find((c) => c.nombre === proyecto.color)?.etiqueta || proyecto.color}
                                            </p>
                                        )}
                                        {proyecto.descripcion && <p>{proyecto.descripcion}</p>}
                                        {proyecto.etiquetas?.length > 0 && (
                                            <ul className="etiquetas" aria-label="Etiquetas">
                                                {proyecto.etiquetas.map((e) => <li key={e}>{e}</li>)}
                                            </ul>
                                        )}
                                        <p className="fechas">
                                            Creado: {formatearFecha(proyecto.fecha_creacion)}
                                            {proyecto.fecha_edicion && <> · Editado: {formatearFecha(proyecto.fecha_edicion)}</>}
                                        </p>
                                        <button type="button" className="boton-principal" onClick={() => abrirProyecto(proyecto.id)}>Abrir</button>
                                        <button type="button" onClick={() => setEditandoId(proyecto.id)}>Editar datos</button>
                                        <button type="button" className="boton-peligro" onClick={() => eliminarProyecto(proyecto)}>Eliminar</button>
                                    </div>
                                    </>
                                )}
                            </li>
                        ))}
                    </ul>
                    </>
                )}  
            </section>
        </main>
    );
}


export default PanelProyectos;
