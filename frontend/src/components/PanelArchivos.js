import { useRef, useState } from 'react';
import { BetweenHorizontalStart, Layers, ListEnd, Replace, Trash2, Upload, X } from 'lucide-react';
import BotonIcono from './BotonIcono';
import { NOMBRES_TIPO, TIPOS_IMPORTABLES } from '../utils/importarImagen';
import { MAX_ARCHIVOS } from '../hooks/useArchivos';

// Tipo de dato con que se arrastra un archivo hasta la lista de frames o el video (lleva su id)
export const TIPO_ARCHIVO = 'application/x-steer-archivo';

function formatearTamano(bytes) {
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

// Cómo se puede usar un archivo en la parte del proyecto que está abierta
// "texto" es la ayuda que se ve; "etiqueta" agrega el nombre del archivo para los lectores de pantalla
const USOS = {
    final: { icono: ListEnd, texto: 'Insertar al final', etiqueta: (n) => `Insertar "${n}" al final` },
    seleccion: { icono: BetweenHorizontalStart, texto: 'Insertar después de la selección', etiqueta: (n) => `Insertar "${n}" después de la selección` },
    reemplazar: { icono: Replace, texto: 'Reemplazar todos los frames', etiqueta: (n) => `Reemplazar todos los frames por "${n}"`, peligro: true },
    capa: { icono: Layers, texto: 'Agregar como capa', etiqueta: (n) => `Agregar "${n}" como capa` },
};

// Ventana "Archivos", a la derecha: todo lo que se subió al proyecto, para volver a usarlo en la parte del
// proyecto en que se esté. Se suben con el botón o arrastrándolos desde el computador, y cada uno se puede
// arrastrar hasta un hueco de la lista de frames o hasta el video.
//
// Props:
//   archivos   lo que devuelve useArchivos
//   usos       formas de usar un archivo aquí: ['final', 'seleccion', 'reemplazar'] o ['capa'] (vacío: no se puede)
//   ocupado    hay una operación con el servidor en curso
//   onUsar(archivo, uso), onCerrar()
function PanelArchivos({ archivos, usos = [], ocupado = false, onUsar, onCerrar }) {
    const selector = useRef(null);
    const [sobre, setSobre] = useState(false); // hay archivos del computador arrastrándose encima
    const { lista, cargando, agregando, error } = archivos;

    function elegir(evento) {
        archivos.agregar(evento.target.files).finally(() => { evento.target.value = ''; });
    }

    function traeArchivos(evento) {
        return Array.from(evento.dataTransfer?.types || []).includes('Files');
    }

    function soltar(evento) {
        if (!traeArchivos(evento)) return;
        evento.preventDefault();
        setSobre(false);
        archivos.agregar(evento.dataTransfer.files);
    }

    function quitar(archivo) {
        if (window.confirm(`¿Quitar "${archivo.nombre}"?`)) archivos.eliminar(archivo.id);
    }

    return (
        <aside
            className="panel-archivos"
            aria-label="Archivos"
            onDragOver={(e) => { if (traeArchivos(e)) { e.preventDefault(); setSobre(true); } }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setSobre(false); }}
            onDrop={soltar}
        >
            <header>
                <h2>Archivos <span>{lista.length} / {MAX_ARCHIVOS}</span></h2>
                <BotonIcono icono={X} texto="Cerrar archivos" lado="abajo" onClick={onCerrar} />
            </header>

            <button
                type="button"
                className={`zona-subir${sobre ? ' sobre' : ''}`}
                onClick={() => selector.current.click()}
                disabled={agregando}
                aria-busy={agregando}
            >
                <Upload aria-hidden="true" size={22} />
                <span>{agregando ? 'Guardando...' : 'Subir'}</span>
                <small>GIF · PNG · JPG · WEBP</small>
            </button>
            <input
                ref={selector}
                type="file"
                multiple
                hidden
                accept={TIPOS_IMPORTABLES.join(',')}
                aria-label="Elegir archivos"
                onChange={elegir}
            />

            {error && <p role="alert">{error}</p>}

            {cargando ? (
                <p role="status" aria-busy="true">Cargando...</p>
            ) : (
                <ul className="lista-archivos">
                    {lista.map((archivo) => (
                        <li
                            key={archivo.id}
                            className="archivo-guardado"
                            draggable={usos.length > 0 && !ocupado}
                            onDragStart={(e) => {
                                e.dataTransfer.effectAllowed = 'copy';
                                e.dataTransfer.setData(TIPO_ARCHIVO, String(archivo.id));
                            }}
                        >
                            <img src={archivo.url} alt="" draggable={false} />
                            <div className="archivo-info">
                                <strong title={archivo.nombre}>{archivo.nombre}</strong>
                                <span>{NOMBRES_TIPO[archivo.tipo] || 'Imagen'} · {formatearTamano(archivo.tamano)}</span>
                            </div>
                            <div className="archivo-acciones">
                                {usos.map((uso) => (
                                    <BotonIcono
                                        key={uso}
                                        icono={USOS[uso].icono}
                                        texto={USOS[uso].texto}
                                        etiqueta={USOS[uso].etiqueta(archivo.nombre)}
                                        peligro={USOS[uso].peligro}
                                        disabled={ocupado}
                                        onClick={() => onUsar(archivo, uso)}
                                    />
                                ))}
                                <BotonIcono
                                    icono={Trash2}
                                    texto="Quitar"
                                    etiqueta={`Quitar "${archivo.nombre}"`}
                                    className="quitar-archivo"
                                    onClick={() => quitar(archivo)}
                                />
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </aside>
    );
}

export default PanelArchivos;
