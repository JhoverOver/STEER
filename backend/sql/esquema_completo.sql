-- Estructura completa de la base al Incremento 3, para crear una base nueva desde cero
-- (por ejemplo, el servidor local de respaldo para la demostración, riesgo R39).
-- Una base que ya existe NO se crea con este archivo: se pone al día con  node scripts/actualizar-esquema.js
--
-- Uso:  mysql -u root -p < sql/esquema_completo.sql

CREATE DATABASE IF NOT EXISTS microanimaciones DEFAULT CHARACTER SET utf8mb4;
USE microanimaciones;

CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(254) NOT NULL UNIQUE,
    contrasena VARCHAR(255) NOT NULL, -- hash bcrypt, nunca la contraseña
    fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS proyectos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT NULL,
    etiquetas TEXT NULL, -- lista JSON de hasta 5 textos
    color VARCHAR(20) NULL, -- nombre de config/paleta.js
    miniatura MEDIUMBLOB NULL, -- WebP del primer frame
    ancho SMALLINT NULL, -- tamaño del lienzo (px)
    alto SMALLINT NULL,
    fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_edicion DATETIME NULL,
    INDEX ix_proyectos_usuario (usuario_id),
    CONSTRAINT fk_proyectos_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS frames (
    id INT AUTO_INCREMENT PRIMARY KEY,
    proyecto_id INT NOT NULL,
    orden INT NOT NULL,
    imagen_data MEDIUMBLOB NOT NULL, -- PNG compuesto con las capas visibles
    duracion INT NOT NULL, -- ms, de 10 a 10000
    INDEX ix_frames_proyecto_orden (proyecto_id, orden),
    CONSTRAINT fk_frames_proyecto FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4;

-- Incremento 3: una pista anima la imagen de una capa con keyframes
CREATE TABLE IF NOT EXISTS pistas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    proyecto_id INT NOT NULL,
    nombre VARCHAR(50) NOT NULL,
    keyframes JSON NOT NULL, -- [{ tiempo, x, y, escala, rotacion, opacidad, curva }]
    imagen_data MEDIUMBLOB NOT NULL,
    INDEX ix_pistas_proyecto (proyecto_id),
    CONSTRAINT fk_pistas_proyecto FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4;

-- Incremento 2: hasta 10 capas por frame (pista_id es del Incremento 3)
CREATE TABLE IF NOT EXISTS capas (
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
) DEFAULT CHARSET=utf8mb4;

-- Incremento 2: atajos de teclado personalizados
CREATE TABLE IF NOT EXISTS preferencias (
    usuario_id INT PRIMARY KEY,
    atajos JSON NOT NULL,
    CONSTRAINT fk_preferencias_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4;