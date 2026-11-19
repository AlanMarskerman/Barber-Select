const BASE = "http://localhost:3000";

(async () => {
  try {
    // 1. Login
    const loginRes = await fetch(`${BASE}/auth/login/unified`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identity: "admin@barberselect.local", password: "admin123" }),
    });
    console.log("Login status:", loginRes.status);
    if (!loginRes.ok) {
      console.log("Erro login:", await loginRes.text());
      return;
    }
    const { accessToken } = await loginRes.json();
    console.log("Token obtido com sucesso.");

    // 2. Testar POST /api/sales
    const saleRes = await fetch(`${BASE}/api/sales`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        client_name: "Carlos Silva",
        item_name: "Corte Degradê",
        amount: 55.0,
        payment_method: "PIX",
        status: "Pago",
        sale_date: "2026-11-14",
      }),
    });
    console.log("POST /api/sales status:", saleRes.status);
    console.log("POST /api/sales body:", await saleRes.text());

    // 3. Testar GET /api/sales
    const getRes = await fetch(`${BASE}/api/sales`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    console.log("GET /api/sales status:", getRes.status);
    console.log("GET /api/sales body:", await getRes.text());
  } catch (e) {
    console.error("Erro no teste:", e);
  }
})();
