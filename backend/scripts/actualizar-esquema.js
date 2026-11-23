// Deja la estructura de la base al día con el Incremento 3 (sql/migracion_incremento1.sql, _incremento2.sql y _incremento3.sql).
// Solo agrega lo que falta, así que se puede correr cuantas veces se quiera: lo que ya existe no se toca.
// Usa la base del archivo .env (local o Aiven).
//
// Uso:  node scripts/actualizar-esquema.js
require('dotenv').config();
const pool = require('../config/db');

// Columnas de "proyectos" que agregaron los incrementos 1 y 2
const COLUMNAS = [
    ['etiquetas', 'TEXT NULL'],
    ['miniatura', 'MEDIUMBLOB NULL'],
    ['ancho', 'SMALLINT NULL'],
    ['alto', 'SMALLINT NULL'],
];

// En este orden: "capas" apunta a "pistas"
const TABLAS = {
    pistas: `CREATE TABLE pistas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        proyecto_id INT NOT NULL,
        nombre VARCHAR(50) NOT NULL,
        keyframes JSON NOT NULL,
        imagen_data MEDIUMBLOB NOT NULL,
        INDEX ix_pistas_proyecto (proyecto_id),
        CONSTRAINT fk_pistas_proyecto FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE CASCADE
    ) DEFAULT CHARSET=utf8mb4`,
    capas: `CREATE TABLE capas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        frame_id INT NOT NULL,
        orden TINYINT NOT NULL,
        nombre VARCHAR(50) NOT NULL,
        visible BOOLEAN NOT NULL DEFAULT TRUE,
        bloqueada BOOLEAN NOT NULL DEFAULT FALSE,
        imagen_data MEDIUMBLOB NULL,
        pista_id INT NULL,
        INDEX ix_capas_frame_orden (frame_id, orden),
        CONSTRAINT fk_capas_frame FOREIGN KEY (frame_id) REFERENCES frames(id) ON DELETE CASCADE,
        CONSTRAINT fk_capas_pista FOREIGN KEY (pista_id) REFERENCES pistas(id) ON DELETE SET NULL
    ) DEFAULT CHARSET=utf8mb4`,
    preferencias: `CREATE TABLE preferencias (
        usuario_id INT PRIMARY KEY,
        atajos JSON NOT NULL,
        CONSTRAINT fk_preferencias_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    ) DEFAULT CHARSET=utf8mb4`,
};

async function main() {
    console.log(`Base: ${process.env.DB_NAME} en ${process.env.DB_HOST}:${process.env.DB_PORT || 3306}`);
    const [tablas] = await pool.query(
        'SELECT TABLE_NAME AS nombre FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()'
    );
    const existentes = new Set(tablas.map((t) => t.nombre.toLowerCase()));
    console.log(`Tablas actuales: ${[...existentes].join(', ') || '(ninguna)'}`);
    for (const necesaria of ['usuarios', 'proyectos', 'frames']) {
        if (!existentes.has(necesaria)) throw new Error(`Falta la tabla "${necesaria}" del Incremento 1: esta no es la base de Steer.`);
    }

    const [columnas] = await pool.query(
        "SELECT COLUMN_NAME AS nombre FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'proyectos'"
    );
    const columnasExistentes = new Set(columnas.map((c) => c.nombre.toLowerCase()));
    for (const [nombre, tipo] of COLUMNAS) {
        if (columnasExistentes.has(nombre)) continue;
        await pool.query(`ALTER TABLE proyectos ADD COLUMN ${nombre} ${tipo}`);
        console.log(`  + columna proyectos.${nombre}`);
    }
    await pool.query('ALTER TABLE proyectos MODIFY nombre VARCHAR(150) NOT NULL');

    for (const [nombre, crear] of Object.entries(TABLAS)) {
        if (existentes.has(nombre)) continue;
        await pool.query(crear);
        console.log(`  + tabla ${nombre}`);
    }

    // Incremento 3: las capas que ya existían reciben la columna que las une a su pista
    const [columnasCapas] = await pool.query(
        "SELECT COLUMN_NAME AS nombre FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'capas'"
    );
    if (!columnasCapas.some((c) => c.nombre.toLowerCase() === 'pista_id')) {
        await pool.query(`ALTER TABLE capas ADD COLUMN pista_id INT NULL,
            ADD CONSTRAINT fk_capas_pista FOREIGN KEY (pista_id) REFERENCES pistas(id) ON DELETE SET NULL`);
        console.log('  + columna capas.pista_id');
    }

    // Frames guardados antes del Incremento 2: reciben su capa "Fondo" (los que ya tienen capas no se tocan)
    const [resultado] = await pool.query(
        `INSERT INTO capas (frame_id, orden, nombre, visible, bloqueada, imagen_data)
        SELECT f.id, 0, 'Fondo', TRUE, FALSE, f.imagen_data FROM frames f
        WHERE NOT EXISTS (SELECT 1 FROM capas c WHERE c.frame_id = f.id)`
    );
    if (resultado.affectedRows) console.log(`  + capa Fondo en ${resultado.affectedRows} frames antiguos`);
    console.log('Listo: la estructura está al día con el Incremento 3.');
}

main()
    .catch((error) => {
        console.error('No se pudo actualizar la estructura:', error.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());