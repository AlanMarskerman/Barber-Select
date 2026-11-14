const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { STAFF_ROLES } = require("../shared/roles");
const { audit } = require("../shared/audit");

const MAX_CLIENTS = 500;

function createClientsRouter({ authenticate, getPool }) {
  const router = express.Router();

  let columnsReady = null;

  async function ensureClientColumns() {
    if (!columnsReady) {
      columnsReady = (async () => {
        const pool = getPool();
        const [existing] = await pool.query("SHOW COLUMNS FROM clients");
        const names = new Set(existing.map((c) => c.Field));
        const MIGRATIONS = [
          ["active", "ALTER TABLE clients ADD COLUMN active TINYINT(1) NOT NULL DEFAULT 1"],
          ["birthdate", "ALTER TABLE clients ADD COLUMN birthdate DATE NULL"],
          ["cpf", "ALTER TABLE clients ADD COLUMN cpf VARCHAR(20) NULL"],
          ["fav_barber", "ALTER TABLE clients ADD COLUMN fav_barber VARCHAR(50) NULL"],
          ["hair_style", "ALTER TABLE clients ADD COLUMN hair_style VARCHAR(100) NULL"],
          ["beard_style", "ALTER TABLE clients ADD COLUMN beard_style VARCHAR(100) NULL"],
          ["skin_notes", "ALTER TABLE clients ADD COLUMN skin_notes VARCHAR(300) NULL"],
          ["loyalty_points", "ALTER TABLE clients ADD COLUMN loyalty_points INT NOT NULL DEFAULT 12"]
        ];

        for (const [col, sql] of MIGRATIONS) {
          if (!names.has(col)) {
            try {
              await pool.query(sql);
            } catch (e) {
              console.error(`[Migrate clients] Erro ao adicionar coluna ${col}:`, e.message);
            }
          }
        }
      })().catch((error) => {
        columnsReady = null;
        throw error;
      });
    }
    return columnsReady;
  }

  function toApi(row, maskCpf = false) {
    let formattedCpf = row.cpf || null;
    if (formattedCpf && maskCpf) {
      const clean = String(formattedCpf).replace(/\D/g, "");
      formattedCpf = clean.length >= 5 ? `***.***.${clean.slice(-5, -2)}-${clean.slice(-2)}` : "***.***.***-**";
    }

    return {
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      birthdate: row.birthdate || null,
      cpf: formattedCpf,
      favBarber: row.fav_barber || null,
      hairStyle: row.hair_style || null,
      beardStyle: row.beard_style || null,
      skinNotes: row.skin_notes || null,
      loyaltyPoints: row.loyalty_points ?? 12,
      active: Boolean(row.active),
      createdAt: row.created_at,
    };
  }

  function isValidCPF(cpf) {
    if (!cpf || String(cpf).trim() === "") return true;
    const cleanCpf = String(cpf).replace(/\D/g, "");
    if (cleanCpf.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(cleanCpf)) return false;

    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cleanCpf.charAt(i), 10) * (10 - i);
    }
    let rev = 11 - (sum % 11);
    if (rev === 10 || rev === 11) rev = 0;
    if (rev !== parseInt(cleanCpf.charAt(9), 10)) return false;

    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cleanCpf.charAt(i), 10) * (11 - i);
    }
    rev = 11 - (sum % 11);
    if (rev === 10 || rev === 11) rev = 0;
    if (rev !== parseInt(cleanCpf.charAt(10), 10)) return false;

    return true;
  }

  // GET /api/clients (Staff/Admin)
  router.get("/", authenticate(STAFF_ROLES), async (req, res) => {
    try {
      await ensureClientColumns();
      const pool = getPool();

      await audit(pool, {
        actor: req.user,
        action: "read",
        resourceType: "client_list",
        legalBasis: "execucao_contrato",
        request: req,
      });

      const [rows] = await pool.query(
        "SELECT id, name, email, phone, birthdate, cpf, fav_barber, hair_style, beard_style, skin_notes, loyalty_points, active, created_at FROM clients ORDER BY created_at DESC, id DESC LIMIT ?",
        [MAX_CLIENTS],
      );

      const [[summary]] = await pool.query(
        "SELECT COUNT(*) AS total, COALESCE(SUM(active = 1), 0) AS active, COALESCE(SUM(created_at >= NOW() - INTERVAL 30 DAY), 0) AS recent FROM clients",
      );

      return res.json({
        clients: rows.map((r) => toApi(r, true)), // Minimização de CPF na listagem geral (art. 46 LGPD)
        summary: {
          total: Number(summary.total),
          active: Number(summary.active),
          newLast30Days: Number(summary.recent),
        },
      });
    } catch (error) {
      console.error("Erro ao listar clientes:", error);
      if (error.code === "ECONNREFUSED" || error.code === "ER_ACCESS_DENIED_ERROR") {
        return res.status(503).json({ error: "O sistema está temporariamente indisponível. Tente em alguns instantes." });
      }
      return res.status(500).json({ error: "Erro interno ao listar clientes." });
    }
  });

  // GET /api/clients/me (Cliente logado busca seus próprios dados)
  router.get("/me", authenticate(["client"]), async (req, res) => {
    try {
      await ensureClientColumns();
      const pool = getPool();
      const clientEmail = req.user.identity;

      const [rows] = await pool.query(
        "SELECT id, name, email, phone, birthdate, cpf, fav_barber, hair_style, beard_style, skin_notes, loyalty_points, active, created_at FROM clients WHERE email = ? LIMIT 1",
        [clientEmail]
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: "Cliente não encontrado." });
      }

      return res.json(toApi(rows[0], false));
    } catch (error) {
      console.error("Erro ao buscar perfil do cliente:", error);
      if (error.code === "ECONNREFUSED" || error.code === "ER_ACCESS_DENIED_ERROR") {
        return res.status(503).json({ error: "O sistema está temporariamente indisponível. Tente em alguns instantes." });
      }
      return res.status(500).json({ error: "Erro ao buscar perfil." });
    }
  });

  // PUT /api/clients/me (Cliente logado atualiza seus próprios dados e preferências)
  router.put("/me", authenticate(["client"]), async (req, res) => {
    try {
      await ensureClientColumns();
      const pool = getPool();
      const clientEmail = req.user.identity;

      const { name, phone, birthdate, cpf, favBarber, hairStyle, beardStyle, skinNotes } = req.body ?? {};

      if (!name || !phone) {
        return res.status(400).json({ error: "Nome e telefone são obrigatórios." });
      }

      if (cpf && !isValidCPF(cpf)) {
        return res.status(400).json({ error: "CPF inválido." });
      }

      await pool.query(
        `UPDATE clients SET name = ?, phone = ?, birthdate = ?, cpf = ?, fav_barber = ?, hair_style = ?, beard_style = ?, skin_notes = ? WHERE email = ?`,
        [
          String(name).trim().slice(0, 100),
          String(phone).trim().slice(0, 20),
          birthdate || null,
          cpf ? String(cpf).trim().slice(0, 20) : null,
          favBarber ? String(favBarber).trim().slice(0, 50) : null,
          hairStyle ? String(hairStyle).trim().slice(0, 100) : null,
          beardStyle ? String(beardStyle).trim().slice(0, 100) : null,
          skinNotes ? String(skinNotes).trim().slice(0, 300) : null,
          clientEmail
        ]
      );

      const [updated] = await pool.query(
        "SELECT id, name, email, phone, birthdate, cpf, fav_barber, hair_style, beard_style, skin_notes, loyalty_points, active, created_at FROM clients WHERE email = ? LIMIT 1",
        [clientEmail]
      );

      return res.json(toApi(updated[0], false));
    } catch (error) {
      console.error("Erro ao atualizar perfil do cliente:", error);
      if (error.code === "ECONNREFUSED" || error.code === "ER_ACCESS_DENIED_ERROR") {
        return res.status(503).json({ error: "O sistema está temporariamente indisponível. Tente em alguns instantes." });
      }
      return res.status(500).json({ error: "Erro ao atualizar perfil." });
    }
  });

  // GET /api/clients/me/export (LGPD: Direito de Portabilidade e Acesso a Dados)
  router.get("/me/export", authenticate(["client"]), async (req, res) => {
    try {
      await ensureClientColumns();
      const pool = getPool();
      const clientEmail = req.user.identity;

      const [rows] = await pool.query(
        "SELECT id, name, email, phone, birthdate, cpf, fav_barber, hair_style, beard_style, skin_notes, loyalty_points, active, created_at FROM clients WHERE email = ? LIMIT 1",
        [clientEmail]
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: "Cliente não encontrado." });
      }

      const clientData = rows[0];

      await audit(pool, {
        actor: req.user,
        action: "export",
        resourceType: "client_data",
        resourceId: String(clientData.id),
        legalBasis: "portabilidade_art18",
        request: req,
      });

      // Busca estritamente por client_id para nunca vazar agendamentos de terceiros (X-14)
      const [appointments] = await pool.query(
        `SELECT id, client_id, client_name, client_phone, service_id, service_name, service_price,
                staff_id, staff_name, appointment_date, appointment_time, status, notes, created_at
           FROM appointments
          WHERE client_id = ?`,
        [clientData.id]
      );

      return res.json({
        exportDate: new Date().toISOString(),
        platform: "Barber Select LGPD Compliance",
        holder: clientData.name,
        profile: clientData,
        appointments: appointments
      });
    } catch (error) {
      console.error("Erro ao exportar dados LGPD:", error);
      if (error.code === "ECONNREFUSED" || error.code === "ER_ACCESS_DENIED_ERROR") {
        return res.status(503).json({ error: "O sistema está temporariamente indisponível. Tente em alguns instantes." });
      }
      return res.status(500).json({ error: "Erro ao exportar dados." });
    }
  });

  // DELETE /api/clients/me (LGPD: Direito ao Esquecimento / Anonimização Completa - P1-07)
  router.delete("/me", authenticate(["client"]), async (req, res) => {
    try {
      await ensureClientColumns();
      const pool = getPool();
      const clientEmail = req.user.identity;

      const [rows] = await pool.query(
        "SELECT id, name FROM clients WHERE email = ? LIMIT 1",
        [clientEmail]
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: "Cliente não encontrado." });
      }

      const clientId = rows[0].id;
      const clientName = rows[0].name;
      const anonymousEmail = `deleted_${clientId}_${Date.now()}@anonymized.local`;
      const randomPasswordHash = await bcrypt.hash(crypto.randomUUID(), 10);

      // Anonimiza tabela clients limpando PII e preferências
      await pool.query(
        `UPDATE clients
           SET name = 'Usuário Anonimizado', email = ?, phone = NULL,
               cpf = NULL, birthdate = NULL, skin_notes = NULL,
               fav_barber = NULL, hair_style = NULL, beard_style = NULL,
               password_hash = ?, active = 0
         WHERE id = ?`,
        [anonymousEmail, randomPasswordHash, clientId]
      );

      // Anonimiza tabelas appointments e sales correspondentes (P1-07)
      await pool.query(
        "UPDATE appointments SET client_name = 'Usuário Anonimizado', client_phone = '00000000000' WHERE client_id = ?",
        [clientId]
      );

      if (clientName) {
        await pool.query(
          "UPDATE sales SET client_name = 'Usuário Anonimizado' WHERE client_name = ?",
          [clientName]
        );
      }

      await audit(pool, {
        actor: req.user,
        action: "anonymize",
        resourceType: "client_account",
        resourceId: String(clientId),
        legalBasis: "eliminacao_art18",
        request: req,
      });

      return res.json({ message: "Dados anonimizados e conta encerrada com sucesso conforme diretrizes da LGPD." });
    } catch (error) {
      console.error("Erro ao anonimizar cliente (LGPD):", error);
      if (error.code === "ECONNREFUSED" || error.code === "ER_ACCESS_DENIED_ERROR") {
        return res.status(503).json({ error: "O sistema está temporariamente indisponível. Tente em alguns instantes." });
      }
      return res.status(500).json({ error: "Erro ao processar exclusão de dados." });
    }
  });

  // PATCH /api/clients/:id/status (Staff/Admin inativa ou reativa cliente)
  router.patch("/:id/status", authenticate(STAFF_ROLES), async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Identificador inválido." });
    }

    const active = req.body && req.body.active;
    if (typeof active !== "boolean") {
      return res.status(400).json({ error: "Informe active como verdadeiro ou falso." });
    }

    try {
      await ensureClientColumns();
      const pool = getPool();

      await pool.query("UPDATE clients SET active = ? WHERE id = ?", [active ? 1 : 0, id]);

      const [rows] = await pool.query(
        "SELECT id, name, email, phone, birthdate, cpf, fav_barber, hair_style, beard_style, skin_notes, loyalty_points, active, created_at FROM clients WHERE id = ?",
        [id],
      );
      if (rows.length === 0) {
        return res.status(404).json({ error: "Cliente não encontrado." });
      }

      return res.json(toApi(rows[0], true));
    } catch (error) {
      console.error("Erro ao alterar status do cliente:", error);
      if (error.code === "ECONNREFUSED" || error.code === "ER_ACCESS_DENIED_ERROR") {
        return res.status(503).json({ error: "O sistema está temporariamente indisponível. Tente em alguns instantes." });
      }
      return res.status(500).json({ error: "Erro interno ao atualizar status." });
    }
  });

  return router;
}

module.exports = createClientsRouter;
