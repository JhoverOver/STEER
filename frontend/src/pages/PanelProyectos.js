import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, X } from 'lucide-react';
import {
    obtenerProyectos,
    crearProyecto as crearProyectoAPI,
    actualizarProyecto as actualizarProyectoAPI,
    eliminarProyecto as eliminarProyectoAPI,
    obtenerMensajeError,
} from '../services/servicioAPI';
import FormularioProyecto from '../components/FormularioProyecto';
import TarjetaProyecto from '../components/TarjetaProyecto';
import MenuPerfil from '../components/MenuPerfil';
import BotonIcono from '../components/BotonIcono';
import { eliminarArchivosDeProyecto } from '../utils/archivos';
import { COLORES } from '../utils/colores';
import {
    FILTROS_VACIOS,
    etiquetasDisponibles,
    filtrarProyectos,
    hayFiltros,
} from '../utils/proyectos';

// "Mis proyectos": una cuadrícula de tarjetas chicas. La primera es la de crear un proyecto nuevo: al crearlo se
// abre de inmediato, en la pestaña Frames, para importar un archivo o empezar con un frame en blanco.
function PanelProyectos() {
    const [proyectos, setProyectos] = useState([]);
    const [error, setError] = useState('');
    const [cargando, setCargando] = useState(true);
    const [nuevoAbierto, setNuevoAbierto] = useState(false);
    const [creando, setCreando] = useState(false);
    const [editandoId, setEditandoId] = useState(null);
    const [guardandoEdicion, setGuardandoEdicion] = useState(false);
    const [filtros, setFiltros] = useState(FILTROS_VACIOS);

    const navigate = useNavigate();

    const cargarProyectos = useCallback(async () => {
        try {
            setProyectos(await obtenerProyectos());
        } catch (err) {
            setError(obtenerMensajeError(err));
        } finally {
            setCargando(false);
        }
    }, []);

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
            const nuevo = await crearProyectoAPI(datos);
            navigate(`/proyectos/${nuevo.id}/frames`);
        } catch (err) {
            setError(obtenerMensajeError(err));
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
            setError(obtenerMensajeError(err));
            if (err.response?.status === 404) cargarProyectos();
        } finally {
            setGuardandoEdicion(false);
        }
    }

    async function eliminarProyecto(proyecto) {
        const check = window.confirm(`¿Quieres borrar "${proyecto.nombre}" y todos sus frames? Esta acción no se puede deshacer.`);
        if (!check) return;
        setError('');
        try {
            await eliminarProyectoAPI(proyecto.id);
            setProyectos((actuales) => actuales.filter((p) => p.id !== proyecto.id));
            // Sus archivos (guardados en este navegador) ya no sirven
            eliminarArchivosDeProyecto(proyecto.id).catch(() => {});
        } catch (err) {
            setError(obtenerMensajeError(err));
            if (err.response?.status === 404) cargarProyectos();
        }
    }

    return (
        <main className="pagina-proyectos">
            <header>
                <h1>Mis proyectos</h1>
                <MenuPerfil posicion="abajo" />
            </header>

            {error && <p role="alert">{error}</p>}

            <section aria-labelledby="titulo-lista">
                <h2 id="titulo-lista" className="solo-lector">Tus proyectos</h2>

                {proyectos.length > 0 && (
                    <form className="filtros" role="search" aria-label="Filtrar proyectos" onSubmit={(e) => e.preventDefault()}>
                        <div className="filtro-buscar">
                            <Search aria-hidden="true" size={16} />
                            <label htmlFor="filtro-nombre" className="solo-lector">Buscar por nombre</label>
                            <input id="filtro-nombre" type="search" placeholder="Buscar" value={filtros.nombre} onChange={(e) => cambiarFiltro('nombre', e.target.value)} />
                        </div>
                        <label htmlFor="filtro-etiqueta" className="solo-lector">Etiqueta</label>
                        <select id="filtro-etiqueta" value={filtros.etiqueta} onChange={(e) => cambiarFiltro('etiqueta', e.target.value)}>
                            <option value="">Etiquetas</option>
                            {etiquetas.map((e) => <option key={e} value={e}>{e}</option>)}
                        </select>
                        <label htmlFor="filtro-color" className="solo-lector">Color</label>
                        <select id="filtro-color" value={filtros.color} onChange={(e) => cambiarFiltro('color', e.target.value)}>
                            <option value="">Colores</option>
                            <option value="ninguno">Sin color</option>
                            {COLORES.map((c) => <option key={c.nombre} value={c.nombre}>{c.etiqueta}</option>)}
                        </select>
                        <div className="filtro-fechas">
                            <label htmlFor="filtro-desde">Desde</label>
                            <input id="filtro-desde" type="date" value={filtros.desde} max={filtros.hasta || undefined} onChange={(e) => cambiarFiltro('desde', e.target.value)} />
                            <label htmlFor="filtro-hasta">hasta</label>
                            <input id="filtro-hasta" type="date" value={filtros.hasta} min={filtros.desde || undefined} onChange={(e) => cambiarFiltro('hasta', e.target.value)} />
                        </div>
                        {hayFiltros(filtros) && (
                            <>
                                <span role="status" className="cuenta-filtrados">{visibles.length} de {proyectos.length}</span>
                                <BotonIcono icono={X} texto="Limpiar filtros" lado="abajo" onClick={() => setFiltros(FILTROS_VACIOS)} />
                            </>
                        )}
                    </form>
                )}

                {cargando ? (
                    <p role="status" aria-busy="true">Cargando...</p>
                ) : (
                    <>
                        <ul className="lista-proyectos">
                            <li className={`tarjeta-proyecto tarjeta-nueva${nuevoAbierto ? ' editando' : ''}`}>
                                {nuevoAbierto ? (
                                    <>
                                        <h3 className="solo-lector">Nuevo proyecto</h3>
                                        <FormularioProyecto
                                            prefijo="nuevo"
                                            textoEnviar="Crear"
                                            textoEnviando="Creando..."
                                            enviando={creando}
                                            onEnviar={crearProyecto}
                                            onCancelar={() => setNuevoAbierto(false)}
                                        />
                                    </>
                                ) : (
                                    <button type="button" className="boton-nuevo-proyecto" onClick={() => setNuevoAbierto(true)}>
                                        <Plus aria-hidden="true" size={36} />
                                        Nuevo proyecto
                                    </button>
                                )}
                            </li>
                            {visibles.map((proyecto) => (editandoId === proyecto.id ? (
                                <li key={proyecto.id} className="tarjeta-proyecto editando">
                                    <h3 className="solo-lector">Ajustes de {proyecto.nombre}</h3>
                                    <FormularioProyecto
                                        prefijo={`editar-${proyecto.id}`}
                                        inicial={proyecto}
                                        textoEnviar="Guardar"
                                        textoEnviando="Guardando..."
                                        enviando={guardandoEdicion}
                                        onEnviar={(datos) => guardarEdicion(proyecto, datos)}
                                        onCancelar={() => setEditandoId(null)}
                                    />
                                </li>
                            ) : (
                                <TarjetaProyecto
                                    key={proyecto.id}
                                    proyecto={proyecto}
                                    onAbrir={() => navigate(`/proyectos/${proyecto.id}/frames`)}
                                    onAjustes={() => setEditandoId(proyecto.id)}
                                    onEliminar={() => eliminarProyecto(proyecto)}
                                />
                            )))}
                        </ul>
                    </>
                )}
            </section>
        </main>
    );
}

export default PanelProyectos;
