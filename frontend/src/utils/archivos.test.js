import {
    listarArchivos, guardarArchivo, eliminarArchivo, eliminarArchivosDeProyecto, cerrarConexion,
} from './archivos';

// IndexedDB no existe en las pruebas (jsdom): se usa fake-indexeddb, que lo imita en memoria.
// jsdom tampoco trae structuredClone, que fake-indexeddb usa para copiar lo que se guarda
global.structuredClone = global.structuredClone || ((valor) => valor);
const { IDBFactory } = require('fake-indexeddb');

beforeEach(() => {
    cerrarConexion();
    global.indexedDB = new IDBFactory(); // una base vacía para cada prueba
});

const subido = (nombre, tipo = 'image/gif') => {
    const blob = new Blob(['GIF89a'], { type: tipo });
    blob.name = nombre;
    return blob;
};

test('guarda los archivos de cada proyecto por separado, del más nuevo al más viejo', async () => {
    jest.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(2000).mockReturnValueOnce(3000);
    await guardarArchivo(5, subido('gato.gif'));
    await guardarArchivo(5, subido('fondo.png', 'image/png'));
    await guardarArchivo(9, subido('otro.gif'));
    const lista = await listarArchivos(5);
    expect(lista.map((a) => a.nombre)).toEqual(['fondo.png', 'gato.gif']);
    expect(lista[0]).toMatchObject({ tipo: 'image/png', tamano: 6, proyectoId: '5' });
    expect((await listarArchivos(9)).length).toBe(1);
    Date.now.mockRestore();
});

test('se pueden eliminar uno por uno o todos los de un proyecto', async () => {
    const primero = await guardarArchivo(5, subido('a.gif'));
    await guardarArchivo(5, subido('b.gif'));
    await guardarArchivo(9, subido('c.gif'));
    await eliminarArchivo(primero.id);
    expect((await listarArchivos(5)).map((a) => a.nombre)).toEqual(['b.gif']);
    await eliminarArchivosDeProyecto(5);
    expect(await listarArchivos(5)).toEqual([]);
    expect((await listarArchivos(9)).length).toBe(1);
});

test('lo guardado con la versión anterior de la base pasa al almacén nuevo', async () => {
    // Base versión 1, con un almacén de otro nombre (el traspaso no depende del nombre)
    const anterior = 'anterior';
    await new Promise((resolver) => {
        const peticion = indexedDB.open('steer', 1);
        peticion.onupgradeneeded = () => {
            const almacen = peticion.result.createObjectStore(anterior, { keyPath: 'id', autoIncrement: true });
            almacen.createIndex('proyecto', 'proyectoId');
            almacen.add({ proyectoId: '5', nombre: 'viejo.gif', tipo: 'image/gif', tamano: 6, fecha: 1, archivo: subido('viejo.gif') });
        };
        peticion.onsuccess = () => { peticion.result.close(); resolver(); };
    });
    const lista = await listarArchivos(5);
    expect(lista.map((a) => a.nombre)).toEqual(['viejo.gif']);
    expect(lista[0].contenido).toBeDefined();
    expect(lista[0].archivo).toBeUndefined();
});
