// Rotas de catálogo de serviços. A duração e o preço atuais ficam no serviço;
// futuros agendamentos devem copiar ambos para snapshots no registro do agendamento.
const express = require("express");

const STAFF_ROLES = ["staff", "admin"];
const CATEGORIES = new Set(["corte", "barba", "combo", "tratamento", "acabamento"]);
const MAX_SERVICES = 500;

// Inseridos uma única vez quando o catálogo nasce vazio. São registros comuns,
// editáveis e inativáveis pelo painel — nunca servem como valores fixos da agenda.
const DEFAULT_SERVICES = [
  ["Corte social", "Corte clássico com acabamento e finalização.", "corte", "50.00", 45],
  ["Corte degradê", "Corte com degradê e acabamento detalhado.", "corte", "60.00", 50],
  ["Barba completa", "Modelagem, toalha quente e finalização da barba.", "barba", "40.00", 30],
  ["Corte + barba", "Combo de corte completo e barba completa.", "combo", "85.00", 75],
  ["Pezinho", "Acabamento de contorno para cabelo e barba.", "acabamento", "25.00", 20],
  ["Sobrancelha", "Alinhamento e acabamento de sobrancelhas.", "acabamento", "20.00", 15],
  ["Hidratação capilar", "Tratamento de hidratação e finalização do cabelo.", "tratamento", "35.00", 30],
];

const CREATE_SERVICES_TABLE = `
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
)`;

