const path = require("path");
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

require("dotenv").config();

const app = express();

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || JWT_SECRET + "_refresh";
const JWT_ISSUER = "barber-select-api";
const JWT_AUDIENCE = "barber-select-app";

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET ausente ou fraco no arquivo .env.");
}

// Armazenamento em memória para sessões ativas e tokens bloqueados
// Em produção, use Redis ou banco de dados
const activeSessions = new Map(); // userId -> { refreshToken, createdAt, lastUsed }
const tokenBlacklist = new Set(); // tokens invalidados

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

// Gera um ID único de usuário baseado em role + identity
function generateUserId(role, identity) {
  return crypto
    .createHash("sha256")
    .update(`${role}:${identity}`)
    .digest("hex")
    .substring(0, 16);
}

// Cria access token (curta duração)
function createAccessToken(userId, role, identity) {
  return jwt.sign(
    {
      userId,
      role,
      identity,
      type: "access"
    },
    JWT_SECRET,
    {
      expiresIn: "15m", // 15 minutos
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }
  );
}

// Cria refresh token (longa duração)
function createRefreshToken(userId, role, identity) {
  return jwt.sign(
    {
      userId,
      role,
      identity,
      type: "refresh",
      jti: crypto.randomBytes(16).toString("hex") // ID único do token
    },
    JWT_REFRESH_SECRET,
    {
      expiresIn: "7d", // 7 dias
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }
  );
}

// Limpa sessões expiradas (executar periodicamente)
function cleanupExpiredSessions() {
  const now = Date.now();
  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

  for (const [userId, session] of activeSessions.entries()) {
    if (now - session.lastUsed > SEVEN_DAYS) {
      activeSessions.delete(userId);
    }
  }
}

// Limpa tokens da blacklist expirados
function cleanupBlacklist() {
  // Tokens JWT expiram naturalmente, então podemos limpar a blacklist periodicamente
  // Para simplificar, vamos limpar tudo após 15 minutos (tempo de expiração do access token)
  if (tokenBlacklist.size > 1000) {
    tokenBlacklist.clear();
  }
}

// Executar limpeza a cada hora
setInterval(() => {
  cleanupExpiredSessions();
  cleanupBlacklist();
}, 60 * 60 * 1000);

function authenticate(requiredRoles = []) {
  return (req, res, next) => {
    const authorization = req.headers.authorization || "";
    const [scheme, token] = authorization.split(" ");

    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({
        error: "Autenticação obrigatória.",
      });
    }

    // Verifica se o token está na blacklist (logout)
    if (tokenBlacklist.has(token)) {
      return res.status(401).json({
        error: "Sessão encerrada. Faça login novamente.",
      });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET, {
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      });

      // Garante que é um access token
      if (decoded.type !== "access") {
        return res.status(401).json({
          error: "Tipo de token inválido.",
        });
      }

      // Verifica se a sessão do usuário ainda é válida
      const userSession = activeSessions.get(decoded.userId);
      if (!userSession) {
        return res.status(401).json({
          error: "Sessão não encontrada ou expirada.",
        });
      }

      // Atualiza o timestamp de último uso
      userSession.lastUsed = Date.now();

      // Verifica permissões de role
      if (requiredRoles.length > 0 && !requiredRoles.includes(decoded.role)) {
        return res.status(403).json({
          error: "Você não tem permissão para esta ação.",
        });
      }

      req.user = decoded;
      req.token = token;
      next();
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        return res.status(401).json({
          error: "Token expirado.",
          code: "TOKEN_EXPIRED"
        });
      }
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

    const userId = generateUserId(role, identity);
    const accessToken = createAccessToken(userId, role, identity);
    const refreshToken = createRefreshToken(userId, role, identity);

    // Registra a sessão ativa
    activeSessions.set(userId, {
      refreshToken,
      createdAt: Date.now(),
      lastUsed: Date.now(),
      identity,
      role
    });

    return res.json({
      accessToken,
      refreshToken,
      role,
      userId,
      identity,
      expiresIn: 15 * 60, // 15 minutos em segundos
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

// Endpoint para refresh token
app.post("/auth/refresh", (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({
      error: "Refresh token obrigatório.",
    });
  }

  try {
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });

    // Garante que é um refresh token
    if (decoded.type !== "refresh") {
      return res.status(401).json({
        error: "Tipo de token inválido.",
      });
    }

    // Verifica se a sessão existe e se o refresh token corresponde
    const userSession = activeSessions.get(decoded.userId);
    if (!userSession || userSession.refreshToken !== refreshToken) {
      return res.status(401).json({
        error: "Sessão inválida ou refresh token não corresponde.",
      });
    }

    // Gera novo access token
    const newAccessToken = createAccessToken(
      decoded.userId,
      decoded.role,
      decoded.identity
    );

    // Atualiza timestamp
    userSession.lastUsed = Date.now();

    return res.json({
      accessToken: newAccessToken,
      expiresIn: 15 * 60, // 15 minutos em segundos
    });
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        error: "Refresh token expirado. Faça login novamente.",
        code: "REFRESH_EXPIRED"
      });
    }
    return res.status(401).json({
      error: "Refresh token inválido.",
    });
  }
});

// Endpoint para logout
app.post("/auth/logout", authenticate(), (req, res) => {
  const { userId } = req.user;
  const token = req.token;

  // Remove a sessão ativa
  activeSessions.delete(userId);

  // Adiciona o token à blacklist
  tokenBlacklist.add(token);

  return res.json({
    message: "Logout realizado com sucesso.",
  });
});

// Endpoint para verificar sessão atual
app.get("/auth/session", authenticate(), (req, res) => {
  const { userId, role, identity } = req.user;
  const userSession = activeSessions.get(userId);

  return res.json({
    userId,
    role,
    identity,
    sessionCreated: userSession?.createdAt,
    lastUsed: userSession?.lastUsed,
  });
});

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
