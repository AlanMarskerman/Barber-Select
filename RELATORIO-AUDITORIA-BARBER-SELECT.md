# Relatório de Auditoria Técnica — Barber Select
**Papéis:** Engenheiro de Software Sênior | Arquiteto de Banco de Dados | Especialista em AppSec  
**Data:** 13 de Novembro de 2026  
**Escopo:** Auditoria profunda do repositório backend (`server.js`, `features/`) e frontend (`public/`).

---

## 📊 1. Resumo Executivo (Notas por Pilar)

| Pilar Crítico | Nota (0–10) | Status | Justificativa Resumida |
| :--- | :---: | :---: | :--- |
| **1. Segurança, Autenticação e RBAC** | **8.0 / 10** | 🟡 Bom | Uso correto de JWT, *bcrypt* com hash falso contra timing attacks, prepared statements (`?`) consistentes. Contudo, sessões em memória simples e ausência de proteção CSRF em APIs baseadas em sessão sem *cookie* HTTP-only. |
| **2. Integridade de Dados e Transações (ACID)** | **5.5 / 10** | 🔴 Crítico | Ausência de transações atômicas (`BEGIN / COMMIT / ROLLBACK`) ao registrar vendas (`sales-routes.js`) e concluir agendamentos (`appointments-routes.js`) com impactos no financeiro. Falta de controle de concorrência (*double-booking* e estoque). |
| **3. Arquitetura, Qualidade e Performance** | **6.5 / 10** | 🟡 Regular | Boa modularização em `features/`, mas gerenciamento de sessão em memória (`activeSessions`) impede escalabilidade horizontal (cluster/PM2). Algumas queries sem índices compostos ideais. |
| **4. Frontend, UX e Responsividade** | **8.5 / 10** | 🟢 Excelente | Design System unificado coeso (*Playfair Display*, *DM Sans*, paleta verde/dourado), tratamento de 401 com refresh automático no `shared.js`. Risco menor pelo uso de `sessionStorage`. |
| **5. Conformidade LGPD e Boas Práticas** | **6.0 / 10** | 🟡 Regular | Armazenamento de dados pessoais sensíveis (`cpf`, `birthdate`, `skin_notes`) sem política explícita de retenção, mascaramento ou exclusão por solicitação do titular (direito ao esquecimento). |

---

## 🚨 2. Vulnerabilidades e Bugs Críticos (P0 / P1)

### [P0-01] Ausência de Transações Atômicas em Vendas e Conclusão de Agendamentos
* **Arquivos e Linhas:** `features/vendas-mysql/sales-routes.js:66-102` e `features/agenda-mysql/appointments-routes.js:141-184`.
* **Risco Real:** Inconsistência financeira e contábil grave na barbearia.
* **Cenário de Falha / Exploit:** 
  1. Em `sales-routes.js`, o sistema insere uma venda na tabela `sales` e, em seguida, insere uma transação correspondente na tabela `transactions`. 
  2. Se ocorrer uma falha de conexão com o banco ou erro de validação na segunda query (`transactions`), a venda é gravada no sistema, mas **nenhuma entrada financeira é gerada no caixa**. O faturamento diário ficará desatualizado e inferior ao realizado.
  3. O mesmo ocorre ao concluir um agendamento em `appointments-routes.js`: o status do agendamento é alterado para `concluido`, mas se a inserção na tabela `transactions` falhar, o serviço prestado não entra no caixa sem que haja reversão (`ROLLBACK`).

### [P1-02] Risco de *Double-Booking* (Concorrência de Agendamentos)
* **Arquivo e Linha:** `features/agenda-mysql/appointments-routes.js:87-138`.
* **Risco Real:** Dois clientes (ou um recepcionista e um cliente) agendarem o mesmo barbeiro para exatamente o mesmo horário (`appointment_date` + `appointment_time`), gerando conflito de atendimento físico na barbearia.
* **Cenário de Falha:** 
  O método `POST /api/appointments` apenas executa um `INSERT` direto sem verificar se já existe um registro ativo para o mesmo `staff_name` (ou `staff_id`) na mesma data e horário. Duas requisições simultâneas passam livremente.

### [P1-03] Armazenamento de Tokens e Credenciais em `sessionStorage`
* **Arquivo e Linha:** `public/js/core/shared.js:11-19`.
* **Risco Real:** Exposição de tokens JWT (`accessToken`, `refreshToken`) a ataques de XSS (*Cross-Site Scripting*).
* **Cenário de Falha:** 
  Caso haja alguma vulnerabilidade de injeção de script nas telas (ex: campos de observações da pele `skin_notes` ou nomes de clientes refletidos sem sanitização no DOM), um script malicioso executado no navegador pode ler o `sessionStorage` e roubar os tokens de autenticação da sessão ativa.

---

## 🛠️ 3. Melhorias de Arquitetura e Performance (P2)

1. **Gestão de Sessões Distribuída:**
   - Atualmente, `activeSessions` e `tokenBlacklist` são mantidos em memória RAM (`Map` e `Set` em `server.js`). Se a aplicação for executada em múltiplas instâncias ou reiniciar, todas as sessões ativas são perdidas. **Recomendação:** Migrar o controle de sessões e blacklist para o Redis ou para uma tabela dedicada no MySQL.
2. **Índices Compostos no Banco de Dados:**
   - Para consultas frequentes de agenda por barbeiro e data, adicionar um índice composto na tabela `appointments`:
     ```sql
     ALTER TABLE appointments ADD INDEX idx_staff_datetime (staff_name, appointment_date, appointment_time);
     ```
3. **Baixa Automática de Estoque em Vendas:**
   - O módulo de vendas (`sales-routes.js`) atualmente registra a venda e o financeiro, mas **não abate o estoque do produto** correspondente na tabela `products`. É necessário associar o item vendido ao estoque e dar baixa automática em transação atômica.

---

## 📋 4. Plano de Ação Priorizado (Checklist)

- [x] **Fase 0:** Auditoria completa e relatório gerado.
- [x] **Fase 1 (Integridade ACID):** Refatorar `sales-routes.js` e `appointments-routes.js` para utilizar transações explícitas (`pool.getConnection()`, `connection.beginTransaction()`, `COMMIT`, `ROLLBACK`, `connection.release()`).
- [x] **Fase 2 (Concorrência):** Adicionar validação prévia de conflito de horário com lock (`FOR UPDATE`) e verificação de agendamentos ativos para evitar *double-booking* por barbeiro/data/horário.
- [x] **Fase 3 (Estoque):** Integrar o PDV de vendas (`sales-routes.js`) com a baixa automática de estoque na tabela `products` dentro da mesma transação ACID.
- [x] **Fase 4 (Segurança & Autenticação):** Revisão de RBAC, sanitização, criptografia bcrypt e proteção de rotas.
- [x] **Fase 5 (Conformidade LGPD):** Implementação de endpoints de exportação de dados pessoais (`GET /api/clients/me/export`) e direito ao esquecimento/anonimização (`DELETE /api/clients/me`).
