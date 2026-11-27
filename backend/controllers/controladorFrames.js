const crudProyecto = require('../models/crudProyecto');
const crudCapas = require('../models/crudCapas');
const procesadorFrames = require('../services/procesadorFrames');
const { errorHttp } = require('../middleware/errores');
const { leerLista, validarListaFrames } = require('../utils/validarFrames');
const {
    FACTOR_AREA_TRABAJO, MAX_FRAMES, LADO_MAXIMO, LADO_MINIMO, DURACION_INICIAL,
} = require('../config/limites');
const { moverForma } = require('../utils/validarForma');
const { moverAnimacion } = require('../utils/validarAnimacion');

// Frames del proyecto: importar un GIF, leerlos, guardarlos, leer las capas de uno y exportar.
// El proyecto ya viene revisado en req.proyecto (middleware/cargarProyecto.js).

function nombreSeguro(nombre) {
    return (nombre || 'proyecto').replace(/[^a-zA-Z0-9-_]+/g, '_');
}

function aImagenCliente(buffer) {
    return `data:image/png;base64,${buffer.toString('base64')}`;
}

function frameCliente(frame) {
    return { id: frame.id, orden: frame.orden, duracion: frame.duracion, imagen: aImagenCliente(frame.imagen_data) };
}

function capaCliente(capa) {
    const { id, nombre, orden, visible, bloqueada, forma, animacion } = capa;
    const cliente = { id, nombre, orden, visible, bloqueada, forma: forma || null, imagen: aImagenCliente(capa.imagen_data) };
    if (animacion) {
        cliente.animacion = animacion;
        if (capa.original_data) cliente.original = aImagenCliente(capa.original_data);
    }
    return cliente;
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

// Responde la lista de frames tal como quedó guardada
async function responderFrames(res, estado, id, extra = {}) {
    const frames = await crudProyecto.obtenerFrames(id);
    return res.status(estado).json({ frames: frames.map(frameCliente), ...extra });
}

// POST /:id/importar: importa un GIF, PNG, JPG o WEBP como frames (RF3, RF14).
// Campo "modo":
//   "agregar" (por defecto)  los frames nuevos van al final y se ajustan al lienzo del proyecto
//   "reemplazar"             los frames y el tamaño del lienzo pasan a ser los del archivo
// Un proyecto sin frames siempre toma el tamaño del archivo.
async function importarArchivo(req, res) {
    if (!req.file) throw errorHttp(400, 'No se proporcionó ningún archivo');
    const modo = req.body?.modo === 'reemplazar' ? 'reemplazar' : 'agregar';
    const { id, ancho, alto } = req.proyecto;

    const existentes = modo === 'agregar' ? await crudProyecto.obtenerListaFrames(id) : [];
    const agrega = existentes.length > 0 && Boolean(ancho && alto);
    const lienzo = agrega ? { ancho, alto } : null;
    const descompuesto = await procesadorFrames.descomponerArchivo(req.file.buffer, lienzo);

    if (agrega) {
        const total = existentes.length + descompuesto.frames.length;
        if (total > MAX_FRAMES) {
            throw errorHttp(400, `El proyecto tiene ${existentes.length} frames y el archivo trae ${descompuesto.frames.length}: `
                + `juntos superan el máximo de ${MAX_FRAMES}.`);
        }
        // Los frames que ya estaban se conservan como copias (con sus capas)
        const conservados = existentes.map((frame) => ({ origen_id: frame.id, duracion: frame.duracion }));
        await crudProyecto.reemplazarFrames(id, [...conservados, ...descompuesto.frames]);
    } else {
        await crudProyecto.reemplazarFrames(id, descompuesto.frames, { ancho: descompuesto.ancho, alto: descompuesto.alto });
    }
    await actualizarMiniatura(id);
    const final = agrega ? { ancho, alto } : { ancho: descompuesto.ancho, alto: descompuesto.alto };
    return responderFrames(res, 201, id, { ...final, agregados: descompuesto.frames.length, modo: agrega ? 'agregar' : 'reemplazar' });
}

// GET /:id/frames
async function obtenerFrames(req, res) {
    return responderFrames(res, 200, req.proyecto.id);
}

// El PNG subido en el campo "campo", revisado: del tamaño del lienzo o de la zona de trabajo
async function pngDeCapa(archivos, campo, etiqueta, ancho, alto) {
    const imagen = archivos.get(campo);
    if (!imagen) throw errorHttp(400, `Falta el archivo de ${etiqueta.toLowerCase()}.`);
    if (!(await procesadorFrames.validarCapaPNG(imagen, ancho, alto))) {
        throw errorHttp(400, `${etiqueta} debe ser un PNG de ${ancho} × ${alto} px (o de ${ancho * FACTOR_AREA_TRABAJO} × ${alto * FACTOR_AREA_TRABAJO} px si guarda contenido fuera del lienzo).`);
    }
    return imagen;
}

// Convierte la lista validada en los frames que se guardan: busca la imagen de cada capa y compone la imagen
// final de cada frame. Si algo no calza, lanza un error 400.
async function armarFrames(lista, proyecto, archivos) {
    const { ancho, alto } = proyecto;
    const necesitaLienzo = lista.some((frame) => frame.vacio || frame.capas);
    if (necesitaLienzo && !(ancho && alto)) {
        throw errorHttp(400, 'No se puede crear ni editar un frame en un proyecto sin frames. Importa un GIF primero.');
    }

    const nuevos = [];
    let blanco = null;
    for (let i = 0; i < lista.length; i++) {
        const frame = lista[i];
        const numero = i + 1;

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
                (await crudCapas.obtenerCapasDelProyecto(frame.origen_id, proyecto.id)).forEach((capa) => guardadas.set(capa.id, capa));
            }

            const capas = [];
            for (let j = 0; j < frame.capas.length; j++) {
                const capa = frame.capas[j];
                const etiqueta = `La capa ${j + 1} del frame ${numero}`;
                let imagen_data;
                let forma = capa.forma === undefined ? null : capa.forma;
                let animacion = capa.animacion === undefined ? null : capa.animacion;
                let original_data = null;
                if (capa.id !== undefined) {
                    const guardada = guardadas.get(capa.id);
                    if (!guardada) {
                        throw errorHttp(400, `${etiqueta} no pertenece a su frame de origen.`);
                    }
                    imagen_data = guardada.imagen_data;
                    // Lo que no viene, no cambió: se conserva lo guardado
                    if (capa.forma === undefined) forma = guardada.forma;
                    if (capa.animacion === undefined) animacion = guardada.animacion;
                    original_data = guardada.original_data;
                } else {
                    imagen_data = await pngDeCapa(archivos, capa.archivo, etiqueta, ancho, alto);
                }
                if (capa.original !== undefined) {
                    original_data = await pngDeCapa(archivos, capa.original, `El dibujo sin animar de ${etiqueta.toLowerCase()}`, ancho, alto);
                } else if (capa.originalDe !== undefined) {
                    original_data = await crudCapas.obtenerOriginal(capa.originalDe, proyecto.id);
                    if (!original_data) throw errorHttp(400, `${etiqueta} indica un dibujo sin animar que no existe.`);
                }
                if (!animacion) original_data = null;
                capas.push({ nombre: capa.nombre, visible: capa.visible, bloqueada: capa.bloqueada, imagen_data, forma, animacion, original_data });
            }
            const compuesta = await procesadorFrames.componerCapas(capas, ancho, alto);
            nuevos.push({ imagen_data: compuesta, duracion: frame.duracion, capas });
        }
    }
    return nuevos;
}

