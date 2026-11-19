const express = require("express");
const { STAFF_ROLES } = require("../shared/roles");

// Monta um array com as 7 datas (YYYY-MM-DD) da semana atual (segunda a domingo)
function buildCurrentWeekDates() {
  const now = new Date();
  const day = now.getDay(); // 0 = domingo ... 6 = sábado
  const offsetToMonday = day === 0 ? -6 : 1 - day;

  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offsetToMonday + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    dates.push(`${y}-${m}-${dd}`);
  }
  return dates;
}

function toDateString(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function createDashboardRouter({ authenticate, getPool }) {
  const router = express.Router();

  // Métricas executivas do dashboard (Staff e Admin)
  router.get("/", authenticate(STAFF_ROLES), async (req, res) => {
    const pool = getPool();
    try {
      const today = toDateString(new Date());
      const yesterday = toDateString(new Date(Date.now() - 86400000));
      const weekDates = buildCurrentWeekDates();
      const weekStart = weekDates[0];
      const weekEnd = weekDates[6];
      // Semana anterior: 7 dias antes do início da semana atual até o dia anterior
      const prevWeekStart = toDateString(new Date(new Date(weekStart + "T00:00:00").getTime() - 7 * 86400000));
      const prevWeekEnd = toDateString(new Date(new Date(weekStart + "T00:00:00").getTime() - 1 * 86400000));

      // --- Agendamentos de hoje + amanhã (próximos) ---
      const [todayAppts] = await pool.query(
        `SELECT COUNT(*) AS total FROM appointments WHERE appointment_date = ? AND status != 'cancelado'`,
        [today]
      );
      const [yesterdayAppts] = await pool.query(
        `SELECT COUNT(*) AS total FROM appointments WHERE appointment_date = ? AND status != 'cancelado'`,
        [yesterday]
      );

      // --- Faturamento de hoje (transações ativas de entrada) ---
      const [todayRevenue] = await pool.query(
        `SELECT COALESCE(SUM(amount), 0) AS total FROM transactions WHERE transaction_date = ? AND type = 'entrada' AND active = 1`,
        [today]
      );
      const [yesterdayRevenue] = await pool.query(
        `SELECT COALESCE(SUM(amount), 0) AS total FROM transactions WHERE transaction_date = ? AND type = 'entrada' AND active = 1`,
        [yesterday]
      );

      // --- Agendamentos futuros (não cancelados, a partir de hoje) ---
      const [upcomingAppts] = await pool.query(
        `SELECT COUNT(*) AS total FROM appointments WHERE appointment_date >= ? AND status != 'cancelado'`,
        [today]
      );

      // --- Ticket médio: faturamento da semana / atendimentos concluídos na semana ---
      const [weekDone] = await pool.query(
        `SELECT COUNT(*) AS total FROM appointments WHERE appointment_date BETWEEN ? AND ? AND status = 'concluido'`,
        [weekStart, weekEnd]
      );
      const [weekRevenue] = await pool.query(
        `SELECT COALESCE(SUM(amount), 0) AS total FROM transactions WHERE transaction_date BETWEEN ? AND ? AND type = 'entrada' AND active = 1`,
        [weekStart, weekEnd]
      );
      const [prevWeekRevenue] = await pool.query(
        `SELECT COALESCE(SUM(amount), 0) AS total FROM transactions WHERE transaction_date BETWEEN ? AND ? AND type = 'entrada' AND active = 1`,
        [prevWeekStart, prevWeekEnd]
      );

      const doneCount = Number(weekDone[0].total);
      const weekRevenueValue = Number(weekRevenue[0].total);
      const avgTicket = doneCount > 0 ? weekRevenueValue / doneCount : 0;

      // --- Série semanal (Seg..Dom) ---
      const series = [];
      for (const dateStr of weekDates) {
        const [row] = await pool.query(
          `SELECT COALESCE(SUM(amount), 0) AS total FROM transactions WHERE transaction_date = ? AND type = 'entrada' AND active = 1`,
          [dateStr]
        );
        series.push({ date: dateStr, amount: Number(row[0].total) });
      }

      // --- Próximos agendamentos (hoje em diante, não cancelados, ordenados) ---
      const [nextAppts] = await pool.query(
        `SELECT id, client_name, service_name, staff_name, appointment_date, appointment_time, status
         FROM appointments
         WHERE appointment_date >= ? AND status != 'cancelado'
         ORDER BY appointment_date ASC, appointment_time ASC
         LIMIT 5`,
        [today]
      );

      const todayCount = Number(todayAppts[0].total);
      const yesterdayCount = Number(yesterdayAppts[0].total);
      const todayRevenueValue = Number(todayRevenue[0].total);
      const yesterdayRevenueValue = Number(yesterdayRevenue[0].total);
      const prevWeekRevenueValue = Number(prevWeekRevenue[0].total);

      const pct = (current, previous) => {
        if (!previous) return current > 0 ? 100 : 0;
        return Number((((current - previous) / previous) * 100).toFixed(1));
      };

      return res.json({
        date: today,
        weekStart,
        weekEnd,
        summary: {
          appointmentsToday: todayCount,
          appointmentsTodayDelta: pct(todayCount, yesterdayCount),
          revenueToday: todayRevenueValue,
          revenueTodayDelta: pct(todayRevenueValue, yesterdayRevenueValue),
          upcomingAppointments: Number(upcomingAppts[0].total),
          avgTicket: Math.round(avgTicket * 100) / 100,
        },
        week: {
          labels: weekDates,
          series,
          total: weekRevenueValue,
          previousWeekTotal: prevWeekRevenueValue,
          deltaVsPreviousWeek: pct(weekRevenueValue, prevWeekRevenueValue),
        },
        nextAppointments: nextAppts,
        // Futuro: avaliações, produto mais vendido, ranking de barbeiros
        future: {
          reviewsAverage: null,
          topProduct: null,
          topBarbers: null,
        },
      });
    } catch (err) {
      console.error("Erro ao carregar métricas do dashboard:", err);
      if (err.code === "ECONNREFUSED" || err.code === "ER_ACCESS_DENIED_ERROR") {
        return res.status(503).json({ error: "O sistema está temporariamente indisponível. Tente em alguns instantes." });
      }
      return res.status(500).json({ error: "Erro ao carregar métricas do dashboard." });
    }
  });

  return router;
}

module.exports = createDashboardRouter;
