const express = require("express");

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
      INDEX idx_appointment_status (status)
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

function createAppointmentsRouter({ authenticate, getPool }) {
  const router = express.Router();

  // Listar agendamentos (com filtros opcionais por data, staff, status)
  router.get("/", authenticate(), async (req, res) => {
    try {
      const pool = getPool();
      await ensureTable(pool);

      const { date, staff, status, search } = req.query;
      let query = "SELECT * FROM appointments WHERE 1=1";
      const params = [];

      if (date) {
        query += " AND appointment_date = ?";
        params.push(date);
      }

      if (staff) {
        query += " AND staff_name LIKE ?";
        params.push(`%${staff}%`);
      }

      if (status) {
        query += " AND status = ?";
        params.push(status);
      }

      if (search) {
        query += " AND (client_name LIKE ? OR service_name LIKE ? OR client_phone LIKE ?)";
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      }

      query += " ORDER BY appointment_date ASC, appointment_time ASC";

      const [rows] = await pool.query(query, params);
      return res.json(rows);
    } catch (err) {
      console.error("Erro ao listar agendamentos:", err);
      return res.status(500).json({ error: "Erro ao listar agendamentos." });
    }
  });

  // Criar novo agendamento com prevenção de double-booking (transação ACID + lock)
  router.post("/", authenticate(), async (req, res) => {
    const pool = getPool();
    const connection = await pool.getConnection();
    try {
      await ensureTable(pool);

      const {
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
      } = req.body;

      if (!client_name || !client_phone || !service_name || service_price === undefined || !staff_name || !appointment_date || !appointment_time) {
        connection.release();
        return res.status(400).json({ error: "Campos obrigatórios ausentes para o agendamento." });
      }

      await connection.beginTransaction();

      // Verificar conflito de horário (double-booking) para o mesmo profissional na mesma data e horário
      const [existing] = await connection.query(
        `SELECT id FROM appointments
         WHERE staff_name = ? AND appointment_date = ? AND appointment_time = ? AND status != 'cancelado'
         LIMIT 1 FOR UPDATE`,
        [staff_name, appointment_date, appointment_time]
      );

      if (existing.length > 0) {
        await connection.rollback();
        connection.release();
        return res.status(409).json({ error: "Este profissional já possui um agendamento neste horário." });
      }

      const [result] = await connection.query(
        `INSERT INTO appointments
         (client_id, client_name, client_phone, service_id, service_name, service_price, staff_id, staff_name, appointment_date, appointment_time, status, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          client_id || null,
          client_name,
          client_phone,
          service_id || null,
          service_name,
          service_price,
          staff_id || null,
          staff_name,
          appointment_date,
          appointment_time,
          status || 'pendente',
          notes || ''
        ]
      );

      await connection.commit();

      const [newApp] = await pool.query("SELECT * FROM appointments WHERE id = ?", [result.insertId]);
      return res.status(201).json(newApp[0]);
    } catch (err) {
      await connection.rollback();
      console.error("Erro ao criar agendamento:", err);
      return res.status(500).json({ error: "Erro ao criar agendamento." });
    } finally {
      connection.release();
    }
  });

  // Atualizar status do agendamento (se concluído, gera receita automática no financeiro via transação ACID)
  router.put("/:id/status", authenticate(), async (req, res) => {
    const pool = getPool();
    const connection = await pool.getConnection();
    try {
      await ensureTable(pool);
      await ensureTransactionsTable(pool);

      const { id } = req.params;
      const { status } = req.body;

      const validStatuses = ['confirmado', 'pendente', 'cancelado', 'concluido'];
      if (!validStatuses.includes(status)) {
        connection.release();
        return res.status(400).json({ error: "Status inválido." });
      }

      await connection.beginTransaction();

      // Buscar agendamento atual para verificar valores se for concluir
      const [current] = await connection.query("SELECT * FROM appointments WHERE id = ? FOR UPDATE", [id]);
      if (current.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({ error: "Agendamento não encontrado." });
      }

      const appData = current[0];

      await connection.query("UPDATE appointments SET status = ? WHERE id = ?", [status, id]);

      // Se passou para concluído e antes não era, gera transação financeira de entrada
      if (status === 'concluido' && appData.status !== 'concluido') {
        await connection.query(
          `INSERT INTO transactions (description, category, type, amount, payment_method, transaction_date)
           VALUES (?, 'Serviços', 'entrada', ?, 'PIX', ?)`,
          [
            `Atendimento: ${appData.service_name} (${appData.client_name}) - Prof: ${appData.staff_name}`,
            appData.service_price,
            appData.appointment_date
          ]
        );
      }

      await connection.commit();

      const [updated] = await pool.query("SELECT * FROM appointments WHERE id = ?", [id]);
      return res.json(updated[0]);
    } catch (err) {
      await connection.rollback();
      console.error("Erro ao atualizar status:", err);
      return res.status(500).json({ error: "Erro ao atualizar status do agendamento." });
    } finally {
      connection.release();
    }
  });

  // Excluir agendamento
  router.delete("/:id", authenticate(), async (req, res) => {
    try {
      const pool = getPool();
      await ensureTable(pool);

      const { id } = req.params;
      const [result] = await pool.query("DELETE FROM appointments WHERE id = ?", [id]);

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Agendamento não encontrado." });
      }

      return res.json({ message: "Agendamento excluído com sucesso." });
    } catch (err) {
      console.error("Erro ao excluir agendamento:", err);
      return res.status(500).json({ error: "Erro ao excluir agendamento." });
    }
  });

  return router;
}

module.exports = createAppointmentsRouter;
