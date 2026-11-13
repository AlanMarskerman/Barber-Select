-- Tabela de agendamentos para o Barber Select
CREATE TABLE IF NOT EXISTS appointments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  client_id INT NULL,
  client_name VARCHAR(100) NOT NULL,
  client_phone VARCHAR(20) NOT NULL,
  service_id INT NULL,
  service_name VARCHAR(100) NOT NULL,
  service_price DECIMAL(8,2) NOT NULL,
  staff_id INT NULL,
  staff_name VARCHAR(100) NOT NULL,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  status ENUM('confirmado', 'pendente', 'cancelado', 'concluido') NOT NULL DEFAULT 'pendente',
  notes VARCHAR(500) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_appointment_date (appointment_date),
  INDEX idx_appointment_status (status)
);
