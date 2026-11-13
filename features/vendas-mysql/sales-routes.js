const express = require("express");

async function ensureTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sales (
      id INT AUTO_INCREMENT PRIMARY KEY,
      client_name VARCHAR(100) NOT NULL,
      item_name VARCHAR(150) NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      payment_method VARCHAR(50) NOT NULL DEFAULT 'PIX',
      status VARCHAR(30) NOT NULL DEFAULT 'Pago',
      sale_date DATE NOT NULL,
      active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_sales_date (sale_date)
    );
  `);
}

async function ensureTransactionsTable(pool) {
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
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    );
  `);
}

function createSalesRouter({ authenticate, getPool }) {
  const router = express.Router();

  // Listar vendas
  router.get("/", authenticate(), async (req, res) => {
    try {
      const pool = getPool();
      await ensureTable(pool);

      const { search } = req.query;
      let query = "SELECT * FROM sales WHERE active = 1";
      const params = [];

      if (search) {
        query += " AND (client_name LIKE ? OR item_name LIKE ?)";
        params.push(`%${search}%`, `%${search}%`);
      }

      query += " ORDER BY sale_date DESC, id DESC";

      const [rows] = await pool.query(query, params);
      return res.json(rows);
    } catch (err) {
      console.error("Erro ao listar vendas:", err);
      return res.status(500).json({ error: "Erro ao listar vendas." });
    }
  });

  // Registrar nova venda e inserir automaticamente no financeiro (transação atômica ACID)
  router.post("/", authenticate(), async (req, res) => {
    const pool = getPool();
    const connection = await pool.getConnection();
    try {
      await ensureTable(pool);
      await ensureTransactionsTable(pool);

      const { client_name, item_name, amount, payment_method, status, sale_date } = req.body;

      if (!client_name || !item_name || amount === undefined || !sale_date) {
        connection.release();
        return res.status(400).json({ error: "Cliente, item, valor e data são obrigatórios." });
      }

      const saleStatus = status || "Pago";

      await connection.beginTransaction();

      // 1. Inserir venda
      const [result] = await connection.query(
        `INSERT INTO sales (client_name, item_name, amount, payment_method, status, sale_date)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [client_name, item_name, amount, payment_method || "PIX", saleStatus, sale_date]
      );

      // 2. Se a venda estiver paga, gerar entrada automática no financeiro
      if (saleStatus.toLowerCase() === 'pago') {
        await connection.query(
          `INSERT INTO transactions (description, category, type, amount, payment_method, transaction_date)
           VALUES (?, ?, 'entrada', ?, ?, ?)`,
          [`Venda: ${item_name} (${client_name})`, "Vendas", amount, payment_method || "PIX", sale_date]
        );
      }

      // 3. Verificar se o item vendido corresponde a um produto em estoque e dar baixa automática
      const [productRows] = await connection.query(
        `SELECT id, stock FROM products WHERE name = ? AND active = 1 LIMIT 1 FOR UPDATE`,
        [item_name]
      );

      if (productRows.length > 0) {
        await connection.query(
          `UPDATE products SET stock = GREATEST(0, stock - 1) WHERE id = ?`,
          [productRows[0].id]
        );
      }

      await connection.commit();

      const [newSale] = await pool.query("SELECT * FROM sales WHERE id = ?", [result.insertId]);
      return res.status(201).json(newSale[0]);
    } catch (err) {
      await connection.rollback();
      console.error("Erro ao registrar venda:", err);
      return res.status(500).json({ error: "Erro ao registrar venda." });
    } finally {
      connection.release();
    }
  });

  // Excluir venda
  router.delete("/:id", authenticate(), async (req, res) => {
    try {
      const pool = getPool();
      await ensureTable(pool);

      const { id } = req.params;
      const [result] = await pool.query("UPDATE sales SET active = 0 WHERE id = ?", [id]);

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Venda não encontrada." });
      }

      return res.json({ message: "Venda excluída com sucesso." });
    } catch (err) {
      console.error("Erro ao excluir venda:", err);
      return res.status(500).json({ error: "Erro ao excluir venda." });
    }
  });

  return router;
}

module.exports = createSalesRouter;
