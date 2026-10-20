// js/client/client-app.js
// Lógica consolidada para todas as páginas da Área do Cliente

(function () {
  'use strict';

  // ===========================
  // VERIFICAÇÃO DE AUTENTICAÇÃO
  // ===========================

  // Usamos DOMContentLoaded para garantir que a página esteja completamente carregada
  // antes de verificar a autenticação, evitando loops de redirecionamento
  document.addEventListener('DOMContentLoaded', () => {
    // 1. Verificação de autenticação para o perfil cliente
    const isAuthenticated = requireAuth("client");

    if (!isAuthenticated) {
      // Se não autenticado, requireAuth já redirecionou para login
      return;
    }

    console.log('[Client App] Autenticação validada com sucesso');

    // 2. Identificação da página atual pelo nome do arquivo na URL
    const pathname = window.location.pathname;
    const currentPage = pathname.substring(pathname.lastIndexOf("/") + 1) || "home.html";

    // 3. Mapeamento de títulos das páginas
    const pageTitles = {
      "home.html": "Minha área",
      "request.html": "Solicitar horário",
      "profile.html": "Meu perfil",
      "settings.html": "Configurações",
    };

    const title = pageTitles[currentPage] || "Área do Cliente";

    // 4. Handler para o botão de logout (área do cliente)
    const logoutButton = document.querySelector(".client-logout .logout");
    if (logoutButton) {
      console.log('[Client App] Configurando handler de logout');
      logoutButton.addEventListener("click", async (e) => {
        e.preventDefault();
        console.log('[Client App] Logout iniciado');
        await logout(); // Usa a função logout() do shared.js que já tem confirmação visual
      });
    }

    // 5. Tela de Perfil
    const profileForm = document.getElementById("profile-form");
    if (profileForm) {
      profileForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        alert("Perfil atualizado com sucesso!");
      });
    }

    // 6. Tela de Agendamento
    const requestForm = document.getElementById("request-form");
    if (requestForm) {
      requestForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        alert("Solicitação de agendamento enviada com sucesso!");
      });
    }

    console.log('[Client App] Inicialização completa');
  });

  // Adiciona uma verificação extra para debugging
  window.addEventListener('error', (error) => {
    console.error('[Client App Error]', error.message);
  });
})();
