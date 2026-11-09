import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import EditorImagen from './EditorImagen';
import { obtenerCapas } from '../services/servicioAPI';

// El lienzo real necesita canvas de verdad (no existe en jsdom): se cambia por uno de mentira
// que deja ver las props que recibe y ofrece los mismos métodos.
const mockLienzo = {
    props: null,
    deshacer: jest.fn(), rehacer: jest.fn(), transformar: jest.fn(), borrarSeleccion: jest.fn(),
    seleccionarTodo: jest.fn(), quitarSeleccion: jest.fn(), copiarPixeles: jest.fn(),
    exportarCapa: jest.fn(), componer: jest.fn(),
};
jest.mock('./Lienzo', () => {
    const React = require('react');
    return {
        __esModule: true,
        default: React.forwardRef(function LienzoFalso(props, ref) {
            mockLienzo.props = props;
            React.useImperativeHandle(ref, () => mockLienzo);
            return <div data-testid="lienzo" />;
        }),
    };
});
jest.mock('../services/servicioAPI', () => ({
    obtenerCapas: jest.fn(),
    obtenerMensajeError: (error) => error.message,
}));

beforeEach(() => {
    jest.clearAllMocks();
    global.URL.createObjectURL = jest.fn(() => 'blob:prueba');
    mockLienzo.componer.mockResolvedValue(new Blob(['compuesta']));
    mockLienzo.exportarCapa.mockImplementation((clave) => Promise.resolve(new Blob([clave])));
});

const capasServidor = [
    { id: 7, nombre: 'Fondo', visible: true, bloqueada: false, imagen: 'data:image/png;base64,AAA' },
    { id: 8, nombre: 'Línea', visible: true, bloqueada: false, imagen: 'data:image/png;base64,BBB' },
];

function abrir(frame, extra = {}) {
    const props = { proyectoId: 3, ancho: 480, alto: 480, frame, onTerminar: jest.fn(), onCancelar: jest.fn(), ...extra };
    render(<EditorImagen {...props} />);
    return props;
}

test('un frame guardado pide sus capas al servidor y deja activa la de arriba', async () => {
    obtenerCapas.mockResolvedValue(capasServidor);
    abrir({ origen_id: 12 });
    expect(screen.getByText('Cargando capas...')).toBeInTheDocument();
    await screen.findByTestId('lienzo');
    expect(obtenerCapas).toHaveBeenCalledWith(3, 12);
    expect(mockLienzo.props.capas.map((c) => c.nombre)).toEqual(['Fondo', 'Línea']);
    expect(screen.getByRole('button', { name: 'Línea' })).toHaveAttribute('aria-pressed', 'true');
});

test('si falla la carga muestra el error y permite reintentar', async () => {
    obtenerCapas.mockRejectedValueOnce(new Error('Sin conexión')).mockResolvedValueOnce(capasServidor);
    abrir({ origen_id: 12 });
    expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await screen.findByTestId('lienzo');
    expect(obtenerCapas).toHaveBeenCalledTimes(2);
});

test('un frame en blanco abre con una sola capa Fondo, sin pedir nada al servidor', async () => {
    abrir({ vacio: true });
    await screen.findByTestId('lienzo');
    expect(obtenerCapas).not.toHaveBeenCalled();
    expect(mockLienzo.props.capas).toHaveLength(1);
    expect(mockLienzo.props.capas[0].nombre).toBe('Fondo');
});

test('un frame importado sin capas usa su imagen como Fondo', async () => {
    abrir({ imagen: 'blob:importada' });
    await screen.findByTestId('lienzo');
    expect(mockLienzo.props.capas[0].imagen).toBe('blob:importada');
});

test('un frame ya editado reabre con sus capas, sin pedir nada al servidor', async () => {
    const capas = [{ clave: 'x1', nombre: 'Editada', visible: true, bloqueada: false, modificada: true, imagen: 'blob:a' }];
    abrir({ origen_id: 12, capas });
    await screen.findByTestId('lienzo');
    expect(obtenerCapas).not.toHaveBeenCalled();
    expect(mockLienzo.props.capas).toBe(capas);
});

