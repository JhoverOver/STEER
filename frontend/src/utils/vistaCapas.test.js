import { filasDeCapas } from './vistaCapas';

const fondo = (n) => ({ clave: `f${n}`, nombre: 'Fondo', visible: true });
const linea = (n) => ({ clave: `l${n}`, nombre: 'Línea', visible: true });

test('una fila por capa, de la de arriba a la de abajo, y frames sin esa capa quedan vacíos', () => {
    const filas = filasDeCapas([[fondo(1), linea(1)], [fondo(2)]], 0);
    expect(filas.map((f) => f.nombre)).toEqual(['Línea', 'Fondo']);
    expect(filas.map((f) => f.clave)).toEqual(['capa-1', 'capa-0']);
    expect(filas[0].celdas).toEqual([linea(1), null]);
    expect(filas[1].celdas).toEqual([fondo(1), fondo(2)]);
});

test('una fila con keyframes queda marcada como animada', () => {
    const animada = { ...linea(2), animacion: { id: 'a1', keyframes: [] } };
    const filas = filasDeCapas([[fondo(1), linea(1)], [fondo(2), animada]], 0);
    expect(filas.map((f) => f.animada)).toEqual([true, false]);
});

test('la fila se llama como la capa del frame actual, o como la que más se repite', () => {
    const otra = { clave: 'x', nombre: 'Sombra', visible: true };
    const lista = [[fondo(1), linea(1)], [fondo(2), otra], [fondo(3)], [fondo(4), linea(4)]];
    expect(filasDeCapas(lista, 1)[0].nombre).toBe('Sombra');
    expect(filasDeCapas(lista, 2)[0].nombre).toBe('Línea');
});

test('sin capas cargadas no hay filas', () => {
    expect(filasDeCapas([null, null], 0)).toEqual([]);
});
