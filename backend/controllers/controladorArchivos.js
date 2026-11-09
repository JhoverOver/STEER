const crudProyecto =require('../models/crudProyecto');
const procesadorFrames = require('../services/procesadorFrames');
const sharp = require('sharp');
const crudCapas = require('../models/crudCapas');

const {
    MAX_FRAMES,
    DURACION_MINIMA,
    DURACION_MAXIMA,
    MAXIMO_NOMBRE_CAPA,
} = require('../config/limites');

function esGIF(buffer) {
    return buffer.length >= 6 && buffer.subarray(0, 4).toString('ascii') === 'GIF8';
}

function nombreSeguro(nombre) {
    return (nombre || 'proyecto').replace(/[^a-zA-Z0-9-_]+/g, '_');
}

function frameCliente(frame) {
    return {
        id: frame.id,
        orden: frame.orden,
        duracion: frame.duracion,
        imagen: `data:image/png;base64,${frame.imagen_data.toString('base64')}`,
    };
}

// Regenera la miniatura del proyecto a partir de su primer frame.
// Un fallo aquí nunca debe romper la petición principal.
async function actualizarMiniatura(id) {
    try {
        const primero = await crudProyecto.obtenerPrimerFrame(id);
        if (!primero) return;
        const miniatura = await procesadorFrames.generarMiniatura(primero.imagen_data);
        await crudProyecto.guardarMiniatura(id, miniatura);
    } catch (error) {
        console.error('No se pudo generar la miniatura del proyecto', id, error.message);
    }
}

