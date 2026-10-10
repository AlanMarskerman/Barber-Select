// features/cadastro-mysql/client-auth.js
// Cadastro e login de CLIENTES usando o MySQL.
// Este arquivo NÃO é um servidor. Ele exporta uma função que devolve duas peças
// para o server.js plugar:
//   - registerRouter: a rota POST /api/register (cadastro);
//   - clientLogin: um "middleware" que entra na rota /auth/login/unified e
//     confere e-mail e senha na tabela clients.
// Tudo roda dentro do server.js (porta 3000), usando as mesmas sessões, tokens,
// refresh e logout que os outros perfis já usam.

const express = require("express");
const bcrypt = require("bcryptjs");
// bcryptjs: transforma a senha em um "hash" (nunca guardamos a senha em texto
// puro) e compara a senha digitada com o hash guardado no banco.
const rateLimit = require("express-rate-limit");
// express-rate-limit: limita quantas vezes alguém pode chamar a rota de cadastro.

const DUMMY_HASH = bcrypt.hashSync("senha-falsa-para-igualar-o-tempo", 10);
// Um hash "de mentira", calculado uma vez quando o servidor liga. Serve para o
// login gastar o mesmo tempo (a comparação do bcrypt é lenta de propósito)
// quando o e-mail existe e quando não existe. Sem isso, quem tentasse adivinhar
// e-mails perceberia pela demora quais estão cadastrados.

function createClientAuth({
  getPool,
  generateUserId,
  createAccessToken,
  createRefreshToken,
  activeSessions,
}) {
  // O server.js entrega as peças que precisamos, em vez de este arquivo importar
  // direto: getPool (conexão com o MySQL) e as funções/lista de sessão que o
  // próprio server.js já tem. Assim este arquivo fica independente.

  // ---------- Validação do cadastro ----------

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
  // Mesma regra de e-mail que o register.js usa no navegador.

  function parseRegisterBody(body) {
    // Valida e limpa os dados do cadastro. Devolve { error } se algo estiver
    // errado ou { value } com os dados prontos para gravar.
    if (!body || typeof body !== "object") {
      return { error: "Dados inválidos." };
    }

    const { name, email, phone, password } = body;
    // Cada campo precisa ser TEXTO. Sem isso, alguém poderia mandar um número ou
    // um objeto e o código quebraria ao chamar .trim() nele.

    if (typeof name !== "string" || name.trim().length < 3 || name.trim().length > 100) {
      return { error: "Nome inválido." };
    }
    if (typeof email !== "string" || email.trim().length > 150 || !isValidEmail(email.trim())) {
      return { error: "E-mail inválido." };
    }
    if (typeof phone !== "string" || phone.trim().length > 20) {
      return { error: "Telefone inválido." };
    }
    const phoneDigits = phone.replace(/\D/g, "").length;
    if (phoneDigits < 10 || phoneDigits > 11) {
      return { error: "Telefone inválido." };
    }
    // Telefone brasileiro: 10 ou 11 dígitos (com DDD), igual ao formulário.

    if (typeof password !== "string" || password.length < 6) {
      return { error: "A senha deve ter pelo menos 6 caracteres." };
    }
    if (Buffer.byteLength(password, "utf8") > 72) {
      return { error: "A senha deve ter no máximo 72 caracteres." };
    }
    // O bcrypt só considera os primeiros 72 bytes da senha. Recusamos senhas
    // maiores em vez de cortá-las em silêncio.

    return {
      value: {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
      },
    };
  }

  // ---------- Cadastro: POST /api/register ----------

  const registerLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Muitas tentativas de cadastro. Tente novamente em 15 minutos." },
  });
  // No máximo 20 cadastros por IP a cada 15 minutos, para ninguém encher o banco.

  const registerRouter = express.Router();

  registerRouter.post("/", registerLimiter, async (req, res) => {
    const parsed = parseRegisterBody(req.body);
    if (parsed.error) {
      return res.status(400).json({ error: parsed.error });
    }
    const { name, email, phone, password } = parsed.value;

    try {
      const passwordHash = await bcrypt.hash(password, 10);
      // Gera o hash da senha. O 10 é o "custo": quanto maior, mais lento e mais
      // seguro. Só o hash vai para o banco.

      await getPool().query(
        "INSERT INTO clients (name, email, phone, password_hash) VALUES (?, ?, ?, ?)",
        [name, email, phone, passwordHash],
      );
      // Os "?" são preenchidos com os valores do array de forma segura, o que
      // impede SQL Injection. Não conferimos antes se o e-mail existe: a coluna
      // email é UNIQUE, então o próprio MySQL recusa o duplicado (e é à prova de
      // dois cadastros simultâneos com o mesmo e-mail).

      return res.status(201).json({ message: "Cadastro realizado com sucesso." });
    } catch (error) {
      if (error.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ error: "E-mail já cadastrado." });
      }
      console.error("Erro ao cadastrar cliente:", error);
      return res.status(500).json({ error: "Erro interno ao cadastrar." });
    }
  });

  // ---------- Login do cliente: middleware de /auth/login/unified ----------

  async function clientLogin(req, res, next) {
    // Roda DEPOIS do limitador e da validação que o server.js já tem na rota.
    // Se o login for de um cliente do MySQL, responde aqui. Se não for, chama
    // next() e o fluxo original (contas de teste do .env) segue como sempre.
    const { identity, password } = req.body;

    if (typeof identity !== "string" || typeof password !== "string" || !identity.includes("@")) {
      return next();
    }
    // Só tentamos o banco quando o login parece um e-mail. Os logins de
    // colaborador e admin ("colaborador", "admin") nem encostam no MySQL.

    try {
      const [rows] = await getPool().query(
        "SELECT id, name, email, password_hash FROM clients WHERE email = ? LIMIT 1",
        [identity.trim()],
      );

      const client = rows[0];
      const passwordMatches = await bcrypt.compare(password, client ? client.password_hash : DUMMY_HASH);
      // Compara a senha digitada com o hash do banco. Se o e-mail não existe,
      // compara com o hash falso só para gastar o mesmo tempo.

      if (!client) {
        return next();
      }
      // E-mail desconhecido: deixa o fluxo original responder (vai dar 401).

      if (!passwordMatches) {
        return res.status(401).json({ error: "Usuário ou senha incorretos." });
      }
      // Mensagem igual à dos outros logins: não revela se o erro foi no e-mail
      // ou na senha.

      const userId = generateUserId("client", client.email);
      const accessToken = createAccessToken(userId, "client", client.email);
      const refreshToken = createRefreshToken(userId, "client", client.email);

      activeSessions.set(userId, {
        refreshToken,
        createdAt: Date.now(),
        lastUsed: Date.now(),
        identity: client.email,
        role: "client",
      });
      // Registra a sessão na lista do server.js. É isso que faz o authenticate,
      // o refresh e o logout reconhecerem este cliente como qualquer outro.

      return res.json({
        accessToken,
        refreshToken,
        role: "client",
        userId,
        identity: client.email,
        expiresIn: 15 * 60,
      });
      // Mesmo formato de resposta dos logins do server.js (15 minutos em
      // segundos). Se alguém mudar esse formato lá, mude aqui também.
    } catch (error) {
      console.error("Erro ao autenticar cliente no MySQL:", error);
      return next();
      // Se o MySQL estiver fora do ar, não derruba o login: segue o fluxo
      // original, e as contas de teste do .env continuam funcionando.
    }
  }

  return { registerRouter, clientLogin };
}

module.exports = createClientAuth;
