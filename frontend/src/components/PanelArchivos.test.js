import { render, screen, fireEvent, within } from '@testing-library/react';
import PanelArchivos, { TIPO_ARCHIVO } from './PanelArchivos';
import { motivoRechazo, TIPOS_IMAGEN } from '../utils/importarImagen';

const gato = { id: 1, nombre: 'gato.gif', tipo: 'image/gif', tamano: 2.5 * 1024 * 1024, url: 'blob:gato' };
const fondo = { id: 2, nombre: 'fondo.png', tipo: 'image/png', tamano: 3000, url: 'blob:fondo' };

function abrir(props = {}) {
    const archivos = { lista: [gato, fondo], cargando: false, agregando: false, error: '', agregar: jest.fn(() => Promise.resolve(1)), eliminar: jest.fn() };
    const onUsar = jest.fn();
    render(<PanelArchivos archivos={archivos} usos={['final', 'seleccion', 'reemplazar']} onUsar={onUsar} onCerrar={jest.fn()} {...props} />);
    return { archivos, onUsar };
}

test('muestra cada archivo con su tipo y tamaño, y lo usa en el proyecto', () => {
    const { onUsar } = abrir();
    const items = screen.getAllByRole('listitem');
    expect(within(items[0]).getByText('GIF · 2,5 MB')).toBeInTheDocument();
    expect(within(items[1]).getByText('PNG · 3 KB')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Insertar "gato.gif" al final' }));
    expect(onUsar).toHaveBeenCalledWith(gato, 'final');
    fireEvent.click(screen.getByRole('button', { name: 'Insertar "fondo.png" después de la selección' }));
    expect(onUsar).toHaveBeenCalledWith(fondo, 'seleccion');
});

test('cada archivo se puede arrastrar a la lista de frames', () => {
    abrir();
    const datos = { setData: jest.fn(), effectAllowed: '' };
    fireEvent.dragStart(screen.getAllByRole('listitem')[1], { dataTransfer: datos });
    expect(datos.setData).toHaveBeenCalledWith(TIPO_ARCHIVO, '2');
});

test('donde no se pueden usar, solo se ven y se pueden quitar', () => {
    window.confirm = jest.fn(() => true);
    const { archivos } = abrir({ usos: [] });
    expect(screen.queryByRole('button', { name: /al final/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Quitar "gato.gif"' }));
    expect(archivos.eliminar).toHaveBeenCalledWith(1);
});

test('se pueden subir archivos arrastrándolos desde el computador', () => {
    const { archivos } = abrir();
    const subido = new File(['x'], 'nuevo.gif', { type: 'image/gif' });
    fireEvent.drop(screen.getByRole('complementary', { name: 'Archivos' }), { dataTransfer: { types: ['Files'], files: [subido] } });
    expect(archivos.agregar).toHaveBeenCalledWith([subido]);
});

test('solo se aceptan GIF, PNG, JPG y WEBP de hasta 30 MB', () => {
    expect(motivoRechazo(new File(['x'], 'a.gif', { type: 'image/gif' }))).toBe('');
    expect(motivoRechazo(new File(['x'], 'a.pdf', { type: 'application/pdf' }))).toBe('"a.pdf" no es GIF, PNG, JPG ni WEBP.');
    // Como capa del editor no se acepta GIF: la misma regla, con otra lista de tipos
    expect(motivoRechazo(new File(['x'], 'a.gif', { type: 'image/gif' }), TIPOS_IMAGEN)).toBe('"a.gif" no es PNG, JPG ni WEBP.');
    const grande = new File(['x'], 'b.png', { type: 'image/png' });
    Object.defineProperty(grande, 'size', { value: 31 * 1024 * 1024 });
    expect(motivoRechazo(grande)).toMatch(/30 MB/);
});
