const sharp = require('sharp');
const {GIFEncoder, quantize, applyPalette} = require('gifenc');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const {
    MAX_FRAMES, 
    DURACION_INICIAL,
    DURACION_MINIMA, 
    DURACION_MAXIMA, 
    ANCHO_MINIATURA,
    LADO_MAXIMO,
    FACTOR_AREA_TRABAJO
} = require('../config/limites');
const { errorHttp } = require('../middleware/errores');

ffmpeg.setFfmpegPath(ffmpegPath);


// detecta numeros enteros mayores o igual a 1 y menores o igual al máximo
function lienzoValido(ancho, alto) {
    const valido = (lado) => Number.isInteger(lado) && lado >= 1 && lado <= LADO_MAXIMO;
    return valido(ancho) && valido(alto);
}

// Formatos que se pueden importar. GIF y WEBP pueden traer varios frames; PNG y JPG traen uno.
const FORMATOS_IMPORTABLES = ['gif', 'png', 'jpeg', 'webp'];

// Medidas con las que queda una imagen de ancho x alto al caber en maxAncho x maxAlto sin agrandarse
function medidasAjustadas(ancho, alto, maxAncho, maxAlto) {
    const escala = Math.min(1, maxAncho / ancho, maxAlto / alto);
    return { ancho: Math.max(1, Math.round(ancho * escala)), alto: Math.max(1, Math.round(alto * escala)) };
}

