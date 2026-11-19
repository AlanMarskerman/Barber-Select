// Teste de integração do dashboard: valida o endpoint /api/dashboard com autenticação real.
// Uso: node test/dashboard-integration.test.js
// Opcional: defina as credenciais via ambiente (STAFF_IDENTITY, STAFF_PASSWORD).

const assert = require("node:assert/strict");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const IDENTITY = process.env.STAFF_IDENTITY || "admin@barberselect.local";
const PASSWORD = process.env.STAFF_PASSWORD || "admin123";

async function main() {
  // 1. Login
  const loginRes = await fetch(`${BASE_URL}/auth/login/unified`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identity: IDENTITY, password: PASSWORD }),
  });
  console.log(`[Login] ${IDENTITY} -> ${loginRes.status}`);
  assert.equal(loginRes.ok, true, "Login falhou — verifique SEED_ADMIN_PASSWORD no .env");

  const loginData = await loginRes.json();
  const accessToken = loginData.accessToken;
  assert.ok(accessToken, "accessToken ausente na resposta de login");

  // 2. Sem token: 401
  const noAuthRes = await fetch(`${BASE_URL}/api/dashboard`);
  console.log(`[Dashboard sem token] -> ${noAuthRes.status}`);
  assert.equal(noAuthRes.status, 401);

  // 3. Com token: 200 + estrutura
  const res = await fetch(`${BASE_URL}/api/dashboard`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  console.log(`[Dashboard com token] -> ${res.status}`);
  assert.equal(res.ok, true);

  const data = await res.json();

  assert.ok(data.date, "date ausente");
  assert.ok(data.weekStart, "weekStart ausente");
  assert.ok(data.weekEnd, "weekEnd ausente");
  assert.ok(data.summary, "summary ausente");
  assert.ok(data.week, "week ausente");
  assert.ok(Array.isArray(data.nextAppointments), "nextAppointments deve ser array");

  // summary
  const s = data.summary;
  assert.equal(typeof s.appointmentsToday, "number");
  assert.equal(typeof s.appointmentsTodayDelta, "number");
  assert.equal(typeof s.revenueToday, "number");
  assert.equal(typeof s.revenueTodayDelta, "number");
  assert.equal(typeof s.upcomingAppointments, "number");
  assert.equal(typeof s.avgTicket, "number");

  // week
  assert.equal(data.week.labels.length, 7, "labels deve ter 7 dias");
  assert.equal(data.week.series.length, 7, "series deve ter 7 dias");
  assert.equal(typeof data.week.total, "number");
  assert.equal(typeof data.week.deltaVsPreviousWeek, "number");

  // future (placeholder para próximos ciclos)
  assert.ok(data.future, "future ausente");
  assert.equal(data.future.reviewsAverage, null);
  assert.equal(data.future.topProduct, null);
  assert.equal(data.future.topBarbers, null);

  // nextAppointments: se houver, valida shape
  for (const a of data.nextAppointments) {
    assert.ok(a.client_name, "client_name ausente");
    assert.ok(a.service_name, "service_name ausente");
    assert.ok(a.staff_name, "staff_name ausente");
    assert.ok(a.appointment_time, "appointment_time ausente");
  }

  console.log("\n✅ Dashboard integration OK");
  console.log("Resumo:", JSON.stringify(s, null, 2));
  console.log("Semana total:", data.week.total, "vs anterior:", data.week.previousWeekTotal);
  console.log("Próximos:", data.nextAppointments.length);
}

main().catch((err) => {
  console.error("❌ Falha no teste de integração:", err.message);
  process.exit(1);
});
