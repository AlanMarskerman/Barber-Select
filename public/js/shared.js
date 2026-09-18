// DASHBOARD - INÍCIO DA ALTERAÇÃO: integração necessária para Dashboard/sidebar.
// Funções compartilhadas entre as páginas internas do Barber Select.
// DASHBOARD - FIM DA ALTERAÇÃO.

// DASHBOARD - INÍCIO DA ALTERAÇÃO: integração necessária para Dashboard/sidebar.
const sidebarIcons = {
  dashboard: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
  calendar: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>',
  clients: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
  barbers: '<svg viewBox="0 0 24 24"><circle cx="10" cy="8" r="4"/><path d="M2 21a8 8 0 0 1 16 0M16 7l5 5M21 7l-5 5"/></svg>',
  services: '<svg viewBox="0 0 24 24"><path d="M4 20l4-9 12-7-7 12-9 4zM8 11l5 5"/></svg>',
  products: '<svg viewBox="0 0 24 24"><rect x="4" y="6" width="16" height="15" rx="2"/><path d="M8 6V4h8v2M9 11h6"/></svg>',
  finance: '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="14" rx="2"/><path d="M7 6V4h10v2"/><circle cx="12" cy="13" r="3"/></svg>',
  reports: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 17v-5M12 17V7M16 17v-8"/></svg>',
  reviews: '<svg viewBox="0 0 24 24"><path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2L5.8 21 7 14.2l-5-4.9 6.9-1L12 2z"/></svg>',
  settings: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1z"/></svg>',
  logout: '<svg viewBox="0 0 24 24"><path d="M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5M14 8l4 4-4 4M18 12H8"/></svg>'
// DASHBOARD - FIM DA ALTERAÇÃO.
};

function getSession() {
// DASHBOARD - INÍCIO DA ALTERAÇÃO: integração necessária para Dashboard/sidebar.
  return { token: sessionStorage.getItem("token"), role: sessionStorage.getItem("role") };
// DASHBOARD - FIM DA ALTERAÇÃO.
}

// DASHBOARD - INÍCIO DA ALTERAÇÃO: integração necessária para Dashboard/sidebar.
function redirectToHome(role) {
  const destinations = { client: "/client/home.html", staff: "/staff/dashboard.html", admin: "/staff/dashboard.html" };
  window.location.replace(destinations[role] || "/pages/login.html");
// DASHBOARD - FIM DA ALTERAÇÃO.
}

// DASHBOARD - INÍCIO DA ALTERAÇÃO: integração necessária para Dashboard/sidebar.
function requireAuth(expectedRoles) {
  const { token, role } = getSession();
  if (!token || !role) {
    window.location.replace("/pages/login.html");
    return false;
  }
  if (expectedRoles) {
    const allowed = Array.isArray(expectedRoles) ? expectedRoles : [expectedRoles];
    if (!allowed.includes(role)) {
      redirectToHome(role);
      return false;
    }
  }
  return true;
// DASHBOARD - FIM DA ALTERAÇÃO.
}

function logout() {
  sessionStorage.removeItem("token");
  sessionStorage.removeItem("role");
// DASHBOARD - INÍCIO DA ALTERAÇÃO: integração necessária para Dashboard/sidebar.
  window.location.href = "/index.html";
// DASHBOARD - FIM DA ALTERAÇÃO.
}

const NAV_ITEMS = {
  client: [
// DASHBOARD - INÍCIO DA ALTERAÇÃO: integração necessária para Dashboard/sidebar.
    { route: "/client/home.html", page: "home.html", icon: "dashboard", label: "Início" },
    { route: "/client/request.html", page: "request.html", icon: "calendar", label: "Agendar" },
    { route: "/client/profile.html", page: "profile.html", icon: "clients", label: "Meu perfil" }
// DASHBOARD - FIM DA ALTERAÇÃO.
  ],
  staff: [
// DASHBOARD - INÍCIO DA ALTERAÇÃO: integração necessária para Dashboard/sidebar.
    { route: "/staff/dashboard.html", page: "dashboard.html", icon: "dashboard", label: "Dashboard" },
    { route: "/staff/appointments.html", page: "appointments.html", icon: "calendar", label: "Agenda" },
    { route: "/staff/clients.html", page: "clients.html", icon: "clients", label: "Clientes" },
    { route: "/staff/services.html", page: "services.html", icon: "services", label: "Serviços" }
// DASHBOARD - FIM DA ALTERAÇÃO.
  ],
  admin: [
// DASHBOARD - INÍCIO DA ALTERAÇÃO: integração necessária para Dashboard/sidebar.
    { route: "/staff/dashboard.html", page: "dashboard.html", icon: "dashboard", label: "Dashboard" },
    { route: "/staff/appointments.html", page: "appointments.html", icon: "calendar", label: "Agenda" },
    { route: "/admin/clients.html", page: "clients.html", icon: "clients", label: "Clientes" },
    { route: "#", icon: "barbers", label: "Barbeiros", disabled: true },
    { route: "/staff/services.html", page: "services.html", icon: "services", label: "Serviços" },
    { route: "#", icon: "products", label: "Produtos", disabled: true },
    { route: "/staff/finance.html", page: "finance.html", icon: "finance", label: "Financeiro" },
    { route: "#", icon: "reports", label: "Relatórios", disabled: true },
    { route: "#", icon: "reviews", label: "Avaliações", disabled: true }
  ]
// DASHBOARD - FIM DA ALTERAÇÃO.
};

