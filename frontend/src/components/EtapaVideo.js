import { useEffect, useRef, useState } from 'react';
import { SkipBack, SkipForward, StepBack, StepForward, Pause, Play } from 'lucide-react';
import LineaTiempo from './LineaTiempo';
import BarraVideo, { HERRAMIENTAS_VIDEO } from './BarraVideo';
import EscenarioVideo from './EscenarioVideo';
import LateralVideo from './LateralVideo';
import BotonIcono from './BotonIcono';
import {
    agregarCapaEnFrames, aplicarAnimacion, aplicarTransformacion, cajaDeFila, canvasPara, capaDeFila, capaEnPunto,
    editarFormaDeFila, eliminarFila, filaDeCapa, indicesObjetivo, quitarAnimacion, transformarFila,
} from '../utils/operacionesVideo';
import { textoInicial } from '../utils/texto';
import { cajaForma, canvasDeForma, dibujarForma, grupoNuevo, problemaForma, rectanguloEntre, transformarForma } from '../utils/formas';
import {
    NEUTRO, agregarKeyframe, animacionDeFila, baseDe, componer, crearAnimacion, moverKeyframe, ponerKeyframe,
    quitarKeyframe, valoresEn,
} from '../utils/animacion';
import { esquinasTransformadas, rectanguloTransformado } from '../utils/herramientas';
import { esSinTransformacion } from '../utils/manijas';
import { TIPO_ARCHIVO } from './PanelArchivos';
import { calcularAjuste, nombreDesdeArchivo } from '../utils/importarImagen';
import { checkDuracion, cambiarDuracion } from '../utils/operacionesFrames';
import { accionDeEdicion, esCampoDeTexto } from '../utils/atajosArte';
import useTeclado from '../hooks/useTeclado';
import { inicios, formatearTiempo } from '../utils/lineaTiempo';
import useCabezal from '../hooks/useCabezal';
import { capasDeFrames } from '../utils/capasProyecto';
import { origenEnZona } from '../utils/imagenes';
import { MAX_CAPAS } from '../config/limites';

// Campos de una forma que no son su lugar, tamaño ni giro (los que se cambian en el panel lateral)
const GEOMETRIA = new Set(['tipo', 'x', 'y', 'rotacion', 'ancho', 'alto', 'grupo']);
const nombreDeTexto = (forma) => forma.contenido.split('\n')[0].trim().slice(0, 40) || 'Texto';

