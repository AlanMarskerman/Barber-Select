const express = require("express");
const { STAFF_ROLES } = require("../shared/roles");
const { escapeLike } = require("../shared/validation");

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

  function sanitizeProduct(row, isAdmin) {
    if (!row) return null;
    const obj = {
      id: Number(row.id),
      name: row.name,
      description: row.description || "",
      sale_price: Number(row.sale_price),
      stock: Number(row.stock),
      min_stock: Number(row.min_stock),
      category: row.category,
      active: Boolean(row.active),
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
    if (isAdmin) {
      obj.cost_price = Number(row.cost_price);
    }
    return obj;
  }

  // Listar produtos
  router.get("/", authenticate(), async (req, res) => {
    try {
      const pool = getPool();
      await ensureTable(pool);

      const { search, category } = req.query;
      const isAdmin = req.user && req.user.role === "admin";
      const cols = isAdmin
        ? "id, name, description, cost_price, sale_price, stock, min_stock, category, active, created_at, updated_at"
        : "id, name, description, sale_price, stock, min_stock, category, active, created_at, updated_at";

      let query = `SELECT ${cols} FROM products WHERE active = 1`;
      const params = [];

      if (search) {
        query += " AND (name LIKE ? OR description LIKE ?)";
        const escaped = `%${escapeLike(search)}%`;
        params.push(escaped, escaped);
      }

      if (category) {
        query += " AND category = ?";
        params.push(category);
      }

      query += " ORDER BY name ASC";

      const [rows] = await pool.query(query, params);
      return res.json(rows.map((r) => sanitizeProduct(r, isAdmin)));
    } catch (err) {
      console.error("Erro ao listar produtos:", err);
      if (err.code === "ECONNREFUSED" || err.code === "ER_ACCESS_DENIED_ERROR") {
        return res.status(503).json({ error: "O sistema está temporariamente indisponível. Tente em alguns instantes." });
      }
      return res.status(500).json({ error: "Erro ao listar produtos." });
    }
  });

  // Criar produto (Restrito a Staff e Admin)
  router.post("/", authenticate(STAFF_ROLES), async (req, res) => {
    try {
      const pool = getPool();
      await ensureTable(pool);

      const { name, description, cost_price, sale_price, stock, min_stock, category } = req.body ?? {};

      if (!name || sale_price === undefined || stock === undefined) {
        return res.status(400).json({ error: "Nome, preço de venda e estoque são obrigatórios." });
      }

      const salePriceNum = Number(sale_price);
      const stockNum = Number(stock);
      const costPriceNum = cost_price !== undefined ? Number(cost_price) : 0;
      const minStockNum = min_stock !== undefined ? Number(min_stock) : 5;

      if (!Number.isFinite(salePriceNum) || salePriceNum < 0 || salePriceNum > 99999.99 ||
          !Number.isFinite(costPriceNum) || costPriceNum < 0 || costPriceNum > 99999.99 ||
          !Number.isInteger(stockNum) || stockNum < 0 ||
          !Number.isInteger(minStockNum) || minStockNum < 0) {
        return res.status(400).json({ error: "Valores de preço ou estoque inválidos." });
      }

      const [result] = await pool.query(
        `INSERT INTO products (name, description, cost_price, sale_price, stock, min_stock, category)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          String(name).trim().slice(0, 100),
          description ? String(description).trim().slice(0, 500) : "",
          costPriceNum.toFixed(2),
          salePriceNum.toFixed(2),
          stockNum,
          minStockNum,
          category ? String(category).trim().slice(0, 50) : "Outros"
        ]
      );

      const isAdmin = req.user.role === "admin";
      const [newProduct] = await pool.query("SELECT * FROM products WHERE id = ?", [result.insertId]);
      return res.status(201).json(sanitizeProduct(newProduct[0], isAdmin));
    } catch (err) {
      console.error("Erro ao criar produto:", err);
      if (err.code === "ECONNREFUSED" || err.code === "ER_ACCESS_DENIED_ERROR") {
        return res.status(503).json({ error: "O sistema está temporariamente indisponível. Tente em alguns instantes." });
      }
      return res.status(500).json({ error: "Erro ao cadastrar produto." });
    }
  });

  // Atualizar produto (Restrito a Staff e Admin) - Não destrutivo (PATCH-like)
  router.put("/:id", authenticate(STAFF_ROLES), async (req, res) => {
    try {
      const pool = getPool();
      await ensureTable(pool);

      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: "Identificador inválido." });
      }

      const [existing] = await pool.query("SELECT * FROM products WHERE id = ? LIMIT 1", [id]);
      if (existing.length === 0) {
        return res.status(404).json({ error: "Produto não encontrado." });
      }

      const current = existing[0];
      const { name, description, cost_price, sale_price, stock, min_stock, category } = req.body ?? {};

      const nextName = name !== undefined ? String(name).trim().slice(0, 100) : current.name;
      const nextDesc = description !== undefined ? String(description).trim().slice(0, 500) : current.description;
      const nextCost = cost_price !== undefined ? Number(cost_price) : Number(current.cost_price);
      const nextSale = sale_price !== undefined ? Number(sale_price) : Number(current.sale_price);
      const nextStock = stock !== undefined ? Number(stock) : Number(current.stock);
      const nextMin = min_stock !== undefined ? Number(min_stock) : Number(current.min_stock);
      const nextCat = category !== undefined ? String(category).trim().slice(0, 50) : current.category;

      if (!Number.isFinite(nextSale) || nextSale < 0 ||
          !Number.isFinite(nextCost) || nextCost < 0 ||
          !Number.isInteger(nextStock) || nextStock < 0 ||
          !Number.isInteger(nextMin) || nextMin < 0) {
        return res.status(400).json({ error: "Valores de preço ou estoque inválidos." });
      }

      await pool.query(
        `UPDATE products SET name = ?, description = ?, cost_price = ?, sale_price = ?, stock = ?, min_stock = ?, category = ? WHERE id = ?`,
        [nextName, nextDesc, nextCost.toFixed(2), nextSale.toFixed(2), nextStock, nextMin, nextCat, id]
      );

      const [updated] = await pool.query("SELECT * FROM products WHERE id = ?", [id]);
      const isAdmin = req.user.role === "admin";
      return res.json(sanitizeProduct(updated[0], isAdmin));
    } catch (err) {
      console.error("Erro ao atualizar produto:", err);
      if (err.code === "ECONNREFUSED" || err.code === "ER_ACCESS_DENIED_ERROR") {
        return res.status(503).json({ error: "O sistema está temporariamente indisponível. Tente em alguns instantes." });
      }
      return res.status(500).json({ error: "Erro ao atualizar produto." });
    }
  });

  // Excluir (desativar) produto (Restrito a Staff e Admin)
  router.delete("/:id", authenticate(STAFF_ROLES), async (req, res) => {
    try {
      const pool = getPool();
      await ensureTable(pool);

      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: "Identificador inválido." });
      }

      const [result] = await pool.query("UPDATE products SET active = 0 WHERE id = ?", [id]);

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Produto não encontrado." });
      }

      return res.json({ message: "Produto excluído com sucesso." });
    } catch (err) {
      console.error("Erro ao excluir produto:", err);
      if (err.code === "ECONNREFUSED" || err.code === "ER_ACCESS_DENIED_ERROR") {
        return res.status(503).json({ error: "O sistema está temporariamente indisponível. Tente em alguns instantes." });
      }
      return res.status(500).json({ error: "Erro ao excluir produto." });
    }
  });

  return router;
}

module.exports = createProductsRouter;
