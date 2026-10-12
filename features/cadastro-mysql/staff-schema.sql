-- staff-schema.sql
-- Tabela da EQUIPE (colaboradores e donos). Os clientes ficam na tabela clients.
-- Opcional: o servidor cria esta tabela sozinho. Rode no phpMyAdmin (aba SQL)
-- só se quiser criá-la antes de ligar o projeto.

USE barber_select;

CREATE TABLE IF NOT EXISTS staff_users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  username VARCHAR(30) NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('staff', 'admin') NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
