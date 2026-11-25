import CampoFormulario from './CampoFormulario';
import useFormulario from '../hooks/useFormulario';
import { COLORES } from '../utils/colores';
import { analizarEtiquetas } from '../utils/proyectos';
import { LARGO_MAXIMO_NOMBRE } from '../config/limites';
import { validarObligatorio } from '../utils/validaciones';

// Formulario compartido para crear y editar un proyecto: nombre, etiquetas y color.
// onEnviar recibe { nombre, etiquetas, color } ya validados.
function FormularioProyecto({ prefijo, inicial, textoEnviar, textoEnviando, enviando, onEnviar, onCancelar }) {
    const formulario = useFormulario({
        nombre: inicial?.nombre || '',
        etiquetas: (inicial?.etiquetas || []).join(', '),
        color: inicial?.color || '',
    }, prefijo);
    const { valores, campo } = formulario;
    const color = valores.color;
    const setColor = (nuevo) => formulario.cambiar('color', nuevo);

    function enviar(evento) {
        evento.preventDefault();
        const analisis = analizarEtiquetas(valores.etiquetas);
        if (!formulario.revisar({ nombre: validarObligatorio(valores.nombre), etiquetas: analisis.error })) return;
        onEnviar({ nombre: valores.nombre.trim(), etiquetas: analisis.etiquetas, color: color || null });
    }

    return (
        <form className="formulario-proyecto" onSubmit={enviar} noValidate>
            <CampoFormulario {...campo('nombre')} etiqueta="Nombre" maxLength={LARGO_MAXIMO_NOMBRE} />
            <CampoFormulario {...campo('etiquetas')} etiqueta="Etiquetas" placeholder="loop, 5fps, urgente" />

            <fieldset className="selector-color">
                <legend>Color</legend>
                <label className="opcion-color" title="Sin color">
                    <input type="radio" name={`${prefijo}-color`} value="" checked={color === ''} onChange={() => setColor('')} />
                    <span className="muestra-color muestra-sin-color" aria-hidden="true" />
                    <span className="solo-lector">Sin color</span>
                </label>
                {COLORES.map((opcion) => (
                    <label key={opcion.nombre} className="opcion-color" title={opcion.etiqueta}>
                        <input
                            type="radio"
                            name={`${prefijo}-color`}
                            value={opcion.nombre}
                            checked={color === opcion.nombre}
                            onChange={() => setColor(opcion.nombre)}
                        />
                        <span className="muestra-color" style={{ background: opcion.hex }} aria-hidden="true" />
                        <span className="solo-lector">{opcion.etiqueta}</span>
                    </label>
                ))}
            </fieldset>

            <div className="acciones-formulario">
                <button type="submit" className="boton-principal" disabled={enviando} aria-busy={enviando}>
                    {enviando ? textoEnviando : textoEnviar}
                </button>
                {onCancelar && <button type="button" onClick={onCancelar} disabled={enviando}>Cancelar</button>}
            </div>
        </form>
    );
}

export default FormularioProyecto;
