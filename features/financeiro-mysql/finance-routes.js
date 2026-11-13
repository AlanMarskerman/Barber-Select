const express = require("express");

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
      active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_transaction_date (transaction_date),
      INDEX idx_transaction_type (type)
    );
  `);
}

function createFinanceRouter({ authenticate, getPool }) {
  const router = express.Router();

  // Listar transações
  router.get("/", authenticate(), async (req, res) => {
    try {
      const pool = getPool();
      await ensureTable(pool);

      const { type, search, start_date, end_date } = req.query;
      let query = "SELECT * FROM transactions WHERE active = 1";
      const params = [];

      if (type) {
        query += " AND type = ?";
        params.push(type);
      }

      if (search) {
        query += " AND (description LIKE ? OR category LIKE ?)";
        params.push(`%${search}%`, `%${search}%`);
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
      return res.status(500).json({ error: "Erro ao listar transações financeiras." });
    }
  });

  // Criar transação
  router.post("/", authenticate(), async (req, res) => {
    try {
      const pool = getPool();
      await ensureTable(pool);

      const { description, category, type, amount, payment_method, transaction_date } = req.body;

      if (!description || !type || amount === undefined || !transaction_date) {
        return res.status(400).json({ error: "Descrição, tipo, valor e data são obrigatórios." });
      }

      const [result] = await pool.query(
        `INSERT INTO transactions (description, category, type, amount, payment_method, transaction_date)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          description,
          category || "Serviços",
          type,
          amount,
          payment_method || "PIX",
          transaction_date
        ]
      );

      const [newTx] = await pool.query("SELECT * FROM transactions WHERE id = ?", [result.insertId]);
      return res.status(201).json(newTx[0]);
    } catch (err) {
      console.error("Erro ao criar transação:", err);
      return res.status(500).json({ error: "Erro ao registrar transação." });
    }
  });

  // Excluir (desativar) transação
  router.delete("/:id", authenticate(), async (req, res) => {
    try {
      const pool = getPool();
      await ensureTable(pool);

      const { id } = req.params;
      const [result] = await pool.query("UPDATE transactions SET active = 0 WHERE id = ?", [id]);

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Transação não encontrada." });
      }

      return res.json({ message: "Transação removida com sucesso." });
    } catch (err) {
      console.error("Erro ao excluir transação:", err);
      return res.status(500).json({ error: "Erro ao excluir transação." });
    }
  });

  return router;
}

module.exports = createFinanceRouter;
