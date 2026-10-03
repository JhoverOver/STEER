const pool = require('../config/db');

async function crearProyecto(usuario_id, nombre, descripcion) {
    const [result] = await pool.execute(
        'INSERT INTO proyectos (usuario_id, nombre, descripcion) VALUES (?, ?, ?)',
        [usuario_id, nombre, descripcion || null]
    );
    return { id: result.insertId, usuario_id, nombre, descripcion };
}

async function obtenerProyectos(usuario_id) {
    const [rows] = await pool.execute(
        'SELECT * FROM proyectos WHERE usuario_id = ? ORDER BY fecha_edicion DESC, fecha_creacion DESC',
        [usuario_id]
    );
    return rows;
}

async function obtenerProyecto(id, usuario_id) {
    const [rows] = await pool.execute(
        'SELECT * FROM proyectos WHERE id = ? AND usuario_id = ?',
        [id, usuario_id]
    );
    return rows[0] || null;
}

async function actualizarProyecto(id, usuario_id, datos) {
    const { nombre, descripcion, etiqueta, color } = datos;
    const [result] = await pool.execute(
        `UPDATE proyectos
        SET nombre = ?, descripcion = ?, etiqueta = ?, color = ?, fecha_edicion = NOW()
        WHERE id = ? AND usuario_id = ?`,
        [nombre, descripcion, etiqueta, color, id, usuario_id]
    );
    return result.affectedRows > 0;
}

async function eliminarProyecto(id, usuario_id) {
    const [result] = await pool.execute(
        'DELETE FROM proyectos WHERE id = ? AND usuario_id = ?',
        [id, usuario_id]
    );
    return result.affectedRows > 0;
}

async function guardarFrames(proyecto_id, frames) {
    const conexion = await pool.getConnection();
    try {
        await conexion.beginTransaction();
        await conexion.execute('DELETE FROM frames WHERE proyecto_id = ?', [proyecto_id]);
        for (const frame of frames) {
            await conexion.execute(
                'INSERT INTO frames (proyecto_id, orden, imagen_data, duracion) VALUES (?, ?, ?, ?)',
                [proyecto_id, frame.orden, frame.imagen_data, frame.duracion]
            );
        }
        await conexion.execute(
            'UPDATE proyectos SET fecha_edicion = NOW() WHERE id = ?',
            [proyecto_id]
        );
        await conexion.commit();
        return true;
    }   catch (error) {
        await conexion.rollback();
        throw error;
    } finally {
        conexion.release(); // Conexión vuelve al pool
    }
}

async function obtenerFrames(proyecto_id) {
    const [rows] = await pool.execute(
        'SELECT id, proyecto_id, orden, imagen_data, duracion FROM frames WHERE proyecto_id = ? ORDER BY orden ASC',
        [proyecto_id]
    );
    return rows;
};

module.exports = {
    crearProyecto,
    obtenerProyectos,
    obtenerProyecto,
    actualizarProyecto,
    eliminarProyecto,
    guardarFrames,
    obtenerFrames,
};