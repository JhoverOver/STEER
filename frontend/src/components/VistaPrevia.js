import { useEffect, useState } from 'react';
import { DURACION_INICIAL } from '../config/limites';

// Qué frame se muestra en la vista previa y si se está reproduciendo la animación.
// Cada frame se muestra el tiempo de su duración y al llegar al último vuelve al primero.
// Devuelve { indice, reproduciendo, alternar(), irA(indice) }. "indice" siempre es válido para la lista actual.
export function useReproduccion(frames) {
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

// Vista previa de la animación con sus controles (RF19).
//   frames       lista actual
//   reproduccion lo que devuelve useReproduccion
//   proporcion   "ancho / alto" del lienzo, para el recuadro de los frames en blanco
function VistaPrevia({ frames, reproduccion, proporcion }) {
    const { indice, reproduciendo, alternar, irA } = reproduccion;
    const frame = frames[indice];
    const total = frames.length;
    const nombre = `Frame ${indice + 1} de ${total}`;

    return (
        <>
            {frame.vacio ? (
                <div
                    className="frame-vacio vista-previa"
                    role="img"
                    aria-label={`${nombre} (en blanco)`}
                    style={proporcion ? { aspectRatio: proporcion } : undefined}
                >
                    En blanco
                </div>
            ) : (
                <img className="vista-previa" src={frame.imagen} alt={nombre} />
            )}
            <p>{nombre} - {frame.duracion} ms</p>
            <div>
                <button type="button" onClick={() => irA((indice - 1 + total) % total)}>Anterior</button>
                <button type="button" onClick={alternar}>{reproduciendo ? 'Pausar' : 'Reproducir'}</button>
                <button type="button" onClick={() => irA((indice + 1) % total)}>Siguiente</button>
            </div>
        </>
    );
}

export default VistaPrevia;