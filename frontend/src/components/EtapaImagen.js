import { useRef } from 'react';
import EditorImagen from './EditorImagen';
import { vecinosDe } from '../utils/papelCebolla';


// Pestaña "Imagen": el editor de un frame (RF26 a RF45). Si todavía no se eligió ninguno, muestra los frames
// para elegir cuál editar.
//
// Props:
//   proyecto, frames, atajos
//   frame                  el frame que se está editando (o null)
//   proporcion             "ancho / alto" del lienzo, para los frames en blanco
//   onElegir(clave)        se eligió un frame para editar
//   onTerminar(resultado)  el editor aplicó sus cambios
//   onCancelar()           se cerró el editor sin aplicar
//   onCambiosSinAplicar(hay)  el editor avisa si tiene cambios sin aplicar
function EtapaImagen({
    proyecto, frames, atajos, frame, proporcion, onElegir, onTerminar, onCancelar, onCambiosSinAplicar, onCambiarFrame,
}) {
    // Herramienta, color, tamaño y paneles del último frame editado: el siguiente se abre igual
    const ajustes = useRef({});

    if (frame) {
        return (
            <EditorImagen
                key={frame.clave}
                proyectoId={proyecto.id}
                nombreProyecto={proyecto.nombre}
                posicion={`Frame ${frames.indexOf(frame) + 1} de ${frames.length}`}
                ancho={proyecto.ancho}
                alto={proyecto.alto}
                frame={frame}
                atajos={atajos}
                onTerminar={onTerminar}
                onCancelar={onCancelar}
                onCambiosSinAplicar={onCambiosSinAplicar}
                vecinos={vecinosDe(frames, frame)}
                onCambiarFrame={onCambiarFrame}
                ajustesIniciales={ajustes.current}
                onAjustes={(nuevos) => { ajustes.current = nuevos; }}
            />
        );
    }

    return (
        <section aria-labelledby="titulo-elegir">
            <h2 id="titulo-elegir">Elige el frame que quieres editar</h2>
            <ol className="elegir-frame">
                {frames.map((f, i) => (
                    <li key={f.clave}>
                        <button type="button" onClick={() => onElegir(f.clave)} aria-label={`Editar frame ${i + 1}`}>
                            {f.vacio ? (
                                <span className="frame-vacio" style={proporcion ? { aspectRatio: proporcion } : undefined}>
                                    En blanco
                                </span>
                            ) : (
                                <img src={f.imagen} alt="" />
                            )}
                            <span>{i + 1}</span>
                        </button>
                    </li>
                ))}
            </ol>
        </section>
    );
}

export default EtapaImagen;