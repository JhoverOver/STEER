import { Trash2, X } from 'lucide-react';
import BotonIcono from './BotonIcono';
import PanelTexto from './PanelTexto';
import { problemaTexto } from '../utils/texto';

// Panel al lado del escenario de la pestaña Video. Arriba dice a qué frames se aplica lo que se hace (todos o los
// marcados). Debajo, según lo que se esté haciendo:
//   - escribiendo un texto nuevo: sus opciones, para agregarlo
//   - con una fila de capas elegida: su nombre y, si es texto, sus opciones para cambiarlo en todas sus copias
//   - sin nada elegido: nada más (el escenario y la barra bastan)
//
// Props:
//   marcados        cuántos frames hay marcados (0: se aplica a todos); onQuitarMarcas()
//   textoNuevo      el texto que se está escribiendo, o null; onTextoNuevo(texto | null), onAgregarTexto()
//   fila            la fila elegida, o null; capa (la capa de esa fila en el frame actual), esPista
//   textoFila       cambios al texto de la fila todavía sin aplicar; onTextoFila(texto | null), onAplicarTexto()
//   onSoltar(), onQuitar()   soltar la fila / quitarla de los frames
//   ocupado, generando
function LateralVideo({
    marcados, onQuitarMarcas, textoNuevo, onTextoNuevo, onAgregarTexto, fila, capa, esPista, textoFila, onTextoFila,
    onAplicarTexto, onSoltar, onQuitar, ocupado, generando,
}) {
    let contenido = null;
    if (textoNuevo) {
        contenido = (
            <>
                <h3 className="solo-lector">Texto nuevo</h3>
                <PanelTexto prefijo="texto-nuevo" texto={textoNuevo} onCambiar={onTextoNuevo}>
                    <div className="acciones-lateral">
                        <button type="button" onClick={() => onTextoNuevo(null)}>Cancelar</button>
                        <button
                            type="button"
                            className="boton-principal"
                            onClick={onAgregarTexto}
                            disabled={ocupado || Boolean(problemaTexto(textoNuevo))}
                            aria-busy={generando}
                        >
                            Agregar
                        </button>
                    </div>
                </PanelTexto>
            </>
        );
    } else if (fila) {
        const textoMostrado = textoFila || capa?.texto || null;
        contenido = (
            <>
                <div className="titulo-lateral">
                    <h3>{capa ? capa.nombre : 'Capa'}</h3>
                    <BotonIcono icono={X} texto="Soltar la capa" atajo="Esc" lado="abajo" onClick={onSoltar} />
                </div>
                {capa?.texto && textoMostrado && (
                    <PanelTexto prefijo="texto-fila" texto={textoMostrado} onCambiar={onTextoFila}>
                        <div className="acciones-lateral">
                            <button type="button" onClick={() => onTextoFila(null)} disabled={!textoFila}>Descartar</button>
                            <button
                                type="button"
                                className="boton-principal"
                                onClick={onAplicarTexto}
                                disabled={ocupado || !textoFila || Boolean(problemaTexto(textoFila))}
                                aria-busy={generando}
                            >
                                Aplicar
                            </button>
                        </div>
                    </PanelTexto>
                )}
                {!esPista && capa && (
                    <BotonIcono icono={Trash2} texto="Quitar capa" atajo="Supr" peligro className="quitar-fila" onClick={onQuitar} disabled={ocupado} />
                )}
            </>
        );
    }

    return (
        <aside className="video-lateral" aria-label="Capa elegida">
            <p className={`alcance-video${marcados > 0 ? ' con-marcas' : ''}`}>
                <span className="solo-lector">Se aplica a: </span>
                <strong>{marcados > 0 ? `${marcados} marcado${marcados === 1 ? '' : 's'}` : 'Todos los frames'}</strong>
                {marcados > 0 && <BotonIcono icono={X} texto="Quitar marcas" lado="abajo" onClick={onQuitarMarcas} />}
            </p>
            {contenido}
        </aside>
    );
}

export default LateralVideo;
