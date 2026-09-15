const path = require("path");
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const jwt = require("jsonwebtoken");

require("dotenv").config();

const app = express();

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET ausente ou fraco no arquivo .env.");
}

app.disable("x-powered-by");

app.use(helmet());

app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Muitas tentativas. Tente novamente em 15 minutos.",
  },
});

app.use(express.static(PUBLIC_DIR));

app.get("/", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    message: "Servidor Barber-Select funcionando.",
  });
});

function validateLoginInput(req, res, next) {
  const { identity, password } = req.body;

  if (
    typeof identity !== "string" ||
    typeof password !== "string" ||
    identity.length < 1 ||
    identity.length > 100 ||
    password.length < 1 ||
    password.length > 200
  ) {
    return res.status(400).json({
      error: "Dados de login inválidos.",
    });
  }

  next();
}

function createToken(role) {
  return jwt.sign({ role }, JWT_SECRET, {
    expiresIn: "2h",
  });
}

function authenticate(requiredRoles = []) {
  return (req, res, next) => {
    const authorization = req.headers.authorization || "";
    const [scheme, token] = authorization.split(" ");

    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({
        error: "Autenticação obrigatória.",
      });
    }

    try {
      const user = jwt.verify(token, JWT_SECRET);

      if (requiredRoles.length > 0 && !requiredRoles.includes(user.role)) {
        return res.status(403).json({
          error: "Você não tem permissão para esta ação.",
        });
      }

      req.user = user;
      next();
    } catch {
      return res.status(401).json({
        error: "Sessão inválida ou expirada.",
      });
    }
  };
}

function handleLogin(role, loginEnv, passwordEnv) {
  return (req, res) => {
    const { identity, password } = req.body;

    const expectedLogin = process.env[loginEnv];
    const expectedPassword = process.env[passwordEnv];

    if (!expectedLogin || !expectedPassword) {
      console.error(`Credenciais ausentes para o papel: ${role}`);
      return res.status(500).json({
        error: "Erro de configuração do servidor.",
      });
    }

    if (identity !== expectedLogin || password !== expectedPassword) {
      console.warn(`Falha de login para o papel: ${role}`);
      return res.status(401).json({
        error: "Usuário ou senha incorretos.",
      });
    }

    return res.json({
      token: createToken(role),
      role,
    });
  };
}

app.post(
  "/auth/login/cliente",
  loginLimiter,
  validateLoginInput,
  handleLogin("client", "CLIENT_LOGIN", "CLIENT_PASSWORD"),
);

app.post(
  "/auth/login/colaborador",
  loginLimiter,
  validateLoginInput,
  handleLogin("staff", "STAFF_LOGIN", "STAFF_PASSWORD"),
);

app.post(
  "/auth/login/admin",
  loginLimiter,
  validateLoginInput,
  handleLogin("admin", "ADMIN_LOGIN", "ADMIN_PASSWORD"),
);

// Exemplo: use isto em endpoints administrativos reais.
app.get("/api/admin/exemplo-protegido", authenticate(["admin"]), (req, res) => {
  res.json({
    message: "Acesso administrativo autorizado.",
    user: req.user,
  });
});

app.use((err, req, res, next) => {
  console.error("Erro interno:", err);

  res.status(500).json({
    error: "Erro interno do servidor.",
  });
});

app.listen(PORT, () => {
  console.log(`Servidor executando em http://localhost:${PORT}`);
});
