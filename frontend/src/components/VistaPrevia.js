import { Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import BotonIcono from './BotonIcono';

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
            <div className="controles-vista-previa">
                <BotonIcono icono={SkipBack} texto="Frame anterior" onClick={() => irA((indice - 1 + total) % total)} />
                <BotonIcono
                    icono={reproduciendo ? Pause : Play}
                    texto={reproduciendo ? 'Pausar' : 'Reproducir'}
                    principal
                    className="boton-grande"
                    onClick={alternar}
                />
                <BotonIcono icono={SkipForward} texto="Frame siguiente" onClick={() => irA((indice + 1) % total)} />
            </div>
        </>
    );
}

export default VistaPrevia;