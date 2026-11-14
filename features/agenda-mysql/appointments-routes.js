const express = require("express");
const { STAFF_ROLES } = require("../shared/roles");
const { escapeLike } = require("../shared/validation");

async function ensureTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS appointments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      client_id INT NULL,
      client_name VARCHAR(100) NOT NULL,
      client_phone VARCHAR(20) NOT NULL,
      service_id INT NULL,
      service_name VARCHAR(100) NOT NULL,
      service_price DECIMAL(8,2) NOT NULL,
      staff_id INT NULL,
      staff_name VARCHAR(100) NOT NULL,
      appointment_date DATE NOT NULL,
      appointment_time TIME NOT NULL,
      status ENUM('confirmado', 'pendente', 'cancelado', 'concluido') NOT NULL DEFAULT 'pendente',
      notes VARCHAR(500) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_appointment_date (appointment_date),
      INDEX idx_appointment_status (status),
      INDEX idx_appointment_client (client_id),
      INDEX idx_staff_datetime (staff_id, appointment_date, appointment_time)
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

function createAppointmentsRouter({ authenticate, getPool }) {
  const router = express.Router();

  // Listar agendamentos (Staff vê tudo; Cliente vê apenas os próprios)
  router.get("/", authenticate(), async (req, res) => {
    try {
      const pool = getPool();
      await ensureTable(pool);

      const isStaff = req.user && STAFF_ROLES.includes(req.user.role);
      const params = [];
      let query = "SELECT * FROM appointments WHERE 1=1";

      if (!isStaff) {
        // Busca o ID do cliente autenticado
        const [clientRows] = await pool.query(
          "SELECT id, phone FROM clients WHERE email = ? LIMIT 1",
          [req.user.identity]
        );
        if (clientRows.length === 0) {
          return res.json([]);
        }
        const client = clientRows[0];
        query += " AND (client_id = ? OR (client_id IS NULL AND client_phone = ?))";
        params.push(client.id, client.phone);
      } else {
        const { date, staff, status, search } = req.query;

        if (date) {
          query += " AND appointment_date = ?";
          params.push(date);
        }

        if (staff) {
          query += " AND staff_name LIKE ?";
          params.push(`%${escapeLike(staff)}%`);
        }

        if (status) {
          query += " AND status = ?";
          params.push(status);
        }

        if (search) {
          query += " AND (client_name LIKE ? OR service_name LIKE ? OR client_phone LIKE ?)";
          const escaped = `%${escapeLike(search)}%`;
          params.push(escaped, escaped, escaped);
        }
      }

      query += " ORDER BY appointment_date ASC, appointment_time ASC";

      const [rows] = await pool.query(query, params);
      return res.json(rows);
    } catch (err) {
      console.error("Erro ao listar agendamentos:", err);
      if (err.code === "ECONNREFUSED" || err.code === "ER_ACCESS_DENIED_ERROR") {
        return res.status(503).json({ error: "O sistema está temporariamente indisponível. Tente em alguns instantes." });
      }
      return res.status(500).json({ error: "Erro ao listar agendamentos." });
    }
  });

  // Criar novo agendamento com prevenção de double-booking e resolução de preço no servidor
  router.post("/", authenticate(), async (req, res) => {
    const pool = getPool();
    const connection = await pool.getConnection();
    try {
      await ensureTable(pool);

      const isStaff = req.user && STAFF_ROLES.includes(req.user.role);
      let {
        client_name,
        client_phone,
        client_id,
        service_id,
        service_name,
        service_price,
        staff_id,
        staff_name,
        appointment_date,
        appointment_time,
        status,
        notes
      } = req.body ?? {};

      // Se for cliente comum, força dados do cadastro dele
      if (!isStaff) {
        const [clientRows] = await connection.query(
          "SELECT id, name, phone FROM clients WHERE email = ? LIMIT 1",
          [req.user.identity]
        );
        if (clientRows.length === 0) {
          return res.status(403).json({ error: "Cadastro de cliente não encontrado." });
        }
        const client = clientRows[0];
        client_id = client.id;
        client_name = client.name;
        client_phone = client.phone;
        status = "pendente"; // Clientes sempre iniciam como pendente
      }

      if (!client_name || !client_phone || (!service_name && !service_id) || !staff_name || !appointment_date || !appointment_time) {
        return res.status(400).json({ error: "Campos obrigatórios ausentes para o agendamento." });
      }

      await connection.beginTransaction();

      // Resolução de preço e serviço no servidor a partir do catálogo (X-07)
      let resolvedPrice = null;
      let resolvedServiceName = service_name;

      if (service_id) {
        const [svcRows] = await connection.query(
          "SELECT id, name, price FROM services WHERE id = ? AND active = 1 LIMIT 1",
          [Number(service_id)]
        );
        if (svcRows.length > 0) {
          resolvedPrice = Number(svcRows[0].price);
          resolvedServiceName = svcRows[0].name;
        }
      }

      if (resolvedPrice === null && service_name) {
        const [svcRows] = await connection.query(
          "SELECT id, name, price FROM services WHERE name = ? AND active = 1 LIMIT 1",
          [service_name]
        );
        if (svcRows.length > 0) {
          resolvedPrice = Number(svcRows[0].price);
          resolvedServiceName = svcRows[0].name;
          service_id = svcRows[0].id;
        }
      }

      if (resolvedPrice === null) {
        if (service_price !== undefined && Number.isFinite(Number(service_price)) && Number(service_price) > 0) {
          resolvedPrice = Number(service_price);
        } else {
          await connection.rollback();
          return res.status(400).json({ error: "Serviço inválido ou sem preço cadastrado." });
        }
      }

      // Normaliza staff_name e staff_id
      const cleanStaffName = String(staff_name).trim();
      const numStaffId = staff_id ? Number(staff_id) : null;

      // Verificar conflito de horário (double-booking) usando lock FOR UPDATE (X-08)
      let conflictQuery = `
        SELECT id FROM appointments
         WHERE (staff_name = ? ${numStaffId ? "OR staff_id = ?" : ""})
           AND appointment_date = ?
           AND appointment_time = ?
           AND status != 'cancelado'
         LIMIT 1 FOR UPDATE
      `;
      const conflictParams = numStaffId
        ? [cleanStaffName, numStaffId, appointment_date, appointment_time]
        : [cleanStaffName, appointment_date, appointment_time];

      const [existing] = await connection.query(conflictQuery, conflictParams);

      if (existing.length > 0) {
        await connection.rollback();
        return res.status(409).json({ error: "Este profissional já possui um agendamento neste horário." });
      }

      const [result] = await connection.query(
        `INSERT INTO appointments
         (client_id, client_name, client_phone, service_id, service_name, service_price, staff_id, staff_name, appointment_date, appointment_time, status, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          client_id || null,
          String(client_name).trim().slice(0, 100),
          String(client_phone).trim().slice(0, 20),
          service_id ? Number(service_id) : null,
          String(resolvedServiceName).trim().slice(0, 100),
          resolvedPrice.toFixed(2),
          numStaffId || null,
          cleanStaffName.slice(0, 100),
          appointment_date,
          appointment_time,
          status || "pendente",
          notes ? String(notes).trim().slice(0, 500) : ""
        ]
      );

      await connection.commit();

      const [newApp] = await pool.query("SELECT * FROM appointments WHERE id = ?", [result.insertId]);
      return res.status(201).json(newApp[0]);
    } catch (err) {
      await connection.rollback();
      console.error("Erro ao criar agendamento:", err);
      if (err.code === "ECONNREFUSED" || err.code === "ER_ACCESS_DENIED_ERROR") {
        return res.status(503).json({ error: "O sistema está temporariamente indisponível. Tente em alguns instantes." });
      }
      return res.status(500).json({ error: "Erro ao criar agendamento." });
    } finally {
      connection.release();
    }
  });

  // Atualizar status do agendamento (Restrito a Staff e Admin)
  router.put("/:id/status", authenticate(STAFF_ROLES), async (req, res) => {
    const pool = getPool();
    const connection = await pool.getConnection();
    try {
      await ensureTable(pool);
      await ensureTransactionsTable(pool);

      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: "Identificador inválido." });
      }

      const { status } = req.body ?? {};
      const validStatuses = ["confirmado", "pendente", "cancelado", "concluido"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: "Status inválido." });
      }

      await connection.beginTransaction();

      const [current] = await connection.query("SELECT * FROM appointments WHERE id = ? FOR UPDATE", [id]);
      if (current.length === 0) {
        await connection.rollback();
        return res.status(404).json({ error: "Agendamento não encontrado." });
      }

      const appData = current[0];

      await connection.query("UPDATE appointments SET status = ? WHERE id = ?", [status, id]);

      // Integridade financeira (X-06):
      // 1. Se passou para concluído e antes não era, gera transação financeira rastreada
      if (status === "concluido" && appData.status !== "concluido") {
        await connection.query(
          `INSERT INTO transactions (description, category, type, amount, payment_method, transaction_date, source_type, source_id)
           VALUES (?, 'Serviços', 'entrada', ?, 'PIX', ?, 'appointment', ?)`,
          [
            `Atendimento: ${appData.service_name} (${appData.client_name}) - Prof: ${appData.staff_name}`,
            appData.service_price,
            appData.appointment_date,
            id
          ]
        );
      }

      // 2. Se mudou de concluído para outro status (reversão/cancelamento), desativa o lançamento financeiro
      if (status !== "concluido" && appData.status === "concluido") {
        await connection.query(
          "UPDATE transactions SET active = 0 WHERE source_type = 'appointment' AND source_id = ? AND active = 1",
          [id]
        );
      }

      await connection.commit();

      const [updated] = await pool.query("SELECT * FROM appointments WHERE id = ?", [id]);
      return res.json(updated[0]);
    } catch (err) {
      await connection.rollback();
      console.error("Erro ao atualizar status:", err);
      if (err.code === "ECONNREFUSED" || err.code === "ER_ACCESS_DENIED_ERROR") {
        return res.status(503).json({ error: "O sistema está temporariamente indisponível. Tente em alguns instantes." });
      }
      return res.status(500).json({ error: "Erro ao atualizar status do agendamento." });
    } finally {
      connection.release();
    }
  });

  // Excluir agendamento (Restrito a Staff e Admin)
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

      const [result] = await connection.query("DELETE FROM appointments WHERE id = ?", [id]);

      if (result.affectedRows === 0) {
        await connection.rollback();
        return res.status(404).json({ error: "Agendamento não encontrado." });
      }

      // Estorna lançamento financeiro caso existisse (X-06)
      await connection.query(
        "UPDATE transactions SET active = 0 WHERE source_type = 'appointment' AND source_id = ? AND active = 1",
        [id]
      );

      await connection.commit();

      return res.json({ message: "Agendamento excluído com sucesso." });
    } catch (err) {
      await connection.rollback();
      console.error("Erro ao excluir agendamento:", err);
      if (err.code === "ECONNREFUSED" || err.code === "ER_ACCESS_DENIED_ERROR") {
        return res.status(503).json({ error: "O sistema está temporariamente indisponível. Tente em alguns instantes." });
      }
      return res.status(500).json({ error: "Erro ao excluir agendamento." });
    } finally {
      connection.release();
    }
  });

  return router;
}

module.exports = createAppointmentsRouter;
