const path = require("path");
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { ipKeyGenerator } = require("express-rate-limit");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

require("dotenv").config();

const app = express();

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
const JWT_SECRET = process.env.JWT_SECRET;
let JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const JWT_ISSUER = "barber-select-api";
const JWT_AUDIENCE = "barber-select-app";

const PLACEHOLDERS = new Set([
  "Insira uma chave de alta aleatoriedade aqui",
  "CHANGE_ME_GENERATE_WITH_openssl_rand_base64_48",
]);

if (!JWT_SECRET || JWT_SECRET.length < 32 || PLACEHOLDERS.has(JWT_SECRET)) {
  throw new Error("JWT_SECRET ausente, fraco (< 32 chars) ou com valor de exemplo no arquivo .env.");
}

// Se JWT_REFRESH_SECRET estiver ausente ou for igual ao access secret, deriva chave HMAC distinta de 64 caracteres
if (!JWT_REFRESH_SECRET || JWT_REFRESH_SECRET === JWT_SECRET || PLACEHOLDERS.has(JWT_REFRESH_SECRET)) {
  JWT_REFRESH_SECRET = crypto.createHmac("sha256", JWT_SECRET).update("barber_select_refresh_key_derivation").digest("hex");
}

app.set("trust proxy", 1);

// Armazenamento em memória para sessões ativas e tokens bloqueados (com jti e hash)
const activeSessions = new Map(); // userId -> { refreshTokenHash, createdAt, lastUsed, identity, role }
const tokenBlacklist = new Map(); // jti -> expMs (X-04)
const failedLogins = new Map(); // lockoutKey -> { count, lockedUntil }

const LOCKOUT_MAX_ATTEMPTS = 5;
const LOCKOUT_TIME_MS = 15 * 60 * 1000; // 15 minutos

function lockoutKey(req) {
  const body = req.body ?? {};
  const identity = typeof body.identity === "string" ? body.identity.trim().toLowerCase() : "anonymous";
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  return `${ip}::${identity}`;
}

function checkLockout(req) {
  const key = lockoutKey(req);
  const record = failedLogins.get(key);
  if (!record) return false;
  if (Date.now() > record.lockedUntil) {
    failedLogins.delete(key);
    return false;
  }
  return record.count >= LOCKOUT_MAX_ATTEMPTS;
}

function recordFailedAttempt(req) {
  const key = lockoutKey(req);
  const now = Date.now();
  let record = failedLogins.get(key);
  if (!record || now > record.lockedUntil) {
    record = { count: 1, lockedUntil: now + LOCKOUT_TIME_MS };
  } else {
    record.count++;
    if (record.count >= LOCKOUT_MAX_ATTEMPTS) {
      record.lockedUntil = now + LOCKOUT_TIME_MS;
    }
  }
  failedLogins.set(key, record);
}

function clearFailedAttempts(req) {
  const key = lockoutKey(req);
  failedLogins.delete(key);
}

app.disable("x-powered-by");
app.use(helmet());
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: false, limit: "100kb" }));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req),
  message: { error: "Muitas tentativas. Tente novamente em 15 minutos." },
});

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req),
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req),
});

app.use("/api/", apiLimiter);

// Rotas de API
const { getPool } = require("./features/cadastro-mysql/db");
const { initDatabase } = require("./features/shared/init-db");

// Cadastro e login de clientes
const createClientAuth = require("./features/cadastro-mysql/client-auth");
const { registerRouter, clientLogin } = createClientAuth({
  getPool,
  generateUserId,
  createAccessToken,
  createRefreshToken,
  activeSessions,
});
app.use("/api/register", registerRouter);

// Login e contas da equipe
const createStaffAuth = require("./features/cadastro-mysql/staff-auth");
const { staffRouter, staffLogin } = createStaffAuth({
  getPool,
  authenticate,
  generateUserId,
  createAccessToken,
  createRefreshToken,
  activeSessions,
});
app.use("/api/staff-users", staffRouter);

app.use("/api/clients", require("./features/clientes-mysql/clients-routes")({ authenticate, getPool }));
app.use("/api/services", require("./features/servicos-mysql/services-routes")({ authenticate, getPool }));
app.use("/api/appointments", require("./features/agenda-mysql/appointments-routes")({ authenticate, getPool }));
app.use("/api/dashboard", require("./features/agenda-mysql/dashboard-routes")({ authenticate, getPool }));
app.use("/api/products", require("./features/produtos-mysql/products-routes")({ authenticate, getPool }));
app.use("/api/finance", require("./features/financeiro-mysql/finance-routes")({ authenticate, getPool }));
app.use("/api/sales", require("./features/vendas-mysql/sales-routes")({ authenticate, getPool }));

app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "Servidor Barber-Select funcionando." });
});

function validateLoginInput(req, res, next) {
  const body = req.body ?? {};
  const { identity, password } = body;

  if (
    typeof identity !== "string" ||
    typeof password !== "string" ||
    identity.length < 1 ||
    identity.length > 100 ||
    password.length < 1 ||
    password.length > 200
  ) {
    return res.status(400).json({ error: "Dados de login inválidos." });
  }

  next();
}

function generateUserId(role, identity) {
  return crypto.createHash("sha256").update(`${role}:${identity}`).digest("hex").substring(0, 16);
}

function createAccessToken(userId, role, identity) {
  // jsonwebtoken@9 não aceita "algorithms" em sign() (só em verify()); o algoritmo
  // é sempre HS256 quando a chave é string, então ele fica implícito aqui.
  return jwt.sign(
    { userId, role, identity, type: "access", jti: crypto.randomBytes(16).toString("hex") },
    JWT_SECRET,
    { expiresIn: "15m", issuer: JWT_ISSUER, audience: JWT_AUDIENCE }
  );
}

