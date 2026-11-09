require('dotenv').config();
const sharp = require('sharp');
const pool = require('../config/db');
const crudProyecto = require('../models/crudProyecto');
const procesadorFrames = require('../services/procesadorFrames');
const { LADO_INICIAL } = require('../config/limites');

async function main() {
    const aplicar = process.argv.includes('--aplicar');
    const proyectos = await crudProyecto.proyectosSinLienzo();
    console.log(`${aplicar ? 'MODO APLICAR' : 'MODO PRUEBA (no cambia nada)'} - Proyectos sin tamaño: ${proyectos.length}`);
    let medidos = 0;
    let borrados = 0;
    for (const { id, usuario_id } of proyectos) {
        try {
            const primero = await crudProyecto.obtenerPrimerFrame(id);
            // Un proyecto sin fotogramas queda como un lienzo en blanco del tamaño inicial
            const { width, height } = primero ? await sharp(primero.imagen_data).metadata() : { width: LADO_INICIAL, height: LADO_INICIAL };
            if (procesadorFrames.lienzoValido(width, height)) {
                console.log(`Proyecto ${id}: ${width} x ${height} px`);
                if (aplicar) await crudProyecto.guardarTamanoLienzo(id, width, height);
                medidos++;
            } else {
                console.log(`Proyecto ${id}: ${width} x ${height} px supera el máximo, se borra`);
                if (aplicar) await crudProyecto.eliminarProyecto(id, usuario_id);
                borrados++;
            }
        } catch (error) {
            console.error(`Proyecto ${id}: ${error.message}`);
        }
    }
    console.log(`Con tamaño fijado: ${medidos} - Borrados por exceder el límite: ${borrados}`);
    await pool.end();
}

main().catch((error) => { console.error(error); process.exit(1); });