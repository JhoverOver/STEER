import { render, screen, fireEvent } from '@testing-library/react';
import ListaFrames from './ListaFrames';
import { TIPO_ARCHIVO } from './PanelArchivos';

const frames = [
    { clave: 'a', duracion: 100, imagen: 'data:a', vacio: false },
    { clave: 'b', duracion: 100, imagen: 'data:b', vacio: false },
];

function abrir() {
    const props = {
        frames, indiceActual: 0, seleccion: { activa: new Set(), claves: [], alternar: jest.fn() },
        deshabilitado: false, puedeEditar: true, puedePegar: true, puedeInsertar: true, proporcion: '1 / 1',
        onVer: jest.fn(), onEditar: jest.fn(), onEliminar: jest.fn(), onCambiarDuracion: jest.fn(),
        onInsertar: jest.fn(), onPegar: jest.fn(), onMover: jest.fn(), onSoltarArchivo: jest.fn(),
    };
    render(<ListaFrames {...props} />);
    return props;
}

test('Shift + clic en cualquier parte de la tarjeta marca el frame en vez de verlo', () => {
    const props = abrir();
    fireEvent.click(screen.getByRole('button', { name: 'Ver frame 2' }), { shiftKey: true });
    expect(props.seleccion.alternar).toHaveBeenCalledWith('b', false);
    expect(props.onVer).not.toHaveBeenCalled();
    // También sobre el botón de editar: marca y no abre el editor
    fireEvent.click(screen.getByRole('button', { name: /Editar frame 1/ }), { shiftKey: true });
    expect(props.seleccion.alternar).toHaveBeenCalledWith('a', false);
    expect(props.onEditar).not.toHaveBeenCalled();
});

test('Ctrl + Shift + clic marca un rango; un clic normal en la casilla marca solo ese', () => {
    const props = abrir();
    fireEvent.click(screen.getByRole('button', { name: 'Ver frame 2' }), { shiftKey: true, ctrlKey: true });
    expect(props.seleccion.alternar).toHaveBeenCalledWith('b', true);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Seleccionar frame 1' }));
    expect(props.seleccion.alternar).toHaveBeenLastCalledWith('a', false);
});

test('los huecos insertan y pegan con símbolos, y reciben archivos', () => {
    const props = abrir();
    fireEvent.click(screen.getByRole('button', { name: 'Insertar frame en blanco en la posición 2' }));
    expect(props.onInsertar).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByRole('button', { name: 'Pegar en la posición 3' }));
    expect(props.onPegar).toHaveBeenCalledWith(2);
    // La lista alterna huecos y tarjetas: hueco 0, frame 1, hueco 1, frame 2, hueco 2
    const hueco = screen.getAllByRole('listitem')[2];
    const dataTransfer = { types: [TIPO_ARCHIVO], getData: () => '7' };
    fireEvent.dragOver(hueco, { dataTransfer });
    fireEvent.drop(hueco, { dataTransfer });
    expect(props.onSoltarArchivo).toHaveBeenCalledWith(7, 1);
});