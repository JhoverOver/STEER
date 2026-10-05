const sharp = require('sharp');
const {GIFEncoder, quantize, applyPalette} = require('gifenc');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');

ffmpeg.setFfmpegPath(ffmpegPath);

const DefaultDuration = 100; // Duración default de cada frame en ms

// archivo (BUFFER) -> Frame[] {orden, imagen_data (PNG), duracion (ms)
async function descomponerGIF(buffer) {
    const imagen = sharp(buffer, {animated: true, pages: -1});
    const metadata = await imagen.metadata();
    const paginas = metadata.pages || 1;
    const alto = metadata.pageHeight || metadata.height;
    const ancho = metadata.width;

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
        frames.push({orden: i, imagen_data: png, duracion: delay});
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

async function crearFrameVacio(ancho, alto) {
    return sharp({
        create: {width: ancho, height: alto, channels: 4, background: {r: 0, g: 0, b:0, alpha: 0 }},
    })
    .png()
    .toBuffer();
}

module.exports = {
    descomponerGIF,
    reconstruirGIF,
    reconstruirVideo,
    crearFrameVacio
};