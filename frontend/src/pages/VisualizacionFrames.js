import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Link, useNavigate, useParams} from 'react-router-dom';
import {
    obtenerProyecto,
    obtenerFrames,
    subirGIF as subirGIFAPI,
    exportar as exportarAPI,
    guardarFrames as guardarFramesAPI,
    obtenerMensajeError,
} from '../services/servicioAPI';

import {
    MAX_FRAMES,
    DURACION_MINIMA,
    DURACION_MAXIMA,
    DURACION_POR_DEFECTO,
    desdeServidor,
    framesLista,
    hayCambios,
    checkEspacio,
    checkDuracion,
    clavesObjetivo,
    clavesEnRango,
    eliminarFrames,
    copiarFrames,
    pegarFrames,
    insertarBlank,
    cambiarDuracion,
    invertirOrden,
    moverFrames,
    moverPaso,
    remapearPortapapeles,
}   from '../utils/operacionesFrames';
import {
    crearHistorial,
    registrarCambio,
    deshacer as deshacerPaso,
    rehacer as rehacerPaso,
    puedeDeshacer,
    puedeRehacer,
}   from '../utils/historial';
import TarjetaFrame from '../components/TarjetaFrame';

const TAMANO_MAXIMO_MB = 10;
const MENSAJE_DURACION = `La duración debe ser un número entero entre ${DURACION_MINIMA} y ${DURACION_MAXIMA} ms.`;


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

function estaEscribiendo(elemento) {
    if(!(elemento instanceof HTMLElement)) return false;
    if (elemento.tagName === 'TEXTAREA' || elemento.tagName === 'SELECT' || elemento.isContentEditable) return true;
    return elemento.tagName === 'INPUT' && !['checkbox', 'radio', 'button', 'file'].includes(elemento.type);
}

