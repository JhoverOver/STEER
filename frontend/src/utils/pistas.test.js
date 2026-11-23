import {
    crearPista, valoresEn, framesDePista, agregarKeyframe, cambiarKeyframe, eliminarKeyframe,
    pistasDesdeServidor, pistasLista, archivosDePistas, hayCambiosPistas, claveDePista, crearKeyframe,
} from './pistas';
import { desvincularPista } from './generarPistas';

function pistaDePrueba() {
    const pista = crearPista({ nombre: 'Pelota', imagen: 'data:x', blob: 'BLOB', tiempo: 0 });
    // De 0 a 1000 ms la pelota avanza 100 px, crece al 200 % y se desvanece
    return agregarKeyframe(pista, 1000);
}

function conValores(pista, tiempo, valores) {
    const keyframe = pista.keyframes.find((k) => k.tiempo === tiempo);
    return cambiarKeyframe(pista, keyframe.clave, valores);
}

describe('interpolación (RF54)', () => {
    const base = conValores(pistaDePrueba(), 1000, { x: 100, escala: 200, opacidad: 0 });

    test('lineal: a la mitad del tiempo, la mitad del cambio', () => {
        const v = valoresEn(base.keyframes, 500);
        expect(v.x).toBeCloseTo(50);
        expect(v.escala).toBeCloseTo(150);
        expect(v.opacidad).toBeCloseTo(50);
    });

    test('suave: lento al salir y al llegar, igual a la mitad', () => {
        const suave = conValores(base, 0, { curva: 'suave' });
        expect(valoresEn(suave.keyframes, 100).x).toBeLessThan(10);
        expect(valoresEn(suave.keyframes, 500).x).toBeCloseTo(50);
        expect(valoresEn(suave.keyframes, 900).x).toBeGreaterThan(90);
    });

    test('antes del primero y después del último se mantienen los extremos', () => {
        expect(valoresEn(base.keyframes, -50).x).toBe(0);
        expect(valoresEn(base.keyframes, 5000).x).toBe(100);
    });
});

describe('frames donde aparece la pista', () => {
    const frames = [100, 100, 100, 100, 100].map((duracion) => ({ duracion }));

    test('solo los frames entre el primer y el último keyframe', () => {
        const pista = conValores(agregarKeyframe(crearPista({ nombre: 'a', tiempo: 150 }), 320), 320, {});
        expect(framesDePista(frames, pista)).toEqual([
            { indice: 1, tiempo: 150 },
            { indice: 2, tiempo: 200 },
            { indice: 3, tiempo: 300 },
        ]);
    });

    test('un solo keyframe aparece en un solo frame', () => {
        expect(framesDePista(frames, crearPista({ nombre: 'a', tiempo: 0 }))).toEqual([{ indice: 0, tiempo: 0 }]);
    });
});

describe('cambios a los keyframes (RF53)', () => {
    test('no se agregan dos keyframes en el mismo momento', () => {
        const pista = pistaDePrueba();
        expect(agregarKeyframe(pista, 1000)).toBe(pista);
    });

    test('mover un keyframe encima de otro no cambia nada', () => {
        const pista = pistaDePrueba();
        expect(cambiarKeyframe(pista, pista.keyframes[1].clave, { tiempo: 0 })).toBe(pista);
    });

    test('los valores se limitan a los rangos del servidor', () => {
        const pista = conValores(pistaDePrueba(), 0, { escala: 5000, opacidad: -3 });
        expect(pista.keyframes[0].escala).toBe(1000);
        expect(pista.keyframes[0].opacidad).toBe(0);
    });

    test('una pista conserva al menos un keyframe', () => {
        const pista = crearPista({ nombre: 'a', tiempo: 0 });
        expect(eliminarKeyframe(pista, pista.keyframes[0].clave)).toBe(pista);
    });
});

describe('guardar (RF55)', () => {
    test('la pista nueva va con su PNG; la guardada, por su id', () => {
        const guardada = pistasDesdeServidor([{ id: 7, nombre: 'Vieja', imagen: 'data:y', keyframes: [crearKeyframe(0)] }])[0];
        const nueva = pistaDePrueba();
        const lista = pistasLista([guardada, nueva]);
        expect(lista[0]).toMatchObject({ clave: claveDePista(7), id: 7, nombre: 'Vieja' });
        expect(lista[1]).toMatchObject({ archivo: 'pista-1', nombre: 'Pelota' });
        expect(lista[1].keyframes[0].clave).toBeUndefined(); // las claves del navegador no viajan
        expect(archivosDePistas([guardada, nueva])).toEqual([{ campo: 'pista-1', blob: 'BLOB' }]);
    });

    test('detecta cambios en los keyframes', () => {
        const pista = pistaDePrueba();
        expect(hayCambiosPistas([pista], [pista])).toBe(false);
        expect(hayCambiosPistas([conValores(pista, 1000, { y: 30 })], [pista])).toBe(true);
    });
});

test('al eliminar una pista sus capas quedan como capas normales', () => {
    const frames = [
        { clave: 'f1', capas: [{ clave: 'c1', nombre: 'Fondo' }, { clave: 'c2', nombre: 'Pelota', pista: 'n1', bloqueada: true }] },
        { clave: 'f2' },
    ];
    const resultado = desvincularPista(frames, 'n1');
    expect(resultado[0].capas[1]).toEqual({ clave: 'c2', nombre: 'Pelota', bloqueada: false });
    expect(resultado[0].capas[0]).toBe(frames[0].capas[0]);
    expect(resultado[1]).toBe(frames[1]);
});