function createRefreshToken(userId, role, identity) {
  return jwt.sign(
    { userId, role, identity, type: "refresh", jti: crypto.randomBytes(16).toString("hex") },
    JWT_REFRESH_SECRET,
    { expiresIn: "7d", issuer: JWT_ISSUER, audience: JWT_AUDIENCE }
  );
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function cleanupBlacklist() {
  const now = Date.now();
  for (const [jti, expMs] of tokenBlacklist) {
    if (expMs <= now) tokenBlacklist.delete(jti);
  }
}

function cleanupExpiredSessions() {
  const now = Date.now();
  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
  for (const [userId, session] of activeSessions.entries()) {
    if (now - session.lastUsed > SEVEN_DAYS) {
      activeSessions.delete(userId);
    }
  }
}

setInterval(() => {
  cleanupExpiredSessions();
  cleanupBlacklist();
}, 60 * 60 * 1000);

function authenticate(requiredRoles = []) {
  return (req, res, next) => {
    const authorization = req.headers.authorization || "";
    const [scheme, token] = authorization.split(" ");

    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({ error: "Autenticação obrigatória." });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET, {
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
        algorithms: ["HS256"],
      });

      if (decoded.type !== "access") {
        return res.status(401).json({ error: "Tipo de token inválido." });
      }

      if (decoded.jti && tokenBlacklist.has(decoded.jti)) {
        return res.status(401).json({ error: "Sessão encerrada. Faça login novamente." });
      }

      const userSession = activeSessions.get(decoded.userId);
      if (!userSession) {
        return res.status(401).json({ error: "Sessão não encontrada ou expirada." });
      }

      userSession.lastUsed = Date.now();

      if (requiredRoles.length > 0 && !requiredRoles.includes(decoded.role)) {
        return res.status(403).json({ error: "Você não tem permissão para esta ação." });
      }

      req.user = decoded;
      req.token = token;
      next();
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        return res.status(401).json({ error: "Token expirado.", code: "TOKEN_EXPIRED" });
      }
      return res.status(401).json({ error: "Sessão inválida ou expirada." });
    }
  };
}

function checkLockoutMiddleware(req, res, next) {
  if (checkLockout(req)) {
    return res.status(429).json({
      error: "Conta temporariamente bloqueada por excesso de tentativas incorretas. Tente novamente em 15 minutos.",
    });
  }
  next();
}

// Endpoint de login unificado (apenas MySQL)
app.post(
  "/auth/login/unified",
  loginLimiter,
  checkLockoutMiddleware,
  validateLoginInput,
  clientLogin,
  staffLogin,
  (req, res) => {
    recordFailedAttempt(req);
    return res.status(401).json({ error: "E-mail ou senha incorretos." });
  }
);

// Refresh token com token rotation e hash de refresh token
app.post("/auth/refresh", refreshLimiter, (req, res) => {
  const body = req.body ?? {};
  const { refreshToken } = body;

  if (!refreshToken || typeof refreshToken !== "string") {
    return res.status(400).json({ error: "Refresh token obrigatório." });
  }

  try {
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      algorithms: ["HS256"],
    });

    if (decoded.type !== "refresh") {
      return res.status(401).json({ error: "Tipo de token inválido." });
    }

    const userSession = activeSessions.get(decoded.userId);
    if (!userSession || userSession.refreshTokenHash !== hashToken(refreshToken)) {
      return res.status(401).json({ error: "Sessão inválida ou refresh token não corresponde." });
    }

    const newAccessToken = createAccessToken(decoded.userId, decoded.role, decoded.identity);
    const newRefreshToken = createRefreshToken(decoded.userId, decoded.role, decoded.identity);

    userSession.refreshTokenHash = hashToken(newRefreshToken);
    userSession.lastUsed = Date.now();

    return res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: 900,
    });
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Refresh token expirado. Faça login novamente.", code: "REFRESH_EXPIRED" });
    }
    return res.status(401).json({ error: "Refresh token inválido." });
  }
});

// Logout unificado
app.post("/auth/logout", authenticate(), (req, res) => {
  const { userId, jti, exp } = req.user;
  const token = req.token;

  activeSessions.delete(userId);
  if (jti && exp) {
    tokenBlacklist.set(jti, exp * 1000);
  }
  tokenBlacklist.set(token, Date.now() + 15 * 60 * 1000);

  return res.json({ message: "Logout realizado com sucesso." });
});

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

// Arquivos estáticos servidos no final (P3-09) e com dotfiles negados
app.use(express.static(PUBLIC_DIR, { dotfiles: "deny", index: "index.html" }));

app.get("/", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

// Middleware global de tratamento de erros (X-12)
app.use((err, req, res, next) => {
  console.error("Erro interno:", err);
  if (res.headersSent) return next(err);
  const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 600 ? err.status : 500;
  const isDbDown = err.code === "ECONNREFUSED" || err.code === "ER_ACCESS_DENIED_ERROR";
  if (isDbDown) {
    return res.status(503).json({ error: "O sistema está temporariamente indisponível. Tente em alguns instantes." });
  }
  res.status(status).json({ error: status === 500 ? "Erro interno do servidor." : err.message });
});

if (require.main === module) {
  initDatabase({ getPool }).then(() => {
    app.listen(PORT, () => {
      console.log(`Servidor executando em http://localhost:${PORT}`);
    });
  }).catch(err => {
    console.error("Falha ao inicializar o banco de dados na partida:", err);
  });
}

module.exports = app;
