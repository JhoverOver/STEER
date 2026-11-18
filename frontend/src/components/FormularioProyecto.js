import { useState } from 'react';
import CampoFormulario from './CampoFormulario';
import { COLORES } from '../utils/colores';
import { analizarEtiquetas } from '../utils/proyectos';
import { LARGO_MAXIMO_NOMBRE, MAX_ETIQUETAS, LARGO_MAXIMO_ETIQUETA, LADO_INICIAL } from '../config/limites';
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
                maxLength={LARGO_MAXIMO_NOMBRE}
                placeholder="Nombre de tu proyecto"
            />
            <CampoFormulario
                id={`${prefijo}-descripcion`}
                etiqueta="Descripción (opcional)"
                valor={descripcion}
                onChange={setDescripcion}
                multilinea
                placeholder="Descripción general de lo que trata tu proyecto"
            />
            <CampoFormulario
                id={`${prefijo}-etiquetas`}
                etiqueta={`Etiquetas (opcional): ${LARGO_MAXIMO_ETIQUETA} caracteres máximo cada una`}
                valor={etiquetas}
                onChange={(v) => { setEtiquetas(v); setErrorEtiquetas(''); }}
                error={errorEtiquetas}
                placeholder={`Máximo ${MAX_ETIQUETAS} etiquetas, separadas por coma. Ej.: 5fps, loop, urgente`}
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
            </fieldset>
             {permiteDesdeCero && (
            <div className="campo">
                <label htmlFor={`${prefijo}-desde-cero`}>
                    <input
                        id={`${prefijo}-desde-cero`}
                        type="checkbox"
                        checked={desdeCero}
                        onChange={(evento) => setDesdeCero(evento.target.checked)}
                    />
                    Empezar con un lienzo en blanco de {LADO_INICIAL} × {LADO_INICIAL} px
                </label>
            </div>
        )}

            <button type="submit" className="boton-principal" disabled={enviando}>
                {enviando ? textoEnviando : textoEnviar}
            </button>
            {onCancelar && <button type="button" onClick={onCancelar} disabled={enviando}>Cancelar</button>}
        </form>
    );
}

export default FormularioProyecto;
