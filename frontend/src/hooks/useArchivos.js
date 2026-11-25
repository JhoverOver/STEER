import { useCallback, useEffect, useRef, useState } from 'react';
import { listarArchivos, guardarArchivo, eliminarArchivo } from '../utils/archivos';
import { motivoRechazo } from '../utils/importarImagen';
import { aBlob, crearCanvas } from '../utils/imagenes';

export const MAX_ARCHIVOS = 30; // por proyecto
const LADO_MINIATURA = 96; // px

// Primer frame del archivo, achicado, para mostrarlo en la lista. null si el navegador no puede leerlo
async function crearMiniatura(subido) {
    try {
        const imagen = await createImageBitmap(subido);
        const escala = Math.min(1, LADO_MINIATURA / Math.max(imagen.width, imagen.height));
        const canvas = crearCanvas(Math.max(1, Math.round(imagen.width * escala)), Math.max(1, Math.round(imagen.height * escala)));
        canvas.getContext('2d').drawImage(imagen, 0, 0, canvas.width, canvas.height);
        if (imagen.close) imagen.close();
        return await aBlob(canvas, 'image/webp', 0.8);
    } catch {
        return null;
    }
}

// Los archivos de un proyecto (utils/archivos.js), listos para mostrar: cada uno trae "url", la dirección de
// su miniatura (o del archivo si no tiene), que se libera al cambiar la lista o al salir.
//
// Devuelve { lista, cargando, agregando, error, agregar(subidos), eliminar(id), aFile(archivo), porId(id) }
function useArchivos(proyectoId) {
    const [lista, setLista] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [agregando, setAgregando] = useState(false);
    const [error, setError] = useState('');
    const urls = useRef([]);

    const mostrar = useCallback((archivos) => {
        urls.current.forEach((url) => URL.revokeObjectURL(url));
        const conUrl = archivos.map((a) => ({ ...a, url: URL.createObjectURL(a.miniatura || a.contenido) }));
        urls.current = conUrl.map((a) => a.url);
        setLista(conUrl);
    }, []);

    const recargar = useCallback(async () => {
        try {
            mostrar(await listarArchivos(proyectoId));
        } catch (err) {
            setError(err.message || 'No se pudieron leer los archivos.');
        } finally {
            setCargando(false);
        }
    }, [proyectoId, mostrar]);

    useEffect(() => {
        recargar();
    }, [recargar]);

    useEffect(() => () => urls.current.forEach((url) => URL.revokeObjectURL(url)), []);

    // Guarda uno o varios archivos subidos. Los que no sirven se saltan y se explica por qué
    async function agregar(subidos) {
        const nuevos = Array.from(subidos || []);
        if (nuevos.length === 0) return 0;
        setError('');
        const problemas = [];
        let espacio = MAX_ARCHIVOS - lista.length;
        let agregados = 0;
        setAgregando(true);
        try {
            for (const subido of nuevos) {
                const motivo = motivoRechazo(subido);
                if (motivo) {
                    problemas.push(motivo);
                } else if (espacio <= 0) {
                    problemas.push(`Máximo ${MAX_ARCHIVOS} archivos por proyecto.`);
                    break;
                } else {
                    await guardarArchivo(proyectoId, subido, await crearMiniatura(subido));
                    espacio -= 1;
                    agregados += 1;
                }
            }
        } catch (err) {
            problemas.push(err.message || 'No se pudo guardar el archivo.');
        } finally {
            setAgregando(false);
        }
        if (problemas.length > 0) setError(problemas.join(' '));
        if (agregados > 0) await recargar();
        return agregados;
    }

    async function eliminar(id) {
        setError('');
        try {
            await eliminarArchivo(id);
            await recargar();
        } catch (err) {
            setError(err.message || 'No se pudo quitar el archivo.');
        }
    }

    // El archivo guardado como File, con su nombre, listo para subirlo al proyecto
    function aFile(archivo) {
        return new File([archivo.contenido], archivo.nombre, { type: archivo.tipo });
    }

    function porId(id) {
        return lista.find((a) => a.id === id) || null;
    }

    return { lista, cargando, agregando, error, agregar, eliminar, aFile, porId };
}

export default useArchivos;
