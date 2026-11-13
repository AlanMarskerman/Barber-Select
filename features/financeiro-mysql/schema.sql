-- Schema para Transações Financeiras no Barber Select
CREATE TABLE IF NOT EXISTS transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  description VARCHAR(150) NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'Serviços',
  type ENUM('entrada', 'saida') NOT NULL DEFAULT 'entrada',
  amount DECIMAL(10,2) NOT NULL,
  payment_method VARCHAR(50) NOT NULL DEFAULT 'PIX',
  transaction_date DATE NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_transaction_date (transaction_date),
  INDEX idx_transaction_type (type)
);
