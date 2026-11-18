// Panel que flota sobre el lienzo del editor y se puede cerrar. Cuando está cerrado no dibuja nada:
// el editor muestra en su lugar un botón para volver a abrirlo.
//
// Props:
//   id          'proyecto', 'herramientas' o 'capas': decide dónde se coloca (ver estilos.css)
//   nombre      nombre del panel, para los textos de accesibilidad ("Cerrar Capas")
//   abierto     si se muestra
//   onCerrar()  el usuario pulsó la ✕
//   children    el contenido del panel
function PanelFlotante({ id, nombre, abierto, onCerrar, children }) {
    if (!abierto) return null;
    return (
        <div className={`panel-flotante flotante-${id}`} role="group" aria-label={nombre}>
            <button
                type="button"
                className="panel-cerrar"
                aria-label={`Cerrar ${nombre}`}
                title={`Cerrar ${nombre}`}
                onClick={onCerrar}
            >
                ✕
            </button>
            {children}
        </div>
    );
}

export default PanelFlotante;