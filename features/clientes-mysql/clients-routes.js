const express = require("express");

const STAFF_ROLES = ["staff", "admin"];
const MAX_CLIENTS = 500;

function createClientsRouter({ authenticate, getPool }) {
  const router = express.Router();

  let columnsReady = null;

  async function ensureClientColumns() {
    if (!columnsReady) {
      columnsReady = (async () => {
        const pool = getPool();
        const colsToAddToClients = [
          "ALTER TABLE clients ADD COLUMN IF NOT EXISTS active TINYINT(1) NOT NULL DEFAULT 1",
          "ALTER TABLE clients ADD COLUMN IF NOT EXISTS birthdate DATE NULL",
          "ALTER TABLE clients ADD COLUMN IF NOT EXISTS cpf VARCHAR(20) NULL",
          "ALTER TABLE clients ADD COLUMN IF NOT EXISTS fav_barber VARCHAR(50) NULL",
          "ALTER TABLE clients ADD COLUMN IF NOT EXISTS hair_style VARCHAR(100) NULL",
          "ALTER TABLE clients ADD COLUMN IF NOT EXISTS beard_style VARCHAR(100) NULL",
          "ALTER TABLE clients ADD COLUMN IF NOT EXISTS skin_notes VARCHAR(300) NULL",
          "ALTER TABLE clients ADD COLUMN IF NOT EXISTS loyalty_points INT NOT NULL DEFAULT 12"
        ];

        for (const sql of colsToAddToClients) {
          try {
            await pool.query(sql);
          } catch (e) {
            // Ignora se a coluna já existir ou falha de versão do ALTER TABLE ADD COLUMN IF NOT EXISTS
          }
        }
      })().catch((error) => {
        columnsReady = null;
        throw error;
      });
    }
    return columnsReady;
  }

  function toApi(row) {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      birthdate: row.birthdate || null,
      cpf: row.cpf || null,
      favBarber: row.fav_barber || null,
      hairStyle: row.hair_style || null,
      beardStyle: row.beard_style || null,
      skinNotes: row.skin_notes || null,
      loyaltyPoints: row.loyalty_points || 12,
      active: Boolean(row.active),
      createdAt: row.created_at,
    };
  }

  // GET /api/clients (Staff/Admin)
  router.get("/", authenticate(STAFF_ROLES), async (req, res) => {
    try {
      await ensureClientColumns();
      const pool = getPool();

      const [rows] = await pool.query(
        "SELECT id, name, email, phone, birthdate, cpf, fav_barber, hair_style, beard_style, skin_notes, loyalty_points, active, created_at FROM clients ORDER BY created_at DESC, id DESC LIMIT ?",
        [MAX_CLIENTS],
      );

      const [[summary]] = await pool.query(
        "SELECT COUNT(*) AS total, COALESCE(SUM(active = 1), 0) AS active, COALESCE(SUM(created_at >= NOW() - INTERVAL 30 DAY), 0) AS recent FROM clients",
      );

      return res.json({
        clients: rows.map(toApi),
        summary: {
          total: Number(summary.total),
          active: Number(summary.active),
          newLast30Days: Number(summary.recent),
        },
      });
    } catch (error) {
      console.error("Erro ao listar clientes:", error);
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

      return res.json(toApi(rows[0]));
    } catch (error) {
      console.error("Erro ao buscar perfil do cliente:", error);
      return res.status(500).json({ error: "Erro ao buscar perfil." });
    }
  });

  // PUT /api/clients/me (Cliente logado atualiza seus próprios dados e preferências)
  router.put("/me", authenticate(["client"]), async (req, res) => {
    try {
      await ensureClientColumns();
      const pool = getPool();
      const clientEmail = req.user.identity;

      const { name, phone, birthdate, cpf, favBarber, hairStyle, beardStyle, skinNotes } = req.body;

      if (!name || !phone) {
        return res.status(400).json({ error: "Nome e telefone são obrigatórios." });
      }

      await pool.query(
        `UPDATE clients SET name = ?, phone = ?, birthdate = ?, cpf = ?, fav_barber = ?, hair_style = ?, beard_style = ?, skin_notes = ? WHERE email = ?`,
        [
          name.trim(),
          phone.trim(),
          birthdate || null,
          cpf || null,
          favBarber || null,
          hairStyle || null,
          beardStyle || null,
          skinNotes || null,
          clientEmail
        ]
      );

      const [updated] = await pool.query(
        "SELECT id, name, email, phone, birthdate, cpf, fav_barber, hair_style, beard_style, skin_notes, loyalty_points, active, created_at FROM clients WHERE email = ? LIMIT 1",
        [clientEmail]
      );

      return res.json(toApi(updated[0]));
    } catch (error) {
      console.error("Erro ao atualizar perfil do cliente:", error);
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
        "SELECT * FROM clients WHERE email = ? LIMIT 1",
        [clientEmail]
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: "Cliente não encontrado." });
      }

      const clientData = rows[0];
      delete clientData.password_hash; // Segurança: nunca exportar hash de senha

      const [appointments] = await pool.query(
        "SELECT * FROM appointments WHERE client_id = ? OR client_phone = ?",
        [clientData.id, clientData.phone]
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
      return res.status(500).json({ error: "Erro ao exportar dados." });
    }
  });

  // DELETE /api/clients/me (LGPD: Direito ao Esquecimento / Anonimização)
  router.delete("/me", authenticate(["client"]), async (req, res) => {
    try {
      await ensureClientColumns();
      const pool = getPool();
      const clientEmail = req.user.identity;

      const [rows] = await pool.query(
        "SELECT id FROM clients WHERE email = ? LIMIT 1",
        [clientEmail]
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: "Cliente não encontrado." });
      }

      const clientId = rows[0].id;
      const anonymousEmail = `deleted_${clientId}_${Date.now()}@anonymized.local`;

      await pool.query(
        `UPDATE clients SET name = 'Usuário Anonimizado', email = ?, phone = '00000000000', cpf = NULL, birthdate = NULL, skin_notes = NULL, active = 0 WHERE id = ?`,
        [anonymousEmail, clientId]
      );

      return res.json({ message: "Dados anonimizados e conta encerrada com sucesso conforme diretrizes da LGPD." });
    } catch (error) {
      console.error("Erro ao anonimizar cliente (LGPD):", error);
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

      return res.json({ client: toApi(rows[0]) });
    } catch (error) {
      console.error("Erro ao alterar status do cliente:", error);
      return res.status(500).json({ error: "Erro interno ao alterar o cliente." });
    }
  });

  return router;
}

module.exports = createClientsRouter;
