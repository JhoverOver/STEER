import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import MenuPerfil from './MenuPerfil';

function abrir(props = {}) {
    render(
        <MemoryRouter initialEntries={['/proyectos']}>
            <Routes>
                <Route path="/proyectos" element={<MenuPerfil {...props} />} />
                <Route path="/preferencias" element={<p>Preferencias</p>} />
                <Route path="/login" element={<p>Login</p>} />
            </Routes>
        </MemoryRouter>
    );
}

beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('token', 'tk');
    localStorage.setItem('correo', 'ana@gmail.com');
});

test('el botón de perfil muestra el correo y lleva a las preferencias de teclado', () => {
    abrir();
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Perfil' }));
    expect(screen.getByText('ana@gmail.com')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: /Preferencias de teclado/ }));
    expect(screen.getByText('Preferencias')).toBeInTheDocument();
});

test('cerrar sesión borra la sesión y vuelve al inicio de sesión', () => {
    abrir();
    fireEvent.click(screen.getByRole('button', { name: 'Perfil' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Cerrar sesión/ }));
    expect(screen.getByText('Login')).toBeInTheDocument();
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('correo')).toBeNull();
});

test('con cambios sin guardar se puede quedar en la página', () => {
    abrir({ puedeSalir: () => false });
    fireEvent.click(screen.getByRole('button', { name: 'Perfil' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Cerrar sesión/ }));
    expect(localStorage.getItem('token')).toBe('tk');
    expect(screen.getByRole('button', { name: 'Perfil' })).toBeInTheDocument();
});

test('Esc cierra el menú', () => {
    abrir();
    fireEvent.click(screen.getByRole('button', { name: 'Perfil' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
});
