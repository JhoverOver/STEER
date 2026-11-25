-- Estructura completa de la base de Steer (Incremento 3 + verificación de correo).
-- La crea  node scripts/actualizar-esquema.js  en la base del .env (local o Aiven): ejecuta cada CREATE TABLE de este
-- archivo, y los IF NOT EXISTS hacen que las tablas que ya existen no se toquen.
-- Las tablas van en orden: cada una solo apunta a tablas que ya están creadas.

CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(254) NOT NULL UNIQUE,
    contrasena VARCHAR(255) NOT NULL, -- hash bcrypt, nunca la contraseña
    fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Verificación de correo: la cuenta se activa con el código de 6 dígitos que llega al correo
    verificado BOOLEAN NOT NULL DEFAULT FALSE,
    codigo_hash VARCHAR(255) NULL, -- hash bcrypt del código de 6 dígitos
    codigo_expira DATETIME NULL,
    codigo_enviado DATETIME NULL,
    codigo_intentos TINYINT NOT NULL DEFAULT 0
) DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS proyectos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    nombre VARCHAR(150) NOT NULL,
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

-- Incremento 2: hasta 10 capas por frame (pista_id y texto son del Incremento 3)
CREATE TABLE IF NOT EXISTS capas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    frame_id INT NOT NULL,
    orden TINYINT NOT NULL,
    nombre VARCHAR(50) NOT NULL,
    visible BOOLEAN NOT NULL DEFAULT TRUE,
    bloqueada BOOLEAN NOT NULL DEFAULT FALSE,
    imagen_data MEDIUMBLOB NULL,
    pista_id INT NULL,
    texto JSON NULL, -- capa de texto editable: { contenido, fuente, tamano, color, ... } (imagen_data es su dibujo)
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