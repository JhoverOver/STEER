export const MAX_FRAMES = 100;
export const DURACION_MINIMA = 10;
export const DURACION_MAXIMA = 10000;
export const DURACION_POR_DEFECTO = 100;

let contadorClaves = 0;
export function crearClave() {
    contadorClaves += 1;
    return`frame-${contadorClaves}`;
}

export function desdeServidor(framesServidor) {
    return framesServidor.map((f) => ({
        clave: crearClave(),
        origen_id: f.id,
        duracion: f.duracion,
        imagen: f.imagen,
        vacio: false,
    }));
}

// Nombre del campo con que se sube el PNG de la capa "j" del frame "i"
function campoDeCapa(i, j) {
    return `frame${i}capa${j}`;
}

// La lista que se envía al servidor. Un frame editado trae sus capas: las modificadas se suben como archivo
// (con un nombre de campo) y las demás se indican por su id.
export function framesLista(frames) {
    return frames.map((f, i) => {
        if (f.vacio) return { vacio: true, duracion: f.duracion };
        const item = f.origen_id == null ? { duracion: f.duracion } : { origen_id: f.origen_id, duracion: f.duracion };
        if (!f.capas) return item;
        return {
            ...item,
            capas: f.capas.map((c, j) => ({
                nombre: c.nombre,
                visible: c.visible,
                bloqueada: c.bloqueada,
                ...(c.blob ? { archivo: campoDeCapa(i, j) } : { id: c.id }),
            })),
        };
    });
}

// Los PNG que acompañan a la lista: [{ campo, blob }]
export function archivosDeFrames(frames) {
    const archivos = [];
    frames.forEach((f, i) => {
        if (f.vacio || !f.capas) return;
        f.capas.forEach((c, j) => {
            if (c.blob) archivos.push({ campo: campoDeCapa(i, j), blob: c.blob });
        });
    });
    return archivos;
}

// Guarda en el frame lo que entregó el editor: sus capas y la imagen compuesta (una URL para mostrarla)
export function aplicarEdicion(frames, clave, { capas, imagen }) {
    return frames.map((f) => (f.clave === clave ? { ...f, capas, imagen, vacio: false } : f));
}


export function hayCambios(actual, guardado) {
    return JSON.stringify(framesLista(actual)) !== JSON.stringify(framesLista(guardado));
}

function limitar(valor, minimo, maximo) {
    return Math.min(Math.max(valor, minimo), maximo);
}

function returnCambio(original, nueva) {
    const igual = original.length === nueva.length && original.every((f, i) => f === nueva[i]);
    return igual ? original : nueva;
}

export function checkEspacio(frames, cantidad = 1) {
    return frames.length + cantidad <= MAX_FRAMES;
}

export function checkDuracion(valor) {
    return Number.isInteger(valor) && valor >= DURACION_MINIMA && valor <= DURACION_MAXIMA;
}

export function cambiarDuracion(frames, claves, duracion) {
    const elegidas = new Set(claves);
    const nueva = frames.map((f) =>
        elegidas.has(f.clave) && f.duracion !== duracion ? {...f, duracion } : f
    );
    return returnCambio(frames,nueva);
}

export function clavesObjetivo(frames, seleccion) {
    const elegidas = frames.filter((f) => seleccion.has(f.clave)).map((f) => f.clave);
    return elegidas.length > 0 ? elegidas : frames.map((f) => f.clave);
}


export function clavesEnRango(frames, claveA, claveB) {
    const a = frames.findIndex((f) => f.clave === claveA);
    const b = frames.findIndex((f) => f.clave === claveB);
    if (a === -1 || b === -1) return [claveB];
    const [desde,hasta] = a < b ? [a,b] : [b,a];
    return frames.slice(desde, hasta + 1).map((f) => f.clave);
}

export function eliminarFrames(frames, claves) {
    const quitar = new Set(claves);
        return returnCambio(frames, frames.filter((f) => !quitar.has(f.clave)));
}

export function copiarFrames(frames, claves) {
    const elegidas = new Set(claves);
    return frames
    .filter((f) => elegidas.has(f.clave))
        .map(({origen_id, duracion, imagen, vacio, capas }) => ({origen_id, duracion, imagen, vacio, capas}));
}

export function pegarFrames(frames, portapapeles, indice) {
    if (portapapeles.length === 0) return frames;
    const copias = portapapeles.map((f) => ({...f,clave: crearClave() }));
    const i = limitar(indice, 0, frames.length);
    return [...frames.slice(0,i), ...copias, ...frames.slice(i)];
}

export function crearBlank(duracion = DURACION_POR_DEFECTO) {
    return {clave: crearClave(), origen_id: null, duracion, imagen: null, vacio: true };
}

export function insertarBlank(frames, indice, duracion = DURACION_POR_DEFECTO) {
    const i = limitar(indice, 0, frames.length);
    return [...frames.slice(0,i), crearBlank(duracion), ...frames.slice(i)];
}


export function invertirOrden(frames, claves) {
    const elegidas = new Set(claves);
    const posiciones = [];
    frames.forEach((f, i) => {
        if (elegidas.has(f.clave)) posiciones.push(i);
    });
    const invertidos = posiciones.map((i) => frames[i]).reverse();
    const nueva = [...frames];
    posiciones.forEach((posicion, k) => {
        nueva[posicion] = invertidos[k];
    });
    return returnCambio(frames, nueva);
}

export function moverFrames(frames, claves, destino) {
    const elegidas = new Set(claves);
    const bloque = frames.filter((f) => elegidas.has(f.clave));
    if (bloque.length === 0) return frames;

    const hueco = limitar(destino, 0, frames.length);
    const restantes = frames.filter((f) => !elegidas.has(f.clave));
    const antes = frames.slice(0, hueco).filter((f) => !elegidas.has(f.clave)).length;
    const nueva = [...restantes.slice(0, antes), ...bloque, ...restantes.slice(antes)];
    return returnCambio(frames, nueva);
}

export function moverPaso(frames,claves, direccion) {
    const elegidas = new Set(claves);
    const indices = [];
    frames.forEach((f, i) => {
        if (elegidas.has(f.clave)) indices.push(i);
        });
        if (indices.length === 0) return frames;
        if (direccion < 0) {
            return indices[0] === 0 ? frames : moverFrames (frames, claves, indices[0] - 1);
        }
        const ultimo = indices[indices.length - 1];
        return ultimo === frames.length - 1 ? frames : moverFrames(frames, claves, ultimo + 2);
    }

    // Tras guardar, los frames cambian de id: se actualizan los del portapapeles. Los que traen capas editadas
// se descartan, porque los id de sus capas ya no existen.
export function remapearPortapapeles(portapapeles, enviados, recibidos) {
    const idNuevo = new Map();
    enviados.forEach((e, i) => {
        if (!e.vacio && e.origen_id != null && !idNuevo.has(e.origen_id) && recibidos[i]) idNuevo.set(e.origen_id, recibidos[i].id);
    });
    return portapapeles
        .map((f) => {
            if (f.vacio) return f;
            if (f.capas) return null;
            return idNuevo.has(f.origen_id) ? { ...f, origen_id: idNuevo.get(f.origen_id) } : null;
        })
        .filter(Boolean);
}