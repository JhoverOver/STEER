import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    obtenerProyecto,
    obtenerFrames,
    subirGIF,
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
} from '../utils/operacionesFrames';
import {
    crearHistorial,
    registrarCambio,
    deshacer as deshacerPaso,
    rehacer as rehacerPaso,
    puedeDeshacer,
    puedeRehacer,
} from '../utils/historial';
import { MAX_MB } from '../config/limites';

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
//   guardar(), importarGIF(archivo), exportar(formato)
//   reinicios: número que sube cada vez que la lista se reemplaza por la del servidor (al cargar, guardar o importar)
function useProyectoFrames(id) {
    const [proyecto, setProyecto] = useState(null);
    const [guardado, setGuardado] = useState([]);
    const [historial, setHistorial] = useState(() => crearHistorial([]));
    const [portapapeles, setPortapapeles] = useState([]);
    const [reinicios, setReinicios] = useState(0);
    const [cargando, setCargando] = useState(true);
    const [subiendo, setSubiendo] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [exportando, setExportando] = useState('');
    const [error, setError] = useState('');
    const [mensaje, setMensaje] = useState('');

    const frames = historial.presente;
    const sinGuardar = useMemo(() => hayCambios(frames, guardado), [frames, guardado]);
    const ocupado = subiendo || guardando || exportando !== '';

    function limpiarMensajes() {
        setError('');
        setMensaje('');
    }

    // La lista que mandó el servidor pasa a ser la guardada, y el historial empieza de nuevo
    function reiniciar(listaServidor) {
        const base = desdeServidor(listaServidor);
        setGuardado(base);
        setHistorial(crearHistorial(base));
        setReinicios((n) => n + 1);
    }

    const cargar = useCallback(async () => {
        try {
            const [datosProyecto, listaFrames] = await Promise.all([obtenerProyecto(id), obtenerFrames(id)]);
            setProyecto(datosProyecto);
            const base = desdeServidor(listaFrames);
            setGuardado(base);
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
        if (ocupado) return;
        limpiarMensajes();
        const nueva = operacion(frames);
        setHistorial((h) => registrarCambio(h, nueva));
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
            const recibidos = await guardarFrames(id, enviados, archivosDeFrames(frames));
            reiniciar(recibidos);
            setPortapapeles((actual) => remapearPortapapeles(actual, enviados, recibidos));
            setMensaje('Cambios guardados.');
            return true;
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

    // Reemplaza los frames del proyecto por los del GIF (pide confirmación si ya había frames)
    async function importarGIF(archivo) {
        limpiarMensajes();
        if (archivo.type !== 'image/gif') {
            setError('Solo se permiten archivos GIF.');
            return false;
        }
        if (archivo.size > MAX_MB * 1024 * 1024) {
            setError(`El archivo supera el máximo de ${MAX_MB} MB.`);
            return false;
        }
        if (frames.length > 0 || guardado.length > 0) {
            const aviso = sinGuardar
                ? 'Subir un GIF reemplaza los frames del proyecto y se perderán los cambios sin guardar. ¿Continuar?'
                : 'Subir un GIF reemplaza los frames actuales de este proyecto. ¿Continuar?';
            if (!window.confirm(aviso)) return false;
        }

        setSubiendo(true);
        try {
            const { frames: nuevos, ancho, alto } = await subirGIF(id, archivo);
            reiniciar(nuevos);
            setProyecto((actual) => ({ ...actual, ancho, alto }));
            setPortapapeles([]);
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
        deshacer,
        rehacer,
        puedeDeshacer: puedeDeshacer(historial),
        puedeRehacer: puedeRehacer(historial),
        portapapeles,
        setPortapapeles,
        guardar,
        importarGIF,
        exportar,
        reinicios,
    };
}

export default useProyectoFrames;