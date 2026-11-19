# Barber Select

Sistema web para agendamento e gestão de barbearia. Clientes solicitam horários pelo portal; a equipe organiza a agenda, cadastra clientes e serviços, controla estoque, registra vendas e acompanha o financeiro em um único painel.

A aplicação usa Node.js e Express na API, MySQL ou MariaDB no banco e HTML, CSS e JavaScript no frontend. O banco e as tabelas são criados na inicialização, sem etapas manuais no phpMyAdmin.

## Requisitos

- Node.js 20 ou superior
- MySQL ou MariaDB (o XAMPP fornece MariaDB no Windows)
- npm

## Instalação

No Windows, com o XAMPP instalado:

1. Abra o XAMPP Control Panel e inicie o módulo **MySQL**.
2. No terminal, entre na pasta do projeto e execute:

```powershell
npm install
Copy-Item .env.example .env
node server.js
```

3. Acesse `http://localhost:3000`.

Em Linux ou macOS, use `cp .env.example .env` no lugar de `Copy-Item`. Se a porta 3000 estiver ocupada, altere `PORT` no `.env`.

### Variáveis de ambiente

| Variável | Padrão | Uso |
| --- | --- | --- |
| `PORT` | `3000` | Porta da API |
| `JWT_SECRET` | obrigatório | Segredo do access token, com pelo menos 32 caracteres |
| `JWT_REFRESH_SECRET` | derivado | Segredo do refresh token |
| `DB_HOST` | `localhost` | Host do MySQL |
| `DB_PORT` | `3306` | Porta do MySQL |
| `DB_USER` | `root` | Usuário do banco |
| `DB_PASSWORD` | vazio | Senha do banco; no XAMPP é vazia por padrão |
| `DB_NAME` | `barber_select` | Nome do banco criado automaticamente |
| `ALLOW_DEFAULT_SEED` | `false` | Autoriza a criação das contas iniciais |
| `SEED_ADMIN_PASSWORD` | — | Senha do administrador criado no seed |

## Banco de dados automático

`features/shared/init-db.js` prepara o banco antes de abrir a porta. A rotina:

1. Executa `CREATE DATABASE IF NOT EXISTS barber_select`;
2. Cria, com `CREATE TABLE IF NOT EXISTS`, as tabelas `staff_users`, `clients`, `services`, `products`, `appointments`, `transactions`, `sales` e `access_audit`;
3. Verifica colunas acrescentadas em versões posteriores;
4. Insere administrador, colaborador, cliente e catálogo inicial quando as tabelas estão vazias.

O processo é idempotente. Reiniciar o servidor não duplica registros.

## Contas de demonstração

| Perfil | Usuário | Senha |
| --- | --- | --- |
| Administrador | `admin` ou `admin@barberselect.local` | `AdminPassword2026!` |
| Colaborador | `staff` ou `staff@barberselect.local` | `StaffPassword2026!` |
| Cliente | `cliente@barberselect.local` | `ClientePassword2026!` |

Clientes adicionais são criados em `/pages/cadastro.html`. O login unificado consulta apenas o banco de dados; as credenciais antigas do `.env` não são aceitas.

## Perfis

| Perfil | Acesso |
| --- | --- |
| Cliente | Solicita horários, consulta agendamentos e edita o próprio perfil |
| Colaborador | Administra agenda, clientes, serviços, produtos e vendas |
| Administrador | Acessa também financeiro, relatórios, equipe e configurações |

## Fluxo de agendamento

1. O cliente entra no portal e escolhe serviço, profissional, data e horário.
2. A solicitação é gravada na tabela `appointments` com status `confirmado` ou `pendente`.
3. A equipe acompanha os atendimentos em `/staff/agenda.html` e altera o status.
4. Ao concluir um atendimento, o sistema lança a receita na tabela `transactions`.

## Funcionalidades

- Agenda com filtros por data, profissional e status
- Cadastro de clientes, serviços, produtos e membros da equipe
- Vendas com baixa de estoque e lançamento automático no financeiro
- Controle de entradas, saídas e saldo
- Autenticação por perfil com tokens JWT e renovação automática
- Layout responsivo com navegação inferior no portal do cliente

## Capturas de tela

### Landing e autenticação

![Landing page](docs/screenshots/landing.png)
![Login](docs/screenshots/login.png)
![Login por perfil](docs/screenshots/auth.png)
![Cadastro de cliente](docs/screenshots/cadastro.png)

### Painel da equipe

![Dashboard](docs/screenshots/dashboard.png)
![Agenda](docs/screenshots/agenda.png)
![Clientes](docs/screenshots/clientes.png)
![Barbeiros](docs/screenshots/barbeiros.png)
![Serviços](docs/screenshots/servicos.png)
![Produtos](docs/screenshots/produtos.png)
![Vendas](docs/screenshots/vendas.png)
![Financeiro](docs/screenshots/financeiro.png)
![Novo cliente](docs/screenshots/novocliente.png)
![Novo agendamento](docs/screenshots/novagendamento.png)
![Agenda legada padronizada](docs/screenshots/appointments.png)
![Configurações](docs/screenshots/settings.png)

### Portal do cliente

![Início do cliente](docs/screenshots/cliente-home.png)

### Versão mobile

![Landing no mobile](docs/screenshots/mobile-landing.png)
![Dashboard no mobile](docs/screenshots/mobile-dashboard.png)
![Agenda no mobile](docs/screenshots/mobile-agenda.png)
![Novo agendamento no mobile](docs/screenshots/mobile-novagendamento.png)
![Financeiro no mobile](docs/screenshots/mobile-financeiro.png)
![Início do cliente no mobile](docs/screenshots/mobile-cliente-home.png)

## Testes

Com o banco em execução e a API iniciada:

```powershell
$env:BASE_URL="http://localhost:3000"
$env:STAFF_IDENTITY="admin"
$env:STAFF_PASSWORD="AdminPassword2026!"
npm test
```

A suíte cobre validação de regras, autorização, login e o endpoint `/api/dashboard`. Para executar o teste de integração isoladamente:

```powershell
node test/dashboard-integration.test.js
```

## Segurança

- As permissões são verificadas no servidor; o frontend apenas esconde o que o perfil não usa.
- Tokens de acesso expiram em 15 minutos e são renovados por refresh token com rotação.
- O login tem limite de tentativas e bloqueio temporário por identidade.
- A política de CSP mantém as diretivas padrão do helmet, com liberação de scripts inline exigida pelo HTML estático atual.
- Senhas são armazenadas como hash bcrypt.

## Estrutura

```
server.js                    API, autenticação e configuração de segurança
features/shared/init-db.js   Criação do banco, tabelas e dados iniciais
features/*-mysql/            Rotas e SQL por domínio
public/index.html            Landing page
public/pages/                Login e cadastro
public/staff/                Painel da equipe
public/client/               Portal do cliente
test/                        Testes automatizados
docs/screenshots/            Capturas de tela
```
