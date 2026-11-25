import { ImageOff, Pencil, Settings2, Trash2 } from 'lucide-react';
import BotonIcono from './BotonIcono';
import { COLORES, hexDeColor } from '../utils/colores';
import { formatearFecha } from '../utils/proyectos';

// Tarjeta de un proyecto en "Mis proyectos": chica, como las de los frames, pero con todos sus datos a la vista.
// Un clic en la imagen abre el proyecto.
//
// Los botones van de menos a más usado, de izquierda a derecha: eliminar y ajustes (nombre, etiquetas y color) son
// chicos y quedan a la izquierda; Editar, lo que más se hace, es el grande y queda solo a la derecha, lejos de los
// otros dos para no apretar uno por otro.
//
// Props: proyecto, onAbrir(), onAjustes(), onEliminar()
function TarjetaProyecto({ proyecto, onAbrir, onAjustes, onEliminar }) {
    const color = proyecto.color ? COLORES.find((c) => c.nombre === proyecto.color) : null;
    const frames = proyecto.cantidad_frames ?? 0;
    const lienzo = proyecto.ancho && proyecto.alto ? `${proyecto.ancho} × ${proyecto.alto} px` : 'Sin lienzo';

    return (
        <li className="tarjeta-proyecto" style={color ? { '--color-proyecto': hexDeColor(proyecto.color) } : undefined}>
            <button type="button" className="tarjeta-proyecto-imagen" onClick={onAbrir} aria-label={`Abrir ${proyecto.nombre}`}>
                {proyecto.miniatura ? (
                    <img src={proyecto.miniatura} alt="" />
                ) : (
                    <span className="sin-vista-previa"><ImageOff aria-hidden="true" size={28} /></span>
                )}
            </button>
            <div className="tarjeta-proyecto-datos">
                <div className="titulo-proyecto">
                    {color && <span className="punto-color" style={{ background: color.hex }} title={color.etiqueta} aria-label={`Color ${color.etiqueta}`} role="img" />}
                    <h3 title={proyecto.nombre}>{proyecto.nombre}</h3>
                </div>
                <p className="detalle-proyecto">{lienzo} · {frames} frame{frames === 1 ? '' : 's'}</p>
                {proyecto.etiquetas?.length > 0 && (
                    <ul className="etiquetas" aria-label="Etiquetas">
                        {proyecto.etiquetas.map((e) => <li key={e}>{e}</li>)}
                    </ul>
                )}
                <p className="fechas">
                    Creado {formatearFecha(proyecto.fecha_creacion)}
                    {proyecto.fecha_edicion && <><br />Editado {formatearFecha(proyecto.fecha_edicion)}</>}
                </p>
            </div>
            <div className="tarjeta-acciones">
                <BotonIcono icono={Trash2} texto={`Eliminar ${proyecto.nombre}`} peligro onClick={onEliminar} />
                <BotonIcono icono={Settings2} texto="Nombre, etiquetas y color" onClick={onAjustes} />
                <BotonIcono icono={Pencil} texto={`Editar ${proyecto.nombre}`} principal className="boton-editar-proyecto" onClick={onAbrir} />
            </div>
        </li>
    );
}

export default TarjetaProyecto;
