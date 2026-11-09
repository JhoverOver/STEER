-- Tamaño del lienzo.
ALTER TABLE proyectos ADD COLUMN ancho SMALLINT NULL, ADD COLUMN alto SMALLINT NULL;

-- Tabla de capas
CREATE TABLE IF NOT EXISTS capas(
    id INT AUTO_INCREMENT PRIMARY KEY,
    frame_id INT NOT NULL,
    orden TINYINT NOT NULL,
    nombre VARCHAR(50) NOT NULL,
    visible BOOLEAN NOT NULL DEFAULT TRUE,
    bloqueada BOOLEAN NOT NULL DEFAULT TRUE,
    imagen_data MEDIUMBLOB NULL,
    INDEX ix_capas_frame_orden (frame_id, orden),
    -- clave foránea basada en la id del frame donde se encuentran las capas.
    CONSTRAINT fk_capas_frame FOREIGN KEY (frame_id) REFERENCES frames(id) ON DELETE CASCADE
);

-- Tabla de preferencias
CREATE TABLE IF NOT EXISTS preferencias (
    usuario_id INT PRIMARY KEY,
    atajos JSON NOT NULL,
    -- clave foránea basada en la id del usuario al que pertenecen las preferencias.
    CONSTRAINT fk_preferencias_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- Insertar capa de fondo para cada frame existente
INSERT INTO capas (frame_id, orden, nombre, visible, bloqueada, imagen_data)
SELECT f.id, 0, 'Fondo', TRUE, FALSE, f.imagen_data
FROM frames f
-- excepción si ya existe una capa de fondo
WHERE NOT EXISTS (SELECT 1 FROM capas c WHERE c.frame_id = f.id);
