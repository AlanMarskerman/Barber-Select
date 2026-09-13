// js/shared.js
// Lógica comum a todas as páginas internas (sidebar, sessão, logout).

const icon = {
  home: "\u2302",
  calendar: "\u25F7",
  clients: "\u2659",
  services: "\u2702",
  finance: "\u20BF",
  profile: "\u25C9",
  settings: "\u2699",
  logout: "\u21AA",
};

function getSession() {
  return {
    token: sessionStorage.getItem("token"),
    role: sessionStorage.getItem("role"),
  };
}

// Redireciona para o login se não houver sessão válida para a página atual
function requireAuth(expectedRole) {
  const { token, role } = getSession();
  if (!token || (expectedRole && role !== expectedRole)) {
    window.location.href = resolveAuthPath();
  }
}

function resolveAuthPath() {
  // Calcula caminho relativo até pages/auth.html a partir de client/ ou staff/
  return "../pages/auth.html";
}

function logout() {
  sessionStorage.removeItem("token");
  sessionStorage.removeItem("role");
  window.location.href = "../index.html";
}

const NAV_ITEMS = {
  client: [
    { route: "home.html", icon: "home", label: "Início" },
    { route: "request.html", icon: "calendar", label: "Agendar" },
    { route: "profile.html", icon: "profile", label: "Perfil" },
  ],
  staff: [
    { route: "dashboard.html", icon: "home", label: "Visão geral" },
    { route: "appointments.html", icon: "calendar", label: "Agenda" },
    { route: "clients.html", icon: "clients", label: "Clientes" },
    { route: "services.html", icon: "services", label: "Serviços" },
  ],
  admin: [
    { route: "finance.html", icon: "finance", label: "Financeiro" },
    { route: "dashboard.html", icon: "home", label: "Resumo" },
  ],
};

function renderSidebar(role, currentPage) {
  const container = document.getElementById("sidebar");
  if (!container) return;

  const items = NAV_ITEMS[role] || [];
  const navHtml = items
    .map(
      (item) => `
      <a class="nav-item ${item.route === currentPage ? "active" : ""}" href="${item.route}">
        <span>${icon[item.icon]}</span>
        <span class="nav-label">${item.label}</span>
      </a>`,
    )
    .join("");

  container.innerHTML = `
    <div class="mark">
      <span class="mark-symbol"><span>B</span></span>
      <span>BARBER-SELECT</span>
    </div>
    <nav class="sidebar-nav">${navHtml}</nav>
    <div style="margin-top:auto;border-top:1px solid rgba(255,255,255,.2);padding-top:14px">
      <a class="nav-item" href="settings.html">
        <span>${icon.settings}</span><span class="nav-label">Configurações</span>
      </a>
      <button class="nav-item" id="logout-btn">
        <span>${icon.logout}</span><span class="nav-label">Sair</span>
      </button>
    </div>
  `;

  document.getElementById("logout-btn").addEventListener("click", logout);
}

function renderTopbar(title, role) {
  const el = document.getElementById("topbar-title");
  const badge = document.getElementById("topbar-role");
  if (el) el.textContent = title;
  if (badge) {
    const labels = { client: "Cliente", staff: "Colab", admin: "Admin" };
    badge.textContent = labels[role] || "";
  }
}
