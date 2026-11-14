const express = require("express");
const { STAFF_ROLES } = require("../shared/roles");
const { escapeLike } = require("../shared/validation");

async function ensureTable(pool) {
  await pool.query(`
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
  `);

  const [cols] = await pool.query("SHOW COLUMNS FROM transactions LIKE 'source_type'");
  if (cols.length === 0) {
    try {
      await pool.query("ALTER TABLE transactions ADD COLUMN source_type VARCHAR(20) NULL, ADD COLUMN source_id INT NULL, ADD INDEX idx_transactions_source (source_type, source_id)");
    } catch (_) {}
  }
}

function createFinanceRouter({ authenticate, getPool }) {
  const router = express.Router();

  // Listar transações (Restrito a Staff e Admin)
  router.get("/", authenticate(STAFF_ROLES), async (req, res) => {
    try {
      const pool = getPool();
      await ensureTable(pool);

      const { type, search, start_date, end_date } = req.query;
      let query = "SELECT id, description, category, type, amount, payment_method, transaction_date, source_type, source_id, active, created_at FROM transactions WHERE active = 1";
      const params = [];

      if (type) {
        if (!["entrada", "saida"].includes(type)) {
          return res.status(400).json({ error: "Tipo inválido. Use 'entrada' ou 'saida'." });
        }
        query += " AND type = ?";
        params.push(type);
      }

      if (search) {
        query += " AND (description LIKE ? OR category LIKE ?)";
        const escaped = `%${escapeLike(search)}%`;
        params.push(escaped, escaped);
      }

      if (start_date && end_date) {
        query += " AND transaction_date BETWEEN ? AND ?";
        params.push(start_date, end_date);
      }

      query += " ORDER BY transaction_date DESC, id DESC";

      const [rows] = await pool.query(query, params);
      return res.json(rows);
    } catch (err) {
      console.error("Erro ao listar transações:", err);
      if (err.code === "ECONNREFUSED" || err.code === "ER_ACCESS_DENIED_ERROR") {
        return res.status(503).json({ error: "O sistema está temporariamente indisponível. Tente em alguns instantes." });
      }
      return res.status(500).json({ error: "Não foi possível carregar o financeiro." });
    }
  });

  // Criar transação (Restrito a Staff e Admin)
  router.post("/", authenticate(STAFF_ROLES), async (req, res) => {
    try {
      const pool = getPool();
      await ensureTable(pool);

      const { description, category, type, amount, payment_method, transaction_date } = req.body ?? {};

      if (!description || !type || amount === undefined || !transaction_date) {
        return res.status(400).json({ error: "Descrição, tipo, valor e data são obrigatórios." });
      }

      if (!["entrada", "saida"].includes(type)) {
        return res.status(400).json({ error: "Tipo inválido. Use 'entrada' ou 'saida'." });
      }

      const amountNum = Number(amount);
      if (!Number.isFinite(amountNum) || amountNum <= 0 || amountNum > 99999999.99) {
        return res.status(400).json({ error: "O valor da transação deve ser um número positivo válido." });
      }

      const [result] = await pool.query(
        `INSERT INTO transactions (description, category, type, amount, payment_method, transaction_date)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          String(description).trim().slice(0, 150),
          category ? String(category).trim().slice(0, 50) : "Serviços",
          type,
          amountNum.toFixed(2),
          payment_method ? String(payment_method).trim().slice(0, 50) : "PIX",
          transaction_date
        ]
      );

      const [newTx] = await pool.query("SELECT * FROM transactions WHERE id = ?", [result.insertId]);
      return res.status(201).json(newTx[0]);
    } catch (err) {
      console.error("Erro ao criar transação:", err);
      if (err.code === "ECONNREFUSED" || err.code === "ER_ACCESS_DENIED_ERROR") {
        return res.status(503).json({ error: "O sistema está temporariamente indisponível. Tente em alguns instantes." });
      }
      return res.status(500).json({ error: "Erro ao registrar transação." });
    }
  });

  // Excluir (desativar) transação (Restrito a Staff e Admin)
  router.delete("/:id", authenticate(STAFF_ROLES), async (req, res) => {
    try {
      const pool = getPool();
      await ensureTable(pool);

      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: "Identificador inválido." });
      }

      const [result] = await pool.query("UPDATE transactions SET active = 0 WHERE id = ?", [id]);

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Transação não encontrada." });
      }

      return res.json({ message: "Transação removida com sucesso." });
    } catch (err) {
      console.error("Erro ao excluir transação:", err);
      if (err.code === "ECONNREFUSED" || err.code === "ER_ACCESS_DENIED_ERROR") {
        return res.status(503).json({ error: "O sistema está temporariamente indisponível. Tente em alguns instantes." });
      }
      return res.status(500).json({ error: "Erro ao excluir transação." });
    }
  });

  return router;
}

module.exports = createFinanceRouter;
