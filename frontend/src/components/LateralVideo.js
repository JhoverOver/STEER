import { Diamond, Trash2, X } from 'lucide-react';
import BotonIcono from './BotonIcono';
import PanelTexto from './PanelTexto';
import { problemaForma } from '../utils/formas';

// Panel al lado del escenario de la pestaña Video. Arriba, a qué frames se aplica lo que se hace (este frame o los
// marcados, o toda la fila). Debajo, según lo que se esté haciendo: la capa elegida, el texto o el color de una forma
// (nueva o de la capa), los keyframes abiertos y, si hay algo sin aplicar, Descartar y Aplicar.
//
// Props:
//   alcance ('frame' | 'fila'), onAlcance(alcance), marcados (cuántos hay), onQuitarMarcas()
//   fila, capa             la fila elegida y su capa en el frame actual (o null)
//   pendiente              lo que está sin aplicar (ver EtapaVideo) o null
//   forma, onForma(forma)  la forma que se edita aquí (o null)
//   onAplicar(), onDescartar()
//   pregunta, onResponder(aplicar)   se quiso hacer otra cosa con algo pendiente: aplicar o descartar
//   onSoltar(), onQuitar(), onKeyframes(), onQuitarKeyframes()
//   ocupado, generando
function LateralVideo({
    alcance, onAlcance, marcados, onQuitarMarcas, fila, capa, pendiente, forma, onForma, onAplicar, onDescartar,
    pregunta, onResponder, onSoltar, onQuitar, onKeyframes, onQuitarKeyframes, ocupado, generando,
}) {
    const enKeyframes = pendiente?.tipo === 'keyframes';
    const esNueva = pendiente?.tipo === 'nueva';
    const textoFrame = marcados > 0 ? `${marcados} marcado${marcados === 1 ? '' : 's'}` : 'Este frame';
    const invalida = forma ? Boolean(problemaForma(forma)) : false;

    let titulo = null;
    if (esNueva) titulo = forma?.tipo === 'texto' ? 'Texto nuevo' : 'Rectángulo nuevo';
    else if (fila) titulo = capa ? capa.nombre : 'Capa';

    return (
        <aside className="video-lateral" aria-label="Capa elegida">
            <div className="alcance-video" role="group" aria-label="Se aplica a">
                <button type="button" aria-pressed={alcance === 'frame'} onClick={() => onAlcance('frame')} disabled={enKeyframes}>
                    {textoFrame}
                </button>
                <button type="button" aria-pressed={alcance === 'fila'} onClick={() => onAlcance('fila')}>Toda la fila</button>
                {marcados > 0 && <BotonIcono icono={X} texto="Quitar marcas" lado="abajo" onClick={onQuitarMarcas} />}
            </div>

            {titulo && (
                <div className="titulo-lateral">
                    <h3>{titulo}</h3>
                    {fila && !esNueva && (
                        <>
                            <BotonIcono
                                icono={Diamond}
                                texto="Keyframes"
                                lado="abajo"
                                aria-pressed={enKeyframes}
                                onClick={onKeyframes}
                                disabled={ocupado || !capa}
                            />
                            {!pendiente && capa && (
                                <BotonIcono icono={Trash2} texto="Quitar capa" atajo="Supr" lado="abajo" peligro onClick={onQuitar} disabled={ocupado} />
                            )}
                            <BotonIcono icono={X} texto="Soltar la capa" atajo="Esc" lado="abajo" onClick={onSoltar} />
                        </>
                    )}
                </div>
            )}

            {enKeyframes && (
                <div className="keyframes-lateral">
                    <p>
                        {pendiente.animacion.keyframes.length}
                        {' '}
                        keyframe{pendiente.animacion.keyframes.length === 1 ? '' : 's'}
                    </p>
                    {capa?.animacion && (
                        <button type="button" className="boton-peligro" onClick={onQuitarKeyframes} disabled={ocupado}>Quitar keyframes</button>
                    )}
                </div>
            )}

            {forma?.tipo === 'texto' && <PanelTexto prefijo="texto-video" texto={forma} onCambiar={onForma} />}
            {forma?.tipo === 'rectangulo' && (
                <div className="campo campo-color">
                    <label htmlFor="rectangulo-video-color">Color</label>
                    <input id="rectangulo-video-color" type="color" value={forma.color} onChange={(e) => onForma({ ...forma, color: e.target.value })} />
                </div>
            )}

            {pregunta && (
                <p role="alertdialog" aria-label="Cambios sin aplicar" className="pregunta-pendiente">
                    Hay cambios sin aplicar.
                </p>
            )}
            {pendiente && (
                <div className="acciones-lateral">
                    <button type="button" onClick={pregunta ? () => onResponder(false) : onDescartar} disabled={ocupado}>Descartar</button>
                    <button
                        type="button"
                        className="boton-principal"
                        onClick={pregunta ? () => onResponder(true) : onAplicar}
                        disabled={ocupado || invalida}
                        aria-busy={generando}
                        title="Enter"
                    >
                        Aplicar
                    </button>
                </div>
            )}
        </aside>
    );
}

export default LateralVideo;
