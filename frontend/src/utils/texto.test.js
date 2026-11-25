import { medirBloque, esquinasTexto, cajaTexto, transformarTexto, problemaTexto, limitarTamanoTexto, textoInicial } from './texto';

// En las pruebas no hay canvas: cada letra mide la mitad del tamaño de la fuente
const medir = (tamano) => (linea) => linea.length * tamano / 2;

test('el bloque mide lo que su línea más larga y tantas líneas como tenga', () => {
    const texto = { ...textoInicial(100, 50), contenido: 'Hola\nmundo!', tamano: 20 };
    const bloque = medirBloque(texto, medir(20));
    expect(bloque.ancho).toBe(60);
    expect(bloque.alto).toBe(48); // 2 líneas x 20 px x 1,2
    expect(cajaTexto(texto, bloque)).toEqual({ x: 70, y: 26, ancho: 60, alto: 48 });
});

test('girado 90° el bloque queda de pie', () => {
    const texto = { ...textoInicial(100, 100), contenido: 'abcd', tamano: 10, rotacion: 90 };
    const bloque = medirBloque(texto, medir(10)); // 20 x 12
    const caja = cajaTexto(texto, bloque);
    expect(caja.ancho).toBe(12);
    expect(caja.alto).toBe(20);
    expect(esquinasTexto(texto, bloque)).toHaveLength(4);
});

test('las manijas mueven, agrandan y giran el texto sin dejar de ser texto', () => {
    const texto = { ...textoInicial(50, 50), tamano: 20 };
    const region = { x: 0, y: 0, ancho: 100, alto: 100 }; // centro (50, 50)
    expect(transformarTexto(texto, region, { dx: 10, dy: -5, escalaX: 1, escalaY: 1, angulo: 0 })).toMatchObject({ x: 60, y: 45, tamano: 20 });
    expect(transformarTexto(texto, region, { dx: 0, dy: 0, escalaX: 2, escalaY: 2, angulo: 30 })).toMatchObject({ x: 50, y: 50, tamano: 40, rotacion: 30 });
    // Un texto fuera del centro gira alrededor del centro de la región
    const lado = { ...texto, x: 100, y: 50 };
    const girado = transformarTexto(lado, region, { dx: 0, dy: 0, escalaX: 1, escalaY: 1, angulo: 90 });
    expect(girado.x).toBeCloseTo(50);
    expect(girado.y).toBeCloseTo(100);
});

test('límites del texto', () => {
    expect(problemaTexto({ contenido: '  ' })).toBe('Escribe algo.');
    expect(problemaTexto({ contenido: 'ok' })).toBe('');
    expect(limitarTamanoTexto(2)).toBe(4);
    expect(limitarTamanoTexto(9000)).toBe(600);
});
