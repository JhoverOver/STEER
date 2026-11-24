import { filasDeCapas } from './vistaCapas';

const fondo = (n) => ({ clave: `f${n}`, nombre: 'Fondo', visible: true });
const linea = (n) => ({ clave: `l${n}`, nombre: 'Línea', visible: true });
const generada = (n) => ({ clave: `g${n}`, nombre: 'Pelota', visible: true, pista: 'n1' });

test('una fila por capa, de la de arriba a la de abajo, y frames sin esa capa quedan vacíos', () => {
    const filas = filasDeCapas([[fondo(1), linea(1)], [fondo(2)]], [], 0);
    expect(filas.map((f) => f.nombre)).toEqual(['Línea', 'Fondo']);
    expect(filas[0].celdas).toEqual([linea(1), null]);
    expect(filas[1].celdas).toEqual([fondo(1), fondo(2)]);
});

test('las pistas van arriba con la capa que generaron en cada frame', () => {
    const pistas = [{ clave: 'n1', nombre: 'Pelota' }];
    const filas = filasDeCapas([[fondo(1), generada(1)], [fondo(2)], [fondo(3), generada(3)]], pistas, 0);
    expect(filas[0]).toMatchObject({ tipo: 'pista', pista: 'n1', nombre: 'Pelota' });
    expect(filas[0].celdas).toEqual([generada(1), null, generada(3)]);
    expect(filas.slice(1).map((f) => f.nombre)).toEqual(['Fondo']);
});

test('una capa de una pista que ya no existe se muestra como capa normal', () => {
    const filas = filasDeCapas([[fondo(1), generada(1)]], [], 0);
    expect(filas.map((f) => [f.tipo, f.nombre])).toEqual([['capa', 'Pelota'], ['capa', 'Fondo']]);
});

test('la fila se llama como la capa del frame actual, o como la que más se repite', () => {
    const otra = { clave: 'x', nombre: 'Sombra', visible: true };
    const filas = filasDeCapas([[fondo(1), linea(1)], [fondo(2), otra], [fondo(3)], [fondo(4), linea(4)]], [], 1);
    expect(filas[0].nombre).toBe('Sombra');
    expect(filasDeCapas([[fondo(1), linea(1)], [fondo(2), otra], [fondo(3)], [fondo(4), linea(4)]], [], 2)[0].nombre).toBe('Línea');
});

test('sin capas cargadas no hay filas', () => {
    expect(filasDeCapas([null, null], [], 0)).toEqual([]);
});