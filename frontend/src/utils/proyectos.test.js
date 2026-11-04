import { analizarEtiquetas, filtrarProyectos, FILTROS_VACIOS, etiquetasDisponibles } from './proyectos';

const proyectos = [
    { id: 1, nombre: 'Gato saltando', color: 'azul', etiquetas: ['Loop', 'gato'], fecha_creacion: '2026-10-01T12:00:00', fecha_edicion: '2026-10-20T12:00:00' },
    { id: 2, nombre: 'Logo animado', color: null, etiquetas: ['cliente'], fecha_creacion: '2026-10-10T12:00:00', fecha_edicion: null },
    { id: 3, nombre: 'Gaviota', color: 'rojo', etiquetas: ['loop'], fecha_creacion: '2026-09-01T12:00:00', fecha_edicion: null },
];
const ids = (lista) => lista.map((p) => p.id);

describe('analizarEtiquetas', () => {
    test('separa por coma, recorta y quita repetidas sin distinguir mayúsculas', () => {
        expect(analizarEtiquetas(' cine, loop ,Cine,,').etiquetas).toEqual(['cine', 'loop']);
    });
    test('rechaza más de 5 etiquetas', () => {
        expect(analizarEtiquetas('a,b,c,d,e,f').error).toMatch(/máximo 5/);
    });
    test('rechaza etiquetas de más de 20 caracteres', () => {
        expect(analizarEtiquetas('x'.repeat(21)).error).toMatch(/20 caracteres/);
        expect(analizarEtiquetas('x'.repeat(20)).error).toBe('');
    });
});

describe('filtrarProyectos', () => {
    test('sin filtros devuelve todo', () => {
        expect(ids(filtrarProyectos(proyectos, FILTROS_VACIOS))).toEqual([1, 2, 3]);
    });
    test('por nombre (sin distinguir mayúsculas)', () => {
        expect(ids(filtrarProyectos(proyectos, { ...FILTROS_VACIOS, nombre: 'ga' }))).toEqual([1, 3]);
    });
    test('por etiqueta (sin distinguir mayúsculas)', () => {
        expect(ids(filtrarProyectos(proyectos, { ...FILTROS_VACIOS, etiqueta: 'loop' }))).toEqual([1, 3]);
    });
    test('por color y por "sin color"', () => {
        expect(ids(filtrarProyectos(proyectos, { ...FILTROS_VACIOS, color: 'rojo' }))).toEqual([3]);
        expect(ids(filtrarProyectos(proyectos, { ...FILTROS_VACIOS, color: 'ninguno' }))).toEqual([2]);
    });
    test('por rango de fechas de última modificación, incluyendo los días de los extremos', () => {
        expect(ids(filtrarProyectos(proyectos, { ...FILTROS_VACIOS, desde: '2026-10-10', hasta: '2026-10-20' }))).toEqual([1, 2]);
        expect(ids(filtrarProyectos(proyectos, { ...FILTROS_VACIOS, hasta: '2026-09-30' }))).toEqual([3]);
    });
    test('combina varios filtros', () => {
        expect(ids(filtrarProyectos(proyectos, { ...FILTROS_VACIOS, nombre: 'ga', etiqueta: 'loop', color: 'azul' }))).toEqual([1]);
    });
});

test('etiquetasDisponibles une etiquetas sin repetir y ordenadas', () => {
    expect(etiquetasDisponibles(proyectos)).toEqual(['cliente', 'gato', 'Loop']);
});
