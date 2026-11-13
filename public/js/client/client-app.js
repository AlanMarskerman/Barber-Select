// js/client/client-app.js
// Lógica consolidada para todas as páginas da Área do Cliente

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    // 1. Verificação de autenticação para o perfil cliente
    if (typeof requireAuth === 'function') {
      const isAuthenticated = requireAuth("client");
      if (!isAuthenticated) return;
    }

    console.log('[Client App] Autenticação validada com sucesso');

    // 2. Configuração universal do botão de logout (mesmo modal do admin/staff)
    const logoutButtons = document.querySelectorAll('.logout, .client-logout-btn');
    console.log('[Client App] Encontrados', logoutButtons.length, 'botões de logout');

    logoutButtons.forEach(button => {
      button.addEventListener('click', async (e) => {
        e.preventDefault();
        console.log('[Client App] Botão de logout clicado - chamando logout()');
        if (typeof logout === 'function') {
          await logout();
        } else {
          sessionStorage.clear();
          window.location.href = '/pages/login.html';
        }
      });
    });
  });
})();
