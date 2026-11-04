-- Ejecutar UNA sola vez sobre la base de datos del proyecto (por ejemplo: USE STEER;).
-- RF12: etiquetas (hasta 5, guardadas como texto JSON). El color usa la columna `color` que ya existe.
ALTER TABLE proyectos ADD COLUMN etiquetas TEXT NULL;
UPDATE proyectos SET etiquetas = JSON_ARRAY(etiqueta) WHERE id > 0 AND etiqueta IS NOT NULL AND etiqueta <> '';
-- RF14: miniatura del proyecto (primer fotograma reducido).
ALTER TABLE proyectos ADD COLUMN miniatura MEDIUMBLOB NULL;
ALTER TABLE proyectos MODIFY nombre VARCHAR(150) NOT NULL;
