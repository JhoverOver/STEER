// Capas de todos los frames del proyecto (pestaña Video): las carga del servidor una sola vez, compone la imagen de
// un frame y prepara las capas nuevas para guardarlas.
import { capasDeFrame } from './capas';
import { aBlob, cargarImagen, crearCanvas, origenEnZona } from './imagenes';
import { matrizDe, transformarContexto } from './animacion';
import { dibujarForma } from './formas';

const CARGAS_A_LA_VEZ = 6;

// Imagen del frame: las capas visibles juntas, solo lo que cae dentro del lienzo
export async function componer(capas, ancho, alto) {
    const canvas = crearCanvas(ancho, alto);
    const ctx = canvas.getContext('2d');
    for (const capa of capas) {
        if (!capa.visible || !capa.imagen) continue;
        ctx.save();
        await dibujarCapa(ctx, capa, ancho, alto);
        ctx.restore();
    }
    return aBlob(canvas);
}

// Dibuja una capa en un contexto que dibuja en píxeles del lienzo. Una capa con keyframes se dibuja transformada
// según el punto (utils/animacion.js); si es una forma, se dibuja la forma ya transformada (nítida a cualquier escala)
export async function dibujarCapa(ctx, capa, ancho, alto, imagen = null) {
    transformarContexto(ctx, matrizDe(capa.animacion));
    if (capa.forma && capa.animacion?.actual) {
        dibujarForma(ctx, capa.forma);
        return;
    }
    const img = imagen || await cargarImagen(capa.imagen);
    const origen = origenEnZona(img, ancho, alto);
    ctx.drawImage(img, origen.x - ancho, origen.y - alto);
}

// Al guardar, cada capa va por su id (ya guardada) o con su PNG. Una capa nueva que todavía no tiene PNG
// (el "Fondo" de un frame en blanco, por ejemplo) lo recibe aquí
export async function conArchivo(capa, ancho, alto) {
    if (capa.id !== undefined || capa.blob) return capa;
    const blob = capa.imagen ? await (await fetch(capa.imagen)).blob() : await aBlob(crearCanvas(ancho, alto));
    return { ...capa, blob, imagen: capa.imagen || URL.createObjectURL(blob) };
}

// Las capas de todos los frames. Las de los frames que no se han abierto se piden al servidor (de a varias a
// la vez) y se recuerdan en "memoria" por el id del frame guardado, para no pedirlas otra vez
export async function capasDeTodos(frames, proyectoId, memoria) {
    const resultado = new Array(frames.length);
    let siguiente = 0;
    async function trabajar() {
        while (siguiente < frames.length) {
            const i = siguiente;
            siguiente += 1;
            const frame = frames[i];
            if (frame.capas) {
                resultado[i] = frame.capas;
            } else if (frame.origen_id != null && memoria.has(frame.origen_id)) {
                resultado[i] = memoria.get(frame.origen_id);
            } else {
                resultado[i] = await capasDeFrame(proyectoId, frame);
                if (frame.origen_id != null) memoria.set(frame.origen_id, resultado[i]);
            }
        }
    }
    await Promise.all(Array.from({ length: CARGAS_A_LA_VEZ }, trabajar));
    return resultado;
}

// Las capas de todos los frames, con la misma memoria (para la vista de capas de la línea de tiempo).
// Devuelve un Map: clave del frame -> sus capas
export async function capasDeFrames(frames, proyectoId, memoria) {
    const capas = await capasDeTodos(frames, proyectoId, memoria);
    return new Map(frames.map((frame, i) => [frame.clave, capas[i]]));
}
