const pool = require('../config/db');

// Las cuentas nuevas empiezan sin verificar: se activan con el código que llega al correo
async function crearUsuario(email, contrasenaHash) {
    const [result] = await pool.execute(
        'INSERT INTO usuarios (email, contrasena, verificado) VALUES (?, ?, FALSE)',
        [email, contrasenaHash]
    );
    return { id: result.insertId, email };
}

// El usuario con ese correo, con dos datos calculados por la base (así no importa la zona horaria del servidor):
//   codigo_vigente         1 si el código de verificación todavía no vence
//   segundos_desde_envio   cuánto pasó desde el último código enviado (null si nunca se envió)
async function filtrarMail(email) {
    const [rows] = await pool.execute(
        `SELECT *,
            (codigo_expira IS NOT NULL AND codigo_expira > NOW()) AS codigo_vigente,
            TIMESTAMPDIFF(SECOND, codigo_enviado, NOW()) AS segundos_desde_envio
        FROM usuarios WHERE email = ?`,
        [email]
    );
    return rows[0] || null;
}

// Cuenta sin verificar que se vuelve a registrar: se queda con la contraseña nueva
async function actualizarContrasena(id, contrasenaHash) {
    await pool.execute('UPDATE usuarios SET contrasena = ? WHERE id = ?', [contrasenaHash, id]);
}

// Guarda el hash de un código nuevo, vence en "minutos" y reinicia los intentos
async function guardarCodigo(id, codigoHash, minutos) {
    await pool.execute(
        `UPDATE usuarios SET codigo_hash = ?, codigo_expira = NOW() + INTERVAL ? MINUTE,
            codigo_enviado = NOW(), codigo_intentos = 0
        WHERE id = ?`,
        [codigoHash, minutos, id]
    );
}

async function sumarIntentoFallido(id) {
    await pool.execute('UPDATE usuarios SET codigo_intentos = codigo_intentos + 1 WHERE id = ?', [id]);
}

async function marcarVerificado(id) {
    await pool.execute(
        `UPDATE usuarios SET verificado = TRUE, codigo_hash = NULL, codigo_expira = NULL, codigo_intentos = 0
        WHERE id = ?`,
        [id]
    );
}

module.exports = {
    crearUsuario,
    filtrarMail,
    actualizarContrasena,
    guardarCodigo,
    sumarIntentoFallido,
    marcarVerificado,
};