// PUT /:id/frames: guarda la lista completa de frames (orden, duraciones, copias, nuevos y editados)
async function guardarFrames(req, res) {
    const { lista, error } = validarListaFrames(leerLista(req));
    if (error) throw errorHttp(400, error);

    const { proyecto } = req;
    // Los PNG subidos, por el nombre del campo con que llegó cada uno
    const archivos = new Map((req.files || []).map((archivo) => [archivo.fieldname, archivo.buffer]));
    // Las copias se revisan dentro de reemplazarFrames y las capas guardadas con obtenerCapasDelProyecto:
    // un frame o una capa de otro proyecto nunca se puede usar
    const nuevos = await armarFrames(lista, proyecto, archivos);
    await crudProyecto.reemplazarFrames(proyecto.id, nuevos);
    await actualizarMiniatura(proyecto.id);
    return responderFrames(res, 200, proyecto.id);
}

// Revisa el tamaño de lienzo pedido. Devuelve { lienzo } o { error }
function leerLienzo(cuerpo = {}) {
    const ancho = Number(cuerpo.ancho);
    const alto = Number(cuerpo.alto);
    const valido = (lado) => Number.isInteger(lado) && lado >= LADO_MINIMO && lado <= LADO_MAXIMO;
    if (!valido(ancho) || !valido(alto)) {
        return { error: `El ancho y el alto del lienzo deben ser números enteros entre ${LADO_MINIMO} y ${LADO_MAXIMO} px.` };
    }
    return { lienzo: { ancho, alto } };
}

