import { capaDeFila, filaDeCapa, indicesObjetivo, transformarPunto } from './operacionesVideo';
import {
    agregarKeyframe, aLaCapa, animacionDeFila, crearAnimacion, estadoEn, estadosPorFrame, matrizDe, moverEstado, moverKeyframe,
    ponerKeyframe, quitarKeyframe,
} from './animacion';
import { sumarGestos, SIN_TRANSFORMACION } from './manijas';

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

const quieto = { escala: 1, giro: 0 };

test('entre dos keyframes el punto avanza en línea recta; después del último queda en el último', () => {
    let a = crearAnimacion(100, { x: 0, y: 0 });
    a = ponerKeyframe(a, 300, { x: 500, y: 100, escala: 3, giro: 90 });
    expect(estadoEn(a.keyframes, 200)).toEqual({ x: 250, y: 50, escala: 2, giro: 45 });
    expect(estadoEn(a.keyframes, 900)).toEqual({ x: 500, y: 100, escala: 3, giro: 90 });
    expect(estadoEn(a.keyframes, 0)).toEqual({ x: 0, y: 0, ...quieto });
});

test('solo se animan los frames que empiezan en el primer keyframe o después', () => {
    const frames = [{ duracion: 100 }, { duracion: 100 }, { duracion: 100 }, { duracion: 100 }];
    const a = ponerKeyframe(crearAnimacion(100, { x: 0, y: 0 }), 200, { x: 50, y: 0, ...quieto });
    const porFrame = estadosPorFrame(frames, a);
    expect([...porFrame.keys()]).toEqual([1, 2, 3]);
    expect(porFrame.get(3).x).toBe(50);
});

test('lo de la capa sigue al punto: se mueve, escala y gira a la misma distancia de él', () => {
    const a = crearAnimacion(0, { x: 10, y: 10 });
    const llevar = (estado, p) => {
        const [m0, m1, m2, m3, m4, m5] = matrizDe(a, estado);
        return { x: Math.round(m0 * p.x + m2 * p.y + m4), y: Math.round(m1 * p.x + m3 * p.y + m5) };
    };
    expect(matrizDe(a)).toBeNull(); // sin "actual", la capa se ve tal cual
    expect(llevar({ x: 110, y: 10, ...quieto }, { x: 20, y: 10 })).toEqual({ x: 120, y: 10 }); // se mueve
    expect(llevar({ x: 10, y: 10, escala: 2, giro: 0 }, { x: 20, y: 10 })).toEqual({ x: 30, y: 10 }); // escala desde el punto
    expect(llevar({ x: 10, y: 10, escala: 1, giro: 90 }, { x: 20, y: 10 })).toEqual({ x: 10, y: 20 }); // gira en el punto
    const m = matrizDe(a, { x: 110, y: 10, escala: 2, giro: 30 });
    const vuelta = aLaCapa(m, llevar({ x: 110, y: 10, escala: 2, giro: 30 }, { x: 25, y: 13 }));
    expect(Math.round(vuelta.x)).toBe(25);
});

test('un gesto de las manijas lleva el punto con él y suma escala y giro', () => {
    // El punto en (10, 0); se gira 90° alrededor de (0, 0) y se escala x2: queda en (0, 20)
    const e = moverEstado({ x: 10, y: 0, escala: 1.5, giro: 10 }, { dx: 0, dy: 0, escalaX: 2, escalaY: 2, angulo: 90 }, { x: 0, y: 0 });
    expect(e).toEqual({ x: 0, y: 20, escala: 3, giro: 100 });
    expect(moverEstado({ x: 10, y: 0, ...quieto }, { dx: 5, dy: -5 }, { x: 0, y: 0 })).toEqual({ x: 15, y: -5, ...quieto });
});

test('agregar, mover y quitar keyframes', () => {
    let a = ponerKeyframe(crearAnimacion(0, { x: 0, y: 0 }), 200, { x: 100, y: 0, ...quieto });
    a = agregarKeyframe(a, 100);
    expect(a.keyframes.map((k) => [k.tiempo, k.x])).toEqual([[0, 0], [100, 50], [200, 100]]);
    expect(moverKeyframe(a, 100, 200)).toBe(a); // choca con otro
    a = moverKeyframe(a, 100, 150);
    expect(a.keyframes.map((k) => k.tiempo)).toEqual([0, 150, 200]);
    a = quitarKeyframe(quitarKeyframe(quitarKeyframe(a, 0), 150), 200);
    expect(a.keyframes).toHaveLength(1); // siempre queda uno
});

test('la animación de una fila es la de la primera capa que la tenga, sin el estado de esa capa', () => {
    const animacion = { ...crearAnimacion(0, { x: 1, y: 2 }), actual: { x: 5, y: 5, ...quieto } };
    const { actual, ...sinActual } = animacion;
    expect(animacionDeFila([null, { imagen: 'x' }, { imagen: 'b', animacion }])).toEqual(sinActual);
    expect(animacionDeFila([null, { imagen: 'x' }])).toBeNull();
});

test('un gesto sobre algo ya transformado suma movimientos y giros, y multiplica escalas', () => {
    const t = sumarGestos({ ...SIN_TRANSFORMACION, dx: 10, escalaX: 2, escalaY: 2, angulo: 30 }, { dx: 5, dy: -5, escalaX: 1.5, escalaY: 1.5, angulo: 15 });
    expect(t).toEqual({ dx: 15, dy: -5, escalaX: 3, escalaY: 3, angulo: 45 });
});
