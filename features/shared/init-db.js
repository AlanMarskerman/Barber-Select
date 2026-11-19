// features/shared/init-db.js
// Inicialização centralizada do banco de dados na partida do servidor.
// Garante que todas as tabelas existam e insere os registros padrão (seed)
// com as credenciais oficiais especificadas em CREDENCIAIS-DEBUG.md.

const bcrypt = require("bcryptjs");
const mysql = require("mysql2/promise");

// Cria o banco antes de conectar o pool. Sem isto, o servidor nem sobe quando
// o banco ainda não existe — por exemplo, num XAMPP recém-instalado.
async function ensureDatabaseExists() {
  const name = process.env.DB_NAME || "barber_select";
  if (!/^[A-Za-z0-9_]+$/.test(name)) {
    throw new Error(`DB_NAME inválido: ${JSON.stringify(name)}. Use letras, números e sublinhado.`);
  }

  const admin = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
  });

  try {
    await admin.query(
      `CREATE DATABASE IF NOT EXISTS ${name} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
  } finally {
    await admin.end();
  }
}

const DDL = {
  clients: `
    CREATE TABLE IF NOT EXISTS clients (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(150) NOT NULL UNIQUE,
      phone VARCHAR(20) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `,
  staff_users: `
    CREATE TABLE IF NOT EXISTS staff_users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(150) NOT NULL UNIQUE,
      username VARCHAR(30) NULL UNIQUE,
      phone VARCHAR(20) NULL,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('staff', 'admin') NOT NULL,
      active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `,
  services: `
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
  `,
  products: `
    CREATE TABLE IF NOT EXISTS products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      description VARCHAR(500) NULL,
      cost_price DECIMAL(8,2) NOT NULL DEFAULT 0.00,
      sale_price DECIMAL(8,2) NOT NULL,
      stock INT NOT NULL DEFAULT 0,
      min_stock INT NOT NULL DEFAULT 5,
      category VARCHAR(50) NOT NULL DEFAULT 'Outros',
      active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_products_active (active),
      INDEX idx_products_category (category)
    );
  `,
  appointments: `
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
      INDEX idx_appointment_status (status),
      INDEX idx_appointment_client (client_id),
      INDEX idx_staff_datetime (staff_id, appointment_date, appointment_time)
    );
  `,
  transactions: `
    CREATE TABLE IF NOT EXISTS transactions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      description VARCHAR(150) NOT NULL,
      category VARCHAR(50) NOT NULL DEFAULT 'Serviços',
      type ENUM('entrada', 'saida') NOT NULL DEFAULT 'entrada',
      amount DECIMAL(10,2) NOT NULL,
      payment_method VARCHAR(50) NOT NULL DEFAULT 'PIX',
      transaction_date DATE NOT NULL,
      source_type VARCHAR(20) NULL,
      source_id INT NULL,
      active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_transaction_date (transaction_date),
      INDEX idx_transaction_type (type),
      INDEX idx_transactions_source (source_type, source_id)
    );
  `,
  sales: `
    CREATE TABLE IF NOT EXISTS sales (
      id INT AUTO_INCREMENT PRIMARY KEY,
      client_name VARCHAR(100) NOT NULL,
      item_name VARCHAR(150) NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      payment_method VARCHAR(50) NOT NULL DEFAULT 'PIX',
      status VARCHAR(30) NOT NULL DEFAULT 'Pago',
      sale_date DATE NOT NULL,
      product_id INT NULL,
      active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_sales_date (sale_date),
      INDEX idx_sales_product (product_id)
    );
  `,
  access_audit: `
    CREATE TABLE IF NOT EXISTS access_audit (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL,
      role VARCHAR(20) NOT NULL,
      action VARCHAR(40) NOT NULL,
      resource VARCHAR(60) NULL,
      success TINYINT(1) NOT NULL DEFAULT 1,
      ip VARCHAR(45) NULL,
      user_agent VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_audit_user (user_id),
      INDEX idx_audit_action (action),
      INDEX idx_audit_created (created_at)
    );
  `
};

async function initDatabase({ getPool }) {
  await ensureDatabaseExists();
  const pool = getPool();

  try {
    // 1. Cria todas as tabelas em ordem
    await pool.query(DDL.staff_users);
    await pool.query(DDL.clients);
    await pool.query(DDL.services);
    await pool.query(DDL.products);
    await pool.query(DDL.appointments);
    await pool.query(DDL.transactions);
    await pool.query(DDL.sales);
    await pool.query(DDL.access_audit);

    // 2. Garante colunas adicionais se tabelas já existiam
    await ensureExtraColumns(pool);

    // 3. Insere dados padrão (seed) com as credenciais oficiais de CREDENCIAIS-DEBUG.md
    await seedDefaultData(pool);

    console.log("[DB] Banco de dados inicializado e conectado com sucesso.");
    return true;
  } catch (err) {
    console.error("[DB] Falha ao inicializar banco de dados:", err);
    throw err;
  }
}

async function ensureExtraColumns(pool) {
  const checks = [
    { table: "transactions", column: "source_type", sql: "ALTER TABLE transactions ADD COLUMN source_type VARCHAR(20) NULL, ADD COLUMN source_id INT NULL, ADD INDEX idx_transactions_source (source_type, source_id)" },
    { table: "sales", column: "product_id", sql: "ALTER TABLE sales ADD COLUMN product_id INT NULL, ADD INDEX idx_sales_product (product_id)" },
    { table: "appointments", column: "notes", sql: "ALTER TABLE appointments ADD COLUMN notes VARCHAR(500) NULL" }
  ];

  for (const chk of checks) {
    try {
      const [cols] = await pool.query(`SHOW COLUMNS FROM ${chk.table} LIKE ?`, [chk.column]);
      if (cols.length === 0) {
        await pool.query(chk.sql);
      }
    } catch (_) {}
  }
}

// Insere uma linha apenas se ela ainda não existir (idempotente, sem duplicatas)
async function seedIfMissing(pool, table, column, value, insertSql, params) {
  const [rows] = await pool.query(`SELECT 1 AS found FROM ${table} WHERE ${column} = ? LIMIT 1`, [value]);
  if (rows.length === 0) {
    await pool.query(insertSql, params);
    return true;
  }
  return false;
}

async function seedDefaultData(pool) {
  try {
    const adminPassHash = await bcrypt.hash("AdminPassword2026!", 12);
    const staffPassHash = await bcrypt.hash("StaffPassword2026!", 12);
    const clientPassHash = await bcrypt.hash("ClientePassword2026!", 12);

    // Contas oficiais de CREDENCIAIS-DEBUG.md (inseridas mesmo que a tabela já tenha outros dados)
    await seedIfMissing(pool, "staff_users", "email", "admin@barberselect.local",
      `INSERT INTO staff_users (name, email, username, phone, password_hash, role, active) VALUES (?, ?, ?, ?, ?, ?, 1)`,
      ["Administrador Master", "admin@barberselect.local", "admin", "11999999999", adminPassHash, "admin"]);

    await seedIfMissing(pool, "staff_users", "email", "staff@barberselect.local",
      `INSERT INTO staff_users (name, email, username, phone, password_hash, role, active) VALUES (?, ?, ?, ?, ?, ?, 1)`,
      ["Profissional Equipe", "staff@barberselect.local", "staff", "11988888888", staffPassHash, "staff"]);

    await seedIfMissing(pool, "clients", "email", "cliente@barberselect.local",
      `INSERT INTO clients (name, email, phone, password_hash, active) VALUES (?, ?, ?, ?, 1)`,
      ["Cliente de Teste", "cliente@barberselect.local", "11977777777", clientPassHash]);

    // Serviços iniciais do catálogo
    const initialServices = [
      ["Corte Degradê", "Corte moderno com acabamento na navalha", "corte", 55.00, 30],
      ["Barba Completa", "Barba modelada com toalha quentes", "barba", 40.00, 25],
      ["Corte + Barba", "Combo completo cabelo e barba", "combo", 85.00, 50],
      ["Acabamento", "Pézinho e contorno", "acabamento", 25.00, 15]
    ];
    for (const [name, description, category, price, duration] of initialServices) {
      await seedIfMissing(pool, "services", "name", name,
        `INSERT INTO services (name, description, category, price, duration_minutes, active) VALUES (?, ?, ?, ?, ?, 1)`,
        [name, description, category, price, duration]);
    }

    // Produtos iniciais do estoque
    const initialProducts = [
      ["Pomada Modeladora Efeito Seco", "Fixação forte 80g", 25.00, 55.00, 15, 3, "Óleos e Pomadas"],
      ["Óleo para Barba Hidratante", "Brilho e maciez 30ml", 20.00, 45.00, 10, 2, "Óleos e Pomadas"],
      ["Shampoo para Cabelo e Barba", "Limpeza profunda 250ml", 18.00, 40.00, 12, 3, "Shampoos"]
    ];
    for (const [name, description, cost, sale, stock, min, category] of initialProducts) {
      await seedIfMissing(pool, "products", "name", name,
        `INSERT INTO products (name, description, cost_price, sale_price, stock, min_stock, category, active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
        [name, description, cost, sale, stock, min, category]);
    }

    console.log("[Seed] Dados padrão verificados/inseridos com sucesso.");
  } catch (err) {
    console.error("[Seed] Erro ao inserir dados padrão:", err.message);
  }
}

module.exports = { initDatabase };
