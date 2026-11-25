import { AlignCenter, AlignLeft, AlignRight, Bold, Italic } from 'lucide-react';
import BotonIcono from './BotonIcono';
import { FUENTES, LARGO_MAXIMO_TEXTO, TAMANO_TEXTO_MAXIMO, TAMANO_TEXTO_MINIMO, limitarTamanoTexto, problemaTexto } from '../utils/texto';

const ICONOS_ALINEACION = { izquierda: AlignLeft, centro: AlignCenter, derecha: AlignRight };

// Campos de un texto editable: contenido, fuente, tamaño, color, negrita, cursiva y alineación. Cada cambio se avisa
// al momento (para verlo en vivo); qué hacer con él lo deciden los botones que vienen en "children".
// Props: prefijo (para los id), texto, onCambiar(texto), children
function PanelTexto({ prefijo, texto, onCambiar, children }) {
    const cambiar = (campo, valor) => onCambiar({ ...texto, [campo]: valor });
    const problema = problemaTexto(texto);
    return (
        <div className="panel-texto">
            <div className="campo">
                <label htmlFor={`${prefijo}-contenido`}>Texto</label>
                <textarea
                    id={`${prefijo}-contenido`}
                    rows={3}
                    maxLength={LARGO_MAXIMO_TEXTO}
                    value={texto.contenido}
                    onChange={(e) => cambiar('contenido', e.target.value)}
                    aria-invalid={problema ? 'true' : undefined}
                />
                {problema && <p className="mensaje-campo">{problema}</p>}
            </div>
            <div className="fila-campos">
                <div className="campo">
                    <label htmlFor={`${prefijo}-fuente`}>Fuente</label>
                    <select id={`${prefijo}-fuente`} value={texto.fuente} onChange={(e) => cambiar('fuente', e.target.value)}>
                        {FUENTES.map((f) => <option key={f.id} value={f.id} style={{ fontFamily: f.familia }}>{f.nombre}</option>)}
                    </select>
                </div>
                <div className="campo">
                    <label htmlFor={`${prefijo}-tamano`}>Tamaño (px)</label>
                    <input
                        id={`${prefijo}-tamano`}
                        type="number"
                        min={TAMANO_TEXTO_MINIMO}
                        max={TAMANO_TEXTO_MAXIMO}
                        value={texto.tamano}
                        onChange={(e) => cambiar('tamano', limitarTamanoTexto(e.target.value))}
                    />
                </div>
                <div className="campo">
                    <label htmlFor={`${prefijo}-color`}>Color</label>
                    <input id={`${prefijo}-color`} type="color" value={texto.color} onChange={(e) => cambiar('color', e.target.value)} />
                </div>
            </div>
            <div className="estilo-texto" role="group" aria-label="Estilo">
                <BotonIcono icono={Bold} texto="Negrita" aria-pressed={texto.negrita} onClick={() => cambiar('negrita', !texto.negrita)} />
                <BotonIcono icono={Italic} texto="Cursiva" aria-pressed={texto.cursiva} onClick={() => cambiar('cursiva', !texto.cursiva)} />
                {Object.entries(ICONOS_ALINEACION).map(([alineacion, icono]) => (
                    <BotonIcono
                        key={alineacion}
                        icono={icono}
                        texto={`Alinear a la ${alineacion === 'centro' ? 'mitad' : alineacion}`}
                        aria-pressed={texto.alineacion === alineacion}
                        onClick={() => cambiar('alineacion', alineacion)}
                    />
                ))}
            </div>
            {children}
        </div>
    );
}

export default PanelTexto;
