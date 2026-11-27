import { MousePointer2, PaintBucket, Redo2, Save, Square, Type, Undo2 } from 'lucide-react';
import BotonIcono from './BotonIcono';

export const HERRAMIENTAS_VIDEO = [
    { id: 'mover', nombre: 'Elegir y mover', atajo: 'V', icono: MousePointer2 },
    { id: 'rectangulo', nombre: 'Rectángulo de color', atajo: 'R', icono: Square },
    { id: 'texto', nombre: 'Texto', atajo: 'T', icono: Type },
];

// Barra vertical de la pestaña Video, a la izquierda: herramientas que actúan en todo el proyecto, el color del
// rectángulo, deshacer, rehacer y guardar. Va pegada arriba al desplazar la página.
// Props: herramienta, onHerramienta(id), color, onColor(color), ocupado, datos (useProyectoFrames)
function BarraVideo({ herramienta, onHerramienta, color, onColor, ocupado, datos }) {
    const comun = { lado: 'derecha' };
    return (
        <div role="toolbar" aria-label="Herramientas del video" aria-orientation="vertical" className="barra-vertical">
            <div role="group" aria-label="Herramientas">
                {HERRAMIENTAS_VIDEO.map((h) => (
                    <BotonIcono
                        key={h.id}
                        {...comun}
                        icono={h.icono}
                        texto={h.nombre}
                        atajo={h.atajo}
                        aria-pressed={herramienta === h.id}
                        onClick={() => onHerramienta(h.id)}
                    />
                ))}
            </div>
            <div role="group" aria-label="Color">
                <label className="color-barra ayuda-derecha" data-ayuda="Color">
                    <PaintBucket aria-hidden="true" size={16} />
                    <input type="color" value={color} onChange={(e) => onColor(e.target.value)} aria-label="Color del rectángulo" />
                </label>
            </div>
            <div role="group" aria-label="Historial">
                <BotonIcono {...comun} icono={Undo2} texto="Deshacer" atajo="Ctrl+Z" onClick={datos.deshacer} disabled={ocupado || !datos.puedeDeshacer} />
                <BotonIcono {...comun} icono={Redo2} texto="Rehacer" atajo="Ctrl+Y" onClick={datos.rehacer} disabled={ocupado || !datos.puedeRehacer} />
            </div>
            <div role="group" aria-label="Guardado">
                <BotonIcono
                    {...comun}
                    icono={Save}
                    principal
                    texto={datos.guardando ? 'Guardando...' : 'Guardar'}
                    atajo="Ctrl+S"
                    insignia={datos.sinGuardar && !datos.guardando ? '•' : undefined}
                    onClick={datos.guardar}
                    disabled={ocupado || !datos.sinGuardar}
                    aria-busy={datos.guardando}
                />
            </div>
        </div>
    );
}

export default BarraVideo;
