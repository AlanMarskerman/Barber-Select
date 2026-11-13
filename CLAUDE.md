# CLAUDE.md — Barber Select

Project context for Claude Code sessions.

## 1. Visão Geral
- **Plataforma**: Gestão inteligente para barbearias (PT-BR).
- **Stack**: Node.js + Express 5 (Backend), HTML/CSS/JS puro com design system unificado (Frontend), MySQL (`mysql2/promise`).
- **Perfis**: `client` (self-service / área do cliente completa), `staff` (colaborador), `admin` (proprietário).

## 2. Comandos e Ambiente
```bash
npm install            # Instala dependências
npm start              # Produção (node server.js)
npm run dev            # Desenvolvimento (node --watch server.js)
```
- **Variáveis de ambiente (`.env`)**:
  `PORT=3000`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, além de credenciais de fallback (`CLIENT_LOGIN`, `STAFF_LOGIN`, `ADMIN_LOGIN`).
- **Banco de dados**: MySQL local. Tabelas principais: `clients`, `staff_users`, `services`, `appointments`, `products`, `transactions`, `sales`.

## 3. Arquitetura e Estrutura Principal
- `server.js`: Entrada do Express, rotas de autenticação (`/auth/*`), saúde (`/api/health`) e registro (`/api/register`).
- `features/`: Módulos de backend:
  - `cadastro-mysql`: Autenticação e registro exclusivo de clientes e equipe.
  - `clientes-mysql`: Gestão e perfil completo de clientes (`/api/clients`, `/api/clients/me`).
  - `servicos-mysql`: Catálogo de serviços (`/api/services`).
  - `agenda-mysql`: Agendamentos sincronizados com o caixa (`/api/appointments`).
  - `produtos-mysql`: Controle de estoque e preços (`/api/products`).
  - `financeiro-mysql`: Transações de entradas e saídas (`/api/finance`).
  - `vendas-mysql`: PDV integrado ao estoque e financeiro (`/api/sales`).
- `public/`: Frontend estático.
  - `index.html`: Landing page modernizada (fontes DM Sans & Playfair Display).
  - `pages/`: Páginas públicas (`login.html`, `cadastro.html`).
  - `client/`: Área do cliente (`home.html`, `request.html`, `profile.html`, `settings.html`).
  - `staff/`: Área do staff/admin (`dashboard.html`, `agenda.html`, `clients.html`, `barbeiros.html`, `services.html`, `produtos.html`, `venda.html`, `finance.html`, etc.).
  - `js/core/shared.js`: Autenticação compartilhada, sessão (`sessionStorage`), refresh tokens, logout unificado.

## 4. Autenticação e Segurança
- **Mecanismo**: JWT access tokens (15 min) + refresh tokens (7 dias). Sessões em memória (`activeSessions`) e token blacklist.
- **Login unificado** (`/auth/login/unified`): Tenta MySQL (`clients`), MySQL (`staff_users`), e fallback `.env`.
- **Middleware**: `authenticate(requiredRoles)` em rotas protegidas.
- **Segurança**: Helmet (CSP), rate-limiting em login/cadastro, bcrypt (custo 10), queries parametrizadas.

## 5. Diretrizes para Modificações
1. **Preserve alterações locais** e verifique os arquivos existentes antes de editar.
2. **Backend**: `server.js` e `features/*` afetam todos os perfis.
3. **Frontend**: Carregue sempre `shared.js` antes dos scripts específicos de página (`client-app.js` ou `staff-app.js`).
4. **Design System**: Mantenha a identidade visual unificada (cores `--green`, `--gold`, tipografia Playfair Display e DM Sans).
