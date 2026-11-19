(async () => {
  try {
    const loginRes = await fetch('http://localhost:3000/auth/login/unified', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: 'admin@barberselect.local', password: 'AdminPassword2026!' })
    });
    const data = await loginRes.json();
    console.log('Login status:', loginRes.status, data);
    if (!data.accessToken) return;

    const prodRes = await fetch('http://localhost:3000/api/products', {
      headers: { 'Authorization': `Bearer ${data.accessToken}` }
    });
    console.log('GET /api/products status:', prodRes.status);
    console.log('GET /api/products body:', await prodRes.text());
  } catch (err) {
    console.error(err);
  }
})();
