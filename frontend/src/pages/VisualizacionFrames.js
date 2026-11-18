import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { obtenerAtajos } from '../services/servicioAPI';
import {
    aplicarEdicion,
    checkEspacio,
    checkDuracion,
    clavesObjetivo,
    eliminarFrames,
    copiarFrames,
    pegarFrames,
    insertarBlank,
    cambiarDuracion,
    invertirOrden,
    moverFrames,
    moverPaso,
} from '../utils/operacionesFrames';
import { combinarAtajos, esCampoDeTexto } from '../utils/atajosArte';
import { MAX_FRAMES, MAX_MB, LADO_MAXIMO } from '../config/limites';
import useProyectoFrames from '../hooks/useProyectoFrames';
import useSeleccionFrames from '../hooks/useSeleccionFrames';
import VistaPrevia, { useReproduccion } from '../components/VistaPrevia';
import BarraEdicionFrames from '../components/BarraEdicionFrames';
import ListaFrames from '../components/ListaFrames';
import EditorImagen from '../components/EditorImagen';

// Pantalla de un proyecto: importar un GIF, ver la animación, editar la lista de frames, abrir un frame en el
// editor de imagen y exportar. Los datos y el servidor están en useProyectoFrames; aquí se unen las piezas.
function VisualizacionFrames() {
    const { id } = useParams();
    const datos = useProyectoFrames(id);
    const { proyecto, frames, ocupado, portapapeles, aplicar, avisar } = datos;
    const seleccion = useSeleccionFrames(frames);
    const reproduccion = useReproduccion(frames);

    const [claveEditando, setClaveEditando] = useState(null);
    const [atajosGuardados, setAtajosGuardados] = useState({});
    const atajos = useMemo(() => combinarAtajos(atajosGuardados), [atajosGuardados]);

    const frameEditando = claveEditando === null ? null : frames.find((f) => f.clave === claveEditando) || null;
    const puedeEditar = Boolean(proyecto && proyecto.ancho && proyecto.alto);
    const hayEspacio = checkEspacio(frames);
    const puedePegar = portapapeles.length > 0 && checkEspacio(frames, portapapeles.length);
    // Proporción de las miniaturas y la vista previa: la del lienzo del proyecto
    const proporcion = proyecto?.ancho ? `${proyecto.ancho} / ${proyecto.alto}` : '';

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

    // ---------- Operaciones sobre la lista ----------

    function posicionDespuesDeSeleccion() {
        const { claves } = seleccion;
        if (claves.length === 0) return frames.length;
        return frames.findIndex((f) => f.clave === claves[claves.length - 1]) + 1;
    }

    function copiar() {
        if (seleccion.claves.length === 0) return false;
        datos.setPortapapeles(copiarFrames(frames, seleccion.claves));
        datos.avisar('');
        datos.informar(`${seleccion.claves.length} frame(s) copiado(s).`);
        return true;
    }

    function pegarEn(posicion) {
        if (portapapeles.length === 0 || ocupado) return false;
        if (!puedePegar) {
            avisar(`No hay espacio: un proyecto admite máximo ${MAX_FRAMES} frames.`);
            return false;
        }
        aplicar((f) => pegarFrames(f, portapapeles, posicion));
        return true;
    }

    function insertarEn(posicion) {
        if (ocupado) return false;
        if (!hayEspacio) {
            avisar(`No hay espacio: un proyecto admite como máximo ${MAX_FRAMES} frames.`);
            return false;
        }
        aplicar((f) => insertarBlank(f, posicion));
        return true;
    }

    function eliminarSeleccion() {
        if (seleccion.claves.length === 0) return false;
        aplicar((f) => eliminarFrames(f, seleccion.claves));
        return true;
    }

    // Devuelve false si la duración no es válida: la tarjeta muestra el motivo junto a su campo
    function cambiarDuracionDeUno(clave, valor) {
        if (!checkDuracion(valor)) return false;
        aplicar((f) => cambiarDuracion(f, [clave], valor));
        return true;
    }

    const acciones = {
        deshacer: datos.deshacer,
        rehacer: datos.rehacer,
        seleccionarTodo: seleccion.seleccionarTodo,
        quitarSeleccion: seleccion.quitar,
        copiar,
        pegar: () => pegarEn(posicionDespuesDeSeleccion()),
        insertar: () => insertarEn(posicionDespuesDeSeleccion()),
        eliminar: eliminarSeleccion,
        invertir: () => aplicar((f) => invertirOrden(f, clavesObjetivo(f, seleccion.activa))),
        mover: (direccion) => aplicar((f) => moverPaso(f, seleccion.claves, direccion)),
        aplicarDuracion: (valor) => aplicar((f) => cambiarDuracion(f, clavesObjetivo(f, seleccion.activa), valor)),
        guardar: datos.guardar,
    };

    // ---------- Editor de imagen ----------

    function abrirEditor(clave) {
        if (ocupado || !puedeEditar) return;
        irA(reproduccion.indice); // detiene la reproducción
        datos.limpiarMensajes();
        setClaveEditando(clave);
    }

    // El editor entregó sus cambios: el frame queda con sus capas y su imagen nueva (se puede deshacer)
    function terminarEdicion(resultado) {
        const clave = claveEditando;
        const imagen = URL.createObjectURL(resultado.imagen);
        aplicar((f) => aplicarEdicion(f, clave, { capas: resultado.capas, imagen }));
        setClaveEditando(null);
    }

    // ---------- Atajos de teclado de la lista ----------

    const accionesTeclado = useRef({});
    accionesTeclado.current = { ...acciones, editando: frameEditando !== null };
    useEffect(() => {
        function alPulsar(evento) {
            const a = accionesTeclado.current;
            const control = evento.ctrlKey || evento.metaKey;
            const tecla = evento.key.toLowerCase();
            if (a.editando) {
                // El editor de imagen tiene sus propios atajos; aquí solo se evita que Ctrl+S guarde la página
                if (control && tecla === 's') evento.preventDefault();
                return;
            }
            const escribiendo = esCampoDeTexto(evento.target);
            if (control && tecla === 's') {
                evento.preventDefault();
                if (escribiendo) {
                    evento.target.blur(); // confirma el valor que se estaba escribiendo antes de guardar
                    setTimeout(() => accionesTeclado.current.guardar(), 0);
                } else {
                    a.guardar();
                }
                return;
            }
            if (escribiendo) return;

            let atendida = false;
            if (control && tecla === 'z' && !evento.shiftKey) atendida = a.deshacer();
            else if (control && (tecla === 'y' || (tecla === 'z' && evento.shiftKey))) atendida = a.rehacer();
            else if (control && tecla === 'c') atendida = a.copiar();
            else if (control && tecla === 'v') atendida = a.pegar();
            else if (control && tecla === 'a') atendida = a.seleccionarTodo();
            else if (tecla === 'delete') atendida = a.eliminar();
            if (atendida) evento.preventDefault();
        }
        document.addEventListener('keydown', alPulsar);
        return () => document.removeEventListener('keydown', alPulsar);
    }, []);

    // ---------- Pantalla ----------

    function volver(evento) {
        if (datos.sinGuardar && !window.confirm('Tienes cambios sin guardar. ¿Salir sin guardar?')) {
            evento.preventDefault();
        }
    }

    function elegirGIF(evento) {
        const archivo = evento.target.files[0];
        evento.target.value = ''; // permite elegir el mismo archivo otra vez
        if (archivo) datos.importarGIF(archivo);
    }

    const hayHistorialPrevio = datos.guardado.length > 0 || frames.length > 0;

    return (
        <main className="pagina-editor">
            {/* Barra vertical de etapas del proyecto (Incremento 3): importación, frames, imagen y video */}
            <nav className="barra-etapas" aria-label="Etapas del proyecto" />
            <header>
                {!frameEditando && <Link to="/proyectos" onClick={volver}>Volver a mis proyectos</Link>}
                <h1>{proyecto ? proyecto.nombre : 'Proyecto'}</h1>
                {proyecto?.descripcion && <p>{proyecto.descripcion}</p>}
            </header>

            {datos.error && <p role="alert">{datos.error}</p>}
            {datos.mensaje && <p role="status">{datos.mensaje}</p>}

            {frameEditando ? (
                <EditorImagen
                    proyectoId={proyecto.id}
                    nombreProyecto={proyecto.nombre}
                    posicion={`Frame ${frames.indexOf(frameEditando) + 1} de ${frames.length}`}
                    ancho={proyecto.ancho}
                    alto={proyecto.alto}
                    frame={frameEditando}
                    atajos={atajos}
                    onTerminar={terminarEdicion}
                    onCancelar={() => setClaveEditando(null)}
                />
            ) : datos.cargando ? (
                <p>Cargando proyecto...</p>
            ) : !proyecto ? (
                <p>No se pudo cargar el proyecto.</p>
            ) : (
                <>
                    <section aria-labelledby="titulo-subir">
                        <h2 id="titulo-subir">Importar GIF</h2>
                        <label htmlFor="archivo-gif">Elige un archivo GIF</label>
                        <input id="archivo-gif" type="file" accept="image/gif" onChange={elegirGIF} disabled={ocupado} />
                        <p>Máximo {MAX_MB} MB y {MAX_FRAMES} frames y {LADO_MAXIMO} × {LADO_MAXIMO} px. Reemplaza los frames actuales del proyecto.</p>
                        {datos.subiendo && <p role="status">Procesando el GIF...</p>}
                    </section>

                    <section aria-labelledby="titulo-secuencia">
                        <h2 id="titulo-secuencia">Animación</h2>
                        {!hayHistorialPrevio ? (
                            <p>Este proyecto todavía no tiene frames. Importa un GIF para empezar.</p>
                        ) : frames.length === 0 ? (
                            <p>No quedan frames.</p>
                        ) : (
                            <VistaPrevia frames={frames} reproduccion={reproduccion} proporcion={proporcion} />
                        )}
                    </section>

                    {hayHistorialPrevio && (
                        <section aria-labelledby="titulo-edicion">
                            <h2 id="titulo-edicion">Edición</h2>
                            <BarraEdicionFrames
                                deshabilitado={ocupado}
                                total={frames.length}
                                seleccionados={seleccion.claves.length}
                                puedeDeshacer={datos.puedeDeshacer}
                                puedeRehacer={datos.puedeRehacer}
                                puedePegar={puedePegar}
                                puedeInsertar={hayEspacio}
                                puedeInvertir={clavesObjetivo(frames, seleccion.activa).length >= 2}
                                sinGuardar={datos.sinGuardar}
                                guardando={datos.guardando}
                                acciones={acciones}
                            />
                            <p>
                                {frames.length} de {MAX_FRAMES} frames - {seleccion.claves.length} seleccionado(s) -{' '}
                                <span className={datos.sinGuardar ? 'estado-sin-guardar' : 'estado-guardado'}>
                                    {datos.sinGuardar ? 'Hay cambios sin guardar' : 'Todo guardado'}
                                </span>
                            </p>
                            <ListaFrames
                                frames={frames}
                                indiceActual={reproduccion.indice}
                                seleccion={seleccion}
                                deshabilitado={ocupado}
                                puedeEditar={puedeEditar}
                                puedePegar={puedePegar}
                                puedeInsertar={hayEspacio}
                                proporcion={proporcion}
                                onVer={irA}
                                onEditar={abrirEditor}
                                onEliminar={(clave) => aplicar((f) => eliminarFrames(f, [clave]))}
                                onCambiarDuracion={cambiarDuracionDeUno}
                                onInsertar={insertarEn}
                                onPegar={pegarEn}
                                onMover={(claves, hueco) => aplicar((f) => moverFrames(f, claves, hueco))}
                            />
                            <p>
                                Atajos: Ctrl+z deshacer, Ctrl+y rehacer, Ctrl+c copiar, Ctrl+v pegar, Ctrl+a seleccionar todo, Supr eliminar, Ctrl+s guardar, Shift + click seleccionar
                            </p>
                        </section>
                    )}

                    <section aria-labelledby="titulo-exportar">
                        <h2 id="titulo-exportar">Exportar</h2>
                        {['gif', 'mp4'].map((formato) => (
                            <button
                                key={formato}
                                type="button"
                                className="boton-principal"
                                onClick={() => datos.exportar(formato)}
                                disabled={frames.length === 0 || ocupado}
                            >
                                {datos.exportando === formato
                                    ? `Generando ${formato.toUpperCase()}...`
                                    : `Exportar ${formato.toUpperCase()}`}
                            </button>
                        ))}
                        {datos.sinGuardar && <p>Se exporta lo guardado; al exportar se te pedirá guardar los cambios.</p>}
                    </section>
                </>
            )}
        </main>
    );
}

export default VisualizacionFrames;