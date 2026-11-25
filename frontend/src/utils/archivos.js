// Archivos de cada proyecto: los GIF, PNG, JPG o WEBP que el usuario subió, guardados en el navegador con IndexedDB.
// Así se pueden volver a usar en cualquier parte del proyecto sin subirlos de nuevo.
// No ocupan espacio en el servidor; a cambio, solo se ven en este navegador y en este computador.
//
// Cada archivo: { id, proyectoId, nombre, tipo, tamano (bytes), fecha (ms), contenido (Blob), miniatura (Blob o null) }

const BASE = 'steer';
const VERSION = 2;
const ALMACEN = 'archivos';

let conexion = null;

// Pasa al almacén "archivos" lo que haya en almacenes de versiones anteriores de la base, y los borra
function traspasarAnteriores(base, tx, nuevo) {
    Array.from(base.objectStoreNames)
        .filter((nombre) => nombre !== ALMACEN)
        .forEach((nombre) => {
            const viejo = tx.objectStore(nombre);
            const lectura = viejo.getAll();
            lectura.onsuccess = () => {
                lectura.result.forEach(({ archivo, ...resto }) => {
                    nuevo.put({ ...resto, contenido: resto.contenido || archivo });
                });
                base.deleteObjectStore(nombre);
            };
        });
}

function abrir() {
    if (!conexion) {
        conexion = new Promise((resolver, rechazar) => {
            if (typeof indexedDB === 'undefined') {
                rechazar(new Error('Este navegador no permite guardar archivos.'));
                return;
            }
            const peticion = indexedDB.open(BASE, VERSION);
            peticion.onupgradeneeded = () => {
                const base = peticion.result;
                if (base.objectStoreNames.contains(ALMACEN)) return;
                const almacen = base.createObjectStore(ALMACEN, { keyPath: 'id', autoIncrement: true });
                almacen.createIndex('proyecto', 'proyectoId');
                traspasarAnteriores(base, peticion.transaction, almacen);
            };
            peticion.onsuccess = () => resolver(peticion.result);
            peticion.onerror = () => {
                conexion = null;
                rechazar(peticion.error);
            };
        });
    }
    return conexion;
}

// Hace "operar(almacen)" en una transacción y devuelve lo que entrega la petición que retorna
async function transaccion(modo, operar) {
    const base = await abrir();
    return new Promise((resolver, rechazar) => {
        const tx = base.transaction(ALMACEN, modo);
        const peticion = operar(tx.objectStore(ALMACEN));
        tx.oncomplete = () => resolver(peticion ? peticion.result : undefined);
        tx.onerror = () => rechazar(tx.error);
        tx.onabort = () => rechazar(tx.error || new Error('No se pudo guardar el archivo.'));
    });
}

// Los archivos de un proyecto, del más nuevo al más viejo
export async function listarArchivos(proyectoId) {
    const todos = await transaccion('readonly', (almacen) => almacen.index('proyecto').getAll(String(proyectoId)));
    return todos.sort((a, b) => b.fecha - a.fecha);
}

// "subido" es el File (o Blob con nombre) que eligió el usuario
export async function guardarArchivo(proyectoId, subido, miniatura = null) {
    const archivo = {
        proyectoId: String(proyectoId),
        nombre: subido.name || 'archivo',
        tipo: subido.type,
        tamano: subido.size,
        fecha: Date.now(),
        contenido: subido,
        miniatura,
    };
    const id = await transaccion('readwrite', (almacen) => almacen.add(archivo));
    return { ...archivo, id };
}

export async function eliminarArchivo(id) {
    await transaccion('readwrite', (almacen) => almacen.delete(id));
}

// Al eliminar un proyecto se borran también sus archivos
export async function eliminarArchivosDeProyecto(proyectoId) {
    const archivos = await listarArchivos(proyectoId);
    await transaccion('readwrite', (almacen) => {
        archivos.forEach((a) => almacen.delete(a.id));
        return null;
    });
}

// Para las pruebas: cierra la conexión para empezar con una base nueva
export function cerrarConexion() {
    if (conexion) conexion.then((base) => base.close()).catch(() => {});
    conexion = null;
}
