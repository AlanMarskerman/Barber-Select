(async () => {
  try {
    const loginRes = await fetch('http://localhost:3000/auth/login/unified', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: 'admin@barberselect.local', password: 'AdminPassword2026!' })
    });
    const data = await loginRes.json();
    if (!data.accessToken) { console.log('Login falhou'); return; }

    const postRes = await fetch('http://localhost:3000/api/products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${data.accessToken}`
      },
      body: JSON.stringify({
        name: 'Pente de Madeira Anti-estático',
        description: 'Pente para barba e cabelo',
        cost_price: 10.00,
        sale_price: 25.00,
        stock: 20,
        min_stock: 5,
        category: 'Acessórios'
      })
    });
    console.log('POST /api/products status:', postRes.status);
    console.log('POST /api/products body:', await postRes.text());
  } catch (err) {
    console.error(err);
  }
})();
