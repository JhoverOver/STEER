const sharp = require('sharp');
const {GIFEncoder, quantize, applyPalette} = require('gifenc');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const {
    MAX_FRAMES, 
    DURACION_MINIMA, 
    DURACION_MAXIMA, 
    ANCHO_MINIATURA,
    LADO_MAXIMO
} = require('../config/limites');

ffmpeg.setFfmpegPath(ffmpegPath);

const DefaultDuration = 100; // Duración default de cada frame en ms

// detecta numeros enteros mayores o igual a 1 y menores o igual al máximo
function lienzoValido(ancho, alto) {
    const valido = (lado) => Number.isInteger(lado) && lado >= 1 && lado <= LADO_MAXIMO;
    return valido(ancho) && valido(alto);
}

// archivo (BUFFER) -> Frame[] {orden, imagen_data (PNG), duracion (ms)
async function descomponerGIF(buffer) {
    const imagen = sharp(buffer, {animated: true, pages: -1});
    const metadata = await imagen.metadata();
    const paginas = metadata.pages || 1;
    const alto = metadata.pageHeight || metadata.height;
    const ancho = metadata.width;

    // error si el GIF excede el tamaño máximo permitido
    if (!lienzoValido(ancho, alto)) {
        const error = new Error(`El GIF mide ${ancho} x ${alto}px y el máximo es ${LADO_MAXIMO} x ${LADO_MAXIMO} px`);
        error.codigo = 'LIENZO_EXCEDIDO';
        throw error;
    }

    // sharp entrega frames completos verticalmente
    const {data} = await imagen.ensureAlpha().raw().toBuffer({resolveWithObject: true});
    const bytesPorFrame = ancho * alto * 4; // RGBA
    const frames = [];

    for (let i = 0; i < paginas; i++) {
        const pixeles = data.subarray(i * bytesPorFrame, (i + 1) * bytesPorFrame);
        const png = await sharp(pixeles, { raw: { width: ancho, height: alto, channels: 4 } })
            .png()
            .toBuffer();
        const delay = metadata.delay && metadata.delay[i] ? metadata.delay[i] : DefaultDuration; // delay en millisegundos
        // Algunos GIF traen delays fuera de rango (0 a 9 ms); se ajustan para que el proyecto se pueda guardar
        const duracion = Math.min(Math.max(delay, DURACION_MINIMA), DURACION_MAXIMA);
        frames.push({orden: i, imagen_data: png, duracion});
    }
    return frames;
}

// Frame[] -> archivo (BUFFER)
async function reconstruirGIF(frames) {
    if (!frames.length) throw new Error('No hay frames para crear el GIF');
    const orden = [...frames].sort((a, b) => a.orden - b.orden);

    const primerFrame = await sharp(orden[0].imagen_data).metadata();
    const ancho = primerFrame.width;
    const alto = primerFrame.height;

    const gif = GIFEncoder();
    for (const frame of orden) {
        const {data} = await sharp(frame.imagen_data)
        .resize(ancho, alto, { fit: 'fill'})
        .ensureAlpha()
        .raw()
        .toBuffer({resolveWithObject: true});

        //pixeles transparentes
        let transparentPixels = false;
        for (let i = 3; i < data.length; i += 4) {
            if (data[i] < 128) {
                transparentPixels = true;
                break;
            }
        }

        // sin transparencia, se puede usar paleta de 256 colores
        const format = transparentPixels ? 'rgba4444' : 'rgb565';
        const paleta = quantize(data, 256, {format: format});
        const indices = applyPalette(data, paleta, format);

        const opciones = {
            palette: paleta,
            delay: frame.duracion || DefaultDuration,
            repeat: 0,
        };
        if (transparentPixels) {
            //rgba4444, se puede usar el primer color de la paleta como transparente
            const colorTransparente = paleta.findIndex((c) => c.length === 4 && c[3] === 0);
            if (colorTransparente >= 0) {
                opciones.transparent = true;
                opciones.transparentIndex = colorTransparente;
            }
        }
        gif.writeFrame(indices, ancho, alto, opciones);
    }
    gif.finish();
    return Buffer.from(gif.bytes());
}

//Frame[] -> mp4 (BUFFER)
async function reconstruirVideo(frames) {
    if (!frames.length) throw new Error('No hay frames para crear el MP4');
    const orden = [...frames].sort((a, b) => a.orden - b.orden);
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'frames-'));

    try {
        //fmppeg lee las imagenes numeradas a 100 fps,
        // el delay del GIF son múltiplos de 10ms, así que cada fram se puede repetir delay/10 veces para que dure lo mismo
        let n = 0;
        const nombreImagenes = (i) => path.join(dir, `f${String(i).padStart(5, '0')}.png`);
        for (const frame of orden) {
            const repeticiones = Math.max(1, Math.round((frame.duracion || DefaultDuration) / 10));
            await fs.writeFile(nombreImagenes(n), frame.imagen_data);
            for (let o = 1; o < repeticiones; o++) {
                await fs.copyFile(nombreImagenes(n), nombreImagenes(n + o));
            }
            n += repeticiones;
        }

        const salida = path.join(dir, 'salida.mp4');
        await new Promise((resolve, reject) => {
            ffmpeg()
                .input(path.join(dir, 'f%05d.png'))
                .inputOptions(['-framerate 100'])
                .outputOptions([
                    '-c:v libx264',
                    '-pix_fmt yuv420p',
                    '-vf scale=trunc(iw/2)*2:trunc(ih/2)*2',
                    '-r 100',
                    '-movflags +faststart',
                ])
                .on('end', resolve)
                .on('error', reject)
                .save(salida);
        });
        return await fs.readFile(salida);
    } finally {
        await fs.rm(dir, {recursive: true, force: true});
    }
}

// PNG (BUFFER) -> miniatura WebP (BUFFER) para el panel de proyectos
async function generarMiniatura(png) {
    return sharp(png)
        .resize({ width: ANCHO_MINIATURA, height: ANCHO_MINIATURA, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 70 })
        .toBuffer();
}

async function crearFrameVacio(ancho, alto) {
    return sharp({
        create: {width: ancho, height: alto, channels: 4, background: {r: 0, g: 0, b:0, alpha: 0 }},
    })
    .png()
    .toBuffer();
}

// componer capas visibles en un solo PNG
async function componerCapas(capas, ancho, alto) {
    const visibles = capas.filter((capa) => capa.visible);
    return sharp({
        create: {width: ancho, height: alto, channels: 4, background: {r: 0, g: 0, b: 0, alpha: 0}},
    })
    .composite(visibles.map((capa) => ({ input: capa.imagen_data })))
    .png()
    .toBuffer();
}

// PNG (BUFFER) -> true si es un PNG y cumple con los límites de tamaño del lienzo
async function validarCapaPNG(buffer, ancho, alto) {
    try {
        const metadata = await sharp(buffer).metadata();
        return metadata.format === 'png' && metadata.width === ancho && metadata.height === alto;
    } catch {
        return false;
    }
}


module.exports = {
    lienzoValido,
    componerCapas,
    descomponerGIF,
    reconstruirGIF,
    reconstruirVideo,
    crearFrameVacio,
    generarMiniatura,
    validarCapaPNG,
};