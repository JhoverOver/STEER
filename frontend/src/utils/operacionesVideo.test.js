import { capaDeFila, filaDeCapa, indicesObjetivo, transformarPunto } from './operacionesVideo';
import {
    agregarKeyframe, componer, crearAnimacion, moverKeyframe, ponerKeyframe, quitarKeyframe, valoresEn, valoresPorFrame,
    animacionDeFila, baseDe, NEUTRO,
} from './animacion';

const fondo = { clave: 'a', nombre: 'Fondo' };
const titulo = { clave: 'c', nombre: 'Título' };
const capas = [fondo, titulo];

test('las filas son las de la línea de tiempo: la capa en la misma posición desde abajo', () => {
    expect(capaDeFila(capas, 'capa-0')).toBe(fondo);
    expect(capaDeFila(capas, 'capa-1')).toBe(titulo);
    expect(capaDeFila(capas, 'capa-5')).toBeNull();
    expect(filaDeCapa(capas, titulo)).toBe('capa-1');
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

const caja = { x: 0, y: 0, ancho: 10, alto: 10 };

test('entre dos keyframes los valores van en línea recta; después del último quedan en el último', () => {
    let a = crearAnimacion(caja, 100);
    a = ponerKeyframe(a, 300, { ...NEUTRO, dx: 200, angulo: 90, escalaX: 3, escalaY: 3 });
    expect(valoresEn(a.keyframes, 200)).toEqual({ dx: 100, dy: 0, escalaX: 2, escalaY: 2, angulo: 45 });
    expect(valoresEn(a.keyframes, 900).dx).toBe(200);
    expect(valoresEn(a.keyframes, 0).dx).toBe(0);
});

test('solo se animan los frames que empiezan en el primer keyframe o después', () => {
    const frames = [{ duracion: 100 }, { duracion: 100 }, { duracion: 100 }, { duracion: 100 }];
    const a = ponerKeyframe(crearAnimacion(caja, 100), 200, { ...NEUTRO, dx: 50 });
    const porFrame = valoresPorFrame(frames, a);
    expect([...porFrame.keys()]).toEqual([1, 2, 3]);
    expect(porFrame.get(1).dx).toBe(0);
    expect(porFrame.get(2).dx).toBe(50);
    expect(porFrame.get(3).dx).toBe(50);
});

test('un gesto de las manijas suma movimientos y giros, y multiplica escalas', () => {
    const v = componer({ dx: 10, dy: 0, escalaX: 2, escalaY: 2, angulo: 30 }, { dx: 5, dy: -5, escalaX: 1.5, escalaY: 1.5, angulo: 15 });
    expect(v).toEqual({ dx: 15, dy: -5, escalaX: 3, escalaY: 3, angulo: 45 });
});

test('agregar, mover y quitar keyframes', () => {
    let a = ponerKeyframe(crearAnimacion(caja, 0), 200, { ...NEUTRO, dx: 100 });
    a = agregarKeyframe(a, 100);
    expect(a.keyframes.map((k) => [k.tiempo, k.dx])).toEqual([[0, 0], [100, 50], [200, 100]]);
    expect(moverKeyframe(a, 100, 200)).toBe(a); // choca con otro
    a = moverKeyframe(a, 100, 150);
    expect(a.keyframes.map((k) => k.tiempo)).toEqual([0, 150, 200]);
    a = quitarKeyframe(quitarKeyframe(quitarKeyframe(a, 0), 150), 200);
    expect(a.keyframes).toHaveLength(1); // siempre queda uno
});

test('la animación de una fila y lo que se anima de cada capa', () => {
    const animacion = { id: 'a1', caja, keyframes: [{ tiempo: 0, ...NEUTRO }], forma: { tipo: 'rectangulo' } };
    const animada = { imagen: 'b', original: 'o', animacion };
    expect(animacionDeFila([null, { imagen: 'x' }, animada])).toBe(animacion);
    expect(baseDe(animada)).toEqual({ imagen: 'o', forma: { tipo: 'rectangulo' } });
    expect(baseDe({ imagen: 'x', forma: null })).toEqual({ imagen: 'x', forma: null });
});