function renderSidebar(role, currentPage) {
  const container = document.getElementById("sidebar");
  if (!container) return;
  const items = NAV_ITEMS[role] || [];
// DASHBOARD - INÍCIO DA ALTERAÇÃO: integração necessária para Dashboard/sidebar.
  const settingsRoute = role === "client" ? "/client/settings.html" : "/staff/settings.html";
  const navHtml = items.map((item) => {
    const active = item.page === currentPage ? "active" : "";
    const disabled = item.disabled ? "nav-disabled" : "";
    return `<a class="nav-item ${active} ${disabled}" href="${item.route}" ${item.disabled ? 'aria-disabled="true"' : ""}>
      <span class="nav-icon">${sidebarIcons[item.icon]}</span><span class="nav-label">${item.label}</span></a>`;
  }).join("");
// DASHBOARD - FIM DA ALTERAÇÃO.

  container.innerHTML = `
<!-- DASHBOARD - INÍCIO DA ALTERAÇÃO: integração necessária para Dashboard/sidebar. -->
    <a class="sidebar-brand" href="${role === "client" ? "/client/home.html" : "/staff/dashboard.html"}">
      <img src="/assets/barber-select-logo.png" alt="Barber Select" />
    </a>
<!-- DASHBOARD - FIM DA ALTERAÇÃO. -->
    <nav class="sidebar-nav">${navHtml}</nav>
<!-- DASHBOARD - INÍCIO DA ALTERAÇÃO: integração necessária para Dashboard/sidebar. -->
    <div class="sidebar-bottom">
      <a class="nav-item ${currentPage === "settings.html" ? "active" : ""}" href="${settingsRoute}">
        <span class="nav-icon">${sidebarIcons.settings}</span><span class="nav-label">Configurações</span>
<!-- DASHBOARD - FIM DA ALTERAÇÃO. -->
      </a>
<!-- DASHBOARD - INÍCIO DA ALTERAÇÃO: integração necessária para Dashboard/sidebar. -->
      <button class="nav-item nav-logout" id="logout-btn" type="button">
        <span class="nav-icon">${sidebarIcons.logout}</span><span class="nav-label">Sair</span>
<!-- DASHBOARD - FIM DA ALTERAÇÃO. -->
      </button>
<!-- DASHBOARD - INÍCIO DA ALTERAÇÃO: integração necessária para Dashboard/sidebar. -->
    </div>`;
// DASHBOARD - FIM DA ALTERAÇÃO.

// DASHBOARD - INÍCIO DA ALTERAÇÃO: integração necessária para Dashboard/sidebar.
  container.querySelectorAll(".nav-disabled").forEach((el) => el.addEventListener("click", (event) => event.preventDefault()));
  document.getElementById("logout-btn")?.addEventListener("click", logout);
// DASHBOARD - FIM DA ALTERAÇÃO.
}

function renderTopbar(title, role) {
// DASHBOARD - INÍCIO DA ALTERAÇÃO: integração necessária para Dashboard/sidebar.
  const titleElement = document.getElementById("topbar-title");
  const roleElement = document.getElementById("topbar-role");
  if (titleElement) titleElement.textContent = title;
  if (roleElement) {
    const labels = { client: "Cliente", staff: "Colaborador", admin: "Administrador" };
    roleElement.textContent = labels[role] || "";
// DASHBOARD - FIM DA ALTERAÇÃO.
  }
}
