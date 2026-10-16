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
        Authorization: `Bearer ${accessToken}`
      }
    });

    // Se o token expirou, tenta renovar e fazer a requisição novamente
    if (response.status === 401) {
      const data = await response.clone().json().catch(() => ({}));

      if (data.code === 'TOKEN_EXPIRED') {
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

  async function requireAuth(expectedRoles) {
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

      // Valida no servidor para garantir máxima segurança
      try {
        const response = await fetch('/auth/validate-access', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({ requiredRoles: allowedRoles })
        });

        if (!response.ok) {
          console.warn(`[Auth] Acesso negado para role '${role}' na página '${currentPage}'.`);

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
      } catch (error) {
        console.error('[Auth] Erro ao validar acesso no servidor:', error);
        // Em caso de erro na validação, usa a validação local como fallback
        if (!allowedRoles.includes(role)) {
          console.warn(`[Auth] Acesso negado (validação local). Role '${role}' não autorizado.`);
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
    }

    // Valida sessão com o servidor (verificação assíncrona)
    validateSession();

    return true;
  }

  // Valida sessão no servidor
  async function validateSession() {
    const { accessToken, refreshToken } = getSession();

    if (!accessToken) return;

    try {
      const response = await fetch('/auth/session', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        // Se a sessão for inválida, tenta renovar o token antes de redirecionar
        console.warn('[Auth] Sessão inválida no servidor. Tentando renovar token...');

        if (refreshToken) {
          const refreshed = await refreshAccessToken();
          if (refreshed) {
            console.log('[Auth] Token renovado com sucesso.');
            return; // Token renovado, sessão válida
          }
        }

        // Só limpa e redireciona se não conseguir renovar
        console.warn('[Auth] Não foi possível renovar o token. Redirecionando para login.');
        clearSession();
        redirectToLogin();
      }
    } catch (error) {
      console.error('[Auth] Erro ao validar sessão:', error);
      // Em caso de erro de rede, não redireciona automaticamente
      // O usuário pode estar em uma conexão instável
    }
  }

  // ===========================
  // MODAL DE CONFIRMAÇÃO DE LOGOUT
  // ===========================

  function createLogoutModal() {
    if (document.getElementById('logout-modal-container')) return;

    const container = document.createElement('div');
    container.id = 'logout-modal-container';
    container.innerHTML = `
      <div class="modal-backdrop" id="logout-modal">
        <div class="logout-modal">
          <div class="logout-modal-header">
            <i class="bx bx-log-out"></i>
            <h3>Sair do Sistema</h3>
            <p>Tem certeza que deseja encerrar sua sessão?</p>
          </div>
          <div class="logout-modal-footer">
            <button class="cancel-btn" id="modal-cancel">Cancelar</button>
            <button class="confirm-btn" id="modal-confirm"><i class="bx bx-log-out"></i> Sair</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(container);
  }

  function showLogoutModal() {
    if (!document.getElementById('logout-modal-container')) {
      createLogoutModal();
    }
    document.getElementById('logout-modal').classList.add('active');
  }

  function hideLogoutModal() {
    const modal = document.getElementById('logout-modal');
    if (modal) {
      modal.classList.remove('active');
    }
  }

  // ===========================
  // LOGOUT
  // ===========================

  async function performLogout() {
    const { accessToken } = getSession();

    // Chama o endpoint de logout no servidor
    if (accessToken) {
      try {
        await fetch('/auth/logout', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        });
      } catch (error) {
        console.error('Erro ao fazer logout:', error);
        // Mesmo com erro no servidor, continua com o logout local
      }
    }

    // Limpa a sessão local e redireciona
    clearSession();
    window.location.href = '../index.html';
  }

  async function logout() {
    // Mostra o modal de confirmação
    showLogoutModal();

    // Configura os botões do modal
    const modal = document.getElementById('logout-modal');
    const cancelBtn = document.getElementById('modal-cancel');
    const confirmBtn = document.getElementById('modal-confirm');

    // Função de cleanup para evitar listeners duplicados
    const cleanup = () => {
      hideLogoutModal();
      cancelBtn?.removeEventListener('click', handleCancel);
      confirmBtn?.removeEventListener('click', handleConfirm);
    };

    const handleCancel = () => {
      cleanup();
      // Usuário cancelou
    };

    const handleConfirm = async () => {
      // Adiciona feedback visual
      confirmBtn.classList.add('logout-processing');
      confirmBtn.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> Saindo...';

      await performLogout();
      cleanup();
    };

    // Remove listeners antigos para evitar duplicação
    const newCancelBtn = cancelBtn.cloneNode(true);
    const newConfirmBtn = confirmBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

    newCancelBtn.addEventListener('click', () => {
      hideLogoutModal();
    });

    newConfirmBtn.addEventListener('click', async () => {
      newConfirmBtn.classList.add('logout-processing');
      newConfirmBtn.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> Saindo...';
      await performLogout();
    });
  }

  // ===========================
  // EXPORTAÇÃO GLOBAL
  // ===========================

  window.BarberSelect = {
    getSession,
    clearSession,
    redirectToLogin,
    refreshAccessToken,
    authenticatedFetch,
    requireAuth,
    logout,
    validateSession
  };

  // Mantém compatibilidade com código existente
  window.getSession = getSession;
  window.clearSessionAndRedirect = function() {
    clearSession();
    redirectToLogin();
  };
  window.refreshAccessToken = refreshAccessToken;
  window.authenticatedFetch = authenticatedFetch;
  window.requireAuth = requireAuth;
  window.logout = logout;

})();
