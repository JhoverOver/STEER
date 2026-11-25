const { errorHttp } = require('../middleware/errores');

// Envío de correos con la API HTTP de Brevo (https://developers.brevo.com). Se usa HTTP y no SMTP porque el plan
// gratuito de Render bloquea los puertos SMTP (25, 465 y 587) desde septiembre de 2025.
//
// Variables del .env:
//   BREVO_API_KEY      clave de la API (Brevo > Settings > SMTP & API > API Keys & MCP)
//   CORREO_REMITENTE   correo verificado como remitente en Brevo (Senders, Domains & Dedicated IPs > Senders)
//   CORREO_NOMBRE      nombre que ve quien recibe (opcional, por defecto "Steer")
//
// Sin BREVO_API_KEY el correo no se envía: el código se escribe en la consola del servidor. Sirve para trabajar en
// local o para el servidor de respaldo de la demostración; en Render la clave debe estar configurada.

const URL_BREVO = 'https://api.brevo.com/v3/smtp/email';
const TIEMPO_ENVIO = 10000; // ms

async function enviarCorreo({ para, asunto, html, texto }) {
    const clave = process.env.BREVO_API_KEY;
    if (!clave) {
        console.log(`[correo sin enviar: falta BREVO_API_KEY] Para: ${para} | ${asunto}\n${texto}`);
        return;
    }
    let respuesta;
    try {
        respuesta = await fetch(URL_BREVO, {
            method: 'POST',
            headers: { 'api-key': clave, 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({
                sender: { email: process.env.CORREO_REMITENTE, name: process.env.CORREO_NOMBRE || 'Steer' },
                to: [{ email: para }],
                subject: asunto,
                htmlContent: html,
                textContent: texto,
            }),
            signal: AbortSignal.timeout(TIEMPO_ENVIO),
        });
    } catch (error) {
        console.error('No se pudo conectar con Brevo:', error.message);
        throw errorHttp(502, 'No se pudo enviar el correo de verificación. Intenta de nuevo en unos minutos.');
    }
    if (!respuesta.ok) {
        console.error(`Brevo respondió ${respuesta.status}:`, await respuesta.text().catch(() => ''));
        throw errorHttp(502, 'No se pudo enviar el correo de verificación. Intenta de nuevo en unos minutos.');
    }
}

// Correo con el código de 6 dígitos para verificar la cuenta
async function enviarCodigoVerificacion(email, codigo, minutos) {
    const texto = `Tu código para activar tu cuenta de Steer es ${codigo}. Vence en ${minutos} minutos.\n`
        + 'Si no creaste una cuenta, ignora este correo.';
    const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#222">
        <p>Tu código para activar tu cuenta de <strong>Steer</strong> es:</p>
        <p style="font-size:30px;font-weight:bold;letter-spacing:6px;margin:16px 0">${codigo}</p>
        <p>Vence en ${minutos} minutos.</p>
        <p style="color:#777;font-size:13px">Si no creaste una cuenta, ignora este correo.</p>
    </div>`;
    await enviarCorreo({ para: email, asunto: `${codigo} es tu código de Steer`, html, texto });
}

module.exports = { enviarCodigoVerificacion };