// archivo (BUFFER) -> { frames: [{ imagen_data (PNG), duracion (ms) }], ancho, alto }
// Acepta GIF, PNG, JPG y WEBP (RF3). Si se indica "lienzo" ({ ancho, alto }), cada frame se reduce hasta caber en
// él y queda centrado sobre fondo transparente: así se puede AGREGAR a un proyecto que ya tiene tamaño. Sin lienzo,
// el archivo fija el tamaño; si mide más de LADO_MAXIMO por lado se reduce manteniendo la proporción.
// Si el archivo no se puede leer o tiene demasiados frames, lanza un error 400.
async function descomponerArchivo(buffer, lienzo = null) {
    let metadata;
    try {
        metadata = await sharp(buffer, { animated: true, pages: -1 }).metadata();
    } catch (error) {
        throw errorHttp(400, 'No se pudo leer el archivo. Usa un GIF, PNG, JPG o WEBP.');
    }
    if (!FORMATOS_IMPORTABLES.includes(metadata.format)) {
        throw errorHttp(400, 'Solo se pueden importar archivos GIF, PNG, JPG o WEBP.');
    }
    const paginas = metadata.pages || 1;
    // Se revisa antes de decodificar: decodificar un archivo con demasiados frames gasta memoria para nada
    if (paginas > MAX_FRAMES) {
        throw errorHttp(400, `El archivo tiene ${paginas} frames y el máximo permitido es ${MAX_FRAMES}.`);
    }

    // Una imagen fija se gira según su EXIF (fotos de celular); una animada se lee con todos sus frames apilados
    const lector = paginas > 1 ? sharp(buffer, { animated: true, pages: -1 }) : sharp(buffer).rotate();
    const { data, info } = await lector.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const ancho = info.width;
    const alto = paginas > 1 ? (metadata.pageHeight || info.height / paginas) : info.height;

    const destino = lienzo || medidasAjustadas(ancho, alto, LADO_MAXIMO, LADO_MAXIMO);
    if (!lienzoValido(destino.ancho, destino.alto)) {
        throw errorHttp(400, `El lienzo debe medir entre 1 y ${LADO_MAXIMO} px por lado.`);
    }
    const ajuste = medidasAjustadas(ancho, alto, destino.ancho, destino.alto);

    const bytesPorFrame = ancho * alto * 4; // RGBA
    const frames = [];
    for (let i = 0; i < paginas; i++) {
        const pixeles = data.subarray(i * bytesPorFrame, (i + 1) * bytesPorFrame);
        let imagen = sharp(pixeles, { raw: { width: ancho, height: alto, channels: 4 } });
        if (ajuste.ancho !== ancho || ajuste.alto !== alto) imagen = imagen.resize(ajuste.ancho, ajuste.alto, { fit: 'fill' });
        let png = await imagen.png().toBuffer();
        if (ajuste.ancho !== destino.ancho || ajuste.alto !== destino.alto) {
            // Más chico que el lienzo: se centra sobre un fondo transparente del tamaño del lienzo
            png = await sharp({
                create: { width: destino.ancho, height: destino.alto, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
            })
                .composite([{
                    input: png,
                    left: Math.floor((destino.ancho - ajuste.ancho) / 2),
                    top: Math.floor((destino.alto - ajuste.alto) / 2),
                }])
                .png()
                .toBuffer();
        }
        const delay = metadata.delay && metadata.delay[i] ? metadata.delay[i] : DURACION_INICIAL; // ms
        // Algunos GIF traen delays fuera de rango (0 a 9 ms); se ajustan para que el proyecto se pueda guardar
        const duracion = Math.min(Math.max(delay, DURACION_MINIMA), DURACION_MAXIMA);
        frames.push({ imagen_data: png, duracion });
    }
    return { frames, ancho: destino.ancho, alto: destino.alto };
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

        // El GIF solo admite transparencia total o nula: un pixel es transparente si su alfa es menor a 128
        const totalPixeles = ancho * alto;
        const opacos = new Uint8Array(totalPixeles * 4);
        let cantidadOpacos = 0;
        for (let p = 0; p < totalPixeles; p++) {
            if (data[p * 4 + 3] >= 128) {
                opacos.set(data.subarray(p * 4, p * 4 + 4), cantidadOpacos * 4);
                cantidadOpacos++;
            }
        }

        // La paleta se calcula solo con los pixeles opacos y deja libre el ultimo color (el 256) para la
        // transparencia. Asi todos los frames, tambien los que no tienen nada borrado, declaran un color
        // transparente: si el primero no lo hace, al volver a importar el GIF las zonas borradas
        // del frame siguiente se rellenan con un color opaco (negro)
        const paleta = cantidadOpacos > 0 ? quantize(opacos.subarray(0, cantidadOpacos * 4), 255, {format: 'rgb565'}) : [];
        const indices = cantidadOpacos > 0 ? applyPalette(data, paleta, 'rgb565') : new Uint8Array(totalPixeles);
        const colorTransparente = paleta.length;
        paleta.push([0, 0, 0]);
        for (let p = 0; p < totalPixeles; p++) {
            if (data[p * 4 + 3] < 128) indices[p] = colorTransparente;
        }

        const opciones = {
            palette: paleta,
            delay: frame.duracion || DURACION_INICIAL,
            repeat: 0,
            transparent: true,
            transparentIndex: colorTransparente,
            // Cada frame se dibuja sobre un lienzo limpio: sin esto, las zonas transparentes
            // (borradas) dejan ver el frame anterior
            dispose: 2,
        };
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
        // Cada frame se escribe UNA sola vez y una lista (concat demuxer) indica cuánto dura.
        // Antes se duplicaba el PNG delay/10 veces: un proyecto largo generaba miles de archivos y el servidor caía (502).
        const lineas = [];
        let ultimo = '';
        for (let i = 0; i < orden.length; i++) {
            const nombre = `f${String(i).padStart(5, '0')}.png`;
            await fs.writeFile(path.join(dir, nombre), orden[i].imagen_data);
            const segundos = Math.max(DURACION_MINIMA, Math.round((orden[i].duracion || DURACION_INICIAL) / 10) * 10) / 1000;
            // "option framerate": el PNG se lee como un cuadro de 1 ms. Sin esto el lector de imágenes le da 40 ms
            // a cada cuadro y los frames más cortos que eso se pierden o se corren.
            lineas.push(`file '${nombre}'`, 'option framerate 1000', `duration ${segundos}`);
            ultimo = nombre;
        }
        // Requisito del concat demuxer: repetir el último archivo para que respete su duración.
        // La copia dura 1 ms: es el cuadro que cierra el video justo cuando termina el último frame.
        lineas.push(`file '${ultimo}'`, 'option framerate 1000', 'duration 0.001');
        const lista = path.join(dir, 'lista.txt');
        await fs.writeFile(lista, ['ffconcat version 1.0', ...lineas].join('\n'));

        const salida = path.join(dir, 'salida.mp4');
        await new Promise((resolve, reject) => {
            ffmpeg()
                .input(lista)
                .inputOptions(['-f concat', '-safe 0'])
                .outputOptions([
                    '-c:v libx264',
                    '-preset ultrafast',
                    '-pix_fmt yuv420p',
                    // Cuadros de duración variable: cada frame se codifica UNA vez y dura lo que indica la lista.
                    // Antes se usaba fps=100, que repetía cada frame hasta llenar su duración: un proyecto de
                    // 100 frames de 10 s codificaba 100.000 cuadros y el hosting gratuito no alcanzaba a terminar.
                    '-fps_mode vfr',
                    '-enc_time_base 1/1000', // milisegundos: así no se pierden los frames de 10 ms
                    '-video_track_timescale 1000',
                    '-vf scale=trunc(iw/2)*2:trunc(ih/2)*2',
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

async function componerCapas(capas, ancho, alto) {
    const visibles = capas.filter((capa) => capa.visible);
    const imagenes = [];
    for (const capa of visibles) {
        imagenes.push({ input: await recortarAlLienzo(capa.imagen_data, ancho, alto) });
    }
    return sharp({
        create: {width: ancho, height: alto, channels: 4, background: {r: 0, g: 0, b: 0, alpha: 0}},
    })
    .composite(imagenes)
    .png()
    .toBuffer();
}

// Una capa puede traer contenido fuera del lienzo: entonces mide FACTOR_AREA_TRABAJO veces el lienzo
// y el lienzo es su parte central. Aqui se devuelve solo esa parte (si la capa ya mide lo del lienzo, queda igual)
async function recortarAlLienzo(buffer, ancho, alto) {
    const { width, height } = await sharp(buffer).metadata();
    if (width === ancho && height === alto) return buffer;
    return sharp(buffer)
        .extract({ left: Math.round((width - ancho) / 2), top: Math.round((height - alto) / 2), width: ancho, height: alto })
        .png()
        .toBuffer();
}

// PNG (BUFFER) -> true si de verdad es un PNG y mide ancho x alto, o el area de trabajo completa
// (FACTOR_AREA_TRABAJO veces el lienzo, cuando la capa guarda contenido fuera de el)
async function validarCapaPNG(buffer, ancho, alto) {
    try {
        const metadata = await sharp(buffer).metadata();
        if (metadata.format !== 'png') return false;
        const medidaLienzo = metadata.width === ancho && metadata.height === alto;
        const medidaArea = metadata.width === ancho * FACTOR_AREA_TRABAJO && metadata.height === alto * FACTOR_AREA_TRABAJO;
        return medidaLienzo || medidaArea;
    } catch {
        return false;
    }
}


// Pega "buffer" (de origenAncho x origenAlto) sobre una imagen transparente de ancho x alto, con su esquina
// superior izquierda en (x, y). Lo que queda afuera se recorta; x e y pueden ser negativos
async function pegarEn(buffer, origenAncho, origenAlto, ancho, alto, x, y) {
    const base = sharp({ create: { width: ancho, height: alto, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } });
    const izquierda = Math.max(x, 0);
    const arriba = Math.max(y, 0);
    const derecha = Math.min(x + origenAncho, ancho);
    const abajo = Math.min(y + origenAlto, alto);
    if (derecha <= izquierda || abajo <= arriba) return base.png().toBuffer(); // no queda nada adentro
    const trozo = await sharp(buffer)
        .extract({ left: izquierda - x, top: arriba - y, width: derecha - izquierda, height: abajo - arriba })
        .png()
        .toBuffer();
    return base.composite([{ input: trozo, left: izquierda, top: arriba }]).png().toBuffer();
}

// Acomoda la imagen de una capa a un lienzo de otro tamaño, sin escalar: el contenido se corre
// (dx, dy) píxeles, que salen del ancla elegida. Una capa mide lo del lienzo o lo de la zona de trabajo (3 x 3
// lienzos, con el lienzo al centro). Si algo del dibujo quedaría fuera del lienzo nuevo, la capa pasa a medir lo de
// la zona de trabajo: así no se pierde (igual que en el editor)
async function reubicarImagen(buffer, anterior, nuevo, dx, dy) {
    const { width, height } = await sharp(buffer).metadata();
    const F = FACTOR_AREA_TRABAJO;
    const enZona = width === anterior.ancho * F && height === anterior.alto * F;
    // Dónde queda la esquina de la imagen respecto del lienzo nuevo
    const x = (enZona ? -anterior.ancho : 0) + dx;
    const y = (enZona ? -anterior.alto : 0) + dy;
    const cabeEnLienzo = x >= 0 && y >= 0 && x + width <= nuevo.ancho && y + height <= nuevo.alto;
    if (!enZona && cabeEnLienzo) return pegarEn(buffer, width, height, nuevo.ancho, nuevo.alto, x, y);
    return pegarEn(buffer, width, height, nuevo.ancho * F, nuevo.alto * F, x + nuevo.ancho, y + nuevo.alto);
}

module.exports = {
    reubicarImagen,
    componerCapas,
    descomponerArchivo,
    reconstruirGIF,
    reconstruirVideo,
    crearFrameVacio,
    generarMiniatura,
    validarCapaPNG,
};