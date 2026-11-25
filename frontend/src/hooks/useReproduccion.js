import { useEffect, useState } from 'react';
import { DURACION_INICIAL } from '../config/limites';

// Qué frame se muestra en la vista previa y si se está reproduciendo la animación.
// Cada frame se muestra el tiempo de su duración y al llegar al último vuelve al primero.
// Devuelve { indice, reproduciendo, alternar(), irA(indice) }. "indice" siempre es válido para la lista actual.
function useReproduccion(frames) {
    const [indice, setIndice] = useState(0);
    const [reproduciendo, setReproduciendo] = useState(false);
    const indiceSeguro = Math.min(indice, Math.max(frames.length - 1, 0));

    useEffect(() => {
        if (!reproduciendo || frames.length === 0) return undefined;
        const espera = frames[indiceSeguro]?.duracion || DURACION_INICIAL;
        const timer = setTimeout(() => {
            setIndice((actual) => (Math.min(actual, frames.length - 1) + 1) % frames.length);
        }, espera);
        return () => clearTimeout(timer);
    }, [reproduciendo, indiceSeguro, frames]);

    return {
        indice: indiceSeguro,
        reproduciendo,
        alternar: () => setReproduciendo((actual) => !actual),
        // Ir a un frame detiene la reproducción
        irA: (nuevo) => {
            setReproduciendo(false);
            setIndice(nuevo);
        },
    };
}

export default useReproduccion;
