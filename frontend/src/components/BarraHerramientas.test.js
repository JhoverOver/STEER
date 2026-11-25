import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import BarraHerramientas from './BarraHerramientas';

// La barra con el tamaño guardado en un estado, como en el editor
function BarraDePrueba() {
    const [tamano, setTamano] = useState(10);
    return (
        <>
            <BarraHerramientas herramienta="pincel" onHerramienta={() => {}} color="#000000" onColor={() => {}}
                tamano={tamano} onTamano={setTamano} atajos={{}} onTransformar={() => {}} />
            <output data-testid="tamano">{tamano}</output>
        </>
    );
}

test('el tamaño del pincel se puede escribir en píxeles exactos', () => {
    render(<BarraDePrueba />);
    const campo = screen.getByLabelText('Tamaño en píxeles');
    fireEvent.change(campo, { target: { value: '37' } });
    expect(screen.getByTestId('tamano')).toHaveTextContent('37');
    // El deslizador se mueve junto con el número
    expect(screen.getByRole('slider')).toHaveValue('37');
});

test('un tamaño fuera de rango se ajusta y un campo vacío vuelve al vigente', () => {
    render(<BarraDePrueba />);
    const campo = screen.getByLabelText('Tamaño en píxeles');
    fireEvent.change(campo, { target: { value: '500' } });
    expect(screen.getByTestId('tamano')).toHaveTextContent('100');
    expect(campo).toHaveValue(100);
    fireEvent.change(campo, { target: { value: '' } });
    fireEvent.blur(campo);
    expect(campo).toHaveValue(100);
});

test('mover el deslizador actualiza el número', () => {
    render(<BarraDePrueba />);
    fireEvent.change(screen.getByRole('slider'), { target: { value: '60' } });
    expect(screen.getByLabelText('Tamaño en píxeles')).toHaveValue(60);
});