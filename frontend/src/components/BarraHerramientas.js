import { useState } from 'react';
import { TAMANO_MINIMO, TAMANO_MAXIMO, ESCALA_MINIMA, ESCALA_MAXIMA, limitarTamano } from '../utils/herramientas';
import { ACCIONES, formatearCombinacion } from '../utils/atajosArte';
import { formatearZoom } from '../utils/areaTrabajo';

// Herramientas que se eligen con un botón; el id es el mismo de la acción con atajo
const HERRAMIENTAS = [
    { id: 'pincel', nombre: 'Pincel' },
    { id: 'borrador', nombre: 'Borrador' },
    { id: 'seleccion', nombre: 'Selección' },
    { id: 'mover', nombre: 'Mover' },
];

// Barra de herramientas del editor de imagen (RF36 a RF44). No dibuja ni guarda nada: muestra los controles
// y avisa al editor lo que el usuario pide.
//
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
    haySeleccion, onSeleccionarTodo, onQuitarSeleccion, onBorrarSeleccion, onTransformar,
    zoom = 1, onAcercar, onAlejar, onZoomReal, onAjustar,
}) {
    const [escala, setEscala] = useState('150');
    const [angulo, setAngulo] = useState('90');

    // Texto de ayuda de un botón: "Pincel (B)"
    function titulo(id) {
        const accion = ACCIONES.find((a) => a.id === id);
        const atajo = atajos && atajos[id] ? ` (${formatearCombinacion(atajos[id])})` : '';
        return `${accion ? accion.nombre : id}${atajo}`;
    }

    const porcentaje = Number(escala);
    const grados = Number(angulo);
    const escalaValida = escala.trim() !== '' && porcentaje >= ESCALA_MINIMA * 100 && porcentaje <= ESCALA_MAXIMA * 100;
    const anguloValido = angulo.trim() !== '' && Number.isFinite(grados);

    return (
        <div className="barra-herramientas" role="toolbar" aria-label="Herramientas de dibujo">
            <div className="barra-grupo" role="group" aria-label="Herramienta">
                {HERRAMIENTAS.map((h) => (
                    <button
                        key={h.id}
                        type="button"
                        aria-pressed={herramienta === h.id}
                        title={titulo(h.id)}
                        onClick={() => onHerramienta(h.id)}
                    >
                        {h.nombre}
                    </button>
                ))}
            </div>

            <div className="barra-grupo" role="group" aria-label="Pincel">
                <label>
                    Color
                    <input type="color" value={color} onChange={(e) => onColor(e.target.value)} />
                </label>
                <label title={`${titulo('tamano_mas')} · ${titulo('tamano_menos')}`}>
                    Tamaño
                    <input
                        type="range"
                        min={TAMANO_MINIMO}
                        max={TAMANO_MAXIMO}
                        value={tamano}
                        onChange={(e) => onTamano(limitarTamano(e.target.value))}
                    />
                    <span>{tamano} px</span>
                </label>
            </div>

            <div className="barra-grupo" role="group" aria-label="Historial">
                <button type="button" onClick={onDeshacer} disabled={!puedeDeshacer} title={titulo('deshacer')}>Deshacer</button>
                <button type="button" onClick={onRehacer} disabled={!puedeRehacer} title={titulo('rehacer')}>Rehacer</button>
            </div>

            <div className="barra-grupo" role="group" aria-label="Selección">
                <button type="button" onClick={onSeleccionarTodo} title={titulo('seleccionar_todo')}>Seleccionar todo</button>
                <button type="button" onClick={onQuitarSeleccion} disabled={!haySeleccion} title={titulo('quitar_seleccion')}>Quitar selección</button>
                <button type="button" onClick={onBorrarSeleccion} disabled={!haySeleccion} title={titulo('borrar_seleccion')}>Borrar selección</button>
            </div>

            <div className="barra-grupo" role="group" aria-label="Transformar">
                <label>
                    Escala (%)
                    <input type="number" value={escala} min={ESCALA_MINIMA * 100} max={ESCALA_MAXIMA * 100} onChange={(e) => setEscala(e.target.value)} />
                </label>
                <button type="button" disabled={!escalaValida} onClick={() => onTransformar({ escala: porcentaje / 100 })}>Escalar</button>
                <label>
                    Ángulo (°)
                    <input type="number" value={angulo} onChange={(e) => setAngulo(e.target.value)} />
                </label>
                <button type="button" disabled={!anguloValido} onClick={() => onTransformar({ angulo: grados })}>Girar</button>
            </div>
            <div className="barra-grupo" role="group" aria-label="Vista">
                <button type="button" onClick={onAlejar} aria-label="Alejar" title="Alejar (rueda del mouse hacia atrás)">−</button>
                <output aria-label="Zoom actual">{formatearZoom(zoom)}</output>
                <button type="button" onClick={onAcercar} aria-label="Acercar" title="Acercar (rueda del mouse hacia adelante)">+</button>
                <button type="button" onClick={onZoomReal} title="Tamaño real">100 %</button>
                <button type="button" onClick={onAjustar} title="Ver todo el lienzo">Ajustar</button>
            </div>
        </div>
    );
}

export default BarraHerramientas;