// Pestaña "Video": la animación en el tiempo. Escenario con herramientas (mover, escalar y girar una capa; agregar un
// rectángulo o un texto), controles de reproducción y la línea de tiempo con una fila por capa.
//
// Nada se aplica al momento: lo que se hace queda pendiente y se ve solo en el frame actual, hasta pulsar Aplicar
// (o Enter); Esc lo descarta. Así cada gesto es instantáneo aunque el proyecto tenga muchos frames. Al aplicar, el
// cambio queda en el historial (Ctrl + Z lo deshace entero). Si hay algo pendiente y se elige otra capa o se cambia
// de pestaña, primero se pregunta si aplicarlo o descartarlo.
//
// A qué frames se aplica ("alcance"):
//   'frame'  el frame actual (o los marcados con Shift + clic). Es lo que queda al elegir una capa en el escenario.
//   'fila'   todos los frames. Es lo que queda al elegir una fila por su nombre en la línea de tiempo.
//
// Keyframes: el botón ◆ de una fila abre sus keyframes (utils/animacion.js). El primero queda en el frame actual; en
// otro frame, mover, escalar o girar la capa pone otro keyframe ahí. La caja que se mueve envuelve la capa en todos
// los frames: la fila se mueve entera, como una sola cosa. Al aplicar, cada frame desde el primer
// keyframe recibe la capa en el punto que le toca.
//
// Props:
//   datos          lo que devuelve useProyectoFrames
//   reproduccion   lo que devuelve useReproduccion: se abre en el frame que se estaba viendo y se le avisa
//                  cada vez que cambia el frame, para que la pestaña Frames siga en el mismo
//   onEditar(clave)   abrir un frame en la pestaña Imagen (opcional)
//   seleccion      lo que devuelve useSeleccionFrames: los frames marcados (los mismos de la pestaña Frames)
//   control        ref donde la pestaña deja { agregarImagen(archivo, punto?), hayPendiente, preguntar(continuar) }
//   fileDeArchivo(id)   el File de uno de los archivos del proyecto (al soltarlo en el escenario)
function EtapaVideo({ datos, reproduccion, onEditar, seleccion, control, fileDeArchivo }) {
    const { proyecto, frames } = datos;
    const { tiempo: tiempoSeguro, indice, total, reproduciendo, alternar, buscar, irAFrame } = useCabezal(frames, reproduccion.indice);
    const [generando, setGenerando] = useState(false);
    const memoriaCapas = useRef(new Map()); // capas ya pedidas al servidor, por id de frame guardado
    const [capasPorFrame, setCapasPorFrame] = useState(null); // vista de capas: Map clave del frame -> capas
    const ocupado = datos.ocupado || generando;
    const [herramienta, setHerramienta] = useState('mover');
    const [color, setColor] = useState('#d4a72c');
    const [fila, setFila] = useState(null); // fila de capas elegida ('capa-<n>')
    const [alcance, setAlcance] = useState('fila');
    const [cajaFila, setCajaFila] = useState(null);
    const [pendiente, setPendiente] = useState(null); // lo hecho sin aplicar (ver arriba)
    const [pregunta, setPregunta] = useState(null); // { continuar }: hay algo pendiente y se quiere hacer otra cosa
    const marcados = seleccion ? seleccion.activa : new Set();
    const claveMarcados = seleccion ? seleccion.claves.join(',') : '';

    const contexto = { proyectoId: proyecto.id, ancho: proyecto.ancho, alto: proyecto.alto, memoria: memoriaCapas.current };
    const frame = frames[indice];
    const { ancho, alto } = proyecto;
    const comienzos = inicios(frames);
    const inicioActual = comienzos[indice] ?? 0;
    const todos = frames.map((_, i) => i);
    const indicesFrame = marcados.size > 0 ? indicesObjetivo(frames, marcados) : [indice];
    const indices = alcance === 'fila' ? todos : indicesFrame;
    const capasLista = capasPorFrame ? frames.map((f) => capasPorFrame.get(f.clave) || null) : null;
    const capasActual = (frame && capasPorFrame && capasPorFrame.get(frame.clave)) || null;
    const capaFila = capaDeFila(capasActual, fila);
    const enKeyframes = pendiente?.tipo === 'keyframes';

    // Capas de todos los frames para la vista de capas de la línea de tiempo. Las de los frames guardados se piden
    // al servidor una sola vez (memoriaCapas); las de los frames editados ya están en el navegador.
    // Mientras cargan las nuevas se sigue mostrando lo anterior
    const proyectoId = proyecto.id;
    useEffect(() => {
        let vigente = true;
        capasDeFrames(frames, proyectoId, memoriaCapas.current)
            .then((mapa) => vigente && setCapasPorFrame(mapa))
            .catch(() => vigente && setCapasPorFrame((actual) => actual || new Map()));
        return () => { vigente = false; };
    }, [frames, proyectoId]);

    // La pestaña Frames queda en el mismo frame que se ve aquí
    const { indice: indiceCompartido, irA } = reproduccion;
    useEffect(() => {
        if (indice !== indiceCompartido) irA(indice);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [indice]);

    // Caja de la fila elegida: lo que tiene en los frames a los que se aplica
    const claveIndices = indices.join(',');
    useEffect(() => {
        let vigente = true;
        if (!fila || !capasLista) {
            setCajaFila(null);
            return undefined;
        }
        cajaDeFila(capasLista, fila, indices, ancho, alto)
            .then((caja) => vigente && setCajaFila(caja), () => vigente && setCajaFila(null));
        return () => { vigente = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fila, capasPorFrame, frames, claveIndices, claveMarcados, ancho, alto]);

    // ---- aplicar ----

    // Hace una operación sobre todos los frames ({ frames } -> { frames, omitidos }) y la deja en el historial como
    // un solo cambio. Devuelve true si se hizo
    async function ejecutar(operacion, motivo) {
        if (ocupado) return false;
        setGenerando(true);
        try {
            const resultado = await operacion({ frames });
            datos.aplicarTodo(() => ({ frames: resultado.frames }));
            if (resultado.omitidos) {
                datos.avisar(`En ${resultado.omitidos} frame(s) no se pudo: ya tenían el máximo de ${MAX_CAPAS} capas, `
                    + 'una sola capa (al quitar) o keyframes (se cambian con ◆).');
            }
            return true;
        } catch (error) {
            datos.avisar(`${motivo}. ${error.message}`);
            return false;
        } finally {
            setGenerando(false);
        }
    }

    // Posición (desde abajo) que tendrá una capa agregada arriba de todas en el frame actual
    const filaNueva = () => `capa-${(capasActual || []).length}`;

    async function agregarCapa(datosCapa, destino = indices) {
        const nueva = filaNueva();
        const listo = await ejecutar((base) => agregarCapaEnFrames(base, destino, datosCapa, contexto), 'No se pudo agregar la capa');
        if (listo) {
            setFila(nueva);
            setHerramienta('mover');
        }
        return listo;
    }

    // Los frames de lo pendiente quedan fijos al hacerlo (null: todos), aunque después se vaya a otro frame
    const fijarIndices = (a = alcance) => (a === 'fila' ? null : indicesFrame);

    function cambiarAlcance(nuevo) {
        setAlcance(nuevo);
        if (pendiente && pendiente.tipo !== 'keyframes') setPendiente({ ...pendiente, indices: fijarIndices(nuevo) });
    }

    // Aplica lo pendiente. Devuelve true si quedó aplicado (o no había nada)
    async function aplicar() {
        if (!pendiente) return true;
        const destino = pendiente.indices || todos;
        if (pendiente.tipo === 'nueva') {
            const { forma } = pendiente;
            if (problemaForma(forma)) return false;
            const conGrupo = { ...forma, grupo: grupoNuevo() };
            const nombre = forma.tipo === 'texto' ? nombreDeTexto(forma) : 'Rectángulo';
            const listo = await agregarCapa({ nombre, canvas: canvasDeForma(conGrupo, ancho, alto), forma: conGrupo }, destino);
            if (listo) setPendiente(null);
            return listo;
        }
        if (pendiente.tipo === 'fila') {
            const { t, cambios, region, forma } = pendiente;
            if (cambios && forma && problemaForma({ ...forma, ...cambios })) return false;
            const listo = await ejecutar(async (base) => {
                let resultado = { frames: base.frames, omitidos: 0 };
                if (cambios && forma) resultado = await editarFormaDeFila(resultado, fila, forma.grupo, cambios, destino, contexto);
                if (region && !esSinTransformacion(t)) {
                    const movido = await transformarFila(resultado, fila, region, t, destino, contexto);
                    resultado = { frames: movido.frames, omitidos: resultado.omitidos + movido.omitidos };
                }
                return resultado;
            }, 'No se pudo cambiar la capa');
            if (listo) setPendiente(null);
            return listo;
        }
        // Keyframes: si nunca tuvo animación y solo hay un keyframe sin cambios, no hay nada que aplicar
        const { animacion } = pendiente;
        const tenia = capasLista && animacionDeFila(capasLista.map((capas) => capaDeFila(capas, fila)));
        const vacia = animacion.keyframes.length === 1 && esSinTransformacion(animacion.keyframes[0]);
        if (!tenia && vacia) {
            setPendiente(null);
            return true;
        }
        const listo = await ejecutar((base) => aplicarAnimacion(base, fila, animacion, contexto), 'No se pudieron aplicar los keyframes');
        if (listo) setPendiente(null);
        return listo;
    }

    function descartar() {
        setPendiente(null);
        setPregunta(null);
    }

    // Antes de hacer otra cosa con algo pendiente, se pregunta si aplicarlo o descartarlo
    function despuesDePendiente(continuar) {
        if (!pendiente) {
            continuar();
            return;
        }
        setPregunta({ continuar });
    }

    async function responder(aplicarlo) {
        const { continuar } = pregunta;
        if (aplicarlo) {
            if (!(await aplicar())) return;
        } else {
            setPendiente(null);
        }
        setPregunta(null);
        continuar();
    }

    // ---- elegir ----

    function elegirFila(nueva, nuevoAlcance) {
        if (nueva === fila && pendiente) {
            if (!enKeyframes) cambiarAlcance(nuevoAlcance);
            return;
        }
        despuesDePendiente(() => {
            setFila(nueva);
            setAlcance(nuevoAlcance);
        });
    }

    async function elegirEnPunto(punto) {
        if (!capasActual) return;
        if (pendiente?.tipo === 'nueva') return; // un clic fuera de lo nuevo no lo suelta
        const capa = await capaEnPunto(capasActual, punto, ancho, alto);
        const nueva = capa ? filaDeCapa(capasActual, capa) : null;
        if (enKeyframes && nueva !== fila) return; // en keyframes, la capa queda fija
        elegirFila(nueva, 'frame');
    }

    // Abre (o cierra) los keyframes de una fila. La animación que ya tenga se puede seguir editando; si no tiene,
    // empieza con un keyframe sin cambios en el frame actual, con la caja de su dibujo ahí
    function abrirKeyframes(clave) {
        if (enKeyframes && clave === fila) {
            despuesDePendiente(() => {});
            return;
        }
        despuesDePendiente(async () => {
            const celdas = capasLista ? capasLista.map((capas) => capaDeFila(capas, clave)) : [];
            const existente = animacionDeFila(celdas);
            setFila(clave);
            setAlcance('fila');
            setHerramienta('mover');
            if (existente) {
                setPendiente({ tipo: 'keyframes', animacion: existente, elegido: null });
                return;
            }
            // La caja envuelve la capa en todos los frames: los keyframes mueven la fila entera como una sola cosa
            const conCapa = celdas.map((c, i) => (c ? i : -1)).filter((i) => i >= 0);
            const caja = capasLista && await cajaDeFila(capasLista, clave, conCapa, ancho, alto, true);
            if (!caja) {
                datos.avisar('Esa capa está vacía: no hay nada que animar.');
                return;
            }
            const desde = celdas[indice] ? indice : conCapa[0];
            setPendiente({ tipo: 'keyframes', animacion: crearAnimacion(caja, comienzos[desde] ?? 0), elegido: null });
        });
    }

    // ---- gestos en el escenario ----

    // Valores de la animación en el frame actual (antes del primer keyframe el frame no se toca)
    function valoresActuales(animacion) {
        const primero = animacion.keyframes[0].tiempo;
        return inicioActual < primero ? NEUTRO : valoresEn(animacion.keyframes, inicioActual);
    }

    function alGesto(g) {
        if (!pendiente) {
            if (!fila || !cajaFila) return;
            if (capaFila?.animacion) {
                datos.avisar('Esta capa tiene keyframes: muévela con ◆.');
                return;
            }
            setPendiente({ tipo: 'fila', t: componer(NEUTRO, g), cambios: null, region: cajaFila, forma: capaFila?.forma || null, indices: fijarIndices() });
        } else if (pendiente.tipo === 'fila') {
            setPendiente({ ...pendiente, t: componer(pendiente.t, g) });
        } else if (pendiente.tipo === 'nueva') {
            setPendiente({ ...pendiente, forma: transformarForma(pendiente.forma, cajaForma(pendiente.forma), g) });
        } else {
            const animacion = ponerKeyframe(pendiente.animacion, inicioActual, componer(valoresActuales(pendiente.animacion), g));
            setPendiente({ ...pendiente, animacion, elegido: inicioActual });
        }
    }

    function crearRectangulo(rect) {
        despuesDePendiente(() => {
            const forma = rectanguloEntre({ x: rect.x, y: rect.y }, { x: rect.x + rect.ancho, y: rect.y + rect.alto }, color);
            setFila(null);
            setPendiente({ tipo: 'nueva', forma, indices: fijarIndices() });
            setHerramienta('mover');
        });
    }

    function empezarTexto(punto) {
        despuesDePendiente(() => {
            setFila(null);
            setPendiente({ tipo: 'nueva', forma: textoInicial(punto.x, punto.y, '#ffffff'), indices: fijarIndices() });
            setHerramienta('mover');
        });
    }

    // Cambios del panel lateral a la forma (la nueva, o la de la fila elegida)
    function cambiarForma(forma) {
        if (pendiente?.tipo === 'nueva') {
            setPendiente({ ...pendiente, forma });
            return;
        }
        const original = pendiente?.tipo === 'fila' ? pendiente.forma : capaFila?.forma;
        if (!original) return;
        const cambios = {};
        for (const [campo, valor] of Object.entries(forma)) {
            if (!GEOMETRIA.has(campo) && valor !== original[campo]) cambios[campo] = valor;
        }
        const previo = pendiente?.tipo === 'fila'
            ? pendiente
            : { tipo: 'fila', t: NEUTRO, region: cajaFila, forma: original, indices: fijarIndices() };
        const hayAlgo = Object.keys(cambios).length > 0 || !esSinTransformacion(previo.t);
        setPendiente(hayAlgo ? { ...previo, cambios } : null);
    }

    async function quitarFila() {
        if (!fila || !capaFila || pendiente) return;
        const donde = alcance === 'fila' ? 'de todos los frames' : `de ${indices.length === 1 ? 'este frame' : `los ${indices.length} frames marcados`}`;
        if (!window.confirm(`¿Quitar la capa "${capaFila.nombre}" ${donde}?`)) return;
        if (await ejecutar((base) => eliminarFila(base, fila, indices, contexto), 'No se pudo quitar la capa')) setFila(null);
    }

    async function quitarKeyframes() {
        if (!enKeyframes) return;
        const { id } = pendiente.animacion;
        if (!window.confirm('¿Quitar los keyframes de esta capa? Vuelve a quedar como antes de animarla.')) return;
        setPendiente(null);
        await ejecutar((base) => quitarAnimacion(base, fila, id, contexto), 'No se pudieron quitar los keyframes');
    }

    // Una imagen de Archivos como capa nueva en los frames: se achica si no cabe y queda centrada (o en "punto")
    async function agregarImagen(archivo, punto = null) {
        try {
            const imagen = await createImageBitmap(archivo);
            const { ancho: w, alto: h } = calcularAjuste(imagen.width, imagen.height, ancho, alto);
            const centro = punto || { x: ancho / 2, y: alto / 2 };
            const rect = { x: Math.round(centro.x - w / 2), y: Math.round(centro.y - h / 2), ancho: w, alto: h };
            const { canvas, ctx } = canvasPara(rect, ancho, alto);
            ctx.drawImage(imagen, rect.x, rect.y, w, h);
            if (imagen.close) imagen.close();
            return agregarCapa({ nombre: nombreDesdeArchivo(archivo.name), canvas });
        } catch (error) {
            datos.avisar(`No se pudo leer la imagen. ${error.message}`);
            return false;
        }
    }
    if (control) control.current = { agregarImagen, hayPendiente: Boolean(pendiente), preguntar: despuesDePendiente };

    // ---- keyframes en la línea de tiempo ----

    function elegirKeyframe(tiempo) {
        if (!enKeyframes) return;
        setPendiente({ ...pendiente, elegido: tiempo });
        buscar(Math.min(tiempo, Math.max(total - 1, 0)));
    }

    function cambiarKeyframes(cambiar, elegido) {
        if (!enKeyframes) return;
        const animacion = cambiar(pendiente.animacion);
        if (animacion !== pendiente.animacion) setPendiente({ ...pendiente, animacion, elegido });
    }

    // Devuelve false si la duración no es válida
    function cambiarDuracionDeUno(clave, valor) {
        if (ocupado || !checkDuracion(valor)) return false;
        datos.aplicar((f) => cambiarDuracion(f, [clave], valor));
        return true;
    }

    // Atajos de esta pestaña: espacio reproduce o pausa, las flechas cambian de frame, Inicio y Fin van a los
    // extremos, V / R / T eligen herramienta, Enter aplica, Esc descarta (o suelta la capa), Supr quita la capa
    // (o el keyframe elegido), y Ctrl + Z / Y / S como en Frames
    useTeclado((evento) => {
        if (esCampoDeTexto(evento.target)) return null;
        const edicion = accionDeEdicion(evento);
        if (edicion) return () => { if (!generando && !pendiente) datos[edicion](); };
        if (evento.ctrlKey || evento.metaKey || evento.altKey) return null;
        const tecla = evento.key.toLowerCase();
        const herramientaElegida = HERRAMIENTAS_VIDEO.find((h) => h.atajo.toLowerCase() === tecla);
        if (herramientaElegida) return () => setHerramienta(herramientaElegida.id);
        const porTecla = {
            ' ': alternar,
            arrowleft: () => irAFrame(indice - 1),
            arrowright: () => irAFrame(indice + 1),
            home: () => irAFrame(0),
            end: () => irAFrame(frames.length - 1),
            enter: () => { if (pendiente && !ocupado) aplicar(); },
            escape: () => { if (pregunta) setPregunta(null); else if (pendiente) descartar(); else setFila(null); },
            delete: () => {
                if (enKeyframes && pendiente.elegido !== null) cambiarKeyframes((a) => quitarKeyframe(a, pendiente.elegido), null);
                else quitarFila();
            },
        };
        return porTecla[tecla] || null;
    });

    if (frames.length === 0) {
        return <p>Sin frames.</p>;
    }

    // ---- lo que muestra el escenario ----
    let caja = null;
    let contorno = null;
    let capaOculta = null;
    let dibujarEncima = null;
    const urlsExtra = [];
    // Dibuja la capa de la fila (su forma, o su imagen) con la transformación "t" alrededor de "region"
    const dibujarCapa = (ctx, imagenes, base, region, t) => {
        if (base.forma) {
            dibujarForma(ctx, transformarForma(base.forma, region, t));
            return;
        }
        const img = imagenes.get(base.imagen);
        if (!img) return;
        const origen = origenEnZona(img, ancho, alto);
        aplicarTransformacion(ctx, region, t);
        ctx.drawImage(img, origen.x - ancho, origen.y - alto);
    };
    // Lo pendiente de "este frame" (o de los marcados) solo se ve en esos frames
    const pendienteAqui = pendiente && (!pendiente.indices || pendiente.indices.includes(indice));
    if (pendiente?.tipo === 'nueva') {
        if (pendienteAqui) caja = cajaForma(pendiente.forma);
        const { forma } = pendiente;
        if (pendienteAqui) dibujarEncima = (ctx, g) => dibujarForma(ctx, transformarForma(forma, cajaForma(forma), g));
    } else if (enKeyframes && capaFila) {
        const { animacion } = pendiente;
        const valores = valoresActuales(animacion);
        const base = baseDe(capaFila);
        if (base.imagen) urlsExtra.push(base.imagen);
        caja = rectanguloTransformado(animacion.caja, valores);
        contorno = esquinasTransformadas(animacion.caja, valores);
        capaOculta = capaFila;
        dibujarEncima = (ctx, g, imagenes) => dibujarCapa(ctx, imagenes, base, animacion.caja, componer(valores, g));
    } else if (pendiente?.tipo === 'fila' && capaFila && pendiente.region) {
        const { t, cambios, region } = pendiente;
        caja = rectanguloTransformado(region, t);
        contorno = esquinasTransformadas(region, t);
        if (pendienteAqui) {
            const base = { imagen: capaFila.imagen, forma: capaFila.forma ? { ...capaFila.forma, ...cambios } : null };
            capaOculta = capaFila;
            dibujarEncima = (ctx, g, imagenes) => dibujarCapa(ctx, imagenes, base, region, componer(t, g));
        }
    } else if (!pendiente && fila && capaFila && cajaFila) {
        caja = cajaFila;
        capaOculta = capaFila;
        const base = { imagen: capaFila.imagen, forma: capaFila.forma };
        dibujarEncima = (ctx, g, imagenes) => dibujarCapa(ctx, imagenes, base, cajaFila, g);
    }

    // La forma que se muestra en el panel lateral: la nueva, o la de la fila con sus cambios sin aplicar
    let formaLateral = null;
    if (pendiente?.tipo === 'nueva') formaLateral = pendiente.forma;
    else if (pendiente?.tipo === 'fila' && pendiente.forma) formaLateral = { ...pendiente.forma, ...(pendiente.cambios || {}) };
    else if (capaFila?.forma && !pendiente) formaLateral = capaFila.forma;

    const nombre = `Frame ${indice + 1} de ${frames.length}`;
    return (
        <div className="etapa-con-barra">
            <BarraVideo
                herramienta={herramienta}
                onHerramienta={setHerramienta}
                color={color}
                onColor={setColor}
                ocupado={ocupado || Boolean(pendiente)}
                datos={datos}
            />
            <section className="etapa-video" aria-labelledby="titulo-video">
                <h2 id="titulo-video" className="solo-lector">Video</h2>

                <div className="video-escena">
                    <div
                        className="video-escenario-zona"
                        onDragOver={(e) => { if (fileDeArchivo && Array.from(e.dataTransfer?.types || []).includes(TIPO_ARCHIVO)) e.preventDefault(); }}
                        onDrop={(e) => {
                            const id = Number(e.dataTransfer?.getData(TIPO_ARCHIVO));
                            const archivo = id && fileDeArchivo ? fileDeArchivo(id) : null;
                            if (!archivo) return;
                            e.preventDefault();
                            agregarImagen(archivo);
                        }}
                    >
                        <EscenarioVideo
                            imagen={frame.vacio ? null : frame.imagen}
                            capas={capasActual}
                            ancho={ancho}
                            alto={alto}
                            herramienta={herramienta}
                            color={color}
                            caja={caja}
                            contorno={contorno}
                            capaOculta={capaOculta}
                            dibujarEncima={dibujarEncima}
                            urlsExtra={urlsExtra}
                            ocupado={ocupado}
                            onPunto={elegirEnPunto}
                            onGesto={alGesto}
                            onRectangulo={crearRectangulo}
                            onTexto={empezarTexto}
                        />
                    </div>
                    <LateralVideo
                        alcance={alcance}
                        onAlcance={cambiarAlcance}
                        marcados={marcados.size > 0 ? indicesObjetivo(frames, marcados).length : 0}
                        onQuitarMarcas={() => seleccion.quitar()}
                        fila={fila}
                        capa={capaFila}
                        pendiente={pendiente}
                        forma={formaLateral}
                        onForma={cambiarForma}
                        onAplicar={aplicar}
                        onDescartar={descartar}
                        pregunta={Boolean(pregunta)}
                        onResponder={responder}
                        onSoltar={() => despuesDePendiente(() => setFila(null))}
                        onQuitar={quitarFila}
                        onKeyframes={() => fila && abrirKeyframes(fila)}
                        onQuitarKeyframes={quitarKeyframes}
                        ocupado={ocupado}
                        generando={generando}
                    />
                </div>

                <div className="controles-video">
                    <BotonIcono icono={SkipBack} texto="Ir al inicio" atajo="Inicio" onClick={() => irAFrame(0)} />
                    <BotonIcono icono={StepBack} texto="Frame anterior" atajo="←" onClick={() => irAFrame(indice - 1)} />
                    <BotonIcono
                        icono={reproduciendo ? Pause : Play}
                        texto={reproduciendo ? 'Pausar' : 'Reproducir'}
                        atajo="Espacio"
                        principal
                        className="boton-grande"
                        onClick={alternar}
                    />
                    <BotonIcono icono={StepForward} texto="Frame siguiente" atajo="→" onClick={() => irAFrame(indice + 1)} />
                    <BotonIcono icono={SkipForward} texto="Ir al final" atajo="Fin" onClick={() => irAFrame(frames.length - 1)} />
                    <span className="tiempo-video">
                        {formatearTiempo(tiempoSeguro)} / {formatearTiempo(total)} · {nombre} · {frame.duracion} ms
                    </span>
                    {(generando || datos.sinGuardar) && (
                        <span className="estado-sin-guardar" aria-busy={generando}>{generando ? 'Aplicando...' : 'Sin guardar'}</span>
                    )}
                </div>

                <LineaTiempo
                    frames={frames}
                    tiempo={tiempoSeguro}
                    indiceActual={indice}
                    seguir={reproduciendo}
                    bloqueada={ocupado}
                    onBuscar={buscar}
                    onDuracion={cambiarDuracionDeUno}
                    onEditar={onEditar}
                    capasDeFrames={capasPorFrame}
                    anchoLienzo={ancho}
                    altoLienzo={alto}
                    filaElegida={fila}
                    onElegirFila={(clave) => { setHerramienta('mover'); elegirFila(clave, 'fila'); }}
                    onKeyframes={abrirKeyframes}
                    keyframes={enKeyframes ? { fila, lista: pendiente.animacion.keyframes, elegido: pendiente.elegido } : null}
                    onElegirKeyframe={elegirKeyframe}
                    onMoverKeyframe={(desde, hasta) => cambiarKeyframes((a) => moverKeyframe(a, desde, hasta), hasta)}
                    onAgregarKeyframe={(tiempo) => cambiarKeyframes((a) => agregarKeyframe(a, tiempo), tiempo)}
                    marcados={marcados}
                    onMarcar={seleccion ? seleccion.alternar : undefined}
                />
            </section>
        </div>
    );
}

export default EtapaVideo;
