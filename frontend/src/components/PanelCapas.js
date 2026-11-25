import { useEffect, useRef, useState } from 'react';
import {
    ChevronDown, ChevronUp, ClipboardPaste, Copy, CopyPlus, Eye, EyeOff, ImagePlus, Lock, LockOpen, Pencil, Plus, Trash2,
} from 'lucide-react';
import BotonIcono from './BotonIcono';
import { checkEspacio, checkNombre } from '../utils/capas';
import { MAX_CAPAS, MAXIMO_NOMBRE_CAPA } from '../config/limites';

const LADO_MINIATURA = 40; // px del lado más largo de la vista previa de cada capa

// Vista previa de lo que tiene una capa (lo que cae dentro del lienzo), con la forma del lienzo y una cuadrícula
// detrás que deja ver lo transparente. Se vuelve a dibujar cuando cambia "version"
function MiniaturaCapa({ clave, ancho, alto, oculta, dibujar, version }) {
    const canvas = useRef(null);
    const mayor = Math.max(ancho, alto);
    const anchoMiniatura = Math.max(1, Math.round((LADO_MINIATURA * ancho) / mayor));
    const altoMiniatura = Math.max(1, Math.round((LADO_MINIATURA * alto) / mayor));
    useEffect(() => {
        if (canvas.current) dibujar(clave, canvas.current);
    }, [clave, dibujar, version, anchoMiniatura, altoMiniatura]);
    return (
        <canvas
            ref={canvas}
            className={`miniatura-capa${oculta ? ' oculta' : ''}`}
            width={anchoMiniatura}
            height={altoMiniatura}
            aria-hidden="true"
        />
    );
}

