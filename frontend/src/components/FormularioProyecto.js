import { useState } from 'react';
import CampoFormulario from './CampoFormulario';
import { COLORES } from '../utils/colores';
import { analizarEtiquetas, MAX_ETIQUETAS, LARGO_MAXIMO_ETIQUETA } from '../utils/proyectos';
import { validarObligatorio, enfocarPrimerError } from '../utils/validaciones';

// Formulario compartido para crear y editar un proyecto (nombre, descripción, etiquetas y color).
// onEnviar recibe { nombre, descripcion, etiquetas, color } ya validados.
function FormularioProyecto({ 
    prefijo, inicial, textoEnviar, textoEnviando, enviando, onEnviar, onCancelar, permiteDesdeCero= false }) {
    const [nombre, setNombre] = useState(inicial?.nombre || '');
    const [descripcion, setDescripcion] = useState(inicial?.descripcion || '');
    const [etiquetas, setEtiquetas] = useState((inicial?.etiquetas || []).join(', '));
    const [color, setColor] = useState(inicial?.color || '');
    const [desdeCero, setDesdeCero] = useState(false);
    const [errorNombre, setErrorNombre] = useState('');
    const [errorEtiquetas, setErrorEtiquetas] = useState('');

    function enviar(evento) {
        evento.preventDefault();
        const problemaNombre = validarObligatorio(nombre);
        const analisis = analizarEtiquetas(etiquetas);
        setErrorNombre(problemaNombre);
        setErrorEtiquetas(analisis.error);
        if (problemaNombre || analisis.error) {
            enfocarPrimerError(
                { nombre: problemaNombre, etiquetas: analisis.error },
                { nombre: `${prefijo}-nombre`, etiquetas: `${prefijo}-etiquetas` }
            );
            return;
        }
        onEnviar({
            nombre: nombre.trim(),
            descripcion: descripcion.trim(),
            etiquetas: analisis.etiquetas,
            color: color || null,
            ...(permiteDesdeCero && { desdeCero}),
        });
    }

    return (
        <form onSubmit={enviar} noValidate>
            <CampoFormulario
                id={`${prefijo}-nombre`}
                etiqueta="Nombre"
                valor={nombre}
                onChange={(v) => { setNombre(v); setErrorNombre(''); }}
                error={errorNombre}
                maxLength={150}
            />
            <CampoFormulario
                id={`${prefijo}-descripcion`}
                etiqueta="Descripción (opcional)"
                valor={descripcion}
                onChange={setDescripcion}
                multilinea
            />
            <CampoFormulario
                id={`${prefijo}-etiquetas`}
                etiqueta={`Etiquetas (opcional): separadas por coma, hasta ${MAX_ETIQUETAS} de ${LARGO_MAXIMO_ETIQUETA} caracteres`}
                valor={etiquetas}
                onChange={(v) => { setEtiquetas(v); setErrorEtiquetas(''); }}
                error={errorEtiquetas}
            />

            <fieldset className="selector-color">
                <legend>Color (opcional)</legend>
                <label className="opcion-color">
                    <input type="radio" name={`${prefijo}-color`} value="" checked={color === ''} onChange={() => setColor('')} />
                    <span className="muestra-color muestra-sin-color" aria-hidden="true" />
                    Sin color
                </label>
                {COLORES.map((opcion) => (
                    <label key={opcion.nombre} className="opcion-color">
                        <input
                            type="radio"
                            name={`${prefijo}-color`}
                            value={opcion.nombre}
                            checked={color === opcion.nombre}
                            onChange={() => setColor(opcion.nombre)}
                        />
                        <span className="muestra-color" style={{ background: opcion.hex }} aria-hidden="true" />
                        {opcion.etiqueta}
                    </label>
                ))}

                {permiteDesdeCero && (
                    <div className="campo">
                    <label htmlFor={`${prefijo}-desde-cero`}>
                        <input
                            id={`${prefijo}-desde-cero`}
                            type="checkbox"
                            checked={desdeCero}
                            onChange={(evento) => setDesdeCero(evento.target.checked)}
                        />
                        Empezar con un lienzo en blanco de 480 × 480 px
                    </label>
                </div>
            )}
            </fieldset>

            <button type="submit" className="boton-principal" disabled={enviando}>
                {enviando ? textoEnviando : textoEnviar}
            </button>
            {onCancelar && <button type="button" onClick={onCancelar} disabled={enviando}>Cancelar</button>}
        </form>
    );
}

export default FormularioProyecto;
