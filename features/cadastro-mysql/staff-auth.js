// features/cadastro-mysql/staff-auth.js
// Login e gerenciamento da EQUIPE (colaboradores e donos) usando o MySQL.
// Este arquivo NÃO é um servidor. Ele exporta uma função que devolve duas peças
// para o server.js plugar:
//   - staffLogin: um "middleware" da rota /auth/login/unified que confere
//     e-mail (ou usuário) e senha na tabela staff_users;
//   - staffRouter: as rotas /api/staff-users, só para o dono (admin) criar,
//     listar e inativar contas da equipe.
// Quem se cadastra pela tela pública vira CLIENTE (tabela clients). Colaborador
// e dono só nascem por aqui, criados por um admin logado.

const express = require("express");
const bcrypt = require("bcryptjs");
// bcryptjs: guarda a senha como "hash" (nunca em texto puro) e compara a senha
// digitada com o hash guardado.
const { ensureStaffTable } = require("./staff-table");

const DUMMY_HASH = bcrypt.hashSync("senha-falsa-para-igualar-o-tempo", 10);
// Hash "de mentira" para o login gastar o mesmo tempo quando o usuário existe
// e quando não existe (senão dá para descobrir quem existe pela demora).

const ADMIN_ONLY = ["admin"];
// Só o dono pode mexer nas contas da equipe.

const ROLE_NAMES = {
  staff: "staff",
  colaborador: "staff",
  admin: "admin",
  administrador: "admin",
  dono: "admin",
};
// Aceitamos o cargo em português ou em inglês e guardamos sempre staff/admin.