// Lista de capas del fotograma que se edita (RF26 a RF34). No toca píxeles ni guarda nada: muestra las capas
// y avisa al editor lo que el usuario pide. La capa de más arriba se muestra primera.
//
// Props:
//   capas, claveActiva      lista de capas (utils/capas.js, la primera es la de abajo) y la seleccionada
//   onSeleccionar(clave)    elegir la capa activa
//   onAgregar()             capa nueva sobre la activa
//   onDuplicar()            duplicar la activa
//   onEliminar(clave)       eliminar (el panel pide confirmación antes)
//   onRenombrar(clave, nombre)
//   onReordenar(clave, destino)   destino: posición nueva (0 = abajo del todo)
//   onVisibilidad(clave), onBloqueo(clave)
//   ancho, alto             tamaño del lienzo, para la forma de las miniaturas
//   dibujarMiniatura(clave, canvas)   dibuja la vista previa de una capa en un canvas chico
//   versionPixeles          cambia cada vez que cambian los píxeles de alguna capa: las miniaturas se redibujan
function PanelCapas({
    capas, claveActiva, onSeleccionar, onAgregar, onDuplicar, onCopiar, onPegar, hayContenido = false,
    onEliminar, onRenombrar, onReordenar, onVisibilidad, onBloqueo, onImportar,
    ancho = 1, alto = 1, dibujarMiniatura, versionPixeles = 0,
}) {
    const [editando, setEditando] = useState(null); // { clave, texto } mientras se renombra
    const [error, setError] = useState('');
    const [confirmando, setConfirmando] = useState(null); // clave de la capa que se quiere eliminar
    const selectorArchivo = useRef(null);

    const hayEspacio = checkEspacio(capas);
    const arriba = [...capas].reverse();

    function empezarRenombre(capa) {
        setConfirmando(null);
        setError('');
        setEditando({ clave: capa.clave, texto: capa.nombre });
    }

    function guardarRenombre(evento) {
        evento.preventDefault();
        if (!checkNombre(editando.texto)) {
            setError(`El nombre debe tener entre 1 y ${MAXIMO_NOMBRE_CAPA} caracteres.`);
            return;
        }
        onRenombrar(editando.clave, editando.texto.trim());
        setEditando(null);
        setError('');
    }

    function cancelarRenombre() {
        setEditando(null);
        setError('');
    }

    function elegirImagen(evento) {
        const archivo = evento.target.files[0];
        evento.target.value = ''; // permite elegir el mismo archivo otra vez
        if (archivo) onImportar(archivo);
    }

    function confirmarEliminar(clave) {
        onEliminar(clave);
        setConfirmando(null);
    }

    return (
        <section className="panel-capas" aria-label="Capas">
            <h2>Capas <span>{capas.length} / {MAX_CAPAS}</span></h2>
            <div className="panel-capas-acciones">
                <BotonIcono icono={Plus} texto="Agregar capa" lado="abajo" principal onClick={onAgregar} disabled={!hayEspacio} />
                <BotonIcono icono={CopyPlus} texto="Duplicar capa" lado="abajo" onClick={onDuplicar} disabled={!hayEspacio || !claveActiva} />
                <BotonIcono icono={Copy} texto="Copiar capa" lado="abajo" onClick={onCopiar} disabled={!claveActiva} />
                <BotonIcono icono={ClipboardPaste} texto="Pegar capa" lado="abajo" onClick={onPegar} disabled={!hayEspacio || !hayContenido} />
                <BotonIcono icono={ImagePlus} texto="Agregar imagen" lado="abajo" onClick={() => selectorArchivo.current.click()} disabled={!hayEspacio} />
                <input
                    ref={selectorArchivo}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    aria-label="Archivo de imagen"
                    hidden
                    onChange={elegirImagen}
                />
            </div>
            {error && <p role="alert">{error}</p>}

            <ul>
                {arriba.map((capa) => {
                    const indice = capas.indexOf(capa);
                    const activa = capa.clave === claveActiva;
                    return (
                        <li key={capa.clave} className={activa ? 'capa-activa' : undefined} aria-current={activa ? 'true' : undefined}>
                            {editando && editando.clave === capa.clave ? (
                                <form onSubmit={guardarRenombre} onKeyDown={(e) => { if (e.key === 'Escape') cancelarRenombre(); }}>
                                    <input
                                        aria-label="Nombre de la capa"
                                        value={editando.texto}
                                        maxLength={MAXIMO_NOMBRE_CAPA}
                                        autoFocus
                                        onChange={(e) => setEditando({ ...editando, texto: e.target.value })}
                                    />
                                    <button type="submit">Guardar</button>
                                    <button type="button" onClick={cancelarRenombre}>Cancelar</button>
                                </form>
                            ) : (
                                <>
                                    <button
                                        type="button"
                                        className="capa-nombre"
                                        aria-pressed={activa}
                                        onClick={() => onSeleccionar(capa.clave)}
                                        onDoubleClick={() => empezarRenombre(capa)}
                                    >
                                        {dibujarMiniatura && (
                                            <MiniaturaCapa
                                                clave={capa.clave} ancho={ancho} alto={alto} oculta={!capa.visible}
                                                dibujar={dibujarMiniatura} version={versionPixeles}
                                            />
                                        )}
                                        <span>{capa.nombre}</span>
                                    </button>
                                    <div className="capa-botones">
                                        <BotonIcono
                                            icono={capa.visible ? Eye : EyeOff}
                                            texto={`${capa.visible ? 'Ocultar' : 'Mostrar'} ${capa.nombre}`}
                                            className={capa.visible ? undefined : 'apagado'}
                                            onClick={() => onVisibilidad(capa.clave)}
                                        />
                                        <BotonIcono
                                            icono={capa.bloqueada ? Lock : LockOpen}
                                            texto={`${capa.bloqueada ? 'Desbloquear' : 'Bloquear'} ${capa.nombre}`}
                                            className={capa.bloqueada ? 'encendido' : undefined}
                                            onClick={() => onBloqueo(capa.clave)}
                                        />
                                        <BotonIcono icono={ChevronUp} texto={`Subir ${capa.nombre}`} onClick={() => onReordenar(capa.clave, indice + 1)} disabled={indice === capas.length - 1} />
                                        <BotonIcono icono={ChevronDown} texto={`Bajar ${capa.nombre}`} onClick={() => onReordenar(capa.clave, indice - 1)} disabled={indice === 0} />
                                        <BotonIcono icono={Pencil} texto={`Renombrar ${capa.nombre}`} onClick={() => empezarRenombre(capa)} />
                                        {confirmando === capa.clave ? (
                                            <span className="confirmar-capa">
                                                <button type="button" className="boton-peligro" onClick={() => confirmarEliminar(capa.clave)}>Eliminar</button>
                                                <button type="button" onClick={() => setConfirmando(null)}>No</button>
                                            </span>
                                        ) : (
                                            <BotonIcono icono={Trash2} texto={`Eliminar ${capa.nombre}`} peligro onClick={() => setConfirmando(capa.clave)} disabled={capas.length <= 1} />
                                        )}
                                    </div>
                                </>
                            )}
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}

export default PanelCapas;