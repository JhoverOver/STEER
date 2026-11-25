import { capaDeFila, filaDeCapa, indicesObjetivo, transformarPunto } from './operacionesVideo';

const pistas = [{ clave: 'p1' }];
const fondo = { clave: 'a', nombre: 'Fondo' };
const generada = { clave: 'b', nombre: 'Pelota', pista: 'p1' };
const titulo = { clave: 'c', nombre: 'Título' };
const capas = [fondo, generada, titulo];

test('las filas son las mismas de la línea de tiempo: pistas aparte, las demás por posición desde abajo', () => {
    expect(capaDeFila(capas, pistas, 'capa-0')).toBe(fondo);
    expect(capaDeFila(capas, pistas, 'capa-1')).toBe(titulo); // la capa de la pista no cuenta
    expect(capaDeFila(capas, pistas, 'pista-p1')).toBe(generada);
    expect(capaDeFila(capas, pistas, 'capa-5')).toBeNull();
    expect(filaDeCapa(capas, pistas, titulo)).toBe('capa-1');
    expect(filaDeCapa(capas, pistas, generada)).toBe('pista-p1');
    // Si la pista ya no existe, su capa es una capa más
    expect(filaDeCapa(capas, [], generada)).toBe('capa-1');
});

test('se aplica a los frames marcados o, si no hay, a todos', () => {
    const frames = [{ clave: 'f1' }, { clave: 'f2' }, { clave: 'f3' }];
    expect(indicesObjetivo(frames, new Set())).toEqual([0, 1, 2]);
    expect(indicesObjetivo(frames, new Set(['f3', 'f1']))).toEqual([0, 2]);
});

test('la transformación de las manijas mueve, escala y gira alrededor del centro de la caja', () => {
    const region = { x: 0, y: 0, ancho: 100, alto: 100 };
    expect(transformarPunto(region, { dx: 10, dy: 20 }, { x: 0, y: 0 })).toEqual({ x: 10, y: 20 });
    expect(transformarPunto(region, { escalaX: 2, escalaY: 2 }, { x: 0, y: 0 })).toEqual({ x: -50, y: -50 });
    const girado = transformarPunto(region, { angulo: 90 }, { x: 100, y: 50 });
    expect(girado.x).toBeCloseTo(50);
    expect(girado.y).toBeCloseTo(100);
});
