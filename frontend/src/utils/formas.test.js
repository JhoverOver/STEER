import { rectanguloEntre, transformarForma, cajaForma, problemaForma } from './formas';
import { mensajeCapaNoEditable } from './herramientas';
import { crearHistorialEditor, registrarCambio, deshacer, rehacer } from './historialEditor';
import { duplicarCapa } from './capas';

test('un rectángulo arrastrado en cualquier dirección queda con su centro y su tamaño', () => {
    const r = rectanguloEntre({ x: 110, y: 90 }, { x: 10, y: 10 }, '#ff0000');
    expect(r).toMatchObject({ tipo: 'rectangulo', x: 60, y: 50, ancho: 100, alto: 80, rotacion: 0 });
    expect(cajaForma(r)).toEqual({ x: 10, y: 10, ancho: 100, alto: 80 });
    expect(problemaForma(r)).toBe('');
});

test('mover, escalar y girar un rectángulo cambia su forma, no solo sus píxeles', () => {
    const r = rectanguloEntre({ x: 0, y: 0 }, { x: 100, y: 50 }, '#00ff00');
    const region = cajaForma(r);
    const movido = transformarForma(r, region, { dx: 20, dy: -10, escalaX: 1, escalaY: 1, angulo: 0 });
    expect(movido).toMatchObject({ x: 70, y: 15, ancho: 100, alto: 50 });
    const escalado = transformarForma(r, region, { dx: 0, dy: 0, escalaX: 2, escalaY: 0.5, angulo: 90 });
    expect(escalado).toMatchObject({ x: 50, y: 25, ancho: 200, alto: 25, rotacion: 90 });
});

test('en una capa con forma solo se puede usar Mover', () => {
    const capa = { visible: true, bloqueada: false, forma: { tipo: 'rectangulo' } };
    expect(mensajeCapaNoEditable(capa, 'mover')).toBeNull();
    expect(mensajeCapaNoEditable(capa, 'pincel')).toMatch(/rectángulo/);
    expect(mensajeCapaNoEditable({ ...capa, forma: { tipo: 'texto' } }, 'borrador')).toMatch(/texto/);
    expect(mensajeCapaNoEditable({ ...capa, bloqueada: true }, 'mover')).toMatch(/bloqueada/);
});

test('deshacer un cambio de forma devuelve la forma de antes y rehacer la nueva', () => {
    const antes = { tipo: 'rectangulo', x: 1 };
    const despues = { tipo: 'rectangulo', x: 2 };
    let forma = despues;
    const pixeles = new Uint8ClampedArray(4);
    const leer = () => pixeles;
    const escribir = () => {};
    let h = registrarCambio(crearHistorialEditor(), { clave: 'a', x: 0, y: 0, ancho: 1, alto: 1, pixeles, forma: antes });
    let paso = deshacer(h, leer, escribir, () => forma);
    expect(paso.entrada.forma).toBe(antes);
    forma = antes;
    h = paso.historial;
    paso = rehacer(h, leer, escribir, () => forma);
    expect(paso.entrada.forma).toBe(despues);
});

test('duplicar una capa con forma copia la forma, sin su grupo de Video', () => {
    const capas = [{ clave: 'a', nombre: 'Texto', visible: true, bloqueada: false, forma: { tipo: 'texto', x: 1, grupo: 'g1' } }];
    const [, copia] = duplicarCapa(capas, 'a');
    expect(copia.forma).toEqual({ tipo: 'texto', x: 1 });
});
