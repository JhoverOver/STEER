// Crea en la base del .env (local o Aiven) las tablas de Steer que falten, a partir de sql/esquema_completo.sql.
// Las que ya existen no se tocan, así que se puede correr cuantas veces se quiera.
//
// Uso:  node scripts/actualizar-esquema.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

const ESQUEMA = path.join(__dirname, '..', 'sql', 'esquema_completo.sql');

// Las sentencias del archivo, sin comentarios (-- hasta el final de la línea)
function leerSentencias() {
    const sinComentarios = fs.readFileSync(ESQUEMA, 'utf8')
        .split('\n')
        .map((linea) => linea.replace(/--.*$/, ''))
        .join('\n');
    return sinComentarios.split(';').map((s) => s.trim()).filter(Boolean);
}

async function main() {
    console.log(`Base: ${process.env.DB_NAME} en ${process.env.DB_HOST}:${process.env.DB_PORT || 3306}`);
    const [tablas] = await pool.query(
        'SELECT TABLE_NAME AS nombre FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()'
    );
    const existentes = new Set(tablas.map((t) => t.nombre.toLowerCase()));
    console.log(`Tablas actuales: ${[...existentes].join(', ') || '(ninguna)'}`);

    for (const sentencia of leerSentencias()) {
        const tabla = /CREATE TABLE IF NOT EXISTS\s+(\w+)/i.exec(sentencia)?.[1];
        if (!tabla) continue; // el archivo solo debe crear tablas
        if (existentes.has(tabla.toLowerCase())) continue;
        await pool.query(sentencia);
        console.log(`  + tabla ${tabla}`);
    }
    console.log('Listo: la base tiene todas las tablas de Steer.');
}

main()
    .catch((error) => {
        console.error('No se pudo crear la estructura:', error.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());