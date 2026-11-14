# Credenciais de Debug e Acesso Padrão — Barber Select

Este documento lista as contas de teste disponíveis no ambiente de desenvolvimento.

## Como funciona o login

O endpoint `/auth/login/unified` consulta **apenas o MySQL** (tabelas `clients` e
`staff_users`). As variáveis `CLIENT_LOGIN` / `STAFF_LOGIN` / `ADMIN_LOGIN` do
`.env` **não são mais usadas** — foram removidas pela refatoração de segurança
(commit `994fd3d`) justamente para eliminar a porta traseira apontada na auditoria.

O login aceita e-mail **ou** username, conforme a tabela:

- `clients` → só por e-mail (o `clientLogin` ignora identidades sem `@`).
- `staff_users` → por e-mail ou username (coluna `username`).

## Contas atuais no banco `barber_select`

| Perfil | E-mail / Usuário | Senha | Origem |
|---|---|---|---|
| Admin | `admin@barberselect.local` ou `admin` | `AdminPassword2026!` | Seed `staff-table.js` |
| Staff | `staff@barberselect.local` ou `staff` | `StaffPassword2026!` | Seed `staff-table.js` |
| Cliente | `cliente@barberselect.local` | `ClientePassword2026!` | Criado manualmente (este doc) |

> **Não use** `cliente` / `colaborador` / `admin` com `123456` — essas são as
> credenciais legadas do `.env` que **não funcionam mais** no login unificado.

## Recriando as contas seed

O seeding automático só roda se **ambos** estiverem definidos no `.env`:

```
ALLOW_DEFAULT_SEED=true
SEED_ADMIN_PASSWORD=<senha>=8+ caracteres
```

Com `staff_users` vazio, o servidor cria admin + staff com essas senhas na
primeira requisição que tocar a tabela. Sem isso, crie as contas à mão:

```sql
INSERT INTO staff_users (name, email, username, phone, password_hash, role, active)
VALUES ('Administrador Master', 'admin@barberselect.local', 'admin', '11999999999',
        '<bcrypt de AdminPassword2026!>', 'admin', 1);
```

Para criar um cliente de teste, use a página `/pages/cadastro.html` ou a API:

```
POST /api/register
{ "name": "Cliente de Teste", "email": "cliente@barberselect.local",
  "phone": "11999999999", "password": "ClientePassword2026!" }
```

---
*Nota: estas contas são para ambiente de desenvolvimento. Nunca commite senhas
reais nem reative o fallback do `.env` em produção — isso viola a LGPD e
reintroduz a porta traseira documentada na auditoria.*
