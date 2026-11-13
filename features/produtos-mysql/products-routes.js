const express = require("express");

async function ensureTable(pool) {
  await pool.query(`
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
  `);
}

function createProductsRouter({ authenticate, getPool }) {
  const router = express.Router();

  // Listar produtos
  router.get("/", authenticate(), async (req, res) => {
    try {
      const pool = getPool();
      await ensureTable(pool);

      const { search, category } = req.query;
      let query = "SELECT * FROM products WHERE active = 1";
      const params = [];

      if (search) {
        query += " AND (name LIKE ? OR description LIKE ?)";
        params.push(`%${search}%`, `%${search}%`);
      }

      if (category) {
        query += " AND category = ?";
        params.push(category);
      }

      query += " ORDER BY name ASC";

      const [rows] = await pool.query(query, params);
      return res.json(rows);
    } catch (err) {
      console.error("Erro ao listar produtos:", err);
      return res.status(500).json({ error: "Erro ao listar produtos." });
    }
  });

  // Criar produto
  router.post("/", authenticate(), async (req, res) => {
    try {
      const pool = getPool();
      await ensureTable(pool);

      const { name, description, cost_price, sale_price, stock, min_stock, category } = req.body;

      if (!name || sale_price === undefined || stock === undefined) {
        return res.status(400).json({ error: "Nome, preço de venda e estoque são obrigatórios." });
      }

      const [result] = await pool.query(
        `INSERT INTO products (name, description, cost_price, sale_price, stock, min_stock, category)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          name,
          description || "",
          cost_price || 0.00,
          sale_price,
          stock,
          min_stock || 5,
          category || "Outros"
        ]
      );

      const [newProduct] = await pool.query("SELECT * FROM products WHERE id = ?", [result.insertId]);
      return res.status(201).json(newProduct[0]);
    } catch (err) {
      console.error("Erro ao criar produto:", err);
      return res.status(500).json({ error: "Erro ao cadastrar produto." });
    }
  });

  // Atualizar estoque ou dados do produto
  router.put("/:id", authenticate(), async (req, res) => {
    try {
      const pool = getPool();
      await ensureTable(pool);

      const { id } = req.params;
      const { name, description, cost_price, sale_price, stock, min_stock, category } = req.body;

      await pool.query(
        `UPDATE products SET name = ?, description = ?, cost_price = ?, sale_price = ?, stock = ?, min_stock = ?, category = ? WHERE id = ?`,
        [name, description, cost_price, sale_price, stock, min_stock, category, id]
      );

      const [updated] = await pool.query("SELECT * FROM products WHERE id = ?", [id]);
      if (updated.length === 0) {
        return res.status(404).json({ error: "Produto não encontrado." });
      }

      return res.json(updated[0]);
    } catch (err) {
      console.error("Erro ao atualizar produto:", err);
      return res.status(500).json({ error: "Erro ao atualizar produto." });
    }
  });

  // Excluir (desativar) produto
  router.delete("/:id", authenticate(), async (req, res) => {
    try {
      const pool = getPool();
      await ensureTable(pool);

      const { id } = req.params;
      const [result] = await pool.query("UPDATE products SET active = 0 WHERE id = ?", [id]);

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Produto não encontrado." });
      }

      return res.json({ message: "Produto excluído com sucesso." });
    } catch (err) {
      console.error("Erro ao excluir produto:", err);
      return res.status(500).json({ error: "Erro ao excluir produto." });
    }
  });

  return router;
}

module.exports = createProductsRouter;
