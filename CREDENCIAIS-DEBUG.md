# Credenciais de Debug e Acesso Padrão — Barber Select

Este documento lista as contas padrão criadas automaticamente pelo sistema (via *database seeding*) no primeiro acesso ou inicialização do banco de dados MySQL.

## 🔐 Contas Padrão (Ambiente de Desenvolvimento / Debug)

### 1. Administrador (Dono)
* **E-mail / Usuário**: `admin@barberselect.local` ou `admin`
* **Senha**: `AdminPassword2026!`
* **Perfil**: `admin` (Acesso completo a todas as áreas, relatórios, configurações e gestão de equipe).

### 2. Colaborador (Staff / Barbeiro)
* **E-mail / Usuário**: `staff@barberselect.local` ou `staff`
* **Senha**: `StaffPassword2026!`
* **Perfil**: `staff` (Acesso à agenda, atendimento e PDV).

### 3. Cliente de Teste
Você pode se cadastrar livremente na página de cadastro (`/pages/cadastro.html`) para testar a Área do Cliente.

---
*Nota: Estas credenciais são injetadas automaticamente caso a tabela `staff_users` esteja vazia, garantindo que o sistema funcione imediatamente sem dependência de variáveis de ambiente estáticas no `.env`.*
