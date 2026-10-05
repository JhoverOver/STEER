function CampoFormulario({
    id,
    etiqueta,
    valor,
    onChange,
    error,
    tipo = 'text',
    multilinea = false,
    autoComplete,
    maxLength,
}) {
    const idError = `${id}-error`;
    const propiedades = {
        id,
        value: valor,
        onChange: (evento) => onChange(evento.target.value),
        autoComplete,
        maxLength,
        'aria-invalid': error ? 'true' : undefined,
        'aria-describedby': error ? idError : undefined,
    };

    return (
        <div className="campo">
            <label htmlFor={id}>{etiqueta}</label>
            {error && <p id={idError} role="alert">{error}</p>}
            {multilinea ? <textarea {...propiedades} /> : <input type={tipo} {...propiedades} />}
        </div>
    );
}

export default CampoFormulario;