import {useEffect, useRef, useState } from 'react';
import { Pencil, Timer, Trash2 } from 'lucide-react';
import BotonIcono from './BotonIcono';
import { MENSAJE_DURACION } from '../utils/operacionesFrames';

function TarjetaFrame({
    frame,
    indice,
    actual,
    seleccionado,
    deshabilitado,
    proporcion,
    puedeEditar,
    onVer,
    onEditar,
    onSeleccionar,
    onEliminar,
    onCambiarDuracion,
    onInicioArrastre,
    onFinArrastre,
    onSobre,
    onSoltar,
}) {

    const numero = indice + 1;
    const tarjeta = useRef(null);
    const [errorDuracion, setErrorDuracion] = useState('');

    const [texto, setTexto] = useState(String(frame.duracion));
    useEffect(() => {
        setTexto(String(frame.duracion));
    }, [frame.duracion]);

    function confirmarDuracion() {
        const valor = Number(texto);
        if (texto.trim() !== '' && valor === frame.duracion) return;
        const aceptado = onCambiarDuracion(frame.clave, texto.trim() === '' ? NaN : valor);
        if (!aceptado) {
            setTexto(String(frame.duracion));
            setErrorDuracion(MENSAJE_DURACION);
        }
    }

    function teclaEnDuracion(evento) {
        if (evento.key === 'Enter') {
            evento.currentTarget.blur();
        } else if(evento.key === 'Escape') {
            setTexto(String(frame.duracion));
            setErrorDuracion('');
        }
    }

    function teclaEnMiniatura(evento) {
        if (evento.key === 'Enter' || evento.key === ' ') {
            evento.preventDefault();
            onVer();
        } 
    }

    const clases = [
        'tarjeta-frame',
        actual ? 'tarjeta-actual' : '',
        seleccionado ? 'tarjeta-seleccionada' : '',
    ]

    .filter(Boolean)
    .join(' ');

    function alPresionar(evento) {
        if (evento.shiftKey) {
            evento.preventDefault(); // que Shift + clic no seleccione texto de la página
            tarjeta.current.draggable = false;
            return;
        }
        tarjeta.current.draggable = !deshabilitado && !evento.target.closest('input, button');
    }

    // Shift + clic en cualquier parte de la tarjeta: marca o desmarca el frame en vez de hacer lo de siempre
    // (ver, editar...). Se atiende antes que los botones de adentro. En el campo de duración no, para poder escribir
    function alHacerClic(evento) {
        if (!evento.shiftKey || deshabilitado || evento.target.closest('input[type="number"]')) return;
        evento.preventDefault();
        evento.stopPropagation();
        onSeleccionar(frame.clave, evento.ctrlKey || evento.metaKey);
    }

    return (
        <li
            ref={tarjeta}
            className={clases}
            onMouseDown={alPresionar}
            onClickCapture={alHacerClic}
            onDragStart={(e) => onInicioArrastre(e, frame.clave)}
            onDragEnd={onFinArrastre}
            onDragOver={(e) => onSobre(e, indice)}
            onDrop={(e) => onSoltar(e, indice)}
        >
            <div
                className="tarjeta-miniatura"
                role="button"
                tabIndex={0}
                aria-label={`Ver frame ${numero}`}
                aria-current={actual ? 'true' : undefined}
                onClick={onVer}
                onDoubleClick={() => puedeEditar && onEditar(frame.clave)}
                onKeyDown={teclaEnMiniatura}
            >
                {frame.vacio ? (
                    <span className="frame-vacio" style={proporcion ? { aspectRatio: proporcion } : undefined}>
                        En blanco
                    </span>
                ) : (
                    <img src={frame.imagen} alt="" draggable={false} />
                )}
            </div>

            <input
                className="tarjeta-casilla"
                type="checkbox"
                checked={seleccionado}
                disabled={deshabilitado}
                aria-label={`Seleccionar frame ${numero}`}
                onChange={() => onSeleccionar(frame.clave, false)}
            />

            <span className="tarjeta-numero">{numero}</span>
            <label className="tarjeta-duracion" title="Duración (ms)">
                <Timer aria-hidden="true" size={14} />
                <input 
                    type="number"
                    inputMode="numeric"
                    min="10"
                    max="10000"
                    step="1"
                    value={texto}
                    disabled={deshabilitado}
                    aria-label={`Duración del frame ${numero} en milisegundos`}
                    onChange={(e) => { setTexto(e.target.value); setErrorDuracion(''); }}
                    onBlur={confirmarDuracion}
                    onKeyDown={teclaEnDuracion}
                />
            </label>
             {errorDuracion && <p className="tarjeta-error" role="alert">{errorDuracion}</p>}
            {/* Como en las tarjetas de proyecto: eliminar antes, y Editar (lo más usado) al final, a la derecha */}
            <div className="tarjeta-acciones">
                <BotonIcono
                    icono={Trash2}
                    peligro
                    texto={`Eliminar frame ${numero}`}
                    disabled={deshabilitado}
                    onClick={() => onEliminar(frame.clave)}
                />
                <BotonIcono
                    icono={Pencil}
                    texto={`Editar frame ${numero}`}
                    atajo="doble clic en la imagen"
                    disabled={deshabilitado || !puedeEditar}
                    onClick={() => onEditar(frame.clave)}
                />
            </div>
        </li>
    );
}


export default TarjetaFrame;