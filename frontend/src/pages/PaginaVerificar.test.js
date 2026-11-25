import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import PaginaVerificar from './PaginaVerificar';
import PaginaRegistro from './PaginaRegistro';
import { verificarCorreo, reenviarCodigo, registrar, guardarToken } from '../services/servicioAPI';

jest.mock('../services/servicioAPI', () => ({
    verificarCorreo: jest.fn(),
    reenviarCodigo: jest.fn(),
    registrar: jest.fn(),
    guardarToken: jest.fn(),
    obtenerMensajeError: (e) => e.response?.data?.error || 'Error',
}));

function abrir(ruta, estado) {
    return render(
        <MemoryRouter initialEntries={[{ pathname: ruta, state: estado }]}>
            <Routes>
                <Route path="/registro" element={<PaginaRegistro />} />
                <Route path="/verificar" element={<PaginaVerificar />} />
                <Route path="/proyectos" element={<p>Proyectos</p>} />
                <Route path="/login" element={<p>Login</p>} />
            </Routes>
        </MemoryRouter>
    );
}

beforeEach(() => jest.clearAllMocks());

test('el registro ya no pide nombre de usuario y lleva a verificar el correo', async () => {
    registrar.mockResolvedValue({ email: 'ana@gmail.com', verificacion: true });
    abrir('/registro');
    expect(screen.queryByLabelText('Usuario')).toBeNull();
    fireEvent.change(screen.getByLabelText(/Correo/), { target: { value: 'ana@gmail.com' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'Clave1234' } });
    fireEvent.change(screen.getByLabelText('Confirma la contraseña'), { target: { value: 'Clave1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrarme' }));
    await screen.findByRole('heading', { name: 'Verifica tu correo' });
    expect(registrar).toHaveBeenCalledWith('ana@gmail.com', 'Clave1234');
    expect(screen.getByText('ana@gmail.com')).toBeInTheDocument();
    // Recién enviado: hay que esperar para pedir otro
    expect(screen.getByRole('button', { name: /Pedir otro código \(\d+ s\)/ })).toBeDisabled();
});

test('un correo temporal se marca en el campo de correo', async () => {
    registrar.mockRejectedValue({ response: { status: 400, data: { error: 'No se aceptan correos temporales o desechables.' } } });
    abrir('/registro');
    fireEvent.change(screen.getByLabelText(/Correo/), { target: { value: 'a@mailinator.com' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'Clave1234' } });
    fireEvent.change(screen.getByLabelText('Confirma la contraseña'), { target: { value: 'Clave1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrarme' }));
    expect(await screen.findByText(/temporales/)).toHaveAttribute('id', 'email-error');
});

test('con el código correcto guarda la sesión y entra a los proyectos', async () => {
    verificarCorreo.mockResolvedValue({ token: 'tk', usuario: {} });
    abrir('/verificar', { email: 'ana@gmail.com', recienEnviado: true });
    fireEvent.change(screen.getByLabelText('Código'), { target: { value: '04 2817' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verificar y entrar' }));
    await screen.findByText('Proyectos');
    expect(verificarCorreo).toHaveBeenCalledWith('ana@gmail.com', '042817');
    expect(guardarToken).toHaveBeenCalledWith('tk', {});
});

test('un código incorrecto muestra el error del servidor', async () => {
    verificarCorreo.mockRejectedValue({ response: { status: 400, data: { error: 'El código no es correcto. Te quedan 4 intento(s).' } } });
    abrir('/verificar', { email: 'ana@gmail.com' });
    fireEvent.change(screen.getByLabelText('Código'), { target: { value: '111111' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verificar y entrar' }));
    expect(await screen.findByText(/Te quedan 4/)).toBeInTheDocument();
});

test('desde el inicio de sesión se puede pedir otro código de inmediato', async () => {
    reenviarCodigo.mockResolvedValue({});
    abrir('/verificar', { email: 'ana@gmail.com', mensaje: 'Tu correo aún no está verificado.' });
    expect(screen.getByText('Tu correo aún no está verificado.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Pedir otro código' }));
    await waitFor(() => expect(reenviarCodigo).toHaveBeenCalledWith('ana@gmail.com'));
    expect(await screen.findByRole('button', { name: /Pedir otro código \(\d+ s\)/ })).toBeDisabled();
});

test('abierta directo, también pide el correo', () => {
    abrir('/verificar');
    expect(screen.getByLabelText('Correo')).toBeInTheDocument();
});

test('si el servidor pide esperar, el botón cuenta los segundos que faltan', async () => {
    reenviarCodigo.mockRejectedValue({ response: { status: 429, data: { error: 'Espera 12 s para pedir otro código.', espera: 12 } } });
    abrir('/verificar', { email: 'ana@gmail.com', mensaje: 'Tu correo aún no está verificado.' });
    fireEvent.click(screen.getByRole('button', { name: 'Pedir otro código' }));
    expect(await screen.findByText('Espera 12 s para pedir otro código.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pedir otro código (12 s)' })).toBeDisabled();
});

test('mientras verifica, el botón muestra que está ocupado', async () => {
    verificarCorreo.mockReturnValue(new Promise(() => {})); // nunca responde
    abrir('/verificar', { email: 'ana@gmail.com' });
    fireEvent.change(screen.getByLabelText('Código'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verificar y entrar' }));
    expect(await screen.findByRole('button', { name: 'Verificando...' })).toHaveAttribute('aria-busy', 'true');
});