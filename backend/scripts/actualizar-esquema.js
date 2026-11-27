// Crea en la base del .env (local o Aiven) las tablas de Steer que falten, a partir de sql/esquema_completo.sql,
// agrega a las tablas que ya existen las columnas nuevas (COLUMNAS_NUEVAS) y, solo si se pide, quita las columnas y
// tablas que Steer ya no usa (COLUMNAS_QUITADAS, TABLAS_QUITADAS). Lo que ya está bien no se toca, así que se puede
// correr cuantas veces se quiera.
//
// Uso:  node scripts/actualizar-esquema.js            agrega lo que falta (seguro con cualquier versión del backend)
//       node scripts/actualizar-esquema.js --quitar   además quita las columnas viejas (solo con el backend nuevo
//                                                     ya publicado: el anterior todavía las pide)
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

const ESQUEMA = path.join(__dirname, '..', 'sql', 'esquema_completo.sql');

// Columnas que se agregaron después de crear las tablas (deben estar también en esquema_completo.sql)
const COLUMNAS_NUEVAS = [
    { tabla: 'capas', columna: 'forma', definicion: 'JSON NULL' }, // texto o rectángulo editable
    { tabla: 'capas', columna: 'animacion', definicion: 'JSON NULL' }, // keyframes de su fila en Video
];

// Columnas que Steer dejó de usar. Al quitarlas se borra lo que tenían
const COLUMNAS_QUITADAS = [
    { tabla: 'capas', columna: 'texto' }, // pasó a "forma" (los textos se copian antes de quitarla)
    { tabla: 'capas', columna: 'pista_id' }, // las pistas de keyframes pasaron a ser animaciones de cada capa
    { tabla: 'proyectos', columna: 'descripcion' }, // los proyectos ya no tienen descripción: bastan las etiquetas
    { tabla: 'proyectos', columna: 'etiqueta' }, // etiqueta única del incremento 1 (pasó a "etiquetas")
];

// Tablas que Steer dejó de usar (se quitan con --quitar, después de las columnas que las nombran)
const TABLAS_QUITADAS = ['pistas'];

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

    const [columnas] = await pool.query(
        'SELECT TABLE_NAME AS tabla, COLUMN_NAME AS columna FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()'
    );
    const hay = new Set(columnas.map((c) => `${c.tabla}.${c.columna}`.toLowerCase()));
    for (const { tabla, columna, definicion } of COLUMNAS_NUEVAS) {
        if (hay.has(`${tabla}.${columna}`.toLowerCase())) continue;
        await pool.query(`ALTER TABLE ${tabla} ADD COLUMN ${columna} ${definicion}`);
        console.log(`  + columna ${tabla}.${columna}`);
    }
    // Los textos de la columna vieja "texto" pasan a "forma" (con tipo 'texto'). Se repite en cada corrida por si el
    // backend anterior guardó algún texto entre medio; las capas que ya tienen forma no se tocan
    if (hay.has('capas.texto')) {
        const [copia] = await pool.query(
            `UPDATE capas SET forma = JSON_SET(texto, '$.tipo', 'texto') WHERE forma IS NULL AND texto IS NOT NULL`
        );
        if (copia.affectedRows) console.log(`  ~ ${copia.affectedRows} textos copiados de capas.texto a capas.forma`);
    }

    const quitar = process.argv.includes('--quitar');
    const viejas = COLUMNAS_QUITADAS.filter(({ tabla, columna }) => hay.has(`${tabla}.${columna}`.toLowerCase()));
    const tablasViejas = TABLAS_QUITADAS.filter((tabla) => existentes.has(tabla));
    if (quitar) {
        // Las capas que generaron las pistas quedan como capas normales: se desbloquean para poder editarlas
        if (hay.has('capas.pista_id')) {
            const [libres] = await pool.query('UPDATE capas SET bloqueada = FALSE WHERE pista_id IS NOT NULL');
            if (libres.affectedRows) console.log(`  ~ ${libres.affectedRows} capas de pistas quedan como capas normales`);
        }
        // Las llaves foráneas que usan una columna que se va se quitan antes que ella
        const [llaves] = await pool.query(
            `SELECT TABLE_NAME AS tabla, COLUMN_NAME AS columna, CONSTRAINT_NAME AS nombre FROM information_schema.KEY_COLUMN_USAGE
            WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL`
        );
        for (const { tabla, columna } of viejas) {
            for (const llave of llaves.filter((l) => l.tabla.toLowerCase() === tabla && l.columna.toLowerCase() === columna)) {
                await pool.query(`ALTER TABLE ${tabla} DROP FOREIGN KEY ${llave.nombre}`);
            }
            await pool.query(`ALTER TABLE ${tabla} DROP COLUMN ${columna}`);
            console.log(`  - columna ${tabla}.${columna}`);
        }
        for (const tabla of tablasViejas) {
            await pool.query(`DROP TABLE ${tabla}`);
            console.log(`  - tabla ${tabla}`);
        }
    } else {
        for (const { tabla, columna } of viejas) {
            console.log(`  (queda la columna vieja ${tabla}.${columna}: se quita con --quitar, con el backend nuevo ya publicado)`);
        }
        for (const tabla of tablasViejas) {
            console.log(`  (queda la tabla vieja ${tabla}: se quita con --quitar, con el backend nuevo ya publicado)`);
        }
    }
    console.log(quitar || viejas.length + tablasViejas.length === 0
        ? 'Listo: la base tiene justo las tablas y columnas de Steer.'
        : 'Listo: la base tiene todo lo que Steer necesita.');
}

main()
    .catch((error) => {
        console.error('No se pudo crear la estructura:', error.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());