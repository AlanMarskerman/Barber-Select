-- schema.sql
-- Cria o banco de dados e a tabela de clientes do Barber-Select.
-- Execute isso uma única vez no phpMyAdmin (aba SQL) ou via linha de comando do MySQL.

CREATE DATABASE IF NOT EXISTS barber_select;

USE barber_select;

CREATE TABLE IF NOT EXISTS clients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  phone VARCHAR(20) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
