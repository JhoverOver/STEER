import { useCallback, useRef, useState } from 'react';
import { FolderOpen, Plus } from 'lucide-react';
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
import { accionDeEdicion, esCampoDeTexto } from '../utils/atajosArte';
import useTeclado from '../hooks/useTeclado';
import { MAX_FRAMES, LADO_INICIAL } from '../config/limites';
import VistaPrevia from './VistaPrevia';
import BarraEdicionFrames from './BarraEdicionFrames';
import ListaFrames from './ListaFrames';
import BotonIcono from './BotonIcono';
import DialogoLienzo from './DialogoLienzo';
import SelectorLienzo, { problemaLado } from './SelectorLienzo';

// Pestaña "Frames": vista previa, barra de herramientas y lista de frames (RF15 a RF21).
//
// Props:
//   datos          lo que devuelve useProyectoFrames
//   seleccion      lo que devuelve useSeleccionFrames
//   reproduccion   lo que devuelve useReproduccion
//   puedeEditar, proporcion
//   onEditar(clave)   abrir un frame en la pestaña Imagen
//   onSoltarArchivo(id, posicion)   se soltó uno de los archivos del proyecto en un hueco de la lista
//   onAbrirArchivos()
function EtapaFrames({ datos, seleccion, reproduccion, puedeEditar, proporcion, onEditar, onSoltarArchivo, onAbrirArchivos }) {
    const { frames, ocupado, portapapeles, aplicar, avisar, proyecto } = datos;
    const hayEspacio = checkEspacio(frames);
    const [dialogoLienzo, setDialogoLienzo] = useState(false);
    const cerrarDialogo = useCallback(() => setDialogoLienzo(false), []);
    // Proyecto sin frames: tamaño del frame en blanco con que se empieza
    const [inicio, setInicio] = useState({ ancho: String(LADO_INICIAL), alto: String(LADO_INICIAL) });
    const [erroresInicio, setErroresInicio] = useState({});

    function crearEnBlanco(evento) {
        evento.preventDefault();
        const errores = { ancho: problemaLado(inicio.ancho), alto: problemaLado(inicio.alto) };
        setErroresInicio(errores);
        if (errores.ancho || errores.alto) return;
        datos.crearFrameVacio(Number(inicio.ancho), Number(inicio.alto));
    }

    async function cambiarLienzo(valores) {
        if (await datos.cambiarLienzo(valores)) setDialogoLienzo(false);
    }
    const puedePegar = portapapeles.length > 0 && checkEspacio(frames, portapapeles.length);

    function posicionDespuesDeSeleccion() {
        const { claves } = seleccion;
        if (claves.length === 0) return frames.length;
        return frames.findIndex((f) => f.clave === claves[claves.length - 1]) + 1;
    }

    function copiar() {
        if (seleccion.claves.length === 0) return false;
        datos.setPortapapeles(copiarFrames(frames, seleccion.claves));
        avisar(''); // lo copiado se ve en el número del botón Pegar
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
        lienzo: () => setDialogoLienzo(true),
        guardar: datos.guardar,
    };

    // Atajos de teclado de esta pestaña (solo existen mientras está abierta). Cada acción devuelve false si no
    // hizo nada, y entonces la tecla hace lo normal del navegador
    const ultimas = useRef(acciones);
    ultimas.current = acciones;
    useTeclado((evento) => {
        const control = evento.ctrlKey || evento.metaKey;
        const tecla = evento.key.toLowerCase();
        const edicion = accionDeEdicion(evento);
        if (esCampoDeTexto(evento.target)) {
            if (edicion !== 'guardar') return null;
            // Guardar desde un campo: primero se confirma lo que se estaba escribiendo
            const campo = evento.target;
            return () => { campo.blur(); setTimeout(() => ultimas.current.guardar(), 0); };
        }
        if (edicion) return acciones[edicion];
        if (control && tecla === 'c') return acciones.copiar;
        if (control && tecla === 'v') return acciones.pegar;
        if (control && tecla === 'a') return acciones.seleccionarTodo;
        if (tecla === 'delete') return acciones.eliminar;
        if (tecla === 'escape') return acciones.quitarSeleccion;
        return null;
    });

    if (datos.guardado.length === 0 && frames.length === 0) {
         return (
            <section className="etapa-vacia" aria-labelledby="titulo-inicio">
                <h2 id="titulo-inicio" className="solo-lector">Empieza tu proyecto</h2>
                <div className="opciones-inicio">
                    <div className="opcion-inicio">
                        <h3>Importar un GIF o imagen</h3>
                        <BotonIcono icono={FolderOpen} texto="Abrir archivos" lado="abajo" principal className="boton-grande" onClick={onAbrirArchivos} />
                    </div>
                    <form className="opcion-inicio" onSubmit={crearEnBlanco} noValidate>
                        <h3>Lienzo en blanco</h3>
                        <SelectorLienzo
                            prefijo="inicio"
                            ancho={inicio.ancho}
                            alto={inicio.alto}
                            errores={erroresInicio}
                            onCambiar={(m) => { setInicio(m); setErroresInicio({}); }}
                        />
                        <BotonIcono
                            icono={Plus}
                            texto="Agregar"
                            lado="abajo"
                            principal
                            className="boton-grande boton-agregar-inicio"
                            type="submit"
                            disabled={ocupado}
                            aria-busy={datos.subiendo}
                        />
                    </form>
                </div>
            </section>
        );
    }

    return (
        <div className="etapa-frames">
            <BarraEdicionFrames
                deshabilitado={ocupado}
                total={frames.length}
                seleccionados={seleccion.claves.length}
                copiados={portapapeles.length}
                puedeDeshacer={datos.puedeDeshacer}
                puedeRehacer={datos.puedeRehacer}
                puedePegar={puedePegar}
                puedeInsertar={hayEspacio}
                puedeInvertir={clavesObjetivo(frames, seleccion.activa).length >= 2}
                sinGuardar={datos.sinGuardar}
                guardando={datos.guardando}
                acciones={acciones}
                lienzo={proyecto?.ancho ? { ancho: proyecto.ancho, alto: proyecto.alto } : null}
            />
            <div className="etapa-frames-contenido">
                <section aria-labelledby="titulo-secuencia">
                    <h2 id="titulo-secuencia" className="solo-lector">Animación</h2>
                    {frames.length === 0 ? null : (
                        <VistaPrevia frames={frames} reproduccion={reproduccion} proporcion={proporcion} />
                    )}
                </section>

                <section aria-labelledby="titulo-edicion">
                    <div className="encabezado-frames">
                        <h2 id="titulo-edicion">Frames</h2>
                        <span className="cuenta-frames" title={`Máximo ${MAX_FRAMES}`}>{frames.length} / {MAX_FRAMES}</span>
                        {datos.sinGuardar && <span className="estado-sin-guardar">Sin guardar</span>}
                    </div>
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
                        onSoltarArchivo={onSoltarArchivo}
                    />
                </section>
            </div>
            {dialogoLienzo && proyecto?.ancho && (
                <DialogoLienzo
                    anterior={{ ancho: proyecto.ancho, alto: proyecto.alto }}
                    ocupado={ocupado}
                    onAplicar={cambiarLienzo}
                    onCerrar={cerrarDialogo}
                />
            )}
        </div>
    );
}

export default EtapaFrames;