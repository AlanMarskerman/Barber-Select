// js/staff/staff-app.js
// Lógica consolidada para todas as páginas da Área do Colaborador e Admin

(function () {
  'use strict';

  // ===========================
  // VERIFICAÇÃO DE AUTENTICAÇÃO
  // ===========================

  // Identificação da página atual
  const pathname = window.location.pathname;
  const currentPage = pathname.substring(pathname.lastIndexOf('/') + 1) || 'dashboard.html';

  // Mapeamento de páginas exclusivas para admin
  const ADMIN_ONLY_PAGES = ['finance.html', 'relatorios.html', 'configuracoes.html'];

  // Verifica se a página atual requer admin
  const requiresAdmin = ADMIN_ONLY_PAGES.includes(currentPage);

  // AUTENTICAÇÃO ROBUSTA: Impede acesso não autorizado
  // Validação síncrona primeiro (rápida)
  const session = getSession();
  const { accessToken, role } = session;

  if (!accessToken) {
    clearSessionAndRedirect();
  }

  // Validação assíncrona com o servidor para máxima segurança
  async function verifyAccess() {
    if (requiresAdmin) {
      // Página exclusiva de admin - valida no servidor
      const hasAccess = await requireAuth(['admin']);
      if (!hasAccess) {
        return; // requireAuth já redirecionou
      }
    } else {
      // Páginas acessíveis por staff e admin - valida no servidor
      const hasAccess = await requireAuth(['staff', 'admin']);
      if (!hasAccess) {
        return; // requireAuth já redirecionou
      }
    }

    // Se passou na validação, inicializa a página
    initPage();
  }

  // Se houver sessão, valida o acesso
  if (accessToken) {
    verifyAccess();
  }

  // ===========================
  // INICIALIZAÇÃO DA PÁGINA
  // ===========================

  function initPage() {
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

    const title = pageTitles[currentPage] || 'Área do Colaborador';

    // ===========================
    // ATUALIZA INFORMAÇÕES DO USUÁRIO NO HEADER
    // ===========================

    function updateUserInfo() {
      const userNameElement = document.querySelector('.user-info b');
      const userRoleElement = document.querySelector('.user-info span');

      if (userNameElement && session.identity) {
        userNameElement.textContent = session.identity;
      }

      if (userRoleElement && session.role) {
        const roleLabels = {
          admin: 'Administrador',
          staff: 'Colaborador',
          client: 'Cliente'
        };
        userRoleElement.textContent = roleLabels[session.role] || session.role;
      }
    }

    // ===========================
    // MARCA O LINK ATIVO NA SIDEBAR
    // ===========================

    function setActiveNavLink() {
      const navLinks = document.querySelectorAll('.sidebar .nav a');

      navLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentPage) {
          link.classList.add('active');
        } else {
          link.classList.remove('active');
        }
      });
    }

    // ===========================
    // HANDLERS DE LOGOUT
    // ===========================

    function setupLogoutHandlers() {
      const logoutButtons = document.querySelectorAll('.logout');

      logoutButtons.forEach(button => {
        button.addEventListener('click', async (e) => {
          e.preventDefault();
          // Usa a função logout() do shared.js que já tem confirmação visual
          await logout();
        });
      });
    }

    // ===========================
    // MENU MOBILE (HAMBURGUER)
    // ===========================

    function setupMobileMenu() {
      const hamburgerButton = document.querySelector('.hamb');
      const app = document.querySelector('.app');

      if (hamburgerButton) {
        hamburgerButton.addEventListener('click', () => {
          // Toggle para desktop (esconde sidebar)
          if (window.innerWidth > 760) {
            app.classList.toggle('sidebar-collapsed');
          } else {
            // Toggle para mobile (abre menu overlay)
            app.classList.toggle('mobile-menu-open');
          }
        });
      }

      // Fecha menu mobile ao clicar fora
      if (window.innerWidth <= 760) {
        const sidebar = document.querySelector('.sidebar');
        const main = document.querySelector('.main');

        main?.addEventListener('click', () => {
          app.classList.remove('mobile-menu-open');
        });

        // Fecha ao clicar em um link
        const navLinks = document.querySelectorAll('.sidebar .nav a');
        navLinks.forEach(link => {
          link.addEventListener('click', () => {
            app.classList.remove('mobile-menu-open');
          });
        });
      }
    }

    // ===========================
    // INICIALIZAÇÃO
    // ===========================

    document.addEventListener('DOMContentLoaded', () => {
      updateUserInfo();
      setActiveNavLink();
      setupLogoutHandlers();
      setupMobileMenu();

      // Handlers específicos de cada página
      initPageSpecificHandlers();
    });

    // ===========================
    // HANDLERS ESPECÍFICOS DAS PÁGINAS
    // ===========================

    function initPageSpecificHandlers() {
      // Dashboard: Nenhum handler específico necessário por enquanto

      // Clientes: Carrega lista de clientes
      if (currentPage === 'clients.html' || currentPage === 'clientes.html') {
        loadClients();
      }

      // Serviços: Handler de formulário de novo serviço
      const serviceForm = document.getElementById('service-form');
      if (serviceForm) {
        serviceForm.addEventListener('submit', handleServiceSubmit);
      }

      // Barbeiros: Handler de formulário de novo barbeiro
      const barberForm = document.getElementById('barber-form');
      if (barberForm) {
        barberForm.addEventListener('submit', handleBarberSubmit);
      }

      // Produtos: Handler de formulário de novo produto
      const productForm = document.getElementById('product-form');
      if (productForm) {
        productForm.addEventListener('submit', handleProductSubmit);
      }

      // Vendas: Handler de formulário de nova venda
      const saleForm = document.getElementById('sale-form');
      if (saleForm) {
        saleForm.addEventListener('submit', handleSaleSubmit);
      }

      // Agendamentos
      const appointmentForm = document.getElementById('appointment-form');
      if (appointmentForm) {
        appointmentForm.addEventListener('submit', handleAppointmentSubmit);
      }
    }

    // ===========================
    // CARREGA LISTA DE CLIENTES
    // ===========================

    async function loadClients() {
      try {
        const response = await authenticatedFetch('/api/clients');

        if (!response) return;

        if (response.ok) {
          const data = await response.json();
          renderClientsTable(data.clients);
          updateClientsSummary(data.summary);
        } else {
          console.error('Erro ao carregar clientes');
        }
      } catch (error) {
        console.error('Erro ao carregar clientes:', error);
      }
    }

    function renderClientsTable(clients) {
      const tbody = document.getElementById('clients-tbody');
      if (!tbody) return;

      if (clients.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Nenhum cliente cadastrado</td></tr>';
        return;
      }

      tbody.innerHTML = clients.map(client => `
        <tr>
          <td><b>${escapeHtml(client.name)}</b></td>
          <td>${escapeHtml(client.email)}</td>
          <td>${escapeHtml(client.phone || '-')}</td>
          <td><span class="pill ${client.active ? 'green' : 'yellow'}">${client.active ? 'Ativo' : 'Inativo'}</span></td>
          <td>
            <button class="btn-icon" onclick="viewClient(${client.id})" title="Ver detalhes">
              <i class="bx bx-show"></i>
            </button>
          </td>
        </tr>
      `).join('');
    }

    function updateClientsSummary(summary) {
      const totalEl = document.getElementById('clients-total');
      const activeEl = document.getElementById('clients-active');
      const recentEl = document.getElementById('clients-recent');

      if (totalEl) totalEl.textContent = summary.total;
      if (activeEl) activeEl.textContent = summary.active;
      if (recentEl) recentEl.textContent = summary.newLast30Days;
    }

    // ===========================
    // HANDLERS DE FORMULÁRIOS
    // ===========================

    async function handleServiceSubmit(e) {
      e.preventDefault();
      alert('Serviço cadastrado com sucesso! (Funcionalidade em desenvolvimento)');
      e.target.reset();
    }

    async function handleBarberSubmit(e) {
      e.preventDefault();
      alert('Barbeiro cadastrado com sucesso! (Funcionalidade em desenvolvimento)');
      e.target.reset();
    }

    async function handleProductSubmit(e) {
      e.preventDefault();
      alert('Produto cadastrado com sucesso! (Funcionalidade em desenvolvimento)');
      e.target.reset();
    }

    async function handleSaleSubmit(e) {
      e.preventDefault();
      alert('Venda registrada com sucesso! (Funcionalidade em desenvolvimento)');
      e.target.reset();
    }

    async function handleAppointmentSubmit(e) {
      e.preventDefault();
      alert('Agendamento criado com sucesso! (Funcionalidade em desenvolvimento)');
      e.target.reset();
    }

    // ===========================
    // UTILITÁRIOS
    // ===========================

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // Exporta funções globais se necessário
    window.viewClient = function(id) {
      alert(`Ver detalhes do cliente ${id} (em desenvolvimento)`);
    };
  } // Fim da função initPage()

})();
