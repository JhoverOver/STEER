import { useState } from 'react';
import {
    ArrowLeftRight, Check, ChevronLeft, ChevronRight, ClipboardPaste, Copy, Plus, Proportions, Redo2, Save,
    SquareCheckBig, SquareX, Timer, Trash2, Undo2,
} from 'lucide-react';
import BotonIcono from './BotonIcono';
import { checkDuracion, MENSAJE_DURACION } from '../utils/operacionesFrames';
import { DURACION_MINIMA, DURACION_MAXIMA, DURACION_INICIAL } from '../config/limites';

// Barra vertical de herramientas de la lista de frames, a la izquierda: historial, selección, portapapeles, orden,
// duración y guardado. Cada botón es un símbolo; su nombre y su atajo aparecen al pasar el mouse.
// Va pegada arriba al desplazar la página, para no perderla de vista.
// Las acciones que no tienen frames seleccionados actúan sobre todos (invertir y duración).
//
// Props:
//   deshabilitado        hay una operación con el servidor en curso
//   total, seleccionados cantidad de frames y de frames seleccionados
//   copiados             cantidad de frames en el portapapeles
//   puedeDeshacer, puedeRehacer, puedePegar, puedeInsertar, puedeInvertir, sinGuardar, guardando
//   acciones   { deshacer, rehacer, seleccionarTodo, quitarSeleccion, copiar, pegar, insertar, eliminar,
//                invertir, mover(direccion), aplicarDuracion(valor), lienzo(), guardar }
//   lienzo     { ancho, alto } del proyecto (sin lienzo, el botón del tamaño queda deshabilitado)
function BarraEdicionFrames({
    deshabilitado, total, seleccionados, copiados = 0, puedeDeshacer, puedeRehacer, puedePegar, puedeInsertar,
    puedeInvertir, sinGuardar, guardando, acciones, lienzo,
}) {
    const [duracion, setDuracion] = useState(String(DURACION_INICIAL));
    const [errorDuracion, setErrorDuracion] = useState('');

    const haySeleccion = seleccionados > 0;
    const todosMarcados = total > 0 && seleccionados === total;
    const frames = (n) => `${n} frame${n === 1 ? '' : 's'}`;
    const comun = { lado: 'derecha' };

    function aplicarDuracion() {
        const valor = duracion.trim() === '' ? NaN : Number(duracion);
        if (!checkDuracion(valor)) {
            setErrorDuracion(MENSAJE_DURACION);
            return;
        }
        setErrorDuracion('');
        acciones.aplicarDuracion(valor);
    }

    return (
        <div role="toolbar" aria-label="Herramientas de edición" aria-orientation="vertical" className="barra-vertical">
            <div role="group" aria-label="Historial">
                <BotonIcono {...comun} icono={Undo2} texto="Deshacer" atajo="Ctrl+Z" onClick={acciones.deshacer} disabled={deshabilitado || !puedeDeshacer} />
                <BotonIcono {...comun} icono={Redo2} texto="Rehacer" atajo="Ctrl+Y" onClick={acciones.rehacer} disabled={deshabilitado || !puedeRehacer} />
            </div>

            <div role="group" aria-label="Selección">
                {todosMarcados ? (
                    <BotonIcono {...comun} icono={SquareX} texto="Quitar selección" atajo="Esc" onClick={acciones.quitarSeleccion} disabled={deshabilitado} />
                ) : (
                    <BotonIcono
                        {...comun}
                        icono={SquareCheckBig}
                        texto="Seleccionar todo"
                        atajo="Ctrl+A"
                        onClick={acciones.seleccionarTodo}
                        disabled={deshabilitado || total === 0}
                    />
                )}
                {haySeleccion && !todosMarcados && (
                    <BotonIcono {...comun} icono={SquareX} texto="Quitar selección" atajo="Esc" onClick={acciones.quitarSeleccion} disabled={deshabilitado} />
                )}
            </div>

            <div role="group" aria-label="Portapapeles">
                <BotonIcono
                    {...comun}
                    icono={Copy}
                    texto={haySeleccion ? `Copiar ${frames(seleccionados)}` : 'Copiar'}
                    atajo="Ctrl+C"
                    insignia={haySeleccion ? seleccionados : undefined}
                    onClick={acciones.copiar}
                    disabled={deshabilitado || !haySeleccion}
                />
                <BotonIcono
                    {...comun}
                    icono={ClipboardPaste}
                    texto={copiados > 0 ? `Pegar ${frames(copiados)}` : 'Pegar'}
                    atajo="Ctrl+V"
                    insignia={copiados > 0 ? copiados : undefined}
                    onClick={acciones.pegar}
                    disabled={deshabilitado || !puedePegar}
                />
                <BotonIcono {...comun} icono={Plus} texto="Insertar frame en blanco" onClick={acciones.insertar} disabled={deshabilitado || !puedeInsertar} />
                <BotonIcono
                    {...comun}
                    icono={Trash2}
                    peligro
                    texto={haySeleccion ? `Eliminar ${frames(seleccionados)}` : 'Eliminar'}
                    atajo="Supr"
                    insignia={haySeleccion ? seleccionados : undefined}
                    onClick={acciones.eliminar}
                    disabled={deshabilitado || !haySeleccion}
                />
            </div>

            <div role="group" aria-label="Orden">
                <BotonIcono
                    {...comun}
                    icono={ArrowLeftRight}
                    texto={haySeleccion ? `Invertir el orden de ${frames(seleccionados)}` : 'Invertir el orden'}
                    insignia={haySeleccion ? seleccionados : 'todo'}
                    onClick={acciones.invertir}
                    disabled={deshabilitado || !puedeInvertir}
                />
                <BotonIcono {...comun} icono={ChevronLeft} texto="Mover a la izquierda" onClick={() => acciones.mover(-1)} disabled={deshabilitado || !haySeleccion} />
                <BotonIcono {...comun} icono={ChevronRight} texto="Mover a la derecha" onClick={() => acciones.mover(1)} disabled={deshabilitado || !haySeleccion} />
            </div>

            <div role="group" aria-label="Duración" className="grupo-duracion">
                <label htmlFor="duracion-global" className="ayuda-derecha" data-ayuda="Duración (ms)">
                    <Timer aria-hidden="true" size={16} />
                    <span className="solo-lector">Duración (ms)</span>
                </label>
                <input
                    id="duracion-global"
                    type="number"
                    min={DURACION_MINIMA}
                    max={DURACION_MAXIMA}
                    step="1"
                    value={duracion}
                    disabled={deshabilitado}
                    onChange={(e) => { setDuracion(e.target.value); setErrorDuracion(''); }}
                    aria-invalid={errorDuracion ? 'true' : undefined}
                    onKeyDown={(e) => { if (e.key === 'Enter') aplicarDuracion(); }}
                />
                <BotonIcono
                    {...comun}
                    icono={Check}
                    texto={haySeleccion ? `Aplicar la duración a ${frames(seleccionados)}` : 'Aplicar la duración'}
                    insignia={haySeleccion ? seleccionados : 'todo'}
                    onClick={aplicarDuracion}
                    disabled={deshabilitado || total === 0}
                />
                {errorDuracion && <p className="mensaje-campo mensaje-flotante" role="alert">{errorDuracion}</p>}
            </div>

            <div role="group" aria-label="Lienzo">
                <BotonIcono
                    {...comun}
                    icono={Proportions}
                    texto="Tamaño del lienzo"
                    onClick={acciones.lienzo}
                    disabled={deshabilitado || !lienzo}
                />
            </div>

            <div role="group" aria-label="Guardado">
                <BotonIcono
                    {...comun}
                    icono={Save}
                    principal
                    texto={guardando ? 'Guardando...' : sinGuardar ? 'Guardar' : 'Todo guardado'}
                    atajo="Ctrl+S"
                    insignia={sinGuardar && !guardando ? '•' : undefined}
                    onClick={acciones.guardar}
                    disabled={deshabilitado || !sinGuardar}
                    aria-busy={guardando}
                />
            </div>
        </div>
    );
}

export default BarraEdicionFrames;