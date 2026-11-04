import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import VisualizacionFrames from './VisualizacionFrames';
import * as api from '../services/servicioAPI';

jest.mock('../services/servicioAPI');

const frame = (id) => ({ id, duracion: 100, imagen: 'data:image/png;base64,AAAA' });

beforeEach(() => {
    jest.resetAllMocks();
    api.obtenerProyecto.mockResolvedValue({ id: 1, nombre: 'P' });
    api.obtenerFrames.mockResolvedValue([frame(1), frame(2), frame(3)]);
    api.obtenerMensajeError.mockImplementation((e) => e.message);
    window.confirm = jest.fn(() => true);
});

async function pintar() {
    render(
        <MemoryRouter initialEntries={['/proyectos/1']}>
            <Routes><Route path="/proyectos/:id" element={<VisualizacionFrames />} /></Routes>
        </MemoryRouter>
    );
    await screen.findByText(/Frame 1 de 3/);
}

const gif = (tipo = 'image/gif', bytes = 5) => new File([new Uint8Array(bytes)], 'a.gif', { type: tipo });

test('muestra los límites 100 frames y 10 MB y solo ofrece importar GIF', async () => {
    await pintar();
    expect(screen.getByText(/Máximo 10 MB y 100 frames/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Elige un archivo GIF/)).toHaveAttribute('accept', 'image/gif');
    expect(screen.queryByLabelText(/video/i)).toBeNull();
});

test('pide confirmación al importar un GIF sobre frames existentes y no importa si se cancela', async () => {
    window.confirm = jest.fn(() => false);
    await pintar();
    fireEvent.change(screen.getByLabelText(/Elige un archivo GIF/), { target: { files: [gif()] } });
    expect(window.confirm).toHaveBeenCalled();
    expect(api.subirGIF).not.toHaveBeenCalled();
});

test('importa el GIF tras confirmar', async () => {
    api.subirGIF.mockResolvedValue([frame(7)]);
    await pintar();
    fireEvent.change(screen.getByLabelText(/Elige un archivo GIF/), { target: { files: [gif()] } });
    await waitFor(() => expect(api.subirGIF).toHaveBeenCalled());
    expect(await screen.findByText(/Frame 1 de 1/)).toBeInTheDocument();
});

test('rechaza archivos que no son GIF o superan 10 MB sin llamar al servidor', async () => {
    await pintar();
    fireEvent.change(screen.getByLabelText(/Elige un archivo GIF/), { target: { files: [gif('video/mp4')] } });
    expect(await screen.findByText('Solo se permiten archivos GIF.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Elige un archivo GIF/), { target: { files: [gif('image/gif', 10 * 1024 * 1024 + 1)] } });
    expect(await screen.findByText(/supera el máximo de 10 MB/)).toBeInTheDocument();
    expect(api.subirGIF).not.toHaveBeenCalled();
});

test('los atajos de frames siguen fijos: Ctrl+A selecciona todo y Supr elimina', async () => {
    await pintar();
    fireEvent.keyDown(document, { key: 'a', ctrlKey: true });
    expect(await screen.findByText(/3 seleccionado/)).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Delete' });
    expect(await screen.findByText(/No quedan frames/)).toBeInTheDocument();
});
