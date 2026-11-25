import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import PanelProyectos from './PanelProyectos';
import { obtenerProyectos, crearProyecto } from '../services/servicioAPI';

jest.mock('../services/servicioAPI', () => ({
    obtenerProyectos: jest.fn(),
    crearProyecto: jest.fn(),
    actualizarProyecto: jest.fn(),
    eliminarProyecto: jest.fn(),
    obtenerMensajeError: () => 'Error',
    borrarToken: jest.fn(),
    correoDeSesion: () => '',
}));

const gato = {
    id: 7, nombre: 'Gato saltando', etiquetas: ['loop', '5fps'], color: 'azul', ancho: 480, alto: 270,
    cantidad_frames: 12, fecha_creacion: '2026-11-20T10:00:00', fecha_edicion: null, miniatura: null,
};

function abrir() {
    render(
        <MemoryRouter initialEntries={['/proyectos']}>
            <Routes>
                <Route path="/proyectos" element={<PanelProyectos />} />
                <Route path="/proyectos/:id/:etapa" element={<p>Proyecto abierto</p>} />
            </Routes>
        </MemoryRouter>
    );
}

test('cada tarjeta muestra el lienzo, los frames, el color y las etiquetas', async () => {
    obtenerProyectos.mockResolvedValue([gato]);
    abrir();
    await screen.findByRole('heading', { name: 'Gato saltando' });
    // La primera tarjeta es la de crear un proyecto; la segunda, la del proyecto
    const tarjeta = screen.getAllByRole('listitem').find((li) => within(li).queryByRole('heading', { name: 'Gato saltando' }));
    expect(within(tarjeta).getByText('480 × 270 px · 12 frames')).toBeInTheDocument();
    expect(within(tarjeta).getByRole('img', { name: 'Color Azul' })).toBeInTheDocument();
    expect(within(tarjeta).getByText('loop')).toBeInTheDocument();
    // De izquierda a derecha: eliminar, ajustes y, al final, Editar (el principal)
    const botones = within(tarjeta).getAllByRole('button').filter((b) => b.classList.contains('boton-icono'));
    expect(botones.map((b) => b.getAttribute('aria-label'))).toEqual(['Eliminar Gato saltando', 'Nombre, etiquetas y color', 'Editar Gato saltando']);
    expect(botones[2]).toHaveClass('boton-principal');
});

test('Editar abre el proyecto; ajustes cambia nombre, etiquetas y color ahí mismo', async () => {
    obtenerProyectos.mockResolvedValue([gato]);
    abrir();
    fireEvent.click(await screen.findByRole('button', { name: 'Nombre, etiquetas y color' }));
    expect(screen.getByLabelText('Nombre')).toHaveValue('Gato saltando');
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Editar Gato saltando' }));
    expect(await screen.findByText('Proyecto abierto')).toBeInTheDocument();
});

test('el proyecto nuevo se crea sin descripción ni lienzo y se abre en Frames', async () => {
    obtenerProyectos.mockResolvedValue([]);
    crearProyecto.mockResolvedValue({ id: 9 });
    abrir();
    fireEvent.click(await screen.findByRole('button', { name: /Nuevo proyecto/ }));
    expect(screen.queryByLabelText(/Descripción/)).toBeNull();
    expect(screen.queryByText(/lienzo en blanco/)).toBeNull();
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Banner' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear' }));
    expect(await screen.findByText('Proyecto abierto')).toBeInTheDocument();
    expect(crearProyecto).toHaveBeenCalledWith({ nombre: 'Banner', etiquetas: [], color: null });
});
