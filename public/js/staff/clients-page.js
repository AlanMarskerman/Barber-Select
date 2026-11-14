// public/js/staff/clients-page.js
// Tela de Clientes (colaborador/admin): lista os clientes cadastrados no MySQL
// (GET /api/clients), preenche os cards de resumo e permite INATIVAR ou
// REATIVAR um cliente (PATCH /api/clients/:id/status) de forma segura e sem inline handlers.
//
// Depende de:
// - /js/core/shared.js: authenticatedFetch(), logout(), requireAuth()
// - /js/staff/staff-app.js: estrutura base da aplicação

(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", () => {
    const tbody = document.getElementById("clients-tbody") || document.getElementById("clients-body");
    if (!tbody) return;

    const searchInput = document.getElementById("search-client") || document.getElementById("client-search");
    const statusFilter = document.getElementById("client-status-filter");
    const message = document.getElementById("clients-message");

    const dateFormat = new Intl.DateTimeFormat("pt-BR");
    let clients = [];

    // ---------- Utilitários ----------

    function makeElement(tag, text, className) {
      const element = document.createElement(tag);
      if (text !== undefined && text !== null) element.textContent = text;
      if (className) element.className = className;
      return element;
    }

    function setText(id, text) {
      const element = document.getElementById(id);
      if (element) element.textContent = text;
    }

    function showMessage(text, type) {
      if (!message) return;
      message.textContent = text;
      message.className = `cli-message ${type}`;
      message.hidden = false;
    }

    function hideMessage() {
      if (!message) return;
      message.hidden = true;
      message.textContent = "";
    }

    // ---------- Cards de resumo ----------

    function updateCards(summary) {
      const total = summary.total || 0;
      const active = summary.active || 0;
      const recent = summary.newLast30Days || 0;

      setText("clients-total", String(total));
      setText("cli-total", String(total));

      setText("clients-active", String(active));
      setText("cli-active", String(active));

      setText("clients-recent", String(recent));
      setText("cli-new", String(recent));

      const percent = total > 0 ? Math.round((active / total) * 100) : 0;
      setText("cli-active-pct", `${percent}%`);
    }

    function updateCardsFromList() {
      const active = clients.filter((c) => c.active).length;
      setText("clients-active", String(active));
      setText("cli-active", String(active));

      const total = clients.length;
      setText("clients-total", String(total));
      setText("cli-total", String(total));

      const percent = total > 0 ? Math.round((active / total) * 100) : 0;
      setText("cli-active-pct", `${percent}%`);
    }

    // ---------- Tabela ----------

    function renderEmpty(text) {
      tbody.replaceChildren();
      const row = document.createElement("tr");
      const cell = makeElement("td", text, "empty-cell");
      cell.colSpan = 6;
      cell.style.textAlign = "center";
      cell.style.padding = "40px";
      cell.style.color = "var(--muted, #666)";
      row.appendChild(cell);
      tbody.appendChild(row);
    }

    function buildRow(client) {
      const row = document.createElement("tr");
      if (!client.active) row.className = "is-inactive";

      // 1. Nome
      const nameCell = document.createElement("td");
      nameCell.appendChild(makeElement("strong", client.name));

      // 2. E-mail
      const emailCell = document.createElement("td");
      emailCell.textContent = client.email || "—";

      // 3. Telefone
      const phoneCell = document.createElement("td");
      phoneCell.textContent = client.phone || "—";

      // 4. Status
      const statusCell = document.createElement("td");
      const statusPill = makeElement(
        "span",
        client.active ? "Ativo" : "Inativo",
        `pill ${client.active ? "ativo" : "inativo"}`
      );
      statusCell.appendChild(statusPill);

      // 5. Data de Cadastro
      const dateCell = document.createElement("td");
      const date = client.createdAt ? new Date(client.createdAt) : null;
      const formattedDate = date && !Number.isNaN(date.getTime()) ? dateFormat.format(date) : "—";
      const smallDate = makeElement("small", formattedDate);
      dateCell.appendChild(smallDate);

      // 6. Ações (Inativar/Reativar com addEventListener limpo - sem inline handler)
      const actionsCell = document.createElement("td");
      const toggleButton = makeElement(
        "button",
        client.active ? "Inativar" : "Reativar",
        "btn-action"
      );
      toggleButton.type = "button";
      toggleButton.addEventListener("click", () => changeStatus(client, !client.active));
      actionsCell.appendChild(toggleButton);

      row.append(nameCell, emailCell, phoneCell, statusCell, dateCell, actionsCell);
      return row;
    }

    function render() {
      const term = searchInput ? searchInput.value.trim().toLowerCase() : "";
      const filter = statusFilter ? statusFilter.value : "all";

      const visible = clients.filter((client) => {
        if (filter === "active" && !client.active) return false;
        if (filter === "inactive" && client.active) return false;
        if (!term) return true;
        return (
          (client.name && client.name.toLowerCase().includes(term)) ||
          (client.email && client.email.toLowerCase().includes(term)) ||
          (client.phone && client.phone.includes(term))
        );
      });

      if (clients.length === 0) {
        renderEmpty("Nenhum cliente cadastrado.");
      } else if (visible.length === 0) {
        renderEmpty("Nenhum cliente encontrado com os filtros aplicados.");
      } else {
        tbody.replaceChildren(...visible.map(buildRow));
      }
    }

    // ---------- Chamadas à API ----------

    async function loadClients() {
      try {
        const response = await authenticatedFetch("/api/clients");
        if (!response) return;

        if (!response.ok) {
          renderEmpty("Não foi possível carregar os clientes.");
          showMessage("Não foi possível carregar os clientes.", "error");
          return;
        }

        const data = await response.json();
        clients = data.clients || [];
        updateCards(data.summary || { total: clients.length, active: 0, newLast30Days: 0 });
        render();
      } catch (error) {
        console.error("Erro ao carregar clientes:", error);
        renderEmpty("Erro ao carregar lista de clientes.");
        showMessage("Não foi possível conectar ao servidor.", "error");
      }
    }

    async function changeStatus(client, makeActive) {
      if (
        !makeActive &&
        !window.confirm(`Deseja inativar o cliente "${client.name}"? O cadastro continuará salvo no sistema.`)
      ) {
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

        if (!response.ok) {
          alert("Não foi possível alterar o status do cliente.");
          return;
        }

        const data = await response.json();
        client.active = data.active;
        updateCardsFromList();
        render();
      } catch (error) {
        console.error("Erro ao alterar status do cliente:", error);
        alert("Erro ao conectar com o servidor.");
      }
    }

    if (searchInput) {
      searchInput.addEventListener("input", render);
    }
    if (statusFilter) {
      statusFilter.addEventListener("change", render);
    }

    loadClients();
  });
})();