function VisualizacionFrames() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [proyecto, setProyecto] = useState(null);
    const [guardado, setGuardado] = useState([]);
    const [historial, setHistorial] = useState(() => crearHistorial([]));
    const [seleccion, setSeleccion] = useState(() => new Set());
    const [portapapeles, setPortapapeles] = useState([]);
    const [duracionGlobal, setDuracionGlobal] = useState(String(DURACION_POR_DEFECTO));
    const [destino, setDestino] = useState(null);
    const [proporcion, setProporcion] = useState('');

    const [indice, setIndice] = useState(0);
    const [reproduciendo, setReproduciendo] = useState(false);
    const [cargando, setCargando] = useState(true);
    const [subiendo, setSubiendo] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [exportando, setExportando] = useState('');
    const [error, setError] = useState('');
    const [mensaje, setMensaje] = useState('');

    const ultimaClave = useRef(null);
    const arrastrando = useRef(null);
    const acciones = useRef({});

    const frames = historial.presente;
    const sinGuardar = useMemo(() => hayCambios(frames, guardado), [frames, guardado]);
    const ocupado = subiendo || guardando || exportando !== '';


    const seleccionActiva = useMemo(
        () => new Set(frames.filter((f) => seleccion.has(f.clave)).map((f) => f.clave)),
        [frames, seleccion]
    );
    const clavesSeleccionadas = useMemo(
        () => frames.filter((f) => seleccionActiva.has(f.clave)).map((f) => f.clave),
        [frames, seleccionActiva]
    );
    const hayEspacio = checkEspacio(frames);

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

    function reiniciarEdicion(listaServidor) {
        const base = desdeServidor(listaServidor);
        setGuardado(base);
        setHistorial(crearHistorial(base));
        setSeleccion(new Set());
        ultimaClave.current = null;
        setIndice(0);
        return base;
    }

    const cargarFrames = useCallback(async () => {
        try {
            const [datosProyecto, listaFrames] = await Promise.all([obtenerProyecto(id), obtenerFrames(id)]);
            setProyecto(datosProyecto);
            const base = desdeServidor(listaFrames);
            setGuardado(base);
            setHistorial(crearHistorial(base));
            setIndice(0);
        }   catch (err) {
            manejarErrorAPI(err);
        }   finally {
            setCargando(false);
        }
    }, [id, manejarErrorAPI]);

    useEffect(() => {
        cargarFrames();
    }, [cargarFrames]);

    useEffect(() => {
        const primero = guardado.find((f) => !f.vacio && f.imagen);
        if (!primero) {
            setProporcion('');
            return undefined;
        }
        let vigente = true;
        const imagen = new Image();
        imagen.onload = () => {
            if (vigente && imagen.naturalWidth) setProporcion(`${imagen.naturalWidth} / ${imagen.naturalHeight}`);
        };
        imagen.src = primero.imagen;
        return () => {
            vigente = false;
        };
    }, [guardado]);

    useEffect(() => {
        if (!sinGuardar) return undefined;
        function avisar(evento) {
            evento.preventDefault();
            evento.returnValue = '';
        }
        window.addEventListener('beforeunload', avisar);
        return () => window.removeEventListener('beforeunload', avisar);
    }, [sinGuardar]);

    const indiceSeguro = Math.min(indice, Math.max(frames.length -1, 0));
    useEffect(() => {
        if (!reproduciendo || frames.length === 0) return undefined;
        const espera = frames[indiceSeguro]?.duracion || DURACION_POR_DEFECTO;
        const timer = setTimeout(() => {
            setIndice((actual) => (Math.min(actual, frames.length - 1) + 1) % frames.length);
        }, espera);
        return () => clearTimeout(timer);
    }, [reproduciendo, indiceSeguro, frames]);

    function alternarReproduccion() {
        setReproduciendo((actual) => !actual);
    }

    function irAFrame(nuevoIndice) {
        setReproduciendo(false);
        setIndice(nuevoIndice);
    }


    // EDICION

    function aplicar(operacion) {
        if (ocupado) return;
        setError('');
        setMensaje('');
        const nueva = operacion(frames);
        setHistorial((h) => registrarCambio(h,nueva));
    }

    function alternarSeleccion(clave, conRango) {
        const nueva = new Set(seleccionActiva);
        if (conRango && ultimaClave.current) {
            clavesEnRango(frames, ultimaClave.current, clave).forEach((c) => nueva.add(c));
        }   else if (nueva.has(clave)) {
            nueva.delete(clave);
        }   else {
            nueva.add(clave);
        }
        ultimaClave.current = clave;
        setSeleccion(nueva);
    }

    function seleccionarTodo() {
        if (frames.length === 0) return false;
        const todosMarcados = seleccionActiva.size === frames.length;
        setSeleccion(todosMarcados ? new Set() : new Set(frames.map((f) => f.clave)));
        ultimaClave.current = null;
        return true;
    }

    function copiar() {
        if (clavesSeleccionadas.length === 0) return false;

        setPortapapeles(copiarFrames(frames, clavesSeleccionadas));
        setError('');
        setMensaje(`${clavesSeleccionadas.length} frame(s) copiado(s).`);
        return true;
    }

    function pegarEn(posicion) {
        if (portapapeles.length === 0 || ocupado) return false;
        if (!checkEspacio(frames, portapapeles.length)) {
            setError(`No hay espacio: un proyecto admite máximo ${MAX_FRAMES} frames.`);
            return false;
        }
        aplicar((f) => pegarFrames(f, portapapeles, posicion));
        return true;
    }

    function posicionDespuesDeSeleccion() {
        if (clavesSeleccionadas.length === 0) return frames.length;
        const ultima = clavesSeleccionadas[clavesSeleccionadas.length - 1];
        return frames.findIndex((f) => f.clave === ultima) + 1;
    }

    function insertarEn(posicion) {
        if (ocupado) return false;
        if (!hayEspacio) {
            setError(`No hay espacio: un proyecto admite como máximo ${MAX_FRAMES} frames.`);
            return false;
        }
        aplicar((f) => insertarBlank(f, posicion));
        return true;
    }

    function eliminarSeleccion() {
        if (clavesSeleccionadas.length === 0) return false;
        aplicar((f) => eliminarFrames(f, clavesSeleccionadas));
        return true;
    }

    function eliminarUno(clave) {
        aplicar((f) => eliminarFrames(f, [clave]));
    }

    function invertir() {
        const objetivo = clavesObjetivo(frames, seleccionActiva);
        aplicar((f) => invertirOrden(f, objetivo));
    }

    function mover(direccion) {
        aplicar((f) => moverPaso(f, clavesSeleccionadas, direccion));
    }

    function cambiarDuracionDeUno(clave, valor) {
        if(!checkDuracion(valor)) {
            setError(MENSAJE_DURACION);
            return false;
        }
        aplicar((f) => cambiarDuracion(f, [clave], valor));
        return true;
    }

    function aplicarDuracionGlobal() {
        const valor = duracionGlobal.trim() === '' ? NaN : Number(duracionGlobal);
        if (!checkDuracion(valor)) {
            setError(MENSAJE_DURACION);
            return;
        }
        const objetivo = clavesObjetivo(frames, seleccionActiva);
        aplicar((f) => cambiarDuracion(f,objetivo, valor));
    }

    function deshacer() {
        if (ocupado || !puedeDeshacer(historial)) return false;
        setError('');
        setMensaje('');
        setHistorial(deshacerPaso);
        return true;
    }

    function rehacer() { 
        if (ocupado || !puedeRehacer(historial)) return false;
        setError('');
        setMensaje('');
        setHistorial(rehacerPaso);
        return true;
    }


    // ARRASTRAR Y SOLTAR

    function iniciarArrastre(evento, clave) {
        if (ocupado) {
            evento.preventDefault();
            return;
        }

        arrastrando.current = seleccionActiva.has(clave) ? clavesSeleccionadas : [clave];
        if(evento.dataTransfer) {
            evento.dataTransfer.effectAllowed = 'move';
            evento.dataTransfer.setData('text/plain', clave);

            const tarjeta = evento.currentTarget.closest('li');
            if (tarjeta && evento.dataTransfer.setDragImage) evento.dataTransfer.setDragImage(tarjeta, 20, 20);
        }
    }

    function huecoSegunPosicion(evento, indiceTarjeta) {
        const caja = evento.currentTarget.getBoundingClientRect();
        const izquierda = evento.clientX < caja.left + caja.width / 2;
        return indiceTarjeta + (izquierda ? 0 : 1);
    }

    function arrastrarSobreTarjeta(evento, indiceTarjeta) {
        if (!arrastrando.current) return;
        evento.preventDefault();
        setDestino(huecoSegunPosicion(evento,indiceTarjeta));
    }

    function arrastrarSobreHueco(evento, indiceHueco) {
        if (!arrastrando.current) return;
        evento.preventDefault();
        setDestino(indiceHueco);
    }

    function terminarArrastre() {
        arrastrando.current = null;
        setDestino(null);
    }

    function soltarEnTarjeta(evento, indiceTarjeta) {
        soltarEn(evento, huecoSegunPosicion(evento, indiceTarjeta));
    }

    function soltarEn(evento,hueco) {
        if (!arrastrando.current) return;
        evento.preventDefault();
        const claves = arrastrando.current;
        terminarArrastre();
        aplicar((f) => moverFrames(f, claves, hueco));
    }

    // SERVIDOR

    async function guardar() {
        if (ocupado) return false;
        if (!sinGuardar) return true;
        setGuardando(true);
        setError('');
        setMensaje('');
        try {
            const enviados = framesLista(frames);
            const recibidos = await guardarFramesAPI(id, enviados);

            reiniciarEdicion(recibidos);
            setPortapapeles((actual) => remapearPortapapeles(actual, enviados, recibidos));
            setMensaje('Cambios guardados.');
            return true;
        }   catch (err) {
            if (err.response?.status === 400 && String(err.response.data?.error).includes('no pertenece')) {
                setError(`${obtenerMensajeError(err)} Si guardaste este proyecto en otra pestaña, recarga la página.`);
            }   else {
                manejarErrorAPI(err);
            }
            return false;
        }   finally {
            setGuardando(false);
        }
    }


    async function subirGIF(evento) {
        const archivo =evento.target.files[0];
        evento.target.value = '';
        if (!archivo) return;

        setError('');
        setMensaje('');
        if (archivo.type !== 'image/gif') {
            setError('Solo se permiten archivos GIF.');
            return;
        }
        if (archivo.size > TAMANO_MAXIMO_MB *1024 *1024) {
            setError(`El archivo supera el máximo de ${TAMANO_MAXIMO_MB} MB.`);
            return;
        }
        if (frames.length > 0 || guardado.length > 0) {
            const aviso = sinGuardar
            ? 'Subir un GIF reemplaza los frames del proyecto y se perderán los cambios sin guardar. ¿Continuar?'
            : 'Subir un GIF reemplaza los frames actuales de este proyecto. ¿Continuar?';
            if (!window.confirm(aviso)) return;
        }

        setSubiendo(true);
        setReproduciendo(false);
        try {
            const nuevos = await subirGIFAPI(id, archivo);
            reiniciarEdicion(nuevos);
            setPortapapeles([]);
        }   catch (err) {
            manejarErrorAPI(err);
        }   finally {
            setSubiendo(false);
        }
    }

    async function exportar(formato) {
        if (ocupado) return;
        setError('');
        setMensaje('');
        if (sinGuardar) {
            if (!window.confirm('Tienes cambios sin guardar. Se guardarán antes de exportar. ¿Continuar?')) return;
            const seGuardo = await guardar();
            if (!seGuardo) return;
        }
        setExportando(formato);
        try {
            const blob = await exportarAPI(id, formato);
            descargarBlob(blob, `proyecto-${id}.${formato}`);
        }   catch (err) {
            manejarErrorAPI(err);
        }   finally {
            setExportando('');
        }
    }

    function volver(evento) {
        if (sinGuardar && !window.confirm('Tienes cambios sin guardar. ¿Salir sin guardar?')) {
            evento.preventDefault();
        }
    }


    // ATAJOS CON TECLADO
    useEffect(() => {
        acciones.current = {
            deshacer,
            rehacer,
            guardar,
            copiar,
            pegar: () => pegarEn(posicionDespuesDeSeleccion()),
            eliminar: eliminarSeleccion,
            seleccionarTodo,
        };
    });

    useEffect(() => {
        function alPulsar(evento) {
            const escribiendo = estaEscribiendo(evento.target);
            const control = evento.ctrlKey || evento.metaKey;
            const tecla = evento.key.toLowerCase();

            if (control && tecla === 's') {
                evento.preventDefault();
                if (escribiendo) {
                    evento.target.blur();
                    setTimeout(() => acciones.current.guardar(), 0);
                }   else {
                    acciones.current.guardar();
                }
                return;
            }
            if (escribiendo) return;

            let atendida = false;
            if (control && tecla === 'z' && !evento.shiftKey) atendida = acciones.current.deshacer();
            else if (control && (tecla === 'y' || (tecla === 'z' && evento.shiftKey))) atendida = acciones.current.rehacer();
            else if (control && tecla === 'c') atendida = acciones.current.copiar();
            else if (control && tecla === 'v') atendida = acciones.current.pegar();
            else if (control && tecla === 'a') atendida = acciones.current.seleccionarTodo();
            else if (tecla === 'delete') atendida = acciones.current.eliminar();
            if (atendida) evento.preventDefault();
        }
        document.addEventListener('keydown', alPulsar);
        return () => document.removeEventListener('keydown', alPulsar);
    }, []);


    //PANTALLA

    const frameActual = frames[indiceSeguro];
    const hayHistorialPrevio = guardado.length > 0 || frames.length > 0;
    const textoInvertir = clavesSeleccionadas.length> 0 ? 'Invertir selección' : 'Invertir todos';
    const textoDuracion = clavesSeleccionadas.length > 0 ? `Aplicar a la selección (${clavesSeleccionadas.length})` : 'Aplicar a todos';
    const todosMarcados = frames.length > 0 && seleccionActiva.size === frames.length;

    return (
        <main className="pagina-editor">
            <header>
                <Link to="/proyectos" onClick={volver}>
                Volver a mis proyectos
                </Link>
                <h1>{proyecto ? proyecto.nombre : 'Proyecto'}</h1>
                {proyecto?.descripcion && <p>{proyecto.descripcion}</p>}
            </header>

            {error && <p role="alert">{error}</p>}
            {mensaje && <p role="status">{mensaje}</p>}

            {cargando ? (
                <p>Cargando proyecto...</p>
            ) : !proyecto ? (
                <p>No se pudo cargar el proyecto.</p>
            ) : (
                <>
                <section aria-labelledby="titulo-subir">
                    <h2 id="titulo-subir">Importar GIF</h2>
                    <label htmlFor="archivo-gif">Elige un archivo GIF</label>
                    <input id="archivo-gif" type="file" accept="image/gif" onChange={subirGIF} disabled={ocupado} />
                    <p>Máximo {TAMANO_MAXIMO_MB} MB y {MAX_FRAMES} frames. Reemplaza los frames actuales del proyecto.</p>
                    {subiendo && <p role="status">Procesando el GIF...</p>}
                </section>

                <section aria-labelledby="titulo-secuencia">
                    <h2 id="titulo-secuencia">Animación</h2>
                    {!hayHistorialPrevio ? (
                        <p>Este proyecto todavía no tiene frames. Importa un GIF para empezar.</p>
                    ) : frames.length === 0 ? (
                        <p>No quedan frames.</p>
                    ) : (
                        <>
                        {frameActual.vacio ? (
                            <div 
                            className="frame-vacio vista-previa"
                            role="img"
                            aria-label={`Frame ${indiceSeguro + 1} de ${frames.length} (en blanco)`}
                            style={proporcion ? {aspectRatio: proporcion } : undefined}
                            >
                                En blanco
                            </div>
                        ) : (
                            <img 
                            className="vista-previa"
                            src={frameActual.imagen}
                            alt={`Frame ${indiceSeguro + 1} de ${frames.length}`}
                            />
                        )}
                        <p>
                            Frame {indiceSeguro + 1} de {frames.length} - {frameActual.duracion} ms
                        </p>

                        <div>
                            <button type="button" onClick={() => irAFrame((indiceSeguro - 1 + frames.length) % frames.length)}>
                                Anterior
                            </button>
                            <button type="button" onClick={alternarReproduccion}>
                                {reproduciendo ? 'Pausar' : 'Reproducir'}    
                            </button>
                            <button type="button" onClick={() => irAFrame((indiceSeguro + 1) % frames.length)}>
                                Siguiente
                            </button>
                        </div>
                        </>
                    )}
                </section>

                {hayHistorialPrevio && (
                    <section aria-labelledby="titulo-edicion">
                        <h2 id="titulo-edicion">Edición</h2>

                        <div role="toolbar" aria-label="Herramientas de edición">
                            <div role="group" aria-label="Historial">
                                <button type="button" onClick={deshacer} disabled={ocupado || !puedeDeshacer(historial)}>
                                    Deshacer    
                                </button>

                                <button type="button" onClick={rehacer} disabled={ocupado || !puedeRehacer(historial)}>
                                    Rehacer
                                </button>
                            </div>

                            <div role="group" aria-label="Selección">
                                <button type="button" onClick={seleccionarTodo} disabled={ocupado || frames.length === 0}>
                                    {todosMarcados ? 'Quitar selección' : 'Seleccionar todo'}
                                </button>

                                <button type="button" onClick={copiar} disabled={ocupado || clavesSeleccionadas.length === 0}>
                                    Copiar
                                </button>

                                <button
                                    type="button"
                                    onClick={() => pegarEn(posicionDespuesDeSeleccion())}
                                    disabled={ocupado || portapapeles.length === 0 || !checkEspacio(frames, portapapeles.length)}
                                >
                                    Pegar
                                </button>

                                <button
                                    type="button"
                                    onClick={() => insertarEn(posicionDespuesDeSeleccion())}
                                    disabled={ocupado || !hayEspacio}
                                >
                                    Frame en blanco
                                </button>

                                <button
                                    type="button"
                                    className="boton-peligro"
                                    onClick={eliminarSeleccion}
                                    disabled={ocupado || clavesSeleccionadas.length === 0}
                                >
                                    Eliminar
                                </button>
                            </div>

                            <div role="group" aria-label="Orden">
                                <button
                                type="button"
                                onClick={invertir}
                                disabled={ocupado || clavesObjetivo(frames, seleccionActiva).length < 2}
                            >
                                {textoInvertir}
                                </button>

                            <button
                                type="button"
                                onClick={() => mover(-1)}
                                disabled={ocupado || clavesSeleccionadas.length === 0}
                            >
                                Mover a la izquierda
                            </button>

                            <button
                                type="button"
                                onClick={() => mover(1)}
                                disabled={ocupado || clavesSeleccionadas.length === 0}
                            >
                                Mover a la derecha
                            </button>
                            </div>

                            <div role="group" aria-label="Duración">
                                <label htmlFor="duracion-global">Duración (ms)</label>
                                <input
                                    id="duracion-global"
                                    type="number"
                                    min={DURACION_MINIMA}
                                    max={DURACION_MAXIMA}
                                    step="1"
                                    value={duracionGlobal}
                                    disabled={ocupado}
                                    onChange={(e) => setDuracionGlobal(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') aplicarDuracionGlobal();
                                    }}
                                    />

                                    <button type="button" onClick={aplicarDuracionGlobal} disabled= {ocupado || frames.length === 0}>
                                        {textoDuracion}
                                    </button>
                            </div>

                            <div role="group" aria-label="Guardado">
                                <button
                                    type="button"
                                    className="boton-principal"
                                    onClick={guardar}
                                    disabled={ocupado || !sinGuardar}
                                    title="Al guardar se reinicia el historial de deshacer"
                                >
                                    {guardando ? 'Guardando...' : 'Guardar'}
                                </button>
                            </div>
                        </div>

                        <p>
                            {frames.length} de {MAX_FRAMES} frames - {clavesSeleccionadas.length} seleccionado(s) -{' '}
                            <span className={sinGuardar ? 'estado-sin-guardar' : 'estado-guardado'}>{sinGuardar ? 'Hay cambios sin guardar' : 'Todo guardado'}</span>
                        </p>

                        <ol aria-label="Frames del proyecto">
                            {frames.map((frame, i) => (
                            <HuecoYTarjeta
                                key={frame.clave}
                                posicion={i}
                                destino={destino}
                                deshabilitado={ocupado}
                                puedePegar={portapapeles.length > 0 && checkEspacio(frames, portapapeles.length)}
                                puedeInsertar={hayEspacio}
                                onInsertar={insertarEn}
                                onPegar={pegarEn}
                                onSobreHueco={arrastrarSobreHueco}
                                onSoltarEnHueco={soltarEn}
                            >
                                <TarjetaFrame
                                    frame={frame}
                                    indice={i}
                                    actual= {i === indiceSeguro}
                                    seleccionado={seleccionActiva.has(frame.clave)}
                                    deshabilitado={ocupado}
                                    proporcion={proporcion}
                                    onVer={() => irAFrame(i)}
                                    onSeleccionar={alternarSeleccion}
                                    onEliminar={eliminarUno}
                                    onCambiarDuracion={cambiarDuracionDeUno}
                                    onInicioArrastre={iniciarArrastre}
                                    onFinArrastre={terminarArrastre}
                                    onSobre={arrastrarSobreTarjeta}
                                    onSoltar={soltarEnTarjeta}
                                />
                            </HuecoYTarjeta>
                            ))}
                            <Hueco
                                posicion={frames.length}
                                destino={destino}
                                deshabilitado={ocupado}
                                puedePegar={portapapeles.length > 0 && checkEspacio(frames, portapapeles.length)}
                                puedeInsertar={hayEspacio}
                                onPegar={pegarEn}
                                onSobreHueco={arrastrarSobreHueco}
                                onSoltarEnHueco={soltarEn}
                                onInsertar={insertarEn}
                            />
                        </ol>
                        <p> 
                            Atajos: Ctrl+z deshacer, Ctrl+y rehacer, Ctrl+c copiar, Ctrl+v pegar, Ctrl+a seleccionar todo, Supr eliminar, Ctrl+s guardar, Shift + click seleccionar
                        </p>
                    </section>
                )}

                <section aria-labelledby="titulo-exportar">
                    <h2 id="titulo-exportar">Exportar</h2>
                    <button
                        type="button"
                        className="boton-principal"
                        onClick={() => exportar('gif')}
                        disabled={frames.length === 0|| ocupado}
                    >
                        {exportando === 'gif' ? 'Generando GIF...' : 'Exportar GIF'}
                    </button>
                    <button
                        type="button"
                        className="boton-principal"
                        onClick={() => exportar('mp4')}
                        disabled={frames.length === 0 || ocupado}
                    >
                        {exportando === 'mp4' ? 'Generando MP4...' : 'Exportar MP4'}
                    </button>
                    {sinGuardar && <p> Se exporta lo guardado; al exportar se te pedirá guardar los cambios.</p>}
                </section>
                </>
            )}
        </main>
    );
}