// Importa un GIF: valida, descompone, guarda y responde.
async function importar(req, res, { validarArchivo, descomponer, mensajeError }) {
    const { id } = req.params;
    const usuario_id = req.usuario_id;

    if (!req.file) {
        return res.status(400).json({ error: 'No se proporcionó ningún archivo' });
    }
    const errorArchivo = validarArchivo(req);
    if (errorArchivo) {
        return res.status(400).json({ error: errorArchivo });
    }

    try {
        const proyecto = await crudProyecto.obtenerProyecto(id, usuario_id);
        if (!proyecto) {
            return res.status(404).json({ error: 'Proyecto no encontrado' });
        }

        let resultado;
        try {
            resultado = await descomponer(req);
        } catch (error) {
            if(error.codigo === 'LIENZO_EXECEDIDO') {
                return res.status(400).json({error: error.message})
            }
            console.error(mensajeError, error);
            return res.status(400).json({ error: mensajeError });
        }

        const { frames } = resultado;
        if (frames.length > MAX_FRAMES) {
            return res.status(400).json({ error: `El archivo tiene demasiados frames. Máximo permitido: ${MAX_FRAMES}` });
        }

        await crudProyecto.guardarFrames(id, frames);
        
        const { width, height } = await sharp(frames[0].imagen_data).metadata();
        await crudProyecto.guardarTamanoLienzo(id,width, height);
        await actualizarMiniatura(id);
        const guardados = await crudProyecto.obtenerFrames(id);
        return res.status(201).json({ frames: guardados.map(frameCliente) });
    } catch (error) {
        console.error('Error al importar:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
}

function subirGIF(req, res) {
    return importar(req, res, {
        validarArchivo: (r) => (esGIF(r.file.buffer) ? null : 'El archivo proporcionado no es un GIF válido'),
        descomponer: async (r) => ({ frames: await procesadorFrames.descomponerGIF(r.file.buffer) }),
        mensajeError: 'Error al procesar el GIF',
    });
}

async function obtenerFrames(req, res) {
    const { id } = req.params;
    const usuario_id = req.usuario_id;

    try {
        const proyecto = await crudProyecto.obtenerProyecto(id, usuario_id);
        if (!proyecto) {
            return res.status(404).json({ error: 'Proyecto no encontrado' });
        }
        const frames = await crudProyecto.obtenerFrames(id);
        return res.status(200).json({ frames: frames.map(frameCliente) });
    } catch (error) {
        console.error('Error en obtenerFrames:', error);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
}

//lista tipo JSON de frames: { frames: [ { duracion, origen_id?, vacio?, capas? } ] }
function leerLista(req) {
    const cuerpo = req.body || {};
    if (typeof cuerpo.lista === 'string') {
        try {
            return JSON.parse(cuerpo.lista);
        } catch {
            return null;
        }
    }
    return cuerpo.frames;
}

// Valida las capas de un solo frame: forma, nombre y banderas. Devuelve { capas } o { error }.
function validarCapas(capas, numero, tieneOrigen) {
    if (!Array.isArray(capas) || capas.length < 1 || capas.length > MAX_CAPAS) {
        return { error: `El frame ${numero} debe tener entre 1 y ${MAX_CAPAS} capas.` };
    }
    const limpias = [];
    for (let j = 0; j < capas.length; j++) {
        const capa = capas[j];
        const etiqueta = `La capa ${j + 1} del frame ${numero}`;
        if (!capa || typeof capa !== 'object') {
            return { error: `${etiqueta} no es válida.` };
        }
        const nombre = typeof capa.nombre === 'string' ? capa.nombre.trim() : '';
        if (!nombre || nombre.length > MAXIMO_NOMBRE_CAPA) {
            return { error: `${etiqueta} debe tener un nombre de 1 a ${MAXIMO_NOMBRE_CAPA} caracteres.` };
        }
        if (typeof capa.visible !== 'boolean' || typeof capa.bloqueada !== 'boolean') {
            return { error: `${etiqueta} debe indicar si está visible y si está bloqueada.` };
        }
        const tieneId = capa.id !== undefined;
        const tieneArchivo = capa.archivo !== undefined;
        if (tieneId === tieneArchivo) {
            return { error: `${etiqueta} debe indicar "id" o "archivo".` };
        }
        // Una capa con "id" es una capa ya guardada: solo existe si el frame viene de otro frame guardado
        if (tieneId && (!Number.isInteger(capa.id) || !tieneOrigen)) {
            return { error: `El "id" de ${etiqueta.toLowerCase()} no es válido.` };
        }
        if (tieneArchivo && (typeof capa.archivo !== 'string' || !capa.archivo)) {
            return { error: `El "archivo" de ${etiqueta.toLowerCase()} no es válido.` };
        }
        limpias.push(tieneId
            ? { nombre, visible: capa.visible, bloqueada: capa.bloqueada, id: capa.id }
            : { nombre, visible: capa.visible, bloqueada: capa.bloqueada, archivo: capa.archivo });
    }
    return { capas: limpias };
}

// Valida el tipo de valor de la lista de frames, la cantidad y cada frame: duración, origen/vacío y capas. Devuelve { lista } o { error }.
function validarListaFrames(crudo) {
    if (!Array.isArray(crudo)) {
        return { error: 'Debes enviar la lista de frames.' };
    }
    if (crudo.length > MAX_FRAMES) {
        return { error: `La lista tiene ${crudo.length} frames y el máximo permitido es ${MAX_FRAMES}` };
    }

    const limpia = [];
    for (let i = 0; i < crudo.length; i++) {
        const frame = crudo[i];
        const numero = i + 1;
        if (!frame || typeof frame !== 'object') {
            return { error: `El frame ${numero} no es válido.` };
        }
        const { duracion, origen_id, capas } = frame;
        if (!Number.isInteger(duracion) || duracion < DURACION_MINIMA || duracion > DURACION_MAXIMA) {
            return {
                error: `La duración del frame ${numero} debe ser un número entero entre ${DURACION_MINIMA} y ${DURACION_MAXIMA} ms.`,
            };
        }

        const tieneOrigen = origen_id !== undefined;
        const esVacio = frame.vacio === true;
        if (tieneOrigen && !Number.isInteger(origen_id)) {
            return { error: `El "origen_id" del frame ${numero} no es válido.` };
        }

        if (capas !== undefined) {
            // Frame editado: trae sus capas
            if (esVacio) {
                return { error: `El frame ${numero} no puede ser vacío y traer capas a la vez.` };
            }
            const resultado = validarCapas(capas, numero, tieneOrigen);
            if (resultado.error) return resultado;
            limpia.push(tieneOrigen
                ? { origen_id, duracion, capas: resultado.capas }
                : { duracion, capas: resultado.capas });
        } else {
            if (tieneOrigen === esVacio) {
                return { error: `El frame ${numero} debe indicar "origen_id" o "vacio".` };
            }
            limpia.push(tieneOrigen ? { origen_id, duracion } : { vacio: true, duracion });
        }
    }
    return { lista: limpia };
}

// Convierte la lista validada en los frames que se guardan: busca la imagen de cada capa y compone la imagen final de cada frame. Devuelve { nuevos } o { error }.
// Devuelve { nuevos } o { error }.
async function armarFrames(lista, proyecto, archivos, idsDelProyecto) {
    const { ancho, alto } = proyecto;
    const necesitaLienzo = lista.some((frame) => frame.vacio || frame.capas);
    if (necesitaLienzo && !(ancho && alto)) {
        return { error: 'No se puede crear ni editar un frame en un proyecto sin frames. Importa un GIF primero.' };
    }

    const nuevos = [];
    let blanco = null;
    for (let i = 0; i < lista.length; i++) {
        const frame = lista[i];
        const numero = i + 1;

        if (frame.origen_id !== undefined && !idsDelProyecto.has(frame.origen_id)) {
            return { error: 'La lista incluye un frame que no pertenece a este proyecto.' };
        }

        if (frame.vacio) {
            blanco = blanco || await procesadorFrames.crearFrameVacio(ancho, alto);
            nuevos.push({ imagen_data: blanco, duracion: frame.duracion });
        } else if (!frame.capas) {
            nuevos.push({ origen_id: frame.origen_id, duracion: frame.duracion });
        } else {
            // Capas ya guardadas de ESE frame (solo se piden si alguna capa las usa)
            const usaGuardadas = frame.capas.some((capa) => capa.id !== undefined);
            const guardadas = new Map();
            if (usaGuardadas) {
                (await crudCapas.obtenerCapas(frame.origen_id)).forEach((capa) => guardadas.set(capa.id, capa));
            }

            const capas = [];
            for (let j = 0; j < frame.capas.length; j++) {
                const capa = frame.capas[j];
                const etiqueta = `La capa ${j + 1} del frame ${numero}`;
                let imagen_data;
                if (capa.id !== undefined) {
                    const guardada = guardadas.get(capa.id);
                    if (!guardada) {
                        return { error: `${etiqueta} no pertenece a su frame de origen.` };
                    }
                    imagen_data = guardada.imagen_data;
                } else {
                    imagen_data = archivos.get(capa.archivo);
                    if (!imagen_data) {
                        return { error: `Falta el archivo de ${etiqueta.toLowerCase()}.` };
                    }
                    if (!(await procesadorFrames.validarCapaPNG(imagen_data, ancho, alto))) {
                        return { error: `${etiqueta} debe ser un PNG de ${ancho} × ${alto} px.` };
                    }
                }
                capas.push({ nombre: capa.nombre, visible: capa.visible, bloqueada: capa.bloqueada, imagen_data });
            }
            const compuesta = await procesadorFrames.componerCapas(capas, ancho, alto);
            nuevos.push({ imagen_data: compuesta, duracion: frame.duracion, capas });
        }
    }
    return { nuevos };
}

// Guardado de los frames del proyecto
async function actualizarFrames(req, res) {
    const { id } = req.params;
    const usuario_id = req.usuario_id;

    const { lista, error } = validarListaFrames(leerLista(req));
    if (error) {
        return res.status(400).json({ error });
    }

    try {
        const proyecto = await crudProyecto.obtenerProyecto(id, usuario_id);
        if (!proyecto) {
            return res.status(404).json({ error: 'Proyecto no encontrado.' });
        }

        // Los PNG subidos, por el nombre del campo con que llegó cada uno
        const archivos = new Map((req.files || []).map((archivo) => [archivo.fieldname, archivo.buffer]));
        const idsDelProyecto = new Set(await crudProyecto.obtenerIdsFrames(id));

        const armado = await armarFrames(lista, proyecto, archivos, idsDelProyecto);
        if (armado.error) {
            return res.status(400).json({ error: armado.error });
        }

        try {
            await crudProyecto.reemplazarFrames(id, armado.nuevos);
        } catch (errorGuardado) {
            if (errorGuardado.codigo === 'ORIGEN_INVALIDO') {
                return res.status(400).json({ error: 'La lista incluye un frame que no pertenece a este proyecto.' });
            }
            throw errorGuardado;
        }
        await actualizarMiniatura(id);
        const guardados = await crudProyecto.obtenerFrames(id);
        return res.status(200).json({ frames: guardados.map(frameCliente) });
    } catch (errorInterno) {
        console.error('Error en actualizarFrames:', errorInterno);
        return res.status(500).json({ error: 'Error interno al guardar los frames' });
    }
}

async function exportar(req, res, construir, tipoMime, extension) {
    const { id } = req.params;
    const usuario_id = req.usuario_id;

    try {
        const proyecto = await crudProyecto.obtenerProyecto(id, usuario_id);
        if (!proyecto) {
            return res.status(404).json({ error: 'Proyecto no encontrado' });
        }
        const frames = await crudProyecto.obtenerFrames(id);
        if (!frames.length) {
            return res.status(400).json({ error: 'No hay frames para exportar' });
        }

        const archivo = await construir(frames);
        res.set({
            'Content-Type': tipoMime,
            'Content-Disposition': `attachment; filename="${nombreSeguro(proyecto.nombre)}.${extension}"`,
        });
        return res.status(200).send(archivo);
    } catch (error) {
        console.error('Error en exportar:', error);
        return res.status(500).json({ error: `Error interno del servidor al exportar ${extension.toUpperCase()}` });
    }
}

function exportarGIF(req, res) {
    return exportar(req, res, procesadorFrames.reconstruirGIF, 'image/gif', 'gif');
}

function exportarMP4(req, res) {
    return exportar(req, res, procesadorFrames.reconstruirVideo, 'video/mp4', 'mp4');
}

module.exports = {
    subirGIF,
    obtenerFrames,
    exportarGIF,
    exportarMP4,
    actualizarFrames,
    leerLista,
    validarListaFrames,
    armarFrames,
    validarCapas,
};

