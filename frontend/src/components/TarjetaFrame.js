import {useEffect, useRef, useState } from 'react';
import { MENSAJE_DURACION } from '../utils/operacionesFrames';

function IconoPapelera() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M6 6l1 14h10l1-14" />
      <path d="M10 10v6" />
      <path d="M14 10v6" />
    </svg>
  );
}

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
        tarjeta.current.draggable = !deshabilitado && !evento.target.closest('input, button');
    }

    return (
        <li
            ref={tarjeta}
            className={clases}
            onMouseDown={alPresionar}
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
                onChange={(e) => onSeleccionar(frame.clave, Boolean(e.nativeEvent.shiftKey))}
            />

            <span className="tarjeta-numero">{numero}</span>
            <label className="tarjeta-duracion">
                <span>Duración (ms)</span>
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
            <button
                type="button"
                disabled={deshabilitado || !puedeEditar}
                aria-label={`Editar frame ${numero}`}
                onClick={() => onEditar(frame.clave)}
            >
                Editar
            </button>
            <button 
                type="button"
                className="boton-peligro"
                disabled={deshabilitado}
                aria-label={`Eliminar frame ${numero}`}
                onClick={() => onEliminar(frame.clave)}
            >
                <IconoPapelera />
            </button>
        </li>
    );
}


export default TarjetaFrame;