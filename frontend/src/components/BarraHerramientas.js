import { useEffect, useState } from 'react';
import {
    Brush, ClipboardCopy, Eraser, Maximize, Move, Paintbrush, Redo2, RotateCw, Scaling, SquareCheckBig, SquareDashed,
    SquareX, Trash2, Undo2, ZoomIn, ZoomOut,
} from 'lucide-react';
import BotonIcono from './BotonIcono';
import { TAMANO_MINIMO, TAMANO_MAXIMO, ESCALA_MINIMA, ESCALA_MAXIMA, limitarTamano } from '../utils/herramientas';
import { ACCIONES, formatearCombinacion } from '../utils/atajosArte';
import { formatearZoom } from '../utils/areaTrabajo';

// Mover va primero: es la herramienta con que se parte
const HERRAMIENTAS = [
    { id: 'mover', icono: Move },
    { id: 'pincel', icono: Brush },
    { id: 'borrador', icono: Eraser },
    { id: 'seleccion', icono: SquareDashed },
];

// Props:
//   herramienta, onHerramienta(id)   herramienta activa y cambio
//   color, onColor(color)            color del pincel
//   tamano, onTamano(numero)         grosor del pincel y del borrador
//   atajos                           atajos vigentes { accion: combinacion }, para mostrarlos
//   puedeDeshacer, puedeRehacer, onDeshacer, onRehacer
//   haySeleccion, onSeleccionarTodo, onQuitarSeleccion, onBorrarSeleccion
//   onTransformar({ escala } o { angulo })   escala como factor (1,5 = 150 %), ángulo en grados
function BarraHerramientas({
    herramienta, onHerramienta, color, onColor, tamano, onTamano, atajos,
    puedeDeshacer, puedeRehacer, onDeshacer, onRehacer,
    haySeleccion, onSeleccionarTodo, onQuitarSeleccion, onBorrarSeleccion, onCopiarSeleccion, onTransformar,
    zoom = 1, onAcercar, onAlejar, onZoomReal, onAjustar,
}) {
    const [escala, setEscala] = useState('150');
    const [angulo, setAngulo] = useState('90');

    // Texto del campo numérico del tamaño: puede quedar vacío mientras se escribe
    const [textoTamano, setTextoTamano] = useState(String(tamano));

    // Si el tamaño cambia desde el deslizador o con los atajos + y −, el campo muestra el valor nuevo
    useEffect(() => setTextoTamano(String(tamano)), [tamano]);

    function cambiarTextoTamano(texto) {
        setTextoTamano(texto);
        const numero = Number(texto);
        if (texto.trim() === '' || !Number.isFinite(numero)) return; // al salir del campo vuelve al tamaño vigente
        const limitado = limitarTamano(Math.round(numero));
        onTamano(limitado);
        if (numero > TAMANO_MAXIMO) setTextoTamano(String(limitado));
    }

    // Nombre y atajo de una acción, para el botón: { texto: 'Pincel', atajo: 'B' }
    function ayuda(id) {
        const accion = ACCIONES.find((a) => a.id === id);
        return { texto: accion ? accion.nombre : id, atajo: atajos && atajos[id] ? formatearCombinacion(atajos[id]) : undefined };
    }
    const comun = { lado: 'abajo' };

    const porcentaje = Number(escala);
    const grados = Number(angulo);
    const escalaValida = escala.trim() !== '' && porcentaje >= ESCALA_MINIMA * 100 && porcentaje <= ESCALA_MAXIMA * 100;
    const anguloValido = angulo.trim() !== '' && Number.isFinite(grados);

    return (
        <div className="barra-herramientas" role="toolbar" aria-label="Herramientas de dibujo">
            <div className="barra-grupo" role="group" aria-label="Herramienta">
                {HERRAMIENTAS.map((h) => (
                    <BotonIcono
                        key={h.id}
                        {...comun}
                        {...ayuda(h.id)}
                        icono={h.icono}
                        aria-pressed={herramienta === h.id}
                        onClick={() => onHerramienta(h.id)}
                    />
                ))}
            </div>

            <div className="barra-grupo" role="group" aria-label="Pincel">
                <label className="color-barra ayuda-abajo" data-ayuda="Color">
                    <Paintbrush aria-hidden="true" size={16} />
                    <input type="color" value={color} onChange={(e) => onColor(e.target.value)} aria-label="Color" />
                </label>
                <label className="tamano-pincel">
                    <span className="solo-lector">Tamaño</span>
                    <input
                        type="range"
                        min={TAMANO_MINIMO}
                        max={TAMANO_MAXIMO}
                        value={tamano}
                        onChange={(e) => onTamano(limitarTamano(e.target.value))}
                    />
                </label>
                <input
                    type="number"
                    className="campo-tamano"
                    aria-label="Tamaño en píxeles"
                    min={TAMANO_MINIMO}
                    max={TAMANO_MAXIMO}
                    step={1}
                    value={textoTamano}
                    onChange={(e) => cambiarTextoTamano(e.target.value)}
                    onBlur={() => setTextoTamano(String(tamano))}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                />
                <span>px</span>
            </div>

            <div className="barra-grupo" role="group" aria-label="Historial">
                <BotonIcono {...comun} {...ayuda('deshacer')} icono={Undo2} onClick={onDeshacer} disabled={!puedeDeshacer} />
                <BotonIcono {...comun} {...ayuda('rehacer')} icono={Redo2} onClick={onRehacer} disabled={!puedeRehacer} />
            </div>

            <div className="barra-grupo" role="group" aria-label="Selección">
                <BotonIcono {...comun} {...ayuda('seleccionar_todo')} icono={SquareCheckBig} onClick={onSeleccionarTodo} />
                <BotonIcono {...comun} {...ayuda('quitar_seleccion')} icono={SquareX} onClick={onQuitarSeleccion} disabled={!haySeleccion} />
                <BotonIcono {...comun} texto="Copiar selección" icono={ClipboardCopy} onClick={onCopiarSeleccion} disabled={!haySeleccion} />
                <BotonIcono {...comun} {...ayuda('borrar_seleccion')} icono={Trash2} peligro onClick={onBorrarSeleccion} disabled={!haySeleccion} />
            </div>

            <div className="barra-grupo" role="group" aria-label="Transformar">
                <label className="campo-unidad">
                    <span className="solo-lector">Escala</span>
                    <input type="number" value={escala} min={ESCALA_MINIMA * 100} max={ESCALA_MAXIMA * 100} onChange={(e) => setEscala(e.target.value)} />
                    <span aria-hidden="true">%</span>
                </label>
                <BotonIcono {...comun} texto="Escalar" icono={Scaling} disabled={!escalaValida} onClick={() => onTransformar({ escala: porcentaje / 100 })} />
                <label className="campo-unidad">
                    <span className="solo-lector">Ángulo</span>
                    <input type="number" value={angulo} onChange={(e) => setAngulo(e.target.value)} />
                    <span aria-hidden="true">°</span>
                </label>
                <BotonIcono {...comun} texto="Girar" icono={RotateCw} disabled={!anguloValido} onClick={() => onTransformar({ angulo: grados })} />
            </div>
            <div className="barra-grupo" role="group" aria-label="Vista">
                <BotonIcono {...comun} texto="Alejar" icono={ZoomOut} onClick={onAlejar} />
                <output aria-label="Zoom actual">{formatearZoom(zoom)}</output>
                <BotonIcono {...comun} texto="Acercar" icono={ZoomIn} onClick={onAcercar} />
                <button type="button" onClick={onZoomReal} aria-label="Tamaño real" className="boton-zoom-real">100 %</button>
                <BotonIcono {...comun} texto="Ver todo el lienzo" icono={Maximize} onClick={onAjustar} />
            </div>
        </div>
    );
}

export default BarraHerramientas;