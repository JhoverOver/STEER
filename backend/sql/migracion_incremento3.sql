-- Incremento 3: pistas de keyframes.
-- Una pista anima una capa: guarda su imagen y sus keyframes (posición, escala, rotación y opacidad en el tiempo).
-- Las capas que genera en cada frame son capas normales que indican su pista en "pista_id".

CREATE TABLE IF NOT EXISTS pistas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    proyecto_id INT NOT NULL,
    nombre VARCHAR(50) NOT NULL,
    -- [{ tiempo, x, y, escala, rotacion, opacidad, curva }], ordenados por tiempo
    keyframes JSON NOT NULL,
    imagen_data MEDIUMBLOB NOT NULL,
    INDEX ix_pistas_proyecto (proyecto_id),
    CONSTRAINT fk_pistas_proyecto FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE CASCADE
);

-- Si se borra la pista, sus capas quedan como capas normales
ALTER TABLE capas
    ADD COLUMN pista_id INT NULL,
    ADD CONSTRAINT fk_capas_pista FOREIGN KEY (pista_id) REFERENCES pistas(id) ON DELETE SET NULL;