function createStaffAuth({
  getPool,
  authenticate,
  generateUserId,
  createAccessToken,
  createRefreshToken,
  activeSessions,
}) {
  // O server.js entrega as peças que precisamos (login, tokens e sessões),
  // assim este arquivo fica independente.

  // ---------- Login: middleware de /auth/login/unified ----------

  async function staffLogin(req, res, next) {
    // Roda DEPOIS do login de cliente. Se o login for de alguém da equipe,
    // responde aqui. Se não achar ninguém, chama next() e o fluxo original
    // (contas de teste do .env) segue como sempre.
    const { identity, password } = req.body;
    if (typeof identity !== "string" || typeof password !== "string") {
      return next();
    }
    const login = identity.trim();

    try {
      await ensureStaffTable(getPool);

      const column = login.includes("@") ? "email" : "username";
      // Com "@" é e-mail; sem "@" é nome de usuário. Os dois funcionam.
      const [rows] = await getPool().query(
        `SELECT id, name, email, password_hash, role, active FROM staff_users WHERE ${column} = ? LIMIT 1`,
        [login],
      );
      // ${column} vem do código acima (só "email" ou "username"), nunca do
      // usuário. O valor digitado entra pelo "?", que impede SQL Injection.

      const user = rows[0];
      const passwordMatches = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);

      if (!user) {
        return next();
      }
      // Ninguém da equipe com esse login: deixa o fluxo original responder.

      if (!passwordMatches || !user.active) {
        return res.status(401).json({ error: "Usuário ou senha incorretos." });
      }
      // Senha errada OU conta inativa: mesma mensagem, para não revelar nada.

      const userId = generateUserId(user.role, user.email);
      const accessToken = createAccessToken(userId, user.role, user.email);
      const refreshToken = createRefreshToken(userId, user.role, user.email);

      activeSessions.set(userId, {
        refreshToken,
        createdAt: Date.now(),
        lastUsed: Date.now(),
        identity: user.email,
        role: user.role,
      });
      // Registra a sessão na lista do server.js: é isso que faz o authenticate,
      // o refresh e o logout reconhecerem este usuário.

      return res.json({
        accessToken,
        refreshToken,
        role: user.role,
        userId,
        identity: user.email,
        expiresIn: 15 * 60,
      });
      // Mesmo formato de resposta dos outros logins do server.js.
    } catch (error) {
      console.error("Erro ao autenticar equipe no MySQL:", error);
      return next();
      // MySQL fora do ar não derruba o login: segue o fluxo original (.env).
    }
  }

  // ---------- Rotas /api/staff-users (só admin) ----------

  const staffRouter = express.Router();

  function toApi(row) {
    // Formato JSON que o front recebe. password_hash nunca entra aqui.
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      username: row.username,
      role: row.role,
      active: Boolean(row.active),
      createdAt: row.created_at,
    };
  }

  function parseCreateBody(body) {
    if (!body || typeof body !== "object") {
      return { error: "Dados inválidos." };
    }
    const { name, email, username, password, role } = body;

    if (typeof name !== "string" || name.trim().length < 3 || name.trim().length > 100) {
      return { error: "Nome inválido." };
    }
    if (typeof email !== "string" || email.trim().length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return { error: "E-mail inválido." };
    }

    let cleanUsername = null;
    if (username !== undefined && username !== null && username !== "") {
      if (typeof username !== "string" || !/^[A-Za-z0-9._-]{3,30}$/.test(username.trim())) {
        return { error: "Usuário inválido. Use de 3 a 30 letras, números, ponto, hífen ou sublinhado." };
      }
      cleanUsername = username.trim();
    }
    // O usuário é opcional. Não aceita "@", para nunca ser confundido com e-mail.

    if (typeof password !== "string" || password.length < 8) {
      return { error: "A senha deve ter pelo menos 8 caracteres." };
    }
    if (Buffer.byteLength(password, "utf8") > 72) {
      return { error: "A senha deve ter no máximo 72 caracteres." };
    }
    // O bcrypt só considera os primeiros 72 bytes; recusamos em vez de cortar.

    const cleanRole = typeof role === "string" ? ROLE_NAMES[role.trim().toLowerCase()] : undefined;
    if (!cleanRole) {
      return { error: "Cargo inválido. Use colaborador ou dono." };
    }

    return {
      value: { name: name.trim(), email: email.trim(), username: cleanUsername, password, role: cleanRole },
    };
  }

  // POST /api/staff-users: cria um colaborador ou dono.
  staffRouter.post("/", authenticate(ADMIN_ONLY), async (req, res) => {
    // authenticate(ADMIN_ONLY) roda antes: sem token de admin, é 401/403.
    const parsed = parseCreateBody(req.body);
    if (parsed.error) {
      return res.status(400).json({ error: parsed.error });
    }
    const { name, email, username, password, role } = parsed.value;

    try {
      await ensureStaffTable(getPool);
      const pool = getPool();

      const [clientRows] = await pool.query("SELECT 1 FROM clients WHERE email = ? LIMIT 1", [email]);
      if (clientRows.length > 0) {
        return res.status(409).json({ error: "E-mail já cadastrado." });
      }
      // O mesmo e-mail não pode ser cliente e equipe ao mesmo tempo: o login
      // não saberia quem é.

      const passwordHash = await bcrypt.hash(password, 10);
      const [result] = await pool.query(
        "INSERT INTO staff_users (name, email, username, password_hash, role) VALUES (?, ?, ?, ?, ?)",
        [name, email, username, passwordHash, role],
      );

      const [rows] = await pool.query(
        "SELECT id, name, email, username, role, active, created_at FROM staff_users WHERE id = ?",
        [result.insertId],
      );
      return res.status(201).json({ staff: toApi(rows[0]) });
    } catch (error) {
      if (error.code === "ER_DUP_ENTRY") {
        const field = String(error.message).includes("username") ? "Nome de usuário" : "E-mail";
        return res.status(409).json({ error: `${field} já cadastrado.` });
      }
      console.error("Erro ao criar usuário da equipe:", error);
      return res.status(500).json({ error: "Erro interno ao criar usuário." });
    }
  });

  // GET /api/staff-users: lista a equipe.
  staffRouter.get("/", authenticate(ADMIN_ONLY), async (req, res) => {
    try {
      await ensureStaffTable(getPool);
      const [rows] = await getPool().query(
        "SELECT id, name, email, username, role, active, created_at FROM staff_users ORDER BY created_at DESC, id DESC",
      );
      return res.json({ staff: rows.map(toApi) });
    } catch (error) {
      console.error("Erro ao listar equipe:", error);
      return res.status(500).json({ error: "Erro interno ao listar equipe." });
    }
  });

  // PATCH /api/staff-users/:id/status: inativa ou reativa (não apaga).
  staffRouter.patch("/:id/status", authenticate(ADMIN_ONLY), async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Identificador inválido." });
    }
    const active = req.body && req.body.active;
    if (typeof active !== "boolean") {
      return res.status(400).json({ error: "Informe active como verdadeiro ou falso." });
    }

    try {
      await ensureStaffTable(getPool);
      const pool = getPool();

      const [found] = await pool.query(
        "SELECT id, name, email, username, role, active, created_at FROM staff_users WHERE id = ?",
        [id],
      );
      if (found.length === 0) {
        return res.status(404).json({ error: "Usuário não encontrado." });
      }
      const target = found[0];
      const targetUserId = generateUserId(target.role, target.email);

      if (!active) {
        if (targetUserId === req.user.userId) {
          return res.status(400).json({ error: "Você não pode inativar a própria conta." });
        }
        // Evita o dono se trancar para fora do sistema sem querer.

        if (target.role === "admin" && target.active) {
          const [[others]] = await pool.query(
            "SELECT COUNT(*) AS n FROM staff_users WHERE role = 'admin' AND active = 1 AND id <> ?",
            [id],
          );
          if (Number(others.n) === 0) {
            return res.status(409).json({ error: "Não é possível inativar o último administrador." });
          }
        }
        // Sempre sobra pelo menos um dono ativo no banco.
      }

      await pool.query("UPDATE staff_users SET active = ? WHERE id = ?", [active ? 1 : 0, id]);

      if (!active) {
        activeSessions.delete(targetUserId);
      }
      // Ao inativar, derruba a sessão dele na hora: o token que ele já tinha
      // para de funcionar, sem esperar os 15 minutos acabarem.

      const [rows] = await pool.query(
        "SELECT id, name, email, username, role, active, created_at FROM staff_users WHERE id = ?",
        [id],
      );
      return res.json({ staff: toApi(rows[0]) });
    } catch (error) {
      console.error("Erro ao alterar status da equipe:", error);
      return res.status(500).json({ error: "Erro interno ao alterar o usuário." });
    }
  });

  return { staffRouter, staffLogin };
}

module.exports = createStaffAuth;
