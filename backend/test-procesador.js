const fs = require('fs');
const { descomponerGIF, crearGIF, crearMP4 } = require('./services/procesadorFrames');

async function pruebas() {
    const ruta = process.argv[2];
    if (!ruta) {
        console.error('Por favor, proporciona la ruta del archivo GIF como argumento.');
        process.exit(1);
    }

    const original = fs.readFileSync(ruta);
    const frames = await descomponerGIF(original);
    console.log('Frames extraídos:', frames.length);
    console.log('Duraciones ms:', frames.map((f) => f.duracion).join(', '));

    fs.writeFileSync('reconstruido.gif', await reconstruirGIF(frames));
    console.log('GIF reconstruido guardado como reconstruido.gif');

    fs.writeFileSync('video.mp4', await reconstruirVideo(frames));
    console.log('Video MP4 guardado como video.mp4');
}

pruebas().catch((err) => console.error('Error durante las pruebas:', err));