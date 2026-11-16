-- SIVEP Tech · inicialización de MySQL
-- Ejecuta este archivo una sola vez como usuario administrador:
--   mysql -u root -p < database.sql
--
-- Crea la base operativa y el usuario que usa backend/.env por defecto.
-- Si cambias MYSQL_USER, MYSQL_PASSWORD o MYSQL_DATABASE, ajusta también estas líneas.

CREATE DATABASE IF NOT EXISTS sivep_tech
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'sivep'@'localhost' IDENTIFIED BY 'sivep';
CREATE USER IF NOT EXISTS 'sivep'@'127.0.0.1' IDENTIFIED BY 'sivep';

GRANT ALL PRIVILEGES ON sivep_tech.* TO 'sivep'@'localhost';
GRANT ALL PRIVILEGES ON sivep_tech.* TO 'sivep'@'127.0.0.1';

FLUSH PRIVILEGES;