// POST /:id/frames/vacio: en un proyecto sin frames, fija el tamaño del lienzo y crea un frame en blanco
async function crearFrameVacio(req, res) {
    const { lienzo, error } = leerLienzo(req.body);
    if (error) throw errorHttp(400, error);
    const { id } = req.proyecto;
    if ((await crudProyecto.obtenerListaFrames(id)).length > 0) {
        throw errorHttp(409, 'El proyecto ya tiene frames: el frame en blanco se agrega desde la lista.');
    }
    const vacio = await procesadorFrames.crearFrameVacio(lienzo.ancho, lienzo.alto);
    await crudProyecto.reemplazarFrames(id, [{ imagen_data: vacio, duracion: DURACION_INICIAL }], lienzo);
    await actualizarMiniatura(id);
    return responderFrames(res, 201, id, lienzo);
}

// Anclas del cambio de tamaño del lienzo: dónde queda el dibujo actual dentro del lienzo nuevo (0 = izquierda o
// arriba, 0.5 = centro, 1 = derecha o abajo). Para agregar espacio arriba, el ancla va abajo
const ANCLAS = [0, 0.5, 1];

// PUT /:id/lienzo: cambia el tamaño del lienzo sin escalar el dibujo (agrega espacio o recorta).
// Cuerpo: { ancho, alto, anclaX, anclaY }. Se aplica a las capas de todos los frames (también a su dibujo sin animar)
async function cambiarLienzo(req, res) {
    const { lienzo, error } = leerLienzo(req.body);
    if (error) throw errorHttp(400, error);
    const anclaX = Number(req.body.anclaX ?? 0.5);
    const anclaY = Number(req.body.anclaY ?? 0.5);
    if (!ANCLAS.includes(anclaX) || !ANCLAS.includes(anclaY)) throw errorHttp(400, 'El ancla debe ser 0, 0.5 o 1.');
    const { id, ancho, alto } = req.proyecto;
    if (!(ancho && alto)) throw errorHttp(400, 'El proyecto todavía no tiene lienzo: importa un archivo o crea un frame en blanco.');
    if (lienzo.ancho === ancho && lienzo.alto === alto) throw errorHttp(400, 'El lienzo ya tiene ese tamaño.');

    const anterior = { ancho, alto };
    const dx = Math.round((lienzo.ancho - ancho) * anclaX);
    const dy = Math.round((lienzo.alto - alto) * anclaY);
    await crudProyecto.cambiarLienzo(
        id,
        lienzo,
        (imagen) => procesadorFrames.reubicarImagen(imagen, anterior, lienzo, dx, dy),
        (capas) => procesadorFrames.componerCapas(capas, lienzo.ancho, lienzo.alto),
        // Las formas (texto o rectángulo) y las animaciones se mueven igual que el dibujo
        { forma: (forma) => moverForma(forma, dx, dy), animacion: (animacion) => moverAnimacion(animacion, dx, dy) }
    );
    await actualizarMiniatura(id);
    return responderFrames(res, 200, id, lienzo);
}

// GET /:id/frames/:frameId/capas: capas de un frame guardado, para abrirlo en el editor
async function obtenerCapas(req, res) {
    const frameId = Number(req.params.frameId);
    if (!Number.isInteger(frameId)) throw errorHttp(400, 'Identificador no válido');
    // Solo devuelve capas si el frame es de ESTE proyecto: si no, se podrían leer capas de otro usuario
    const capas = await crudCapas.obtenerCapasDelProyecto(frameId, req.proyecto.id);
    if (!capas.length) throw errorHttp(404, 'Frame no encontrado');
    return res.status(200).json({ capas: capas.map(capaCliente) });
}

async function exportar(req, res, construir, tipoMime, extension) {
    const frames = await crudProyecto.obtenerFrames(req.proyecto.id);
    if (!frames.length) throw errorHttp(400, 'No hay frames para exportar');

    const archivo = await construir(frames);
    res.set({
        'Content-Type': tipoMime,
        'Content-Disposition': `attachment; filename="${nombreSeguro(req.proyecto.nombre)}.${extension}"`,
    });
    return res.status(200).send(archivo);
}

function exportarGIF(req, res) {
    return exportar(req, res, procesadorFrames.reconstruirGIF, 'image/gif', 'gif');
}

function exportarMP4(req, res) {
    return exportar(req, res, procesadorFrames.reconstruirVideo, 'video/mp4', 'mp4');
}

module.exports = {
    importarArchivo,
    obtenerFrames,
    guardarFrames,
    obtenerCapas,
    exportarGIF,
    exportarMP4,
    crearFrameVacio,
    cambiarLienzo,
};