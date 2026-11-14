const express = require("express");
const { STAFF_ROLES } = require("../shared/roles");
const { escapeLike } = require("../shared/validation");

const VALID_SALE_STATUS = ["Pago", "Pendente"];

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
      product_id INT NULL,
      active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_sales_date (sale_date),
      INDEX idx_sales_product (product_id)
    );
  `);

  const [cols] = await pool.query("SHOW COLUMNS FROM sales LIKE 'product_id'");
  if (cols.length === 0) {
    try {
      await pool.query("ALTER TABLE sales ADD COLUMN product_id INT NULL, ADD INDEX idx_sales_product (product_id)");
    } catch (_) {}
  }
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
}

function createSalesRouter({ authenticate, getPool }) {
  const router = express.Router();

  // Listar vendas (Restrito a Staff e Admin)
  router.get("/", authenticate(STAFF_ROLES), async (req, res) => {
    try {
      const pool = getPool();
      await ensureTable(pool);

      const { search } = req.query;
      let query = "SELECT id, client_name, item_name, amount, payment_method, status, sale_date, product_id, active, created_at FROM sales WHERE active = 1";
      const params = [];

      if (search) {
        query += " AND (client_name LIKE ? OR item_name LIKE ?)";
        const escaped = `%${escapeLike(search)}%`;
        params.push(escaped, escaped);
      }

      query += " ORDER BY sale_date DESC, id DESC";

      const [rows] = await pool.query(query, params);
      return res.json(rows);
    } catch (err) {
      console.error("Erro ao listar vendas:", err);
      if (err.code === "ECONNREFUSED" || err.code === "ER_ACCESS_DENIED_ERROR") {
        return res.status(503).json({ error: "O sistema está temporariamente indisponível. Tente em alguns instantes." });
      }
      return res.status(500).json({ error: "Erro ao listar vendas." });
    }
  });

  // Registrar nova venda e inserir automaticamente no financeiro (transação atômica ACID)
  router.post("/", authenticate(STAFF_ROLES), async (req, res) => {
    const pool = getPool();
    const connection = await pool.getConnection();
    try {
      await ensureTable(pool);
      await ensureTransactionsTable(pool);

      const { client_name, item_name, amount, payment_method, status, sale_date, product_id } = req.body ?? {};

      if (!client_name || !item_name || amount === undefined || !sale_date) {
        return res.status(400).json({ error: "Cliente, item, valor e data são obrigatórios." });
      }

      const amountNum = Number(amount);
      if (!Number.isFinite(amountNum) || amountNum <= 0 || amountNum > 99999999.99) {
        return res.status(400).json({ error: "O valor da venda deve ser um número positivo válido." });
      }

      const saleStatus = VALID_SALE_STATUS.includes(status) ? status : "Pago";

      await connection.beginTransaction();

      // 1. Verificar produto se product_id foi fornecido ou encontrar por nome
      let matchedProductId = product_id ? Number(product_id) : null;
      let productRows = [];

      if (matchedProductId && Number.isInteger(matchedProductId)) {
        [productRows] = await connection.query(
          "SELECT id, name, stock FROM products WHERE id = ? AND active = 1 LIMIT 1 FOR UPDATE",
          [matchedProductId]
        );
      } else {
        [productRows] = await connection.query(
          "SELECT id, name, stock FROM products WHERE name = ? AND active = 1 LIMIT 1 FOR UPDATE",
          [item_name]
        );
      }

      if (productRows.length > 0) {
        matchedProductId = productRows[0].id;
        await connection.query(
          "UPDATE products SET stock = GREATEST(0, stock - 1) WHERE id = ?",
          [productRows[0].id]
        );
      }

      // 2. Inserir venda
      const [result] = await connection.query(
        `INSERT INTO sales (client_name, item_name, amount, payment_method, status, sale_date, product_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          String(client_name).trim().slice(0, 100),
          String(item_name).trim().slice(0, 150),
          amountNum.toFixed(2),
          payment_method ? String(payment_method).trim().slice(0, 50) : "PIX",
          saleStatus,
          sale_date,
          matchedProductId || null
        ]
      );

      const saleId = result.insertId;

      // 3. Se a venda estiver paga, gerar entrada automática no financeiro com rastreio de origem
      if (saleStatus.toLowerCase() === "pago") {
        await connection.query(
          `INSERT INTO transactions (description, category, type, amount, payment_method, transaction_date, source_type, source_id)
           VALUES (?, 'Vendas', 'entrada', ?, ?, ?, 'sale', ?)`,
          [`Venda: ${item_name} (${client_name})`, amountNum.toFixed(2), payment_method || "PIX", sale_date, saleId]
        );
      }

      await connection.commit();

      const [newSale] = await pool.query("SELECT * FROM sales WHERE id = ?", [saleId]);
      return res.status(201).json(newSale[0]);
    } catch (err) {
      await connection.rollback();
      console.error("Erro ao registrar venda:", err);
      if (err.code === "ECONNREFUSED" || err.code === "ER_ACCESS_DENIED_ERROR") {
        return res.status(503).json({ error: "O sistema está temporariamente indisponível. Tente em alguns instantes." });
      }
      return res.status(500).json({ error: "Erro ao registrar venda." });
    } finally {
      connection.release();
    }
  });

  // Excluir venda (e estornar transação financeira correspondente na mesma transação)
  router.delete("/:id", authenticate(STAFF_ROLES), async (req, res) => {
    const pool = getPool();
    const connection = await pool.getConnection();
    try {
      await ensureTable(pool);
      await ensureTransactionsTable(pool);

      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: "Identificador inválido." });
      }

      await connection.beginTransaction();

      const [result] = await connection.query("UPDATE sales SET active = 0 WHERE id = ?", [id]);

      if (result.affectedRows === 0) {
        await connection.rollback();
        return res.status(404).json({ error: "Venda não encontrada." });
      }

      // Desativa também o lançamento financeiro correspondente (X-06)
      await connection.query(
        "UPDATE transactions SET active = 0 WHERE source_type = 'sale' AND source_id = ? AND active = 1",
        [id]
      );

      await connection.commit();

      return res.json({ message: "Venda excluída com sucesso." });
    } catch (err) {
      await connection.rollback();
      console.error("Erro ao excluir venda:", err);
      if (err.code === "ECONNREFUSED" || err.code === "ER_ACCESS_DENIED_ERROR") {
        return res.status(503).json({ error: "O sistema está temporariamente indisponível. Tente em alguns instantes." });
      }
      return res.status(500).json({ error: "Erro ao excluir venda." });
    } finally {
      connection.release();
    }
  });

  return router;
}

module.exports = createSalesRouter;
