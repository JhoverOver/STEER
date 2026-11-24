// Pruebas de la verificación de correo sin red: el DNS y la API de Brevo se reemplazan por funciones falsas.
// Ejecutar con:  npm test
const { test } = require('node:test');
const assert = require('node:assert');
const { validarCorreoReal } = require('../utils/validarCorreoReal');
const { enviarCodigoVerificacion } = require('../services/correo');

const conMx = async () => [{ exchange: 'mx.ejemplo.com', priority: 10 }];
const errorDns = (code) => async () => { throw Object.assign(new Error(code), { code }); };

test('acepta un dominio con servidor de correo', async () => {
    assert.strictEqual(await validarCorreoReal('ana@gmail.com', { buscarMx: conMx, verificarMx: true }), '');
});

test('rechaza correos temporales sin consultar el DNS', async () => {
    let consultado = false;
    const buscarMx = async () => { consultado = true; return []; };
    for (const correo of ['a@mailinator.com', 'a@yopmail.com', 'a@10minutemail.com', 'a@sub.guerrillamail.com']) {
        assert.match(await validarCorreoReal(correo, { buscarMx, verificarMx: true }), /temporales/);
    }
    assert.strictEqual(consultado, false);
});

test('rechaza dominios que no existen o no reciben correo', async () => {
    assert.match(await validarCorreoReal('a@nada.cl', { buscarMx: errorDns('ENOTFOUND'), verificarMx: true }), /no recibe correos/);
    assert.match(await validarCorreoReal('a@web.cl', { buscarMx: errorDns('ENODATA'), verificarMx: true }), /no recibe correos/);
    // MX nulo (RFC 7505): el dominio declara que no recibe correo
    const mxNulo = async () => [{ exchange: '', priority: 0 }];
    assert.match(await validarCorreoReal('a@nulo.cl', { buscarMx: mxNulo, verificarMx: true }), /no recibe correos/);
});

test('si el DNS falla, no se culpa al usuario (el código de verificación igual protege)', async () => {
    assert.strictEqual(await validarCorreoReal('a@gmail.com', { buscarMx: errorDns('ETIMEOUT'), verificarMx: true }), '');
    assert.strictEqual(await validarCorreoReal('a@gmail.com', { buscarMx: errorDns('ESERVFAIL'), verificarMx: true }), '');
});

test('VERIFICAR_MX=false no consulta el DNS, pero sigue rechazando temporales', async () => {
    assert.strictEqual(await validarCorreoReal('a@lo-que-sea.cl', { buscarMx: errorDns('ENOTFOUND'), verificarMx: false }), '');
    assert.match(await validarCorreoReal('a@mailinator.com', { verificarMx: false }), /temporales/);
});

test('el código se envía a Brevo con la clave y el remitente del .env', async () => {
    const fetchOriginal = global.fetch;
    const anterior = { ...process.env };
    let pedido = null;
    global.fetch = async (url, opciones) => {
        pedido = { url, opciones };
        return { ok: true, status: 201, text: async () => '' };
    };
    try {
        process.env.BREVO_API_KEY = 'clave-de-prueba';
        process.env.CORREO_REMITENTE = 'steer@gmail.com';
        await enviarCodigoVerificacion('ana@gmail.com', '042817', 15);
        assert.strictEqual(pedido.url, 'https://api.brevo.com/v3/smtp/email');
        assert.strictEqual(pedido.opciones.headers['api-key'], 'clave-de-prueba');
        const cuerpo = JSON.parse(pedido.opciones.body);
        assert.deepStrictEqual(cuerpo.to, [{ email: 'ana@gmail.com' }]);
        assert.strictEqual(cuerpo.sender.email, 'steer@gmail.com');
        assert.match(cuerpo.subject, /042817/);
        assert.match(cuerpo.htmlContent, /042817/);
    } finally {
        global.fetch = fetchOriginal;
        process.env = anterior;
    }
});

test('si Brevo falla, responde 502 con un mensaje para el usuario', async () => {
    const fetchOriginal = global.fetch;
    const anterior = { ...process.env };
    const errorOriginal = console.error;
    global.fetch = async () => ({ ok: false, status: 401, text: async () => 'Key not found' });
    console.error = () => {};
    try {
        process.env.BREVO_API_KEY = 'clave-mala';
        await assert.rejects(enviarCodigoVerificacion('ana@gmail.com', '123456', 15), (e) => e.estado === 502);
    } finally {
        global.fetch = fetchOriginal;
        process.env = anterior;
        console.error = errorOriginal;
    }
});