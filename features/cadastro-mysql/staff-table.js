// features/cadastro-mysql/staff-table.js
// Cria a tabela staff_users (colaboradores e donos) se ela ainda não existir,
// e realiza o seeding automático de contas padrão (admin e staff) se a tabela estiver vazia.

const bcrypt = require("bcryptjs");

const CREATE_STAFF_TABLE = `
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
	)`;

let tableReady = null;

function ensureStaffTable(getPool) {
  if (!tableReady) {
    tableReady = getPool()
      .query(CREATE_STAFF_TABLE)
      .then(async () => {
        const pool = getPool();
        const [columns] = await pool.query("SHOW COLUMNS FROM staff_users LIKE 'phone'");
        if (columns.length === 0) {
          await pool.query("ALTER TABLE staff_users ADD COLUMN phone VARCHAR(20) NULL AFTER username");
        }

        // Se a tabela estiver vazia, cria contas padrão apenas se explicitamente habilitado em ambiente de desenvolvimento (P0-06)
        const [rows] = await pool.query("SELECT COUNT(*) AS total FROM staff_users");
        const allowSeed = process.env.ALLOW_DEFAULT_SEED === "true";
        if (Number(rows[0].total) === 0 && allowSeed) {
          const adminPass = process.env.SEED_ADMIN_PASSWORD;
          const staffPass = process.env.SEED_STAFF_PASSWORD || adminPass;

          if (!adminPass || adminPass.length < 8) {
            console.warn("[Seed] SEED_ADMIN_PASSWORD não configurada ou muito curta (mínimo 8 caracteres). Pulando seeding de contas.");
            return;
          }

          const adminHash = await bcrypt.hash(adminPass, 12);
          const staffHash = await bcrypt.hash(staffPass, 12);

          await pool.query(
            `INSERT INTO staff_users (name, email, username, phone, password_hash, role, active) VALUES (?, ?, ?, ?, ?, ?, 1)`,
            ["Administrador Master", "admin@barberselect.local", "admin", "11999999999", adminHash, "admin"]
          );
          await pool.query(
            `INSERT INTO staff_users (name, email, username, phone, password_hash, role, active) VALUES (?, ?, ?, ?, ?, ?, 1)`,
            ["Profissional Equipe", "staff@barberselect.local", "staff", "11988888888", staffHash, "staff"]
          );
          console.log("[Seed] Contas padrão de admin e staff criadas com sucesso no banco de dados.");
        }
      })
      .catch((error) => {
        tableReady = null;
        throw error;
      });
  }
  return tableReady;
}

module.exports = { ensureStaffTable };
