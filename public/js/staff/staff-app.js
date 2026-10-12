// js/staff/staff-app.js
// Lógica consolidada para todas as páginas da Área do Colaborador e Admin

(function () {
  'use strict';

  // ===========================
  // VERIFICAÇÃO DE AUTENTICAÇÃO
  // ===========================

  // Obtém a sessão atual
  const session = getSession();

  // Identificação da página atual
  const pathname = window.location.pathname;
  const currentPage = pathname.substring(pathname.lastIndexOf('/') + 1) || 'dashboard.html';

  // Mapeamento de páginas exclusivas para admin
  const ADMIN_ONLY_PAGES = ['finance.html', 'relatorios.html', 'configuracoes.html'];

  // Verifica se a página atual requer admin
  const requiresAdmin = ADMIN_ONLY_PAGES.includes(currentPage);

  // AUTENTICAÇÃO ROBUSTA: Impede acesso não autorizado
  if (requiresAdmin) {
    // Página exclusiva de admin
    requireAuth(['admin']);
  } else {
    // Páginas acessíveis por staff e admin
    const { accessToken, role } = session;
    if (!accessToken || (role !== 'staff' && role !== 'admin')) {
      clearSessionAndRedirect();
    }
  }

  // ===========================
  // CONFIGURAÇÃO DA INTERFACE
  // ===========================

  // Mapeamento de títulos das páginas
  const pageTitles = {
    'dashboard.html': 'Dashboard',
    'agenda.html': 'Agenda',
    'appointments.html': 'Agendamentos',
    'clients.html': 'Clientes',
    'clientes.html': 'Clientes',
    'barbeiros.html': 'Barbeiros',
    'services.html': 'Serviços',
    'servicos.html': 'Serviços',
    'produtos.html': 'Produtos',
    'venda.html': 'Vendas',
    'finance.html': 'Financeiro',
    'relatorios.html': 'Relatórios',
    'avaliacoes.html': 'Avaliações',
    'configuracoes.html': 'Configurações',
    'settings.html': 'Configurações'
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
