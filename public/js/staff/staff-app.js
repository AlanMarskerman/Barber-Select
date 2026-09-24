// js/staff/staff-app.js
// Lógica consolidada para todas as páginas da Área do Colaborador e Admin

(function () {
  // 1. Obtém a sessão atual
  const session = getSession();

  // 2. Identificação da página atual pelo nome do arquivo na URL
  const pathname = window.location.pathname;
  const currentPage = pathname.substring(pathname.lastIndexOf("/") + 1) || "dashboard.html";

  // 3. Determina se é staff ou admin baseado na página e na role
  let requiredRole = "staff";

  // finance.html é exclusivo para admin
  if (currentPage === "finance.html") {
    requiredRole = "admin";
  }

  // 4. Verificação de autenticação
  // Permite tanto staff quanto admin acessarem páginas de staff
  // Mas apenas admin acessa finance.html
  if (requiredRole === "admin") {
    requireAuth("admin");
  } else {
    // Aceita staff ou admin
    const { accessToken, role } = session;
    if (!accessToken || (role !== "staff" && role !== "admin")) {
      clearSessionAndRedirect();
    }
  }

  // 5. Mapeamento de títulos das páginas
  const pageTitles = {
    "dashboard.html": "Visão geral",
    "appointments.html": "Agenda",
    "clients.html": "Clientes",
    "services.html": "Serviços",
    "finance.html": "Financeiro",
    "settings.html": "Configurações",
  };

  const title = pageTitles[currentPage] || "Área do Colaborador";

  // 6. Determina qual role usar para a sidebar (admin ou staff)
  const sidebarRole = session.role === "admin" ? "admin" : "staff";

  // 7. Renderização padrão de layout
  renderSidebar(sidebarRole, currentPage);
  renderTopbar(title, sidebarRole);

  // 8. Handlers de formulários específicos de cada tela
  document.addEventListener("DOMContentLoaded", () => {
    // Tela de Agendamentos
    const appointmentForm = document.getElementById("appointment-form");
    if (appointmentForm) {
      appointmentForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        alert("Agendamento salvo com sucesso!");
      });
    }

    // Outras telas podem ter seus handlers adicionados aqui conforme necessário
  });
})();
