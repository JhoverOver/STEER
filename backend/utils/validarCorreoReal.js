const dns = require('dns').promises;
const { isDisposableEmailDomain } = require('disposable-email-domains-js');

// Revisa que el correo pueda ser real, además de tener la forma correcta (validarCredenciales.validarEmail):
//  1. El dominio no es de correos temporales (mailinator, yopmail, 10minutemail...). La lista viene del paquete
//     disposable-email-domains-js, que se actualiza a partir de github.com/disposable-email-domains.
//  2. El dominio recibe correos: tiene al menos un registro MX en DNS.
// Que la persona sea dueña del correo lo prueba después el código de verificación.
//
// VERIFICAR_MX=false en el .env desactiva el punto 2 (servidor local sin internet para la demostración).

const MENSAJE_TEMPORAL = 'No se aceptan correos temporales o desechables. Usa tu correo personal o institucional.';
const TIEMPO_DNS = 4000; // ms

// Las preguntas al DNS no deben dejar colgado el registro: si no responde a tiempo, se considera sin respuesta
function conTiempoLimite(promesa, ms) {
    let temporizador;
    const limite = new Promise((resolver, rechazar) => {
        temporizador = setTimeout(() => rechazar(Object.assign(new Error('Tiempo agotado'), { code: 'ETIMEOUT' })), ms);
    });
    return Promise.race([promesa, limite]).finally(() => clearTimeout(temporizador));
}

// Devuelve '' si el dominio del correo puede recibir correos reales, o un mensaje de error.
// "buscarMx" se puede reemplazar en las pruebas (por defecto, el DNS del sistema).
async function validarCorreoReal(email, { buscarMx = dns.resolveMx, verificarMx = process.env.VERIFICAR_MX !== 'false' } = {}) {
    const dominio = String(email).trim().split('@')[1]?.toLowerCase() || '';
    if (!dominio) return 'Ingresa un correo válido (nombre@dominio.com).';
    if (isDisposableEmailDomain(dominio)) return MENSAJE_TEMPORAL;
    if (!verificarMx) return '';

    try {
        const registros = await conTiempoLimite(buscarMx(dominio), TIEMPO_DNS);
        // Un MX "nulo" (RFC 7505: un solo registro con exchange vacío o ".") declara que el dominio no recibe correo
        const utiles = registros.filter((r) => r.exchange && r.exchange !== '.');
        if (utiles.length === 0) return `El dominio "${dominio}" no recibe correos. Revisa que el correo esté bien escrito.`;
        return '';
    } catch (error) {
        // ENOTFOUND: el dominio no existe. ENODATA: existe, pero no tiene servidor de correo
        if (error.code === 'ENOTFOUND' || error.code === 'ENODATA') {
            return `El dominio "${dominio}" no recibe correos. Revisa que el correo esté bien escrito.`;
        }
        // Falla del DNS (tiempo agotado, servidor caído): no se culpa al usuario. El código de verificación
        // igual impide crear la cuenta si el correo no existe
        console.warn(`No se pudo consultar el MX de ${dominio} (${error.code || error.message}); se acepta el dominio.`);
        return '';
    }
}

module.exports = { validarCorreoReal, MENSAJE_TEMPORAL };