// register-server.js
// Servidor Express INDEPENDENTE do server.js principal.
// Roda em outra porta e cuida do cadastro E do login de clientes no MySQL.
// Assim, o server.js original não precisa ser alterado (além do CSP já ajustado).

const path = require("path");
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
// jsonwebtoken: gera o token de sessão do cliente após o login.
// express-rate-limit: limita tentativas de login, evitando força bruta.

require("dotenv").config({ path: path.join(__dirname, ".env.register") });

const { getPool } = require("./db");

const REGISTER_PORT = process.env.REGISTER_PORT || 3001;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "http://localhost:3000";
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET ausente ou fraco no arquivo .env.register.");
}
// Mesma validação de segurança que existe no server.js: sem um segredo
// forte, o servidor nem inicia. Evita esquecer de configurar isso.

const app = express();

app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json({ limit: "50kb" }));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Muitas tentativas. Tente novamente em 15 minutos.",
  },
});
// Limita a 5 tentativas de login por IP a cada 15 minutos, só neste
// servidor (não compartilha cota com o login de staff/admin do server.js).

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

app.post("/api/register", async (req, res) => {
  const { name, email, phone, password } = req.body;

  if (!name || name.trim().length < 3) {
    return res.status(400).json({ error: "Nome inválido." });
  }
  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: "E-mail inválido." });
  }
  if (!phone || phone.replace(/\D/g, "").length < 10) {
    return res.status(400).json({ error: "Telefone inválido." });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ error: "Senha muito curta." });
  }

  try {
    const pool = getPool();

    const [existing] = await pool.query(
      "SELECT id FROM clients WHERE email = ? LIMIT 1",
      [email],
    );

    if (existing.length > 0) {
      return res.status(409).json({ error: "E-mail já cadastrado." });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await pool.query(
      "INSERT INTO clients (name, email, phone, password_hash) VALUES (?, ?, ?, ?)",
      [name.trim(), email.trim(), phone.trim(), passwordHash],
    );

    return res.status(201).json({ message: "Cadastro realizado com sucesso." });
  } catch (error) {
    console.error("Erro ao cadastrar cliente:", error);
    return res.status(500).json({ error: "Erro interno ao cadastrar." });
  }
});

app.post("/api/login", loginLimiter, async (req, res) => {
  // Rota nova: autentica um cliente que já se cadastrou via /api/register.

  const { identity, password } = req.body;
  // "identity" chega do auth-unified.js — aqui, para cliente, é o e-mail.

  if (typeof identity !== "string" || typeof password !== "string" || !identity || !password) {
    return res.status(400).json({ error: "Dados de login inválidos." });
  }

  try {
    const pool = getPool();

    const [rows] = await pool.query(
      "SELECT id, name, password_hash FROM clients WHERE email = ? LIMIT 1",
      [identity.trim()],
    );
    // Busca o cliente pelo e-mail. Só pedimos as colunas que vamos usar.

    if (rows.length === 0) {
      return res.status(401).json({ error: "Usuário ou senha incorretos." });
    }
    // Mensagem genérica de propósito: não revela se o problema foi o
    // e-mail não existir ou a senha estar errada (evita dar pista a
    // quem está tentando adivinhar contas).

    const client = rows[0];
    const passwordMatches = await bcrypt.compare(password, client.password_hash);
    // Compara a senha digitada com o hash salvo. bcrypt.compare faz o
    // hash da senha digitada e verifica se bate, sem nunca descriptografar
    // o hash salvo (hash não é reversível).

    if (!passwordMatches) {
      return res.status(401).json({ error: "Usuário ou senha incorretos." });
    }

    const token = jwt.sign(
      { role: "client", clientId: client.id, name: client.name },
      JWT_SECRET,
      { expiresIn: "2h" },
    );
    // Gera o token de sessão, válido por 2h, guardando o papel (client),
    // o id do cliente e o nome — útil se algum dia quisermos personalizar
    // a interface sem precisar consultar o banco de novo a cada página.

    return res.json({ token, role: "client" });
    // Mesmo formato de resposta que os logins de staff/admin já usam
    // ({ token, role }), para o auth-unified.js continuar funcionando
    // sem precisar saber a diferença entre os dois sistemas.
  } catch (error) {
    console.error("Erro ao autenticar cliente:", error);
    return res.status(500).json({ error: "Erro interno ao autenticar." });
  }
});

app.listen(REGISTER_PORT, () => {
  console.log(`Servidor de cadastro rodando em http://localhost:${REGISTER_PORT}`);
});
