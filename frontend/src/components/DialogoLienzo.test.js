import { render, screen, fireEvent } from '@testing-library/react';
import DialogoLienzo, { desplazamiento, nombreAncla } from './DialogoLienzo';

function abrir() {
    const props = { anterior: { ancho: 480, alto: 270 }, onAplicar: jest.fn(), onCerrar: jest.fn() };
    render(<DialogoLienzo {...props} />);
    return props;
}

test('parte con las medidas actuales; más alto con el dibujo abajo agrega espacio arriba', () => {
    const props = abrir();
    expect(screen.getByLabelText('Ancho (px)')).toHaveValue(480);
    expect(screen.getByLabelText('Alto (px)')).toHaveValue(270);
    expect(screen.queryByText(/Ahora mide/)).toBeNull();
    fireEvent.change(screen.getByLabelText('Alto (px)'), { target: { value: '370' } });
    fireEvent.click(screen.getByRole('button', { name: 'Dibujo abajo' }));
    expect(screen.getByRole('button', { name: 'Dibujo abajo' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar tamaño' }));
    expect(props.onAplicar).toHaveBeenCalledWith({ ancho: 480, alto: 370, anclaX: 0.5, anclaY: 1 });
});

test('un tamaño fuera de rango no se aplica; el mismo tamaño tampoco', () => {
    const props = abrir();
    expect(screen.getByRole('button', { name: 'Cambiar tamaño' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Ancho (px)'), { target: { value: '5000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar tamaño' }));
    expect(screen.getByText('Entre 16 y 720 px.')).toBeInTheDocument();
    expect(props.onAplicar).not.toHaveBeenCalled();
});

test('Esc o Cancelar cierran sin cambiar nada', () => {
    const props = abrir();
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(props.onCerrar).toHaveBeenCalledTimes(2);
});

test('el ancla dice dónde queda el dibujo actual', () => {
    expect(desplazamiento({ ancho: 100, alto: 100 }, { ancho: 100, alto: 160 }, 0.5, 1)).toEqual({ x: 0, y: 60 });
    expect(desplazamiento({ ancho: 100, alto: 100 }, { ancho: 60, alto: 60 }, 0.5, 0.5)).toEqual({ x: -20, y: -20 });
    expect(nombreAncla(0, 1)).toBe('abajo a la izquierda');
    expect(nombreAncla(0.5, 0.5)).toBe('al centro');
});
