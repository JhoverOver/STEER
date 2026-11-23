import { useEffect, useRef } from 'react';
import {
    checkEspacio,
    checkDuracion,
    clavesObjetivo,
    eliminarFrames,
    copiarFrames,
    pegarFrames,
    insertarBlank,
    cambiarDuracion,
    invertirOrden,
    moverFrames,
    moverPaso,
} from '../utils/operacionesFrames';
import { esCampoDeTexto } from '../utils/atajosArte';
import { MAX_FRAMES } from '../config/limites';
import VistaPrevia from './VistaPrevia';
import BarraEdicionFrames from './BarraEdicionFrames';
import ListaFrames from './ListaFrames';

// Pestaña "Frames": vista previa, barra de herramientas y lista de frames (RF15 a RF21).
//
// Props:
//   datos          lo que devuelve useProyectoFrames
//   seleccion      lo que devuelve useSeleccionFrames
//   reproduccion   lo que devuelve useReproduccion
//   puedeEditar, proporcion
//   onEditar(clave)   abrir un frame en la pestaña Imagen
function EtapaFrames({ datos, seleccion, reproduccion, puedeEditar, proporcion, onEditar }) {
    const { frames, ocupado, portapapeles, aplicar, avisar } = datos;
    const hayEspacio = checkEspacio(frames);
    const puedePegar = portapapeles.length > 0 && checkEspacio(frames, portapapeles.length);

    function posicionDespuesDeSeleccion() {
        const { claves } = seleccion;
        if (claves.length === 0) return frames.length;
        return frames.findIndex((f) => f.clave === claves[claves.length - 1]) + 1;
    }

    function copiar() {
        if (seleccion.claves.length === 0) return false;
        datos.setPortapapeles(copiarFrames(frames, seleccion.claves));
        avisar('');
        datos.informar(`${seleccion.claves.length} frame(s) copiado(s).`);
        return true;
    }

    function pegarEn(posicion) {
        if (portapapeles.length === 0 || ocupado) return false;
        if (!puedePegar) {
            avisar(`No hay espacio: un proyecto admite máximo ${MAX_FRAMES} frames.`);
            return false;
        }
        aplicar((f) => pegarFrames(f, portapapeles, posicion));
        return true;
    }

    function insertarEn(posicion) {
        if (ocupado) return false;
        if (!hayEspacio) {
            avisar(`No hay espacio: un proyecto admite como máximo ${MAX_FRAMES} frames.`);
            return false;
        }
        aplicar((f) => insertarBlank(f, posicion));
        return true;
    }

    function eliminarSeleccion() {
        if (seleccion.claves.length === 0) return false;
        aplicar((f) => eliminarFrames(f, seleccion.claves));
        return true;
    }

    // Devuelve false si la duración no es válida: la tarjeta muestra el motivo junto a su campo
    function cambiarDuracionDeUno(clave, valor) {
        if (!checkDuracion(valor)) return false;
        aplicar((f) => cambiarDuracion(f, [clave], valor));
        return true;
    }

    const acciones = {
        deshacer: datos.deshacer,
        rehacer: datos.rehacer,
        seleccionarTodo: seleccion.seleccionarTodo,
        quitarSeleccion: seleccion.quitar,
        copiar,
        pegar: () => pegarEn(posicionDespuesDeSeleccion()),
        insertar: () => insertarEn(posicionDespuesDeSeleccion()),
        eliminar: eliminarSeleccion,
        invertir: () => aplicar((f) => invertirOrden(f, clavesObjetivo(f, seleccion.activa))),
        mover: (direccion) => aplicar((f) => moverPaso(f, seleccion.claves, direccion)),
        aplicarDuracion: (valor) => aplicar((f) => cambiarDuracion(f, clavesObjetivo(f, seleccion.activa), valor)),
        guardar: datos.guardar,
    };

    // Atajos de teclado de esta pestaña (solo existen mientras está abierta)
    const accionesTeclado = useRef(acciones);
    accionesTeclado.current = acciones;
    useEffect(() => {
        function alPulsar(evento) {
            const a = accionesTeclado.current;
            const control = evento.ctrlKey || evento.metaKey;
            const tecla = evento.key.toLowerCase();
            const escribiendo = esCampoDeTexto(evento.target);
            if (control && tecla === 's') {
                evento.preventDefault();
                if (escribiendo) {
                    evento.target.blur(); // confirma el valor que se estaba escribiendo antes de guardar
                    setTimeout(() => accionesTeclado.current.guardar(), 0);
                } else {
                    a.guardar();
                }
                return;
            }
            if (escribiendo) return;

            let atendida = false;
            if (control && tecla === 'z' && !evento.shiftKey) atendida = a.deshacer();
            else if (control && (tecla === 'y' || (tecla === 'z' && evento.shiftKey))) atendida = a.rehacer();
            else if (control && tecla === 'c') atendida = a.copiar();
            else if (control && tecla === 'v') atendida = a.pegar();
            else if (control && tecla === 'a') atendida = a.seleccionarTodo();
            else if (tecla === 'delete') atendida = a.eliminar();
            if (atendida) evento.preventDefault();
        }
        document.addEventListener('keydown', alPulsar);
        return () => document.removeEventListener('keydown', alPulsar);
    }, []);

    if (datos.guardado.length === 0 && frames.length === 0) {
        return <p>Este proyecto todavía no tiene frames. Ve a la pestaña Importar para subir un GIF o imagen.</p>;
    }

    return (
        <>
            <section aria-labelledby="titulo-secuencia">
                <h2 id="titulo-secuencia">Animación</h2>
                {frames.length === 0 ? (
                    <p>No quedan frames.</p>
                ) : (
                    <VistaPrevia frames={frames} reproduccion={reproduccion} proporcion={proporcion} />
                )}
            </section>

            <section aria-labelledby="titulo-edicion">
                <h2 id="titulo-edicion">Edición</h2>
                <BarraEdicionFrames
                    deshabilitado={ocupado}
                    total={frames.length}
                    seleccionados={seleccion.claves.length}
                    puedeDeshacer={datos.puedeDeshacer}
                    puedeRehacer={datos.puedeRehacer}
                    puedePegar={puedePegar}
                    puedeInsertar={hayEspacio}
                    puedeInvertir={clavesObjetivo(frames, seleccion.activa).length >= 2}
                    sinGuardar={datos.sinGuardar}
                    guardando={datos.guardando}
                    acciones={acciones}
                />
                <p>
                    {frames.length} de {MAX_FRAMES} frames - {seleccion.claves.length} seleccionado(s) -{' '}
                    <span className={datos.sinGuardar ? 'estado-sin-guardar' : 'estado-guardado'}>
                        {datos.sinGuardar ? 'Hay cambios sin guardar' : 'Todo guardado'}
                    </span>
                </p>
                <ListaFrames
                    frames={frames}
                    indiceActual={reproduccion.indice}
                    seleccion={seleccion}
                    deshabilitado={ocupado}
                    puedeEditar={puedeEditar}
                    puedePegar={puedePegar}
                    puedeInsertar={hayEspacio}
                    proporcion={proporcion}
                    onVer={reproduccion.irA}
                    onEditar={onEditar}
                    onEliminar={(clave) => aplicar((f) => eliminarFrames(f, [clave]))}
                    onCambiarDuracion={cambiarDuracionDeUno}
                    onInsertar={insertarEn}
                    onPegar={pegarEn}
                    onMover={(claves, hueco) => aplicar((f) => moverFrames(f, claves, hueco))}
                />
                <p>
                    Atajos: Ctrl+z deshacer, Ctrl+y rehacer, Ctrl+c copiar, Ctrl+v pegar, Ctrl+a seleccionar todo, Supr eliminar, Ctrl+s guardar, Shift + click seleccionar
                </p>
            </section>
        </>
    );
}

export default EtapaFrames;