import { render, screen } from '@testing-library/react';
import App from './App';

test('sin sesión iniciada la aplicación lleva al inicio de sesión', () => {
  localStorage.clear();
  render(<App />);
  expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  expect(window.location.pathname).toBe('/login');
});