function Hueco({ posicion, destino, deshabilitado, puedePegar, puedeInsertar, onInsertar, onPegar, onSobreHueco, onSoltarEnHueco}) {
    return (
        <li
            className={`hueco${destino === posicion ? ' soltar-aqui': ''}`}
            onDragOver={(e) => onSobreHueco(e, posicion)}
            onDrop={(e) => onSoltarEnHueco(e, posicion)}
        >
            <div className="hueco-acciones">
                <button 
                    type="button"
                    tabIndex={-1}
                    disabled={deshabilitado || !puedeInsertar}
                    aria-label={`Insertar frame en blanco en la posición ${posicion + 1}`}
                    onClick={() => onInsertar(posicion)}
                >
                    Nuevo frame en blanco
                </button>
                <button
                    type="button"
                    tabIndex={-1}
                    disabled={deshabilitado || !puedePegar}
                    aria-label={`Pegar en la posición ${posicion + 1}`}
                    onClick={() => onPegar(posicion)}
                >
                    Pegar Aquí
                </button>
            </div>
        </li>
    );
}

function HuecoYTarjeta({ children, posicion, ...propsHueco}) {
    return (
        <>
        <Hueco posicion={posicion} {...propsHueco} />
        {children}
        </>
    );
}

export default VisualizacionFrames;