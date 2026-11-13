-- Catálogo de serviços Barber Select.
-- O servidor também cria a tabela sob demanda ao receber a primeira requisição.
-- Em agendamentos, copie preço e duração para snapshots: não use o valor atual do catálogo para históricos.

CREATE TABLE IF NOT EXISTS services (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(500) NULL,
  category ENUM('corte', 'barba', 'combo', 'tratamento', 'acabamento') NOT NULL,
  price DECIMAL(8,2) NOT NULL,
  duration_minutes SMALLINT UNSIGNED NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_services_name (name),
  INDEX idx_services_active_category (active, category),
  INDEX idx_services_name (name)
);
