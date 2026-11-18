// Borra TODOS los datos de la base de datos (usuarios, proyectos, frames, capas y preferencias) y deja las
// tablas vacías, con los id partiendo de nuevo en 1. La estructura de las tablas no se toca.
// Usa la base del archivo .env, así que sirve para la base local y para la de Aiven.
//
// Uso:  node scripts/vaciar-base.js
// Pide escribir el nombre de la base para confirmar. NO SE PUEDE DESHACER.
require('dotenv').config();
const readline = require('readline/promises');
const pool = require('../config/db');

// De hijas a madres: así el orden no importa aunque las claves foráneas estuvieran activas
const TABLAS = ['capas', 'frames', 'preferencias', 'proyectos', 'usuarios'];

async function main() {
    const base = process.env.DB_NAME;
    const conexion = await pool.getConnection();
    try {
        console.log(`Base: ${base} en ${process.env.DB_HOST}:${process.env.DB_PORT || 3306}`);
        for (const tabla of TABLAS) {
            const [[{ total }]] = await conexion.query(`SELECT COUNT(*) AS total FROM ${tabla}`);
            console.log(`  ${tabla}: ${total} filas`);
        }

        const consola = readline.createInterface({ input: process.stdin, output: process.stdout });
        const respuesta = await consola.question(`\nEsto borra TODO y no se puede deshacer. Escribe "${base}" para confirmar: `);
        consola.close();
        if (respuesta.trim() !== base) {
            console.log('Cancelado: no se borró nada.');
            return;
        }

        await conexion.query('SET FOREIGN_KEY_CHECKS = 0');
        for (const tabla of TABLAS) {
            await conexion.query(`TRUNCATE TABLE ${tabla}`);
        }
        await conexion.query('SET FOREIGN_KEY_CHECKS = 1');
        console.log('Listo: todas las tablas quedaron vacías.');
    } finally {
        conexion.release();
        await pool.end();
    }
}

main().catch((error) => {
    console.error('No se pudo vaciar la base:', error.message);
    process.exit(1);
});