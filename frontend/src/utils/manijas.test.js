import {
    posicionesManijas, manijaEnPunto, escalaPorEsquina, giroPorManija, esSinTransformacion, cabeEnArea,
    DISTANCIA_GIRO, SIN_TRANSFORMACION,
} from './manijas';
import { esquinasTransformadas, rectanguloTransformado } from './herramientas';
import { grupoDeRegion } from './objetos';

const caja = { x: 100, y: 100, ancho: 80, alto: 40 };
const redondear = (p) => ({ x: Math.round(p.x * 1000) / 1000, y: Math.round(p.y * 1000) / 1000 });

test('la manija de giro sobresale arriba al centro, o abajo si no cabe', () => {
    expect(posicionesManijas(caja, 1).giro).toEqual({ x: 140, y: 100 - DISTANCIA_GIRO });
    // Con zoom 2 la distancia en pantalla es la misma: en píxeles de la zona es la mitad
    expect(posicionesManijas(caja, 2).giro.y).toBe(100 - DISTANCIA_GIRO / 2);
    const pegadaArriba = { ...caja, y: 5 };
    expect(posicionesManijas(pegadaArriba, 1).giro.y).toBe(5 + 40 + DISTANCIA_GIRO);
});

test('reconoce las esquinas y la manija de giro bajo el mouse', () => {
    expect(manijaEnPunto(caja, { x: 101, y: 99 }, 1)).toBe('no');
    expect(manijaEnPunto(caja, { x: 180, y: 140 }, 1)).toBe('se');
    expect(manijaEnPunto(caja, { x: 140, y: 100 - DISTANCIA_GIRO }, 1)).toBe('giro');
    expect(manijaEnPunto(caja, { x: 140, y: 120 }, 1)).toBeNull(); // el centro mueve, no escala
});

test('en una caja chica, el interior sirve para mover', () => {
    const chica = { x: 10, y: 50, ancho: 6, alto: 6 };
    expect(manijaEnPunto(chica, { x: 13, y: 53 }, 1)).toBeNull();
    expect(manijaEnPunto(chica, { x: 9, y: 49 }, 1)).toBe('no');
});

test('escalar desde una esquina deja fija la opuesta y mantiene la proporción', () => {
    // Arrastrar la esquina inferior derecha al doble de distancia
    const t = escalaPorEsquina(caja, 'se', { x: 260, y: 180 });
    expect(t.escalaX).toBe(2);
    expect(t.escalaY).toBe(2);
    const esquinas = esquinasTransformadas(caja, t).map(redondear);
    expect(esquinas[0]).toEqual({ x: 100, y: 100 }); // la superior izquierda no se movió
    expect(esquinas[2]).toEqual({ x: 260, y: 180 });
});

test('con Shift cada eje se estira por separado', () => {
    const t = escalaPorEsquina(caja, 'no', { x: 140, y: 60 }, true);
    expect(t.escalaX).toBe(0.5);
    expect(t.escalaY).toBe(2);
    expect(rectanguloTransformado(caja, t)).toEqual({ x: 140, y: 60, ancho: 40, alto: 80 });
});

test('no se puede achicar a menos de 1 px ni dar vuelta', () => {
    const t = escalaPorEsquina(caja, 'se', { x: 0, y: 0 });
    expect(t.escalaX).toBeGreaterThan(0);
    const destino = rectanguloTransformado(caja, t);
    expect(destino.ancho).toBeGreaterThanOrEqual(1);
    expect(destino.alto).toBeGreaterThanOrEqual(1);
});

test('girar con la manija mide el ángulo alrededor del centro; con Shift va de 15 en 15', () => {
    const inicio = { x: 140, y: 60 }; // arriba del centro (140, 120)
    expect(giroPorManija(caja, inicio, { x: 200, y: 120 }).angulo).toBeCloseTo(90);
    expect(giroPorManija(caja, inicio, { x: 80, y: 120 }).angulo).toBeCloseTo(-90);
    const casi = giroPorManija(caja, inicio, { x: 140 + 60 * Math.sin(0.4), y: 120 - 60 * Math.cos(0.4) }, true);
    expect(casi.angulo).toBe(30); // 22,9° se ajusta al múltiplo de 15 más cercano
});

test('sin cambios y límites de la zona', () => {
    expect(esSinTransformacion(SIN_TRANSFORMACION)).toBe(true);
    expect(esSinTransformacion({ ...SIN_TRANSFORMACION, angulo: 15 })).toBe(false);
    expect(cabeEnArea({ x: 0, y: 0, ancho: 10, alto: 10 }, { ancho: 10, alto: 10 })).toBe(true);
    expect(cabeEnArea({ x: -1, y: 0, ancho: 10, alto: 10 }, { ancho: 20, alto: 20 })).toBe(false);
});

test('lo transformado sigue elegido: el grupo se ajusta a los píxeles que quedaron', () => {
    // Región de 4 x 3 en (10, 20) con dos píxeles opacos
    const datos = new Uint8ClampedArray(4 * 3 * 4);
    datos[(1 * 4 + 1) * 4 + 3] = 255;
    datos[(2 * 4 + 2) * 4 + 3] = 128;
    const grupo = grupoDeRegion(datos, { x: 10, y: 20, ancho: 4, alto: 3 });
    expect(grupo.rect).toEqual({ x: 11, y: 21, ancho: 2, alto: 2 });
    expect(Array.from(grupo.mascara)).toEqual([1, 0, 0, 1]);
    expect(grupoDeRegion(new Uint8ClampedArray(16), { x: 0, y: 0, ancho: 2, alto: 2 })).toBeNull();
});