import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    obtenerProyecto,
    obtenerFrames,
    importarArchivo as importarArchivoAPI,
    crearFrameVacio as crearFrameVacioAPI,
    cambiarLienzo as cambiarLienzoAPI,
    exportar as exportarAPI,
    guardarFrames,
    obtenerMensajeError,
} from '../services/servicioAPI';
import {
    desdeServidor,
    framesLista,
    archivosDeFrames,
    hayCambios,
    remapearPortapapeles,
    moverFrames,
} from '../utils/operacionesFrames';
import {
    crearHistorial,
    registrarCambio,
    deshacer as deshacerPaso,
    rehacer as rehacerPaso,
    puedeDeshacer,
    puedeRehacer,
} from '../utils/historial';
import { pistasDesdeServidor, pistasLista, archivosDePistas, hayCambiosPistas } from '../utils/pistas';
import { MAX_FRAMES } from '../config/limites';
import { motivoRechazo } from '../utils/importarImagen';


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

// Datos de un proyecto y sus frames, con todo lo que habla con el servidor: cargar, guardar, importar un GIF
// y exportar. También guarda el historial de cambios (deshacer y rehacer) y el portapapeles de frames.
//
// Devuelve:
//   proyecto, frames (lista actual), guardado (lo último guardado), cargando, sinGuardar
//   subiendo, guardando, exportando ('' | 'gif' | 'mp4'), ocupado (alguno de los tres)
//   error, mensaje, avisar(texto) (error), informar(texto) (mensaje), limpiarMensajes()
//   aplicar(operacion): registra en el historial el resultado de operacion(frames)
//   deshacer(), rehacer(), puedeDeshacer, puedeRehacer   (devuelven true si hicieron algo)
//   portapapeles, setPortapapeles
//   guardar(), importarArchivo(archivo, modo, posicion), exportar(formato)
//   crearFrameVacio(ancho, alto)   en un proyecto sin frames: fija el lienzo y crea un frame en blanco
//   cambiarLienzo({ ancho, alto, anclaX, anclaY })   agrega espacio o recorta el lienzo de todos los frames
//   reinicios: número que sube cada vez que la lista se reemplaza por la del servidor (al cargar, guardar o importar)
function useProyectoFrames(id) {
    const [proyecto, setProyecto] = useState(null);
    const [guardado, setGuardado] = useState([]);
    const [pistasGuardadas, setPistasGuardadas] = useState([]);
    const [historial, setHistorial] = useState(() => crearHistorial({ frames: [], pistas: [] }));
    const [portapapeles, setPortapapeles] = useState([]);
    const [reinicios, setReinicios] = useState(0);
    const [cargando, setCargando] = useState(true);
    const [subiendo, setSubiendo] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [exportando, setExportando] = useState('');
    const [error, setError] = useState('');
    const [mensaje, setMensaje] = useState('');

    const { frames, pistas } = historial.presente;
    const sinGuardar = useMemo(
        () => hayCambios(frames, guardado) || hayCambiosPistas(pistas, pistasGuardadas),
        [frames, guardado, pistas, pistasGuardadas]
    );
    const ocupado = subiendo || guardando || exportando !== '';

    function limpiarMensajes() {
        setError('');
        setMensaje('');
    }

    // La lista que mandó el servidor pasa a ser la guardada, y el historial empieza de nuevo
        // Lo que mandó el servidor pasa a ser lo guardado, y el historial empieza de nuevo
    function reiniciar(framesServidor, pistasServidor) {
        const base = { frames: desdeServidor(framesServidor), pistas: pistasDesdeServidor(pistasServidor) };
        setGuardado(base.frames);
        setPistasGuardadas(base.pistas);
        setHistorial(crearHistorial(base));
        setReinicios((n) => n + 1);
        return base;
    }

    const cargar = useCallback(async () => {
        try {
            const [datosProyecto, guardados] = await Promise.all([obtenerProyecto(id), obtenerFrames(id)]);
            setProyecto(datosProyecto);
            const base = { frames: desdeServidor(guardados.frames), pistas: pistasDesdeServidor(guardados.pistas) };
            setGuardado(base.frames);
            setPistasGuardadas(base.pistas);
            setHistorial(crearHistorial(base));
            setReinicios((n) => n + 1);
        } catch (err) {
            setError(obtenerMensajeError(err));
        } finally {
            setCargando(false);
        }
    }, [id]);

    useEffect(() => {
        cargar();
    }, [cargar]);

    // Avisa al cerrar o recargar la pestaña si hay cambios sin guardar
    useEffect(() => {
        if (!sinGuardar) return undefined;
        function avisar(evento) {
            evento.preventDefault();
            evento.returnValue = '';
        }
        window.addEventListener('beforeunload', avisar);
        return () => window.removeEventListener('beforeunload', avisar);
    }, [sinGuardar]);

    function aplicar(operacion) {
        aplicarTodo((presente) => ({ ...presente, frames: operacion(presente.frames) }));
    }

    function aplicarTodo(operacion) {
        if (ocupado) return;
        limpiarMensajes();
        const presente = historial.presente;
        const nuevo = operacion(presente);
        // Si la operación no cambió nada, no se agrega un paso al historial
        if (nuevo.frames === presente.frames && nuevo.pistas === presente.pistas) return;
        setHistorial((h) => registrarCambio(h, nuevo));
    }

    function deshacer() {
        if (ocupado || !puedeDeshacer(historial)) return false;
        limpiarMensajes();
        setHistorial(deshacerPaso);
        return true;
    }

    function rehacer() {
        if (ocupado || !puedeRehacer(historial)) return false;
        limpiarMensajes();
        setHistorial(rehacerPaso);
        return true;
    }

    async function guardar() {
        if (ocupado) return false;
        if (!sinGuardar) return true;
        setGuardando(true);
        limpiarMensajes();
        try {
            const enviados = framesLista(frames);
            const archivos = [...archivosDeFrames(frames), ...archivosDePistas(pistas)];
            const recibidos = await guardarFrames(id, enviados, archivos, pistasLista(pistas));
            reiniciar(recibidos.frames, recibidos.pistas);
            setPortapapeles((actual) => remapearPortapapeles(actual, enviados, recibidos.frames));
            return true
        } catch (err) {
            if (err.response?.status === 400 && String(err.response.data?.error).includes('no pertenece')) {
                setError(`${obtenerMensajeError(err)} Si guardaste este proyecto en otra pestaña, recarga la página.`);
            } else {
                setError(obtenerMensajeError(err));
            }
            return false;
        } finally {
            setGuardando(false);
        }
    }

    // Importa un GIF o una imagen (RF3). modo 'agregar': los frames van al final, ajustados al lienzo; como el
    // servidor agrega sobre lo guardado, antes se guardan los cambios pendientes. Con "posicion", después se mueven
    // ahí (ese movimiento queda como un cambio sin guardar que se puede deshacer). modo 'reemplazar': pide
    // confirmación si ya había frames. Devuelve true si se importó.
    async function importarArchivo(archivo, modo = 'agregar', posicion = null) {
        if (ocupado) return false;
        limpiarMensajes();
        const motivo = motivoRechazo(archivo);
        if (motivo) {
            setError(motivo);
            return false;
        }
        const hayFrames = frames.length > 0 || guardado.length > 0;
        if (modo === 'reemplazar' && hayFrames) {
            const aviso = sinGuardar
                ? 'Reemplazar borra los frames y keyframes del proyecto y se perderán los cambios sin guardar. ¿Continuar?'
                : 'Reemplazar borra los frames y keyframes actuales de este proyecto. ¿Continuar?';
            if (!window.confirm(aviso)) return false;
        }
        if (modo === 'agregar' && sinGuardar) {
            if (!window.confirm('Tienes cambios sin guardar. Se guardarán antes de agregar el archivo. ¿Continuar?')) return false;
            if (!(await guardar())) return false;
        }
        if (modo === 'agregar' && frames.length >= MAX_FRAMES) {
            setError(`El proyecto ya tiene ${MAX_FRAMES} frames, el máximo permitido.`);
            return false;
        }

        setSubiendo(true);
        try {
            const respuesta = await importarArchivoAPI(id, archivo, modo);
            const base = reiniciar(respuesta.frames, respuesta.pistas);
            setProyecto((actual) => ({ ...actual, ancho: respuesta.ancho, alto: respuesta.alto }));
            // Los frames guardados cambian de id: lo copiado antes ya no se puede pegar
            setPortapapeles([]);
            const finalAnterior = base.frames.length - respuesta.agregados;
            if (respuesta.modo === 'agregar' && posicion !== null && posicion < finalAnterior) {
                // Los nuevos quedaron al final: se mueven a la posición pedida
                const nuevos = base.frames.slice(finalAnterior).map((f) => f.clave);
                setHistorial((h) => registrarCambio(h, { ...base, frames: moverFrames(base.frames, nuevos, posicion) }));
            }
            // Sin mensaje de éxito: los frames nuevos se ven en la lista
            return true;
        } catch (err) {
            setError(obtenerMensajeError(err));
            return false;
        } finally {
            setSubiendo(false);
        }
    }

    // Para lo que el servidor hace sobre lo guardado: si hay cambios, primero pide guardarlos
    async function guardarAntes(motivo) {
        if (!sinGuardar) return true;
        if (!window.confirm(`Tienes cambios sin guardar. Se guardarán antes de ${motivo}. ¿Continuar?`)) return false;
        return guardar();
    }

    // Respuesta del servidor que cambia el lienzo: la lista pasa a ser la guardada y el historial empieza de nuevo
    function recibirLienzo(respuesta) {
        reiniciar(respuesta.frames, respuesta.pistas);
        setProyecto((actual) => ({ ...actual, ancho: respuesta.ancho, alto: respuesta.alto }));
        setPortapapeles([]);
    }

    async function crearFrameVacio(ancho, alto) {
        if (ocupado) return false;
        limpiarMensajes();
        setSubiendo(true);
        try {
            recibirLienzo(await crearFrameVacioAPI(id, ancho, alto));
            return true;
        } catch (err) {
            setError(obtenerMensajeError(err));
            return false;
        } finally {
            setSubiendo(false);
        }
    }

    async function cambiarLienzo({ ancho, alto, anclaX, anclaY }) {
        if (ocupado) return false;
        limpiarMensajes();
        if (!(await guardarAntes('cambiar el tamaño del lienzo'))) return false;
        setSubiendo(true);
        try {
            recibirLienzo(await cambiarLienzoAPI(id, { ancho, alto, anclaX, anclaY }));
            return true;
        } catch (err) {
            setError(obtenerMensajeError(err));
            return false;
        } finally {
            setSubiendo(false);
        }
    }

    // Exporta lo guardado; si hay cambios, primero pide guardarlos
    async function exportar(formato) {
        if (ocupado) return;
        limpiarMensajes();
        if (sinGuardar) {
            if (!window.confirm('Tienes cambios sin guardar. Se guardarán antes de exportar. ¿Continuar?')) return;
            if (!(await guardar())) return;
        }
        setExportando(formato);
        try {
            descargarBlob(await exportarAPI(id, formato), `proyecto-${id}.${formato}`);
        } catch (err) {
            setError(obtenerMensajeError(err));
        } finally {
            setExportando('');
        }
    }

    return {
        proyecto,
        frames,
        pistas,
        guardado,
        cargando,
        sinGuardar,
        subiendo,
        guardando,
        exportando,
        ocupado,
        error,
        mensaje,
        avisar: setError,
        informar: setMensaje,
        limpiarMensajes,
        aplicar,
        aplicarTodo,
        deshacer,
        rehacer,
        puedeDeshacer: puedeDeshacer(historial),
        puedeRehacer: puedeRehacer(historial),
        portapapeles,
        setPortapapeles,
        guardar,
        importarArchivo,
        crearFrameVacio,
        cambiarLienzo,
        exportar,
        reinicios,
    };
}

export default useProyectoFrames;