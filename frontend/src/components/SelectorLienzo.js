import { LADO_MAXIMO, LADO_MINIMO } from '../config/limites';

// Tamaños de lienzo frecuentes, para no tener que escribirlos
const TAMANOS_FRECUENTES = [
    { nombre: 'Cuadrado', ancho: 480, alto: 480 },
    { nombre: 'Horizontal 16:9', ancho: 640, alto: 360 },
    { nombre: 'Vertical 9:16', ancho: 360, alto: 640 },
    { nombre: 'Grande', ancho: 720, alto: 720 },
];

// '' si el lado es válido; si no, el motivo
export function problemaLado(valor) {
    const numero = Number(valor);
    if (String(valor).trim() === '' || !Number.isInteger(numero) || numero < LADO_MINIMO || numero > LADO_MAXIMO) {
        return `Entre ${LADO_MINIMO} y ${LADO_MAXIMO} px.`;
    }
    return '';
}

// Ancho y alto del lienzo, con botones para los tamaños frecuentes.
// Props: prefijo (para los id), ancho, alto (textos), onCambiar({ ancho, alto }), errores { ancho, alto }, frecuentes
function SelectorLienzo({ prefijo, ancho, alto, onCambiar, errores = {}, frecuentes = true }) {
    return (
        <div className="selector-lienzo">
            {frecuentes && (
                <div className="tamanos-frecuentes" role="group" aria-label="Tamaños frecuentes">
                    {TAMANOS_FRECUENTES.map((t) => {
                        const elegido = String(t.ancho) === String(ancho) && String(t.alto) === String(alto);
                        return (
                            <button
                                key={t.nombre}
                                type="button"
                                aria-pressed={elegido}
                                onClick={() => onCambiar({ ancho: String(t.ancho), alto: String(t.alto) })}
                            >
                                <span className="forma-tamano" style={{ aspectRatio: `${t.ancho} / ${t.alto}` }} aria-hidden="true" />
                                {t.nombre}
                                <small>{t.ancho} × {t.alto}</small>
                            </button>
                        );
                    })}
                </div>
            )}
            <div className="medidas-lienzo">
                <div className="campo">
                    <label htmlFor={`${prefijo}-ancho`}>Ancho (px)</label>
                    <input
                        id={`${prefijo}-ancho`}
                        type="number"
                        min={LADO_MINIMO}
                        max={LADO_MAXIMO}
                        value={ancho}
                        onChange={(e) => onCambiar({ ancho: e.target.value, alto })}
                        aria-invalid={errores.ancho ? 'true' : undefined}
                        aria-describedby={errores.ancho ? `${prefijo}-ancho-error` : undefined}
                    />
                    {errores.ancho && <p id={`${prefijo}-ancho-error`} className="mensaje-campo">{errores.ancho}</p>}
                </div>
                <span aria-hidden="true">×</span>
                <div className="campo">
                    <label htmlFor={`${prefijo}-alto`}>Alto (px)</label>
                    <input
                        id={`${prefijo}-alto`}
                        type="number"
                        min={LADO_MINIMO}
                        max={LADO_MAXIMO}
                        value={alto}
                        onChange={(e) => onCambiar({ ancho, alto: e.target.value })}
                        aria-invalid={errores.alto ? 'true' : undefined}
                        aria-describedby={errores.alto ? `${prefijo}-alto-error` : undefined}
                    />
                    {errores.alto && <p id={`${prefijo}-alto-error`} className="mensaje-campo">{errores.alto}</p>}
                </div>
            </div>
        </div>
    );
}

export default SelectorLienzo;
