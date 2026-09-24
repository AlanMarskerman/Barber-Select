// js/client/client-app.js
// Lógica consolidada para todas as páginas da Área do Cliente

(function () {
  // 1. Verificação de autenticação para o perfil cliente
  requireAuth("client");

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

  // 4. Renderização padrão de layout
  renderSidebar("client", currentPage);
  renderTopbar(title, "client");

  // 5. Handlers de formulários específicos de cada tela do cliente
  document.addEventListener("DOMContentLoaded", () => {
    // Tela de Perfil
    const profileForm = document.getElementById("profile-form");
    if (profileForm) {
      profileForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        alert("Perfil atualizado com sucesso!");
      });
    }

    // Tela de Agendamento
    const requestForm = document.getElementById("request-form");
    if (requestForm) {
      requestForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        alert("Solicitação de agendamento enviada com sucesso!");
      });
    }
  });
})();
