import { prepararParaEditar } from './capas';

test('al editar, el fondo queda bloqueado y la capa activa es la de más arriba que se puede editar', () => {
    const capas = [
        { clave: 'a', nombre: 'Fondo', visible: true, bloqueada: false },
        { clave: 'b', nombre: 'Línea', visible: true, bloqueada: false },
        { clave: 'c', nombre: 'Pelota', visible: true, bloqueada: true, pista: 'n1' },
    ];
    const { capas: preparadas, activa } = prepararParaEditar(capas);
    expect(preparadas[0].bloqueada).toBe(true);
    expect(preparadas.slice(1)).toEqual(capas.slice(1));
    expect(capas[0].bloqueada).toBe(false); // no cambia la lista original
    expect(activa).toBe('b');
});

test('un frame con una sola capa recibe una capa vacía encima para dibujar', () => {
    const { capas, activa } = prepararParaEditar([{ clave: 'a', nombre: 'Fondo', visible: true, bloqueada: false }]);
    expect(capas.map((c) => c.nombre)).toEqual(['Fondo', 'Capa 1']);
    expect(capas[0].bloqueada).toBe(true);
    expect(activa).toBe(capas[1].clave);
});

test('si el fondo ya estaba bloqueado no se toca', () => {
    const capas = [
        { clave: 'a', nombre: 'Fondo', visible: true, bloqueada: true },
        { clave: 'b', nombre: 'Capa 1', visible: true, bloqueada: false },
    ];
    expect(prepararParaEditar(capas).capas).toBe(capas);
});