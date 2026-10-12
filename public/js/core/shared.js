// js/core/shared.js
// Lógica comum a todas as páginas internas (sidebar, sessão, logout, refresh token, requireAuth robusto)

(function () {
  'use strict';

  // ===========================
  // CONFIGURAÇÕES DE AUTENTICAÇÃO
  // ===========================

  // Mapeamento de roles para suas respectivas áreas
  const ROLE_DESTINATIONS = {
    client: '/client/home.html',
    staff: '/staff/dashboard.html',
    admin: '/staff/dashboard.html'
  };

  // Páginas que requerem role específica
  const PROTECTED_PAGES = {
    // Páginas exclusivas do admin
    'finance.html': ['admin'],
    'relatorios.html': ['admin'],
    'configuracoes.html': ['admin'],

    // Páginas acessíveis por staff e admin
    'dashboard.html': ['staff', 'admin'],
    'appointments.html': ['staff', 'admin'],
    'agenda.html': ['staff', 'admin'],
    'clients.html': ['staff', 'admin'],
    'clientes.html': ['staff', 'admin'],
    'services.html': ['staff', 'admin'],
    'servicos.html': ['staff', 'admin'],
    'produtos.html': ['staff', 'admin'],
    'venda.html': ['staff', 'admin'],
    'avaliacoes.html': ['staff', 'admin'],
    'barbeiros.html': ['staff', 'admin'],
    'settings.html': ['staff', 'admin'],

    // Páginas do cliente
    'home.html': ['client'],
    'request.html': ['client'],
    'profile.html': ['client']
  };

  // ===========================
  // GERENCIAMENTO DE SESSÃO
  // ===========================

  function getSession() {
    return {
      accessToken: sessionStorage.getItem('accessToken'),
      refreshToken: sessionStorage.getItem('refreshToken'),
      role: sessionStorage.getItem('role'),
      userId: sessionStorage.getItem('userId'),
      identity: sessionStorage.getItem('identity')
    };
  }

  function clearSession() {
    sessionStorage.removeItem('accessToken');
    sessionStorage.removeItem('refreshToken');
    sessionStorage.removeItem('role');
    sessionStorage.removeItem('userId');
    sessionStorage.removeItem('identity');
  }

  function redirectToLogin() {
    const currentPath = window.location.pathname;

    // Determina qual página de login usar baseado no path atual
    if (currentPath.includes('/client/')) {
      window.location.href = '../pages/login.html';
    } else if (currentPath.includes('/staff/')) {
      window.location.href = '../pages/login.html';
    } else {
      window.location.href = '/pages/login.html';
    }
  }

  // ===========================
  // REFRESH TOKEN AUTOMÁTICO
  // ===========================

  async function refreshAccessToken() {
    const { refreshToken } = getSession();

    if (!refreshToken) {
      return false;
    }

    try {
      const response = await fetch('/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refreshToken })
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      sessionStorage.setItem('accessToken', data.accessToken);
      return true;
    } catch (error) {
      console.error('Erro ao renovar token:', error);
      return false;
    }
  }

  // Wrapper para fetch com refresh automático
  async function authenticatedFetch(url, options = {}) {
    const { accessToken } = getSession();

  // Primeira tentativa com o token atual
  let response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  // Se o token expirou, tenta renovar e fazer a requisição novamente
  if (response.status === 401) {
    const data = await response.json();
    if (data.code === "TOKEN_EXPIRED") {
      const refreshed = await refreshAccessToken();

        if (refreshed) {
          const { accessToken: newToken } = getSession();
          response = await fetch(url, {
            ...options,
            headers: {
              ...options.headers,
              Authorization: `Bearer ${newToken}`
            }
          });
        } else {
          clearSession();
          redirectToLogin();
          return null;
        }
      } else {
        clearSession();
        redirectToLogin();
        return null;
      }
    }

    return response;
  }

  // ===========================
  // SISTEMA DE AUTENTICAÇÃO ROBUSTO
  // ===========================

  function requireAuth(expectedRoles) {
    const session = getSession();
    const { accessToken, role } = session;

    // Se não há token, redireciona para login
    if (!accessToken) {
      console.warn('[Auth] Nenhum token encontrado. Redirecionando para login.');
      clearSession();
      redirectToLogin();
      return false;
    }

    // Determina a página atual
    const pathname = window.location.pathname;
    const currentPage = pathname.substring(pathname.lastIndexOf('/') + 1) || 'index.html';

    // Verifica se a página tem restrição de role
    const pageRoles = PROTECTED_PAGES[currentPage];

    if (pageRoles) {
      // Se expectedRoles foi fornecido, usa ele. Senão usa o mapeamento da página.
      const allowedRoles = expectedRoles || pageRoles;

      if (!allowedRoles.includes(role)) {
        console.warn(`[Auth] Acesso negado. Role '${role}' não tem permissão para acessar '${currentPage}'.`);
        console.warn(`[Auth] Roles permitidas: ${allowedRoles.join(', ')}`);

        // Redireciona para a página apropriada baseada no role do usuário
        const destination = ROLE_DESTINATIONS[role];
        if (destination) {
          window.location.href = destination;
        } else {
          clearSession();
          redirectToLogin();
        }
        return false;
      }
    }

    // Valida o token com o servidor (verificação assíncrona)
    validateSession();

    return true;
  }

  // Valida sessão no servidor
  async function validateSession() {
    const { accessToken } = getSession();

    if (!accessToken) return;

    try {
      const response = await fetch('/auth/session', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        console.warn('[Auth] Sessão inválida no servidor.');
        clearSession();
        redirectToLogin();
      }
    } catch (error) {
      console.error('[Auth] Erro ao validar sessão:', error);
    }
  }

  // ===========================
  // LOGOUT
  // ===========================

  async function logout() {
    const { accessToken } = getSession();

  // Chama o endpoint de logout no servidor
  if (accessToken) {
    try {
      await fetch("/auth/logout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
    }
  }

  // Limpa a sessão local
  sessionStorage.removeItem("accessToken");
  sessionStorage.removeItem("refreshToken");
  sessionStorage.removeItem("role");
  sessionStorage.removeItem("userId");
  sessionStorage.removeItem("identity");
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