function createServicesRouter({ authenticate, getPool }) {
  const router = express.Router();
  let tableReady = null;

  function ensureServicesTable() {
    if (!tableReady) {
      tableReady = getPool().query(CREATE_SERVICES_TABLE).catch((error) => {
        tableReady = null;
        throw error;
      });
    }
    return tableReady;
  }

  async function seedDefaultServices() {
    const [[summary]] = await getPool().query("SELECT COUNT(*) AS total FROM services");
    if (Number(summary.total) > 0) return;

    // INSERT IGNORE impede que uma segunda inicialização concorrente crie duplicatas.
    await getPool().query(
      "INSERT IGNORE INTO services (name, description, category, price, duration_minutes) VALUES ?",
      [DEFAULT_SERVICES],
    );
  }

  async function ensureCatalogReady() {
    await ensureServicesTable();
    await seedDefaultServices();
  }

  function parseService(body) {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return { error: "Dados inválidos." };
    }

    const { name, description, category, price, durationMinutes } = body;
    if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 100) {
      return { error: "O nome deve ter entre 2 e 100 caracteres." };
    }
    if (description !== undefined && description !== null && typeof description !== "string") {
      return { error: "Descrição inválida." };
    }
    const cleanDescription = typeof description === "string" ? description.trim() : "";
    if (cleanDescription.length > 500) {
      return { error: "A descrição deve ter no máximo 500 caracteres." };
    }
    if (typeof category !== "string" || !CATEGORIES.has(category)) {
      return { error: "Categoria inválida." };
    }

    const parsedPrice = typeof price === "number" ? price : Number(String(price).replace(',', '.'));
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0.01 || parsedPrice > 99999.99) {
      return { error: "Informe um preço entre R$ 0,01 e R$ 99.999,99." };
    }
    if (Math.abs(parsedPrice * 100 - Math.round(parsedPrice * 100)) > 1e-7) {
      return { error: "O preço deve ter no máximo duas casas decimais." };
    }

    const parsedDuration = Number(durationMinutes);
    if (!Number.isInteger(parsedDuration) || parsedDuration < 5 || parsedDuration > 600 || parsedDuration % 5 !== 0) {
      return { error: "A duração deve ser múltipla de 5 minutos, entre 5 e 600." };
    }

    return {
      value: {
        name: name.trim(),
        description: cleanDescription || null,
        category,
        price: parsedPrice.toFixed(2),
        durationMinutes: parsedDuration,
      },
    };
  }

  function toApi(row) {
    return {
      id: Number(row.id),
      name: row.name,
      description: row.description || "",
      category: row.category,
      price: Number(row.price),
      durationMinutes: Number(row.duration_minutes),
      active: Boolean(row.active),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  const SERVICE_COLUMNS = "id, name, description, category, price, duration_minutes, active, created_at, updated_at";

  router.get("/", authenticate(STAFF_ROLES), async (req, res) => {
    const activeOnly = req.query.active === "true";
    try {
      await ensureCatalogReady();
      const [rows] = await getPool().query(
        `SELECT ${SERVICE_COLUMNS} FROM services ${activeOnly ? "WHERE active = 1" : ""} ORDER BY active DESC, category ASC, name ASC LIMIT ?`,
        [MAX_SERVICES],
      );
      return res.json({ services: rows.map(toApi) });
    } catch (error) {
      console.error("Erro ao listar serviços:", error);
      return res.status(500).json({ error: "Erro interno ao listar serviços." });
    }
  });

  router.post("/", authenticate(STAFF_ROLES), async (req, res) => {
    const parsed = parseService(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });

    try {
      await ensureCatalogReady();
      const service = parsed.value;
      const [result] = await getPool().query(
        "INSERT INTO services (name, description, category, price, duration_minutes) VALUES (?, ?, ?, ?, ?)",
        [service.name, service.description, service.category, service.price, service.durationMinutes],
      );
      const [rows] = await getPool().query(
        `SELECT ${SERVICE_COLUMNS} FROM services WHERE id = ? LIMIT 1`,
        [result.insertId],
      );
      return res.status(201).json({ service: toApi(rows[0]) });
    } catch (error) {
      if (error.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ error: "Já existe um serviço com este nome." });
      }
      console.error("Erro ao cadastrar serviço:", error);
      return res.status(500).json({ error: "Erro interno ao cadastrar serviço." });
    }
  });

  router.patch("/:id", authenticate(STAFF_ROLES), async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Identificador inválido." });
    }
    const parsed = parseService(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });

    try {
      await ensureCatalogReady();
      const service = parsed.value;
      const [result] = await getPool().query(
        "UPDATE services SET name = ?, description = ?, category = ?, price = ?, duration_minutes = ? WHERE id = ?",
        [service.name, service.description, service.category, service.price, service.durationMinutes, id],
      );
      if (result.affectedRows === 0) {
        const [found] = await getPool().query("SELECT id FROM services WHERE id = ? LIMIT 1", [id]);
        if (found.length === 0) return res.status(404).json({ error: "Serviço não encontrado." });
      }
      const [rows] = await getPool().query(
        `SELECT ${SERVICE_COLUMNS} FROM services WHERE id = ? LIMIT 1`,
        [id],
      );
      return res.json({ service: toApi(rows[0]) });
    } catch (error) {
      if (error.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ error: "Já existe outro serviço com este nome." });
      }
      console.error("Erro ao atualizar serviço:", error);
      return res.status(500).json({ error: "Erro interno ao atualizar serviço." });
    }
  });

  router.patch("/:id/status", authenticate(STAFF_ROLES), async (req, res) => {
    const id = Number(req.params.id);
    const active = req.body && req.body.active;
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Identificador inválido." });
    }
    if (typeof active !== "boolean") {
      return res.status(400).json({ error: "Informe active como verdadeiro ou falso." });
    }

    try {
      await ensureCatalogReady();
      const [result] = await getPool().query("UPDATE services SET active = ? WHERE id = ?", [active ? 1 : 0, id]);
      if (result.affectedRows === 0) {
        const [found] = await getPool().query("SELECT id FROM services WHERE id = ? LIMIT 1", [id]);
        if (found.length === 0) return res.status(404).json({ error: "Serviço não encontrado." });
      }
      const [rows] = await getPool().query(
        `SELECT ${SERVICE_COLUMNS} FROM services WHERE id = ? LIMIT 1`,
        [id],
      );
      return res.json({ service: toApi(rows[0]) });
    } catch (error) {
      console.error("Erro ao alterar status do serviço:", error);
      return res.status(500).json({ error: "Erro interno ao alterar status do serviço." });
    }
  });

  return router;
}

module.exports = createServicesRouter;
