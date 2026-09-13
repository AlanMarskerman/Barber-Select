const path = require("path");
const express = require("express");
require("dotenv").config();

const app = express();

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Arquivos públicos
app.use(express.static(PUBLIC_DIR));

// Página inicial
app.get("/", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

// Teste do servidor
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    message: "Servidor Barber-Select funcionando.",
  });
});

// Login do cliente
app.post("/auth/login/cliente", (req, res) => {
  console.log("Tentativa de login de cliente:", req.body);

  const { identity, password } = req.body;

  if (
    identity !== process.env.CLIENT_LOGIN ||
    password !== process.env.CLIENT_PASSWORD
  ) {
    return res.status(401).json({
      error: "Usuário ou senha do cliente incorretos.",
    });
  }

  return res.json({
    token: "token-teste-cliente",
    role: "client",
  });
});

// Login do colaborador
app.post("/auth/login/colaborador", (req, res) => {
  console.log("Tentativa de login de colaborador:", req.body);

  const { identity, password } = req.body;

  if (
    identity !== process.env.STAFF_LOGIN ||
    password !== process.env.STAFF_PASSWORD
  ) {
    return res.status(401).json({
      error: "Usuário ou senha do colaborador incorretos.",
    });
  }

  return res.json({
    token: "token-teste-colaborador",
    role: "staff",
  });
});

// Login do administrador
app.post("/auth/login/admin", (req, res) => {
  console.log("Tentativa de login de administrador:", req.body);

  const { identity, password } = req.body;

  if (
    identity !== process.env.ADMIN_LOGIN ||
    password !== process.env.ADMIN_PASSWORD
  ) {
    return res.status(401).json({
      error: "Usuário ou senha do administrador incorretos.",
    });
  }

  return res.json({
    token: "token-teste-admin",
    role: "admin",
  });
});

// Tratamento de erros
app.use((err, req, res, next) => {
  console.error("Erro interno:", err);

  res.status(500).json({
    error: "Erro interno do servidor.",
  });
});

// Inicialização
app.listen(PORT, () => {
  console.log(`Servidor executando em http://localhost:${PORT}`);
});
