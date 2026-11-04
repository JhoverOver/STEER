import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import PanelProyectos from './PanelProyectos';
import * as api from '../services/servicioAPI';

jest.mock('../services/servicioAPI');

const lista = [
    { id: 1, nombre: 'Gato saltando', descripcion: 'd', color: 'azul', etiquetas: ['loop'], miniatura: 'data:image/webp;base64,AAAA', fecha_creacion: '2026-10-01T12:00:00Z', fecha_edicion: '2026-10-20T12:00:00Z' },
    { id: 2, nombre: 'Logo', descripcion: null, color: null, etiquetas: [], miniatura: null, fecha_creacion: '2026-10-10T12:00:00Z', fecha_edicion: null },
];

beforeEach(() => {
    jest.resetAllMocks();
    api.obtenerProyectos.mockResolvedValue(lista);
    api.obtenerMensajeError.mockImplementation((e) => e.message);
});

function pintar() {
    return render(<MemoryRouter><PanelProyectos /></MemoryRouter>);
}

test('muestra miniatura, fechas de creación y edición, etiquetas y color', async () => {
    pintar();
    const tarjeta = (await screen.findByText('Gato saltando')).closest('li');
    expect(within(tarjeta).getByAltText(/Primer frame de Gato saltando/)).toHaveAttribute('src', 'data:image/webp;base64,AAAA');
    expect(within(tarjeta).getByText(/Creado:/)).toBeInTheDocument();
    expect(within(tarjeta).getByText(/Editado:/)).toBeInTheDocument();
    expect(within(tarjeta).getByText('loop')).toBeInTheDocument();
    expect(within(tarjeta).getByText(/Color: Azul/)).toBeInTheDocument();
    const sinEditar = screen.getByText('Logo').closest('li');
    expect(within(sinEditar).queryByText(/Editado:/)).toBeNull();
    expect(within(sinEditar).getByRole('img', { name: /sin frames/i })).toBeInTheDocument();
});

test('filtra por nombre y por color y permite limpiar', async () => {
    pintar();
    await screen.findByText('Gato saltando');
    await userEvent.type(screen.getByLabelText('Nombre', { selector: '#filtro-nombre' }), 'logo');
    expect(screen.queryByText('Gato saltando')).toBeNull();
    expect(screen.getByText(/Mostrando 1 de 2/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    expect(screen.getByText('Gato saltando')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Color', { selector: '#filtro-color' }), 'azul');
    expect(screen.queryByText('Logo')).toBeNull();
});

test('crea un proyecto con etiquetas y color', async () => {
    api.crearProyecto.mockResolvedValue({ id: 3 });
    pintar();
    await screen.findByText('Gato saltando');
    await userEvent.type(screen.getByLabelText('Nombre', { selector: '#nuevo-nombre' }), '  Nuevo ');
    await userEvent.type(screen.getByLabelText(/Etiquetas \(opcional\)/, { selector: '#nuevo-etiquetas' }), 'cine, loop');
    await userEvent.click(screen.getByLabelText('Verde'));
    await userEvent.click(screen.getByRole('button', { name: 'Crear proyecto' }));
    await waitFor(() => expect(api.crearProyecto).toHaveBeenCalledWith('Nuevo', '', ['cine', 'loop'], 'verde'));
});

test('no crea si hay más de 5 etiquetas y avisa', async () => {
    pintar();
    await screen.findByText('Gato saltando');
    await userEvent.type(screen.getByLabelText('Nombre', { selector: '#nuevo-nombre' }), 'X');
    await userEvent.type(screen.getByLabelText(/Etiquetas \(opcional\)/, { selector: '#nuevo-etiquetas' }), 'a,b,c,d,e,f');
    await userEvent.click(screen.getByRole('button', { name: 'Crear proyecto' }));
    expect(await screen.findByText(/como máximo 5 etiquetas/)).toBeInTheDocument();
    expect(api.crearProyecto).not.toHaveBeenCalled();
});

test('edita los datos de un proyecto', async () => {
    api.actualizarProyecto.mockResolvedValue({});
    pintar();
    const tarjeta = (await screen.findByText('Logo')).closest('li');
    await userEvent.click(within(tarjeta).getByRole('button', { name: 'Editar datos' }));
    const campo = screen.getByLabelText('Nombre', { selector: '#editar-2-nombre' });
    await userEvent.clear(campo);
    await userEvent.type(campo, 'Logo v2');
    await userEvent.click(within(tarjeta).getByLabelText('Rojo'));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(api.actualizarProyecto).toHaveBeenCalledWith(2, { nombre: 'Logo v2', descripcion: '', etiquetas: [], color: 'rojo' }));
});