test('sin cambios, "Aplicar y cerrar" cierra sin entregar nada', async () => {
    obtenerCapas.mockResolvedValue(capasServidor);
    const props = abrir({ origen_id: 12 });
    await screen.findByTestId('lienzo');
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar y cerrar' }));
    expect(props.onCancelar).toHaveBeenCalled();
    expect(props.onTerminar).not.toHaveBeenCalled();
});

test('al aplicar entrega la imagen compuesta y el PNG solo de las capas modificadas', async () => {
    obtenerCapas.mockResolvedValue(capasServidor);
    const props = abrir({ origen_id: 12 });
    await screen.findByTestId('lienzo');
    const claveLinea = mockLienzo.props.capas[1].clave;
    act(() => mockLienzo.props.onCapaModificada(claveLinea, { x: 0, y: 0, ancho: 5, alto: 5 }));
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar y cerrar' }));
    await waitFor(() => expect(props.onTerminar).toHaveBeenCalled());
    const { capas, imagen } = props.onTerminar.mock.calls[0][0];
    expect(imagen).toBeInstanceOf(Blob);
    expect(mockLienzo.exportarCapa).toHaveBeenCalledTimes(1);
    expect(capas[0].blob).toBeUndefined();
    expect(capas[0].id).toBe(7);
    expect(capas[1].blob).toBeInstanceOf(Blob);
    expect(capas[1].imagen).toBe('blob:prueba');
});

test('cambiar la lista de capas cuenta como cambio aunque no se dibuje', async () => {
    obtenerCapas.mockResolvedValue(capasServidor);
    const props = abrir({ origen_id: 12 });
    await screen.findByTestId('lienzo');
    fireEvent.click(screen.getByRole('button', { name: 'Bloquear Fondo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar y cerrar' }));
    await waitFor(() => expect(props.onTerminar).toHaveBeenCalled());
    const { capas } = props.onTerminar.mock.calls[0][0];
    expect(capas[0].bloqueada).toBe(true);
    expect(mockLienzo.exportarCapa).not.toHaveBeenCalled();
});

test('cancelar con cambios pide confirmación', async () => {
    obtenerCapas.mockResolvedValue(capasServidor);
    const props = abrir({ origen_id: 12 });
    await screen.findByTestId('lienzo');
    fireEvent.click(screen.getByRole('button', { name: 'Bloquear Fondo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(props.onCancelar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Seguir editando' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, descartar' }));
    expect(props.onCancelar).toHaveBeenCalled();
});

test('cancelar sin cambios cierra directo', async () => {
    const props = abrir({ vacio: true });
    await screen.findByTestId('lienzo');
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(props.onCancelar).toHaveBeenCalled();
});

test('los atajos de teclado cambian de herramienta y agregan capas', async () => {
    abrir({ vacio: true });
    await screen.findByTestId('lienzo');
    fireEvent.keyDown(window, { key: 'e' });
    expect(screen.getByRole('button', { name: 'Borrador' })).toHaveAttribute('aria-pressed', 'true');
    expect(mockLienzo.props.herramienta).toBe('borrador');
    fireEvent.keyDown(window, { key: 'n' });
    expect(mockLienzo.props.capas).toHaveLength(2);
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(mockLienzo.deshacer).toHaveBeenCalled();
});

test('duplicar copia los píxeles de la capa activa en la nueva', async () => {
    abrir({ vacio: true });
    await screen.findByTestId('lienzo');
    const original = mockLienzo.props.capas[0].clave;
    fireEvent.click(screen.getByRole('button', { name: 'Duplicar capa' }));
    expect(mockLienzo.copiarPixeles).toHaveBeenCalledWith(original, mockLienzo.props.capas[1].clave);
});