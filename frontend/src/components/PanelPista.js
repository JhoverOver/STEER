import { useEffect, useState } from 'react';
import { RANGOS } from '../utils/pistas';
import { formatearTiempo } from '../utils/lineaTiempo';
import { MAXIMO_NOMBRE_CAPA, MAX_FRAMES, DURACION_MAXIMA } from '../config/limites';

// Campo numérico que se aplica al salir de él o con Enter (no en cada tecla: cada cambio vuelve a generar
// las capas de la pista). Escape vuelve al valor actual.
function CampoNumero({ etiqueta, unidad, valor, min, max, deshabilitado, onCambiar }) {
    const [texto, setTexto] = useState(String(valor));
    useEffect(() => setTexto(String(valor)), [valor]);

    function confirmar() {
        const numero = Number(texto);
        if (texto.trim() === '' || !Number.isFinite(numero)) {
            setTexto(String(valor));
            return;
        }
        const limitado = Math.min(Math.max(Math.round(numero), min), max);
        setTexto(String(limitado));
        if (limitado !== valor) onCambiar(limitado);
    }

    return (
        <label className="campo-keyframe">
            {etiqueta}
            <input
                type="number"
                value={texto}
                min={min}
                max={max}
                disabled={deshabilitado}
                onChange={(evento) => setTexto(evento.target.value)}
                onBlur={confirmar}
                onKeyDown={(evento) => {
                    if (evento.key === 'Enter') evento.currentTarget.blur();
                    if (evento.key === 'Escape') setTexto(String(valor));
                }}
            />
            <span>{unidad}</span>
        </label>
    );
}

const CAMPOS = [
    { campo: 'x', etiqueta: 'X', unidad: 'px' },
    { campo: 'y', etiqueta: 'Y', unidad: 'px' },
    { campo: 'escala', etiqueta: 'Escala', unidad: '%' },
    { campo: 'rotacion', etiqueta: 'Rotación', unidad: '°' },
    { campo: 'opacidad', etiqueta: 'Opacidad', unidad: '%' },
];

