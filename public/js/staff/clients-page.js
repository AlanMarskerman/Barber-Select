// public/js/staff/clients-page.js
// Tela de Clientes (colaborador/admin): lista os clientes cadastrados no MySQL
// (GET /api/clients), preenche os cards de resumo e permite INATIVAR ou
// REATIVAR um cliente (PATCH /api/clients/:id/status) sem apagar nada.
//
// Depende de dois scripts que a página carrega ANTES dele:
// - /js/core/shared.js: fornece authenticatedFetch() (fetch com o token de
//   login e renovação automática) e logout();
// - /js/staff/staff-app.js: exige login de colaborador/admin na página.
//
// Todo texto vindo da API entra na tela com textContent (nunca innerHTML),
// para que um nome com "<" ou aspas não vire código na página.

(function () {
  const tbody = document.getElementById("clients-body");
  if (!tbody) return;
  // Se a página não tiver a tabela esperada, não faz nada.

  const searchInput = document.getElementById("client-search");
  const statusFilter = document.getElementById("client-status-filter");
  const message = document.getElementById("clients-message");

  const dateFormat = new Intl.DateTimeFormat("pt-BR");
  // Formata datas no padrão brasileiro: 10/10/2026.

  let clients = [];
  // Lista de clientes da última resposta da API.

  const logoutButton = document.querySelector(".logout");
  if (logoutButton) logoutButton.addEventListener("click", logout);
  // O botão "Sair" do mockup não tinha ação; ligamos ao logout() do shared.js.

  // ---------- Utilitários ----------

  function makeElement(tag, text, className) {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  }

  function setText(id, text) {
    const element = document.getElementById(id);
    if (element) element.textContent = text;
  }

  function showMessage(text, type) {
    message.textContent = text;
    message.className = `cli-message ${type}`;
    message.hidden = false;
  }

  function hideMessage() {
    message.hidden = true;
    message.textContent = "";
  }

  // ---------- Cards de resumo ----------

  function updateCards(summary) {
    setText("cli-total", String(summary.total));
    setText("cli-new", String(summary.newLast30Days));
    setText("cli-active", String(summary.active));
    const percent = summary.total > 0 ? Math.round((summary.active / summary.total) * 100) : 0;
    setText("cli-active-pct", `${percent}%`);
    // Percentual de clientes ativos sobre o total.
  }

  function updateCardsFromList() {
    // Depois de inativar/reativar, recalcula só o que mudou, sem nova consulta.
    const active = clients.filter((client) => client.active).length;
    setText("cli-active", String(active));
    const total = Number(document.getElementById("cli-total").textContent) || clients.length;
    setText("cli-active-pct", `${total > 0 ? Math.round((active / total) * 100) : 0}%`);
  }

  // ---------- Tabela ----------

  function renderEmpty(text) {
    tbody.replaceChildren();
    const row = document.createElement("tr");
    const cell = makeElement("td", text, "cli-empty");
    cell.colSpan = 5;
    row.appendChild(cell);
    tbody.appendChild(row);
  }

  function buildRow(client) {
    const row = document.createElement("tr");
    if (!client.active) row.className = "is-inactive";

    const nameCell = document.createElement("td");
    nameCell.appendChild(makeElement("b", client.name));
    nameCell.appendChild(document.createElement("br"));
    nameCell.appendChild(makeElement("small", client.email));

    const phoneCell = makeElement("td", client.phone, "num");

    const date = new Date(client.createdAt);
    const dateCell = makeElement("td", Number.isNaN(date.getTime()) ? "—" : dateFormat.format(date), "num");

    const statusCell = document.createElement("td");
    statusCell.appendChild(
      makeElement("span", client.active ? "Ativo" : "Inativo", client.active ? "pill green" : "pill yellow"),
    );

    const actionsCell = makeElement("td", undefined, "actions");
    const toggleButton = makeElement(
      "button",
      client.active ? "Inativar" : "Reativar",
      client.active ? "cli-btn cli-btn-danger" : "cli-btn",
    );
    toggleButton.type = "button";
    toggleButton.addEventListener("click", () => changeStatus(client, !client.active));
    actionsCell.appendChild(toggleButton);

    row.append(nameCell, phoneCell, dateCell, statusCell, actionsCell);
    return row;
  }

  function render() {
    const term = searchInput.value.trim().toLowerCase();
    const filter = statusFilter.value;
    // Busca simples na própria tela, por nome, e-mail ou telefone, junto com o
    // filtro de situação (todos / ativos / inativos).

    const visible = clients.filter((client) => {
      if (filter === "active" && !client.active) return false;
      if (filter === "inactive" && client.active) return false;
      return [client.name, client.email, client.phone].some((field) => String(field).toLowerCase().includes(term));
    });

    if (clients.length === 0) {
      renderEmpty("Nenhum cliente cadastrado ainda.");
    } else if (visible.length === 0) {
      renderEmpty("Nenhum cliente encontrado para esse filtro.");
    } else {
      tbody.replaceChildren(...visible.map(buildRow));
    }
  }

  // ---------- Chamadas à API ----------

  async function readJson(response) {
    try {
      return await response.json();
    } catch (error) {
      return {};
      // Resposta sem JSON: segue com objeto vazio.
    }
  }

  async function loadClients() {
    try {
      const response = await authenticatedFetch("/api/clients");
      if (!response) return;
      // null = sessão expirou (o shared.js já mandou para o login).

      const data = await readJson(response);

      if (!response.ok) {
        renderEmpty("Não foi possível carregar os clientes.");
        showMessage(data.error || "Não foi possível carregar os clientes.", "error");
        return;
      }

      clients = data.clients || [];
      updateCards(data.summary || { total: clients.length, active: 0, newLast30Days: 0 });
      render();
    } catch (error) {
      console.error("Erro ao carregar clientes:", error);
      renderEmpty("Não foi possível carregar os clientes.");
      showMessage("Não foi possível conectar ao servidor.", "error");
    }
  }

  async function changeStatus(client, makeActive) {
    if (!makeActive && !window.confirm(`Inativar "${client.name}"? O cadastro continua salvo e pode ser reativado depois.`)) {
      return;
    }
    hideMessage();

    try {
      const response = await authenticatedFetch(`/api/clients/${client.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: makeActive }),
      });
      if (!response) return;

      const data = await readJson(response);

      if (!response.ok) {
        showMessage(data.error || "Não foi possível alterar o cliente.", "error");
        return;
      }

      client.active = data.client.active;
      // Atualiza o cliente na lista local com o que o servidor gravou.
      updateCardsFromList();
      render();
      showMessage(client.active ? "Cliente reativado." : "Cliente inativado.", "success");
    } catch (error) {
      console.error("Erro ao alterar cliente:", error);
      showMessage("Não foi possível conectar ao servidor.", "error");
    }
  }

  searchInput.addEventListener("input", render);
  statusFilter.addEventListener("change", render);

  loadClients();
  // Ao abrir a página, carrega a lista.
})();
