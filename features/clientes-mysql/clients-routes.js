// features/clientes-mysql/clients-routes.js
// Rotas dos CLIENTES para a tela de Clientes do colaborador/admin
// (/staff/clients.html):
//   GET   /api/clients             -> lista os clientes e os números dos cards;
//   PATCH /api/clients/:id/status  -> inativa ou reativa um cliente.
// Este arquivo NÃO é um servidor. Ele exporta uma função que devolve um
// "Router" (um conjunto de rotas) para o server.js plugar em /api/clients.
// Assim as rotas rodam dentro do server.js (porta 3000), com o mesmo login e
// as mesmas sessões do resto do projeto.

const express = require("express");
// Express: framework que o projeto já usa. Aqui só precisamos do Router.

const STAFF_ROLES = ["staff", "admin"];
// Quem pode ver e inativar clientes: colaborador e administrador.
// Um cliente logado NÃO pode ver nem alterar os outros clientes.

const MAX_CLIENTS = 500;
// Teto de linhas devolvidas de uma vez, para a resposta não crescer sem fim.

function createClientsRouter({ authenticate, getPool }) {
  // O server.js entrega duas peças (em vez de importarmos direto):
  // - authenticate: confere o token e a sessão do usuário;
  // - getPool: devolve a conexão com o MySQL.

  const router = express.Router();

  // ---------- Coluna "active" ----------

  let columnReady = null;

  function ensureActiveColumn() {
    // "Inativar" precisa de uma coluna active na tabela clients (1 = ativo,
    // 0 = inativo). Quem já tinha a tabela criada não tem essa coluna, então
    // na primeira chamada conferimos e criamos se faltar. Todo cliente que já
    // existe nasce ativo (DEFAULT 1). Guardamos a promessa para fazer isso uma
    // única vez, mesmo com várias requisições ao mesmo tempo.
    if (!columnReady) {
      columnReady = (async () => {
        const pool = getPool();
        const [[found]] = await pool.query(
          "SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clients' AND COLUMN_NAME = 'active'",
        );
        if (Number(found.n) === 0) {
          await pool.query("ALTER TABLE clients ADD COLUMN active TINYINT(1) NOT NULL DEFAULT 1");
        }
      })().catch((error) => {
        columnReady = null;
        // Se falhou (ex.: MySQL fora do ar), tenta de novo na próxima chamada.
        throw error;
      });
    }
    return columnReady;
  }

  function toApi(row) {
    // Converte uma linha do banco para o formato JSON que o front recebe.
    // password_hash nunca entra aqui: o hash da senha não sai do servidor.
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      active: Boolean(row.active),
      // active vem do banco como 0 ou 1; Boolean() transforma em false/true.
      createdAt: row.created_at,
    };
  }

  // ---------- GET /api/clients ----------

  router.get("/", authenticate(STAFF_ROLES), async (req, res) => {
    // authenticate(STAFF_ROLES) roda ANTES: sem token válido de colaborador
    // ou admin, a resposta já é 401/403 e o código abaixo nem executa.
    try {
      await ensureActiveColumn();
      const pool = getPool();

      const [rows] = await pool.query(
        "SELECT id, name, email, phone, active, created_at FROM clients ORDER BY created_at DESC, id DESC LIMIT ?",
        [MAX_CLIENTS],
      );
      // Escolhemos as colunas uma a uma (password_hash fica de fora).

      const [[summary]] = await pool.query(
        "SELECT COUNT(*) AS total, COALESCE(SUM(active = 1), 0) AS active, COALESCE(SUM(created_at >= NOW() - INTERVAL 30 DAY), 0) AS recent FROM clients",
      );
      // Uma segunda consulta conta TODOS os clientes (não só os 500 da lista):
      // o total, quantos estão ativos e quantos chegaram nos últimos 30 dias.

      return res.json({
        clients: rows.map(toApi),
        summary: {
          total: Number(summary.total),
          active: Number(summary.active),
          newLast30Days: Number(summary.recent),
          // Number(): o MySQL pode devolver contagens como texto.
        },
      });
    } catch (error) {
      console.error("Erro ao listar clientes:", error);
      return res.status(500).json({ error: "Erro interno ao listar clientes." });
    }
  });

  // ---------- PATCH /api/clients/:id/status ----------

  router.patch("/:id/status", authenticate(STAFF_ROLES), async (req, res) => {
    // Inativa ou reativa um cliente. Nada é apagado: o cadastro, o histórico e
    // o login continuam existindo. É só uma marca de "cliente parado".
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Identificador inválido." });
    }

    const active = req.body && req.body.active;
    if (typeof active !== "boolean") {
      return res.status(400).json({ error: "Informe active como verdadeiro ou falso." });
    }
    // Exigimos true/false de verdade. Texto como "sim" ou número é recusado.

    try {
      await ensureActiveColumn();
      const pool = getPool();

      await pool.query("UPDATE clients SET active = ? WHERE id = ?", [active ? 1 : 0, id]);

      const [rows] = await pool.query(
        "SELECT id, name, email, phone, active, created_at FROM clients WHERE id = ?",
        [id],
      );
      // Relemos o cliente depois de gravar. Assim a resposta é sempre o estado
      // real do banco, e um id que não existe vira 404 abaixo.
      if (rows.length === 0) {
        return res.status(404).json({ error: "Cliente não encontrado." });
      }

      return res.json({ client: toApi(rows[0]) });
    } catch (error) {
      console.error("Erro ao alterar status do cliente:", error);
      return res.status(500).json({ error: "Erro interno ao alterar o cliente." });
    }
  });

  return router;
}

module.exports = createClientsRouter;
