import { Fragment, useRef, useState } from 'react';
import { ClipboardPaste, Plus } from 'lucide-react';
import TarjetaFrame from './TarjetaFrame';
import BotonIcono from './BotonIcono';
import { TIPO_ARCHIVO } from './PanelArchivos';

// ¿Lo que se arrastra es uno de los archivos del proyecto?
function esArchivo(evento) {
    return Array.from(evento.dataTransfer?.types || []).includes(TIPO_ARCHIVO);
}

// Hueco entre dos tarjetas (o al final): se puede soltar un frame arrastrado, insertar uno en blanco o pegar
function Hueco({ posicion, destino, deshabilitado, puedePegar, puedeInsertar, onInsertar, onPegar, onSobre, onSoltar }) {
    return (
        <li
            className={`hueco${destino === posicion ? ' soltar-aqui' : ''}`}
            onDragOver={(e) => onSobre(e, posicion)}
            onDrop={(e) => onSoltar(e, posicion)}
        >
            <span className="hueco-indicador" aria-hidden="true">+</span>
            <div className="hueco-acciones">
                <BotonIcono
                    icono={Plus}
                    texto={`Insertar frame en blanco en la posición ${posicion + 1}`}
                    lado="derecha"
                    tabIndex={-1}
                    disabled={deshabilitado || !puedeInsertar}
                    onClick={() => onInsertar(posicion)}
                />
                <BotonIcono
                    icono={ClipboardPaste}
                    texto={`Pegar en la posición ${posicion + 1}`}
                    lado="derecha"
                    tabIndex={-1}
                    disabled={deshabilitado || !puedePegar}
                    onClick={() => onPegar(posicion)}
                />
            </div>
        </li>
    );
}

// Lista de frames del proyecto, con un hueco antes de cada tarjeta y otro al final.
// Se encarga del arrastre: al soltar llama a onMover(claves, hueco) con los frames arrastrados
// (la selección completa si se arrastró un frame seleccionado) y la posición de destino.
//
// Props:
//   frames, indiceActual (el que muestra la vista previa), seleccion (lo que devuelve useSeleccionFrames)
//   deshabilitado, puedeEditar, puedePegar, puedeInsertar, proporcion
//   onVer(indice), onEditar(clave), onEliminar(clave), onCambiarDuracion(clave, valor)
//   onInsertar(posicion), onPegar(posicion), onMover(claves, hueco)
function ListaFrames({
    frames, indiceActual, seleccion, deshabilitado, puedeEditar, puedePegar, puedeInsertar, proporcion,
        onVer, onEditar, onEliminar, onCambiarDuracion, onInsertar, onPegar, onMover, onSoltarArchivo,
}) {
    const [destino, setDestino] = useState(null); // hueco donde caería lo que se arrastra
    const arrastrando = useRef(null); // claves que se están arrastrando

    function iniciarArrastre(evento, clave) {
        if (deshabilitado) {
            evento.preventDefault();
            return;
        }
        arrastrando.current = seleccion.activa.has(clave) ? seleccion.claves : [clave];
        if (evento.dataTransfer) {
            evento.dataTransfer.effectAllowed = 'move';
            evento.dataTransfer.setData('text/plain', clave);
            const tarjeta = evento.currentTarget.closest('li');
            if (tarjeta && evento.dataTransfer.setDragImage) evento.dataTransfer.setDragImage(tarjeta, 20, 20);
        }
    }

    // Sobre una tarjeta, el hueco es el de su izquierda o el de su derecha según la mitad en que esté el mouse
    function huecoSegunPosicion(evento, indiceTarjeta) {
        const caja = evento.currentTarget.getBoundingClientRect();
        return indiceTarjeta + (evento.clientX < caja.left + caja.width / 2 ? 0 : 1);
    }

    function sobreHueco(evento, hueco) {
        const deArchivos = esArchivo(evento);
        if (!arrastrando.current && !(deArchivos && onSoltarArchivo && !deshabilitado)) return;
        evento.preventDefault();
        if (deArchivos && evento.dataTransfer) evento.dataTransfer.dropEffect = 'copy';
        if (hueco !== destino) setDestino(hueco);
    }

    function terminarArrastre() {
        arrastrando.current = null;
        setDestino(null);
    }

    function soltarEn(evento, hueco) {
        if (!arrastrando.current && esArchivo(evento) && onSoltarArchivo && !deshabilitado) {
            evento.preventDefault();
            setDestino(null);
            onSoltarArchivo(Number(evento.dataTransfer.getData(TIPO_ARCHIVO)), hueco);
            return;
        }
        if (!arrastrando.current) return;
        evento.preventDefault();
        const claves = arrastrando.current;
        terminarArrastre();
        onMover(claves, hueco);
    }

    const propsHueco = {
        destino, deshabilitado, puedePegar, puedeInsertar, onInsertar, onPegar, onSobre: sobreHueco, onSoltar: soltarEn,
    };

    return (
                <ol aria-label="Frames del proyecto" onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDestino(null); }}>
            {frames.map((frame, i) => (
                <Fragment key={frame.clave}>
                    <Hueco posicion={i} {...propsHueco} />
                    <TarjetaFrame
                        frame={frame}
                        indice={i}
                        actual={i === indiceActual}
                        seleccionado={seleccion.activa.has(frame.clave)}
                        deshabilitado={deshabilitado}
                        proporcion={proporcion}
                        puedeEditar={puedeEditar}
                        onVer={() => onVer(i)}
                        onEditar={onEditar}
                        onSeleccionar={seleccion.alternar}
                        onEliminar={onEliminar}
                        onCambiarDuracion={onCambiarDuracion}
                        onInicioArrastre={iniciarArrastre}
                        onFinArrastre={terminarArrastre}
                        onSobre={(e, indice) => sobreHueco(e, huecoSegunPosicion(e, indice))}
                        onSoltar={(e, indice) => soltarEn(e, huecoSegunPosicion(e, indice))}
                    />
                </Fragment>
            ))}
            <Hueco posicion={frames.length} {...propsHueco} />
        </ol>
    );
}

export default ListaFrames;