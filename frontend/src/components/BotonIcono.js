// Botón con un símbolo en vez de texto. El texto aparece como ayuda al pasar el mouse (o al llegar con Tab),
// junto con su atajo de teclado, y es también el nombre que leen los lectores de pantalla.
//
// Props:
//   icono      componente del símbolo (de lucide-react)
//   texto      lo que hace el botón: "Copiar", "Invertir orden de 3 frames"...
//   atajo      atajo de teclado que se muestra en la ayuda: "Ctrl+C" (opcional)
//   insignia   número o texto corto que se muestra en una esquina del símbolo, como la cantidad de frames (opcional)
//   lado       dónde aparece la ayuda: 'arriba' (por defecto), 'abajo', 'derecha' o 'izquierda'
//   peligro, principal   colores de eliminar y de la acción importante
//   activo     true si es la opción elegida (por ejemplo, la etapa abierta)
//   el resto (onClick, disabled, aria-busy...) va directo al <button>
function BotonIcono({
    icono: Icono, texto, atajo, insignia, lado = 'arriba', peligro = false, principal = false, activo, className = '', ...resto
}) {
    const ayuda = atajo ? `${texto} (${atajo})` : texto;
    const clases = [
        'boton-icono',
        `ayuda-${lado}`,
        peligro ? 'boton-peligro' : '',
        principal ? 'boton-principal' : '',
        className,
    ].filter(Boolean).join(' ');
    return (
        <button
            type="button"
            className={clases}
            aria-label={ayuda}
            aria-current={activo ? 'page' : undefined}
            data-ayuda={ayuda}
            {...resto}
        >
            <Icono aria-hidden="true" size={18} strokeWidth={2} />
            {insignia !== undefined && insignia !== null && insignia !== '' && (
                <span className="insignia" aria-hidden="true">{insignia}</span>
            )}
        </button>
    );
}

export default BotonIcono;