// Panel de la pista elegida en la línea de tiempo (pestaña Video): su nombre, los valores del keyframe
// elegido y las acciones. Sin pista elegida, ofrece crear una a partir de una capa del frame actual.
//
// Props:
//   pista, keyframe          los elegidos (o null)
//   tiempo                   momento del cabezal, para agregar keyframes ahí
//   ocupado                  se está generando o guardando: no se puede cambiar nada
//   puedeCrear               queda espacio para otra pista
//   onPedirCapas()           promesa con las capas del frame actual que se pueden animar
//   onCrear(capa)            crear una pista con esa capa
//   onCambiarKeyframe(cambios), onAgregarKeyframe(), onEliminarKeyframe()
//   onRenombrar(nombre), onRegenerar(), onEliminar(), onCerrar()
function PanelPista({
    pista, keyframe, tiempo, ocupado, puedeCrear, onPedirCapas, onCrear,
    onCambiarKeyframe, onAgregarKeyframe, onEliminarKeyframe, onRenombrar, onRegenerar, onEliminar, onCerrar,
}) {
    const [capas, setCapas] = useState(null); // capas para elegir al crear una pista (null: no se está eligiendo)
    const [cargandoCapas, setCargandoCapas] = useState(false);
    const [nombre, setNombre] = useState(pista ? pista.nombre : '');
    useEffect(() => setNombre(pista ? pista.nombre : ''), [pista]);

    async function elegirCapa() {
        setCargandoCapas(true);
        try {
            setCapas(await onPedirCapas());
        } finally {
            setCargandoCapas(false);
        }
    }

    if (!pista) {
        return (
            <section className="panel-pista" aria-labelledby="titulo-panel-pista">
                <h3 id="titulo-panel-pista">Keyframes</h3>
                <p>
                    Una pista anima una capa: en cada keyframe defines su posición, escala, rotación y opacidad, y Steer
                    genera esa capa en todos los frames que hay entre el primer y el último keyframe.
                </p>
                {capas === null ? (
                    <button type="button" onClick={elegirCapa} disabled={ocupado || !puedeCrear || cargandoCapas}>
                        {cargandoCapas ? 'Cargando capas...' : 'Nueva pista con una capa de este frame'}
                    </button>
                ) : (
                    <>
                        <p>Elige la capa que quieres animar (se oculta en este frame y la pista la reemplaza):</p>
                        {capas.length === 0 && <p>Este frame no tiene capas con dibujo para animar.</p>}
                        <div className="elegir-capa-pista">
                            {capas.map((capa) => (
                                <button
                                    key={capa.clave}
                                    type="button"
                                    disabled={ocupado}
                                    onClick={() => {
                                        setCapas(null);
                                        onCrear(capa);
                                    }}
                                >
                                    {capa.imagen && <img src={capa.imagen} alt="" />}
                                    <span>{capa.nombre}</span>
                                </button>
                            ))}
                        </div>
                        <button type="button" onClick={() => setCapas(null)}>Cancelar</button>
                    </>
                )}
                {!puedeCrear && <p>Llegaste al máximo de pistas de este proyecto.</p>}
            </section>
        );
    }

    return (
        <section className="panel-pista" aria-labelledby="titulo-panel-pista">
            <div className="panel-pista-titulo">
                <h3 id="titulo-panel-pista">Pista</h3>
                <button type="button" onClick={onCerrar}>Ver todas</button>
            </div>

            <label className="campo-keyframe campo-nombre-pista">
                Nombre
                <input
                    type="text"
                    value={nombre}
                    maxLength={MAXIMO_NOMBRE_CAPA}
                    disabled={ocupado}
                    onChange={(evento) => setNombre(evento.target.value)}
                    onBlur={() => {
                        if (nombre.trim() && nombre.trim() !== pista.nombre) onRenombrar(nombre.trim());
                        else setNombre(pista.nombre);
                    }}
                    onKeyDown={(evento) => {
                        if (evento.key === 'Enter') evento.currentTarget.blur();
                    }}
                />
            </label>

            {keyframe ? (
                <fieldset className="valores-keyframe" disabled={ocupado}>
                    <legend>Keyframe en {formatearTiempo(keyframe.tiempo)}</legend>
                    <CampoNumero
                        etiqueta="Tiempo"
                        unidad="ms"
                        valor={keyframe.tiempo}
                        min={0}
                        max={MAX_FRAMES * DURACION_MAXIMA}
                        onCambiar={(valor) => onCambiarKeyframe({ tiempo: valor })}
                    />
                    {CAMPOS.map(({ campo, etiqueta, unidad }) => (
                        <CampoNumero
                            key={campo}
                            etiqueta={etiqueta}
                            unidad={unidad}
                            valor={keyframe[campo]}
                            min={RANGOS[campo][0]}
                            max={RANGOS[campo][1]}
                            onCambiar={(valor) => onCambiarKeyframe({ [campo]: valor })}
                        />
                    ))}
                    <label className="campo-keyframe">
                        Hacia el siguiente
                        <select value={keyframe.curva} onChange={(evento) => onCambiarKeyframe({ curva: evento.target.value })}>
                            <option value="lineal">Lineal</option>
                            <option value="suave">Suave</option>
                        </select>
                    </label>
                </fieldset>
            ) : (
                <p>Elige un keyframe en la línea de tiempo para ver y cambiar sus valores.</p>
            )}

            <div className="acciones-pista">
                <button type="button" onClick={onAgregarKeyframe} disabled={ocupado}>
                    Agregar keyframe en {formatearTiempo(tiempo)}
                </button>
                <button type="button" onClick={onEliminarKeyframe} disabled={ocupado || !keyframe || pista.keyframes.length <= 1}>
                    Eliminar keyframe
                </button>
                <button type="button" onClick={onRegenerar} disabled={ocupado} title="Úsalo si cambiaste duraciones u orden en la pestaña Frames">
                    Regenerar capas
                </button>
                <button type="button" className="boton-peligro" onClick={onEliminar} disabled={ocupado}>
                    Eliminar pista
                </button>
            </div>
        </section>
    );
}

export default PanelPista;
