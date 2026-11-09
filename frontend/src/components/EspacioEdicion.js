import EditorImagen from './EditorImagen';

// El espacio donde se edita un fotograma (RF31). Hoy aloja UN editor a la vez: recibe el fotograma que
// VisualizacionFrames quiere editar y lo muestra con su posición. Las pestañas para tener varios editores
// abiertos quedan para el Incremento 3; este componente es el lugar donde se agregarán.
//
// Props:
//   proyecto                  { id, ancho, alto }
//   frame, numero, total      el fotograma que se edita, su posición (desde 1) y cuántos hay
//   atajos                    atajos de teclado vigentes
//   onAplicar({ capas, imagen })   el editor entregó sus cambios
//   onCerrar()                se cerró el editor sin cambios
function EspacioEdicion({ proyecto, frame, numero, total, atajos, onAplicar, onCerrar }) {
    return (
        <section className="espacio-edicion" aria-label={`Edición del frame ${numero} de ${total}`}>
            <p>Frame {numero} de {total}</p>
            <EditorImagen
                proyectoId={proyecto.id}
                ancho={proyecto.ancho}
                alto={proyecto.alto}
                frame={frame}
                atajos={atajos}
                onTerminar={onAplicar}
                onCancelar={onCerrar}
            />
        </section>
    );
}

export default EspacioEdicion;