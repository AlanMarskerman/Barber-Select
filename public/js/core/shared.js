// js/core/shared.js
// Sistema de autenticação simplificado e robusto

(function () {
  'use strict';

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
    // Sempre redireciona para /pages/login.html (caminho absoluto)
    window.location.href = '/pages/login.html';
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

    let response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${accessToken}`
      }
    });

    // Se o token expirou (401), tenta renovar
    if (response.status === 401) {
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
        // Não conseguiu renovar, limpa e vai para login
        clearSession();
        redirectToLogin();
        return null;
      }
    }

    return response;
  }

  // ===========================
  // VERIFICAÇÃO DE AUTENTICAÇÃO SIMPLES
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

    // Se expectedRoles foi fornecido, valida se o role do usuário está autorizado
    if (expectedRoles) {
      const allowedRoles = Array.isArray(expectedRoles) ? expectedRoles : [expectedRoles];
      
      if (!allowedRoles.includes(role)) {
        console.warn(`[Auth] Role '${role}' não autorizado.`);
        clearSession();
        redirectToLogin();
        return false;
      }
    }

    return true;
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

    // Adiciona listeners para os botões após criar o modal
    const cancelBtn = document.getElementById('modal-cancel');
    const confirmBtn = document.getElementById('modal-confirm');

    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => hideLogoutModal());
    }
    if (confirmBtn) {
      confirmBtn.addEventListener('click', async () => {
        confirmBtn.disabled = true;
        confirmBtn.classList.add('logout-processing');
        await performLogout();
        // Se o logout falhar, reabilita o botão
        confirmBtn.disabled = false;
        confirmBtn.classList.remove('logout-processing');
      });
    }

    // Adiciona logs para debugging
    console.log('[Logout] Modal criado e listeners configurados');
  }

  function showLogoutModal() {
    if (!document.getElementById('logout-modal-container')) {
      createLogoutModal();
    }
    const modal = document.getElementById('logout-modal');
    if (modal) {
      modal.classList.add('active');
    }
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
        console.error('Erro ao fazer logout no servidor:', error);
        // Mesmo com erro, continua com logout local
      }
    }

    // Limpa a sessão local
    clearSession();

    // SEMPRE redireciona para /pages/login.html
    window.location.href = '/pages/login.html';
  }

  async function logout() {
    // Mostra o modal de confirmação
    showLogoutModal();

    console.log('[Logout] Modal de logout exibido - aguarde a confirmação');

    // Log adicional para debugging
    console.log('[Logout] Botões do modal devem ser configurados automaticamente em createLogoutModal');
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
    logout
  };

  // Compatibilidade com código existente
  window.getSession = getSession;
  window.clearSession = clearSession;
  window.clearSessionAndRedirect = function() {
    clearSession();
    redirectToLogin();
  };
  window.refreshAccessToken = refreshAccessToken;
  window.authenticatedFetch = authenticatedFetch;
  window.requireAuth = requireAuth;
  window.logout = logout;

})();
