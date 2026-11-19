// js/staff/staff-app.js
// Lógica consolidada para todas as páginas da Área do Colaborador e Admin

(async function () {
  'use strict';

  // ===========================
  // VERIFICAÇÃO DE AUTENTICAÇÃO
  // ===========================

  // Aguarda o DOM estar pronto antes de verificar autenticação
  // Isso evita loops de redirecionamento quando a página ainda está carregando
  await new Promise(resolve => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', resolve);
    } else {
      resolve();
    }
  });

  // Identificação da página atual
  const pathname = window.location.pathname;
  const currentPage = pathname.substring(pathname.lastIndexOf('/') + 1) || 'dashboard.html';

  // Mapeamento de páginas exclusivas para admin
  const ADMIN_ONLY_PAGES = ['finance.html', 'relatorios.html', 'configuracoes.html'];

  // Verifica se a página atual requer admin
  const requiresAdmin = ADMIN_ONLY_PAGES.includes(currentPage);

  // AUTENTICAÇÃO ROBUSTA: Impede acesso não autorizado
  const session = getSession();
  const { accessToken, role } = session;

  // Se não há token, redireciona para login
  if (!accessToken) {
    console.warn('[Auth] Nenhum token encontrado no staff-app. Redirecionando para login.');
    clearSessionAndRedirect();
    return;
  }

  // Valida o acesso no servidor de forma síncrona
  let hasAccess = false;

  if (requiresAdmin) {
    // Página exclusiva de admin - valida no servidor
    hasAccess = requireAuth(['admin']);
  } else {
    // Páginas acessíveis por staff e admin - valida no servidor
    hasAccess = requireAuth(['staff', 'admin']);
  }

  // Se falhou na validação, requireAuth já redirecionou
  if (!hasAccess) {
    console.warn('[Auth] Acesso negado. Redirecionando.');
    return;
  }

  console.log('[Staff App] Autenticação validada com sucesso');

  // ===========================
  // INICIALIZAÇÃO DA PÁGINA (só roda se passou na autenticação)
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

      console.log('[Staff App] Encontrados', logoutButtons.length, 'botões de logout');

      logoutButtons.forEach(button => {
        console.log('[Staff App] Configurando handler para botão de logout:', button);
        button.addEventListener('click', async (e) => {
          e.preventDefault();
          console.log('[Staff App] Botão de logout clicado - chamando logout()');
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
        hamburgerButton.addEventListener('click', (event) => {
          // Evita que o clique chegue ao .main e feche o menu logo em seguida.
          event.stopPropagation();
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

    // Como já aguardamos o DOM carregar no início do script, executamos diretamente
    updateUserInfo();
    setActiveNavLink();
    setupLogoutHandlers();
    setupMobileMenu();

    // Handlers específicos de cada página
    initPageSpecificHandlers();

    // ===========================
    // HANDLERS ESPECÍFICOS DAS PÁGINAS
    // ===========================

    function initPageSpecificHandlers() {
      // Dashboard: carrega métricas reais do backend
      if (currentPage === 'dashboard.html') {
        loadDashboard();
      }

      // Clientes: Carrega lista de clientes
      if (currentPage === 'clients.html' || currentPage === 'clientes.html') {
        loadClients();
      }

      // Serviços: carrega o catálogo e configura ações/filtros.
      const serviceForm = document.getElementById('service-form');
      if (serviceForm) {
        serviceForm.addEventListener('submit', handleServiceSubmit);
        document.getElementById('services-search')?.addEventListener('input', renderServicesList);
        document.getElementById('services-category-filter')?.addEventListener('change', renderServicesList);
        document.getElementById('services-list')?.addEventListener('click', handleServiceAction);
        loadServices();
      }

      // Barbeiros: carrega a equipe e configura o cadastro de profissional.
      const barberForm = document.getElementById('barber-form');
      if (barberForm) {
        barberForm.addEventListener('submit', handleBarberSubmit);
        if (session.role === 'admin') {
          loadBarbers();
        } else {
          showBarberAccessNotice();
        }
      }

      // Novo Cliente (novocliente.html)
      const formCliente = document.getElementById('formCliente');
      if (formCliente || currentPage === 'novocliente.html') {
        initNewClientPage();
      }

      // Novo Agendamento (novagendamento.html)
      if (currentPage === 'novagendamento.html') {
        initNewAppointmentPage();
      }

      // Nota: os formulários de Produtos, Vendas e Agendamentos são tratados
      // nativamente em suas respectivas páginas (produtos.html, venda.html, agenda.html).
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

    const serviceCategoryLabels = {
      corte: 'Cabelo',
      barba: 'Barba',
      combo: 'Combo',
      tratamento: 'Tratamento',
      acabamento: 'Acabamento'
    };
    let cachedServices = [];

    async function handleServiceSubmit(e) {
      e.preventDefault();
      const form = e.currentTarget;
      const submitButton = form.querySelector('button[type="submit"]');
      const service = {
        name: form.elements.name.value.trim(),
        description: form.elements.description.value.trim(),
        category: form.elements.category.value,
        price: Number(form.elements.price.value),
        durationMinutes: Number(form.elements.durationMinutes.value)
      };

      setServiceFormMessage('');
      if (service.name.length < 2 || service.name.length > 100) {
        setServiceFormMessage('O nome deve ter entre 2 e 100 caracteres.');
        return;
      }
      if (!Object.prototype.hasOwnProperty.call(serviceCategoryLabels, service.category)) {
        setServiceFormMessage('Selecione uma categoria válida.');
        return;
      }
      if (!Number.isFinite(service.price) || service.price < 0.01 || service.price > 99999.99) {
        setServiceFormMessage('Informe um preço válido maior que zero.');
        return;
      }
      if (!Number.isInteger(service.durationMinutes) || service.durationMinutes < 5 || service.durationMinutes > 600) {
        setServiceFormMessage('A duração deve ser entre 5 e 600 minutos.');
        return;
      }

      const editingId = form.dataset.editingId;
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="bx bx-loader-alt bx-spin" aria-hidden="true"></i><span>Salvando...</span>';
      }

      try {
        const response = await authenticatedFetch(editingId ? `/api/services/${encodeURIComponent(editingId)}` : '/api/services', {
          method: editingId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(service)
        });
        if (!response) return;
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          setServiceFormMessage(data.error || 'Não foi possível cadastrar o serviço.');
          return;
        }

        form.reset();
        delete form.dataset.editingId;
        if (submitButton) submitButton.innerHTML = '<i class="bx bx-plus-circle" aria-hidden="true"></i><span>Cadastrar serviço</span>';
        setServiceFormMessage(editingId ? 'Serviço atualizado com sucesso.' : 'Serviço cadastrado com sucesso.', 'success');
        await loadServices();
      } catch (error) {
        console.error('Erro ao cadastrar serviço:', error);
        setServiceFormMessage('Não foi possível conectar ao servidor. Tente novamente.');
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.innerHTML = form.dataset.editingId
            ? '<i class="bx bx-save" aria-hidden="true"></i><span>Salvar alterações</span>'
            : '<i class="bx bx-plus-circle" aria-hidden="true"></i><span>Cadastrar serviço</span>';
        }
      }
    }

    function setServiceFormMessage(text, type = 'error') {
      const message = document.getElementById('service-form-message');
      if (!message) return;
      message.textContent = text;
      message.classList.toggle('is-success', type === 'success');
    }

    async function loadServices() {
      const tbody = document.getElementById('services-list');
      const count = document.getElementById('services-count');
      if (!tbody) return;

      try {
        const response = await authenticatedFetch('/api/services');
        if (!response) return;
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Não foi possível carregar o catálogo.');
        cachedServices = Array.isArray(data.services) ? data.services : [];
        renderServicesList();
        if (count) {
          const activeCount = cachedServices.filter(service => service.active).length;
          count.innerHTML = `<i class="bx bx-cut" aria-hidden="true"></i> ${activeCount} ativo${activeCount === 1 ? '' : 's'}`;
        }
      } catch (error) {
        console.error('Erro ao carregar serviços:', error);
        tbody.innerHTML = `<tr><td colspan="6"><div class="services-empty-state"><i class="bx bx-error-circle" aria-hidden="true"></i><strong>Não foi possível carregar o catálogo</strong><span>${escapeHtml(error.message || 'Tente atualizar a página.')}</span></div></td></tr>`;
        if (count) count.innerHTML = '<i class="bx bx-error-circle" aria-hidden="true"></i> Indisponível';
      }
    }

    function renderServicesList() {
      const tbody = document.getElementById('services-list');
      if (!tbody) return;
      const search = (document.getElementById('services-search')?.value || '').trim().toLocaleLowerCase('pt-BR');
      const category = document.getElementById('services-category-filter')?.value || '';
      const services = cachedServices.filter(service => {
        const matchesSearch = !search || `${service.name} ${service.description || ''}`.toLocaleLowerCase('pt-BR').includes(search);
        return matchesSearch && (!category || service.category === category);
      });

      if (services.length === 0) {
        const emptyMessage = cachedServices.length === 0 ? 'Cadastre o primeiro serviço usando o formulário ao lado.' : 'Nenhum serviço corresponde à busca ou categoria selecionada.';
        tbody.innerHTML = `<tr><td colspan="6"><div class="services-empty-state"><i class="bx bx-cut" aria-hidden="true"></i><strong>${cachedServices.length === 0 ? 'Nenhum serviço cadastrado' : 'Nenhum resultado'}</strong><span>${emptyMessage}</span></div></td></tr>`;
        return;
      }

      tbody.innerHTML = services.map(service => `
        <tr>
          <td class="service-name-cell"><strong>${escapeHtml(service.name)}</strong>${service.description ? `<span>${escapeHtml(service.description)}</span>` : ''}</td>
          <td><span class="service-category-pill">${escapeHtml(serviceCategoryLabels[service.category] || service.category)}</span></td>
          <td>${Number(service.durationMinutes)} min</td>
          <td class="service-price-cell">${formatServicePrice(service.price)}</td>
          <td><span class="service-status ${service.active ? 'is-active' : 'is-inactive'}">${service.active ? 'Ativo' : 'Inativo'}</span></td>
          <td><div class="service-actions"><button class="service-action-button" type="button" data-service-action="edit" data-service-id="${Number(service.id)}" aria-label="Editar ${escapeHtml(service.name)}" title="Editar"><i class="bx bx-edit-alt" aria-hidden="true"></i></button><button class="service-action-button" type="button" data-service-action="toggle" data-service-id="${Number(service.id)}" data-active="${service.active ? 'true' : 'false'}" aria-label="${service.active ? 'Inativar' : 'Ativar'} ${escapeHtml(service.name)}" title="${service.active ? 'Inativar' : 'Ativar'}"><i class="bx ${service.active ? 'bx-pause' : 'bx-play'}" aria-hidden="true"></i></button></div></td>
        </tr>
      `).join('');
    }

    function formatServicePrice(value) {
      return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    async function handleServiceAction(event) {
      const button = event.target.closest('button[data-service-action]');
      if (!button) return;
      const id = Number(button.dataset.serviceId);
      const service = cachedServices.find(item => item.id === id);
      if (!service) return;

      if (button.dataset.serviceAction === 'edit') {
        const form = document.getElementById('service-form');
        if (!form) return;
        form.elements.name.value = service.name;
        form.elements.description.value = service.description || '';
        form.elements.category.value = service.category;
        form.elements.price.value = Number(service.price).toFixed(2);
        form.elements.durationMinutes.value = service.durationMinutes;
        form.dataset.editingId = String(service.id);
        const submitButton = form.querySelector('button[type="submit"]');
        if (submitButton) submitButton.innerHTML = '<i class="bx bx-save" aria-hidden="true"></i><span>Salvar alterações</span>';
        setServiceFormMessage(`Editando: ${service.name}`, 'success');
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
        form.elements.name.focus({ preventScroll: true });
        return;
      }

      if (button.dataset.serviceAction === 'toggle') {
        button.disabled = true;
        try {
          const response = await authenticatedFetch(`/api/services/${id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ active: button.dataset.active !== 'true' })
          });
          if (!response) return;
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(data.error || 'Não foi possível alterar o status.');
          await loadServices();
        } catch (error) {
          console.error('Erro ao alterar status do serviço:', error);
          setServiceFormMessage(error.message || 'Não foi possível alterar o status.');
        } finally {
          button.disabled = false;
        }
      }
    }

    function showBarberAccessNotice() {
      const form = document.getElementById('barber-form');
      const list = document.getElementById('barbers-list');
      const count = document.getElementById('barbers-count');

      form?.querySelectorAll('input, button').forEach(element => {
        element.disabled = true;
      });
      setBarberFormMessage('Somente administradores podem cadastrar ou consultar a equipe.', 'error');

      if (list) {
        list.innerHTML = `
          <tr>
            <td colspan="4">
              <div class="barber-empty-state">
                <i class="bx bx-lock-alt" aria-hidden="true"></i>
                <strong>Acesso restrito</strong>
                <span>Você pode acessar as páginas operacionais pelo menu lateral.</span>
              </div>
            </td>
          </tr>`;
      }
      if (count) {
        count.innerHTML = '<i class="bx bx-lock-alt" aria-hidden="true"></i> Acesso restrito';
      }
    }

    async function handleBarberSubmit(e) {
      e.preventDefault();

      if (session.role !== 'admin') {
        setBarberFormMessage('Somente administradores podem cadastrar barbeiros.');
        return;
      }

      const form = e.currentTarget;
      const message = document.getElementById('barber-form-message');
      const submitButton = form.querySelector('button[type="submit"]');
      const name = form.elements.name.value.trim();
      const email = form.elements.email.value.trim();
      const phone = form.elements.phone.value.trim();
      const password = form.elements.password.value;
      const passwordConfirm = form.elements.passwordConfirm.value;

      setBarberFormMessage('');

      if (name.length < 3) {
        setBarberFormMessage('Informe o nome completo do barbeiro.');
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setBarberFormMessage('Informe um e-mail válido.');
        return;
      }
      if (phone && phone.replace(/\D/g, '').length < 10) {
        setBarberFormMessage('Informe um telefone com DDD ou deixe o campo vazio.');
        return;
      }
      if (password.length < 8) {
        setBarberFormMessage('A senha deve ter pelo menos 8 caracteres.');
        return;
      }
      if (password !== passwordConfirm) {
        setBarberFormMessage('A confirmação de senha não confere.');
        return;
      }

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="bx bx-loader-alt bx-spin" aria-hidden="true"></i><span>Cadastrando...</span>';
      }

      try {
        const response = await authenticatedFetch('/api/staff-users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            email,
            phone: phone || undefined,
            password,
            role: 'staff'
          })
        });

        if (!response) return;

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          setBarberFormMessage(data.error || 'Não foi possível cadastrar o barbeiro.');
          return;
        }

        form.reset();
        setBarberFormMessage('Barbeiro cadastrado com sucesso. O acesso por e-mail e senha já está liberado.', 'success');
        await loadBarbers();
      } catch (error) {
        console.error('Erro ao cadastrar barbeiro:', error);
        setBarberFormMessage('Não foi possível conectar ao servidor. Tente novamente.');
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.innerHTML = '<i class="bx bx-user-plus" aria-hidden="true"></i><span>Cadastrar barbeiro</span>';
        }
      }
    }

    function setBarberFormMessage(text, type = 'error') {
      const message = document.getElementById('barber-form-message');
      if (!message) return;
      message.textContent = text;
      message.classList.toggle('is-success', type === 'success');
    }

    async function loadBarbers() {
      const tbody = document.getElementById('barbers-list');
      const count = document.getElementById('barbers-count');
      if (!tbody) return;

      try {
        const response = await authenticatedFetch('/api/staff-users');
        if (!response) return;

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || 'Não foi possível carregar a equipe.');
        }

        const barbers = (data.staff || []).filter(member => member.role === 'staff');
        renderBarbersList(barbers);
        if (count) {
          count.innerHTML = `<i class="bx bx-group" aria-hidden="true"></i> ${barbers.length} ${barbers.length === 1 ? 'barbeiro' : 'barbeiros'}`;
        }
      } catch (error) {
        console.error('Erro ao carregar barbeiros:', error);
        tbody.innerHTML = `
          <tr>
            <td colspan="4">
              <div class="barber-empty-state">
                <i class="bx bx-error-circle" aria-hidden="true"></i>
                <strong>Não foi possível carregar a equipe</strong>
                <span>${escapeHtml(error.message || 'Tente atualizar a página.')}</span>
              </div>
            </td>
          </tr>`;
        if (count) {
          count.innerHTML = '<i class="bx bx-error-circle" aria-hidden="true"></i> Indisponível';
        }
      }
    }

    function renderBarbersList(barbers) {
      const tbody = document.getElementById('barbers-list');
      if (!tbody) return;

      if (barbers.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="4">
              <div class="barber-empty-state">
                <i class="bx bx-group" aria-hidden="true"></i>
                <strong>Nenhum barbeiro cadastrado</strong>
                <span>Use o formulário acima para criar o primeiro acesso da equipe.</span>
              </div>
            </td>
          </tr>`;
        return;
      }

      tbody.innerHTML = barbers.map(barber => `
        <tr>
          <td><strong>${escapeHtml(barber.name)}</strong></td>
          <td>${escapeHtml(barber.email)}</td>
          <td>${escapeHtml(barber.phone || 'Não informado')}</td>
          <td><span class="barber-status ${barber.active ? 'is-active' : 'is-inactive'}">${barber.active ? 'Ativo' : 'Inativo'}</span></td>
        </tr>
      `).join('');
    }

    async function handleProductSubmit(e) {
      e.preventDefault();
      alert('Produto cadastrado com sucesso! (Funcionalidade em desenvolvimento)');
      e.target.reset();
    }

    // ===========================
    // NOVO CLIENTE E NOVO AGENDAMENTO (novocliente.html / novagendamento.html)
    // ===========================

    function initNewClientPage() {
      const form = document.getElementById('formCliente');
      if (!form) return;

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('nome')?.value.trim();
        const phone = document.getElementById('telefone')?.value.trim();
        const email = document.querySelector('input[name="email"]')?.value.trim();
        const notes = document.querySelector('textarea[name="texto"]')?.value.trim();

        if (!name || !phone) {
          alert('Preencha pelo menos o nome e o telefone do cliente.');
          return;
        }

        try {
          const res = await authenticatedFetch('/api/clients', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, phone, email, notes })
          });

          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            alert(data.error || 'Erro ao cadastrar cliente.');
            return;
          }

          alert('Cliente cadastrado com sucesso no banco de dados!');
          form.reset();
          window.location.href = 'clients.html';
        } catch (err) {
          console.error('Erro ao cadastrar cliente:', err);
          alert('Não foi possível conectar ao servidor.');
        }
      });
    }

    function initNewAppointmentPage() {
      // Caso novagendamento.html seja usado, conecta o envio ao /api/appointments
      const submitBtn = document.querySelector('.btn-agendamentos button:last-child');
      if (!submitBtn) return;

      submitBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        const clientName = document.getElementById('cliente')?.value || 'Cliente Balcão';
        const serviceName = document.querySelector('.caixa-detalhes select')?.value || 'Corte Social';
        const staffName = document.querySelectorAll('.caixa-detalhes select')[1]?.value || 'Carlos';
        const date = document.querySelector('.caixa-data input')?.value || new Date().toISOString().split('T')[0];
        const notes = document.getElementById('observacoes')?.value || '';

        try {
          const res = await authenticatedFetch('/api/appointments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              client_name: clientName,
              client_phone: '11999999999',
              service_name: serviceName,
              staff_name: staffName,
              appointment_date: date,
              appointment_time: '10:00:00',
              notes
            })
          });

          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            alert(data.error || 'Erro ao criar agendamento.');
            return;
          }

          alert('Agendamento criado com sucesso no banco de dados!');
          window.location.href = 'agenda.html';
        } catch (err) {
          console.error('Erro ao criar agendamento:', err);
          alert('Não foi possível conectar ao servidor.');
        }
      });
    }

    // ===========================
    // DASHBOARD — Métricas reais
    // ===========================

    async function loadDashboard() {
      try {
        const response = await authenticatedFetch('/api/dashboard');
        if (!response) return;

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          console.error('[Dashboard] Erro ao carregar métricas:', data.error || response.status);
          renderDashboardError(data.error || 'Não foi possível carregar as métricas.');
          return;
        }

        const data = await response.json();
        renderDashboard(data);
      } catch (error) {
        console.error('[Dashboard] Erro ao carregar métricas:', error);
        renderDashboardError('Não foi possível conectar ao servidor.');
      }
    }

    function renderDashboardError(message) {
      const tbody = document.getElementById('appointments-tbody');
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="4" class="empty-state"><i class="bx bx-error-circle" aria-hidden="true"></i> ${escapeHtml(message)}</td></tr>`;
      }
      const chart = document.getElementById('week-chart');
      if (chart) {
        chart.innerHTML = `<div class="chart-loading"><i class="bx bx-error-circle" aria-hidden="true"></i> ${escapeHtml(message)}</div>`;
      }
    }

    function renderDashboard(data) {
      const { summary, week, nextAppointments } = data;

      // --- Cards de resumo ---
      setText('stat-appointments-today', summary.appointmentsToday);
      setDelta('stat-appointments-today-delta', summary.appointmentsTodayDelta);

      setText('stat-revenue-today', formatBRL(summary.revenueToday));
      setDelta('stat-revenue-today-delta', summary.revenueTodayDelta);

      setText('stat-upcoming-appointments', summary.upcomingAppointments);
      setText('stat-avg-ticket', formatBRL(summary.avgTicket));

      // --- Resumo semanal ---
      setText('week-total', formatBRL(week.total));
      const deltaEl = document.getElementById('week-delta');
      if (deltaEl) {
        const delta = week.deltaVsPreviousWeek;
        const arrow = delta >= 0 ? '↗' : '↘';
        deltaEl.textContent = `${arrow} ${Math.abs(delta)}% vs semana anterior`;
        deltaEl.style.color = delta >= 0 ? '#218c32' : '#c0392b';
      }

      // --- Gráfico semanal ---
      renderWeekChart(week.labels, week.series);

      // --- Próximos agendamentos ---
      renderNextAppointments(nextAppointments);

      // Dados futuros (avaliações, produto mais vendido, ranking de barbeiros)
      // chegam via data.future quando o backend implementar.
      if (data.future) {
        if (data.future.reviewsAverage != null) {
          console.log('[Dashboard] Média de avaliações:', data.future.reviewsAverage);
        }
        if (data.future.topProduct) {
          console.log('[Dashboard] Produto mais vendido:', data.future.topProduct);
        }
        if (data.future.topBarbers) {
          console.log('[Dashboard] Ranking de barbeiros:', data.future.topBarbers);
        }
      }
    }

    function setText(id, value) {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    }

    function setDelta(id, delta) {
      const el = document.getElementById(id);
      if (!el) return;
      const arrow = delta >= 0 ? '↗' : '↘';
      el.textContent = `${arrow} ${Math.abs(delta)}%`;
      el.style.color = delta >= 0 ? '#218c32' : '#c0392b';
    }

    function formatBRL(value) {
      return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    // ===========================
    // GRÁFICO SEMANAL (SVG dinâmico)
    // ===========================

    const WEEKDAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

    function renderWeekChart(labels, series) {
      const container = document.getElementById('week-chart');
      if (!container) return;

      const amounts = series.map(s => Number(s.amount));
      const maxVal = Math.max(...amounts, 1);
      const niceMax = Math.ceil(maxVal / 500) * 500 || 500;

      const W = 760, H = 300;
      const padLeft = 78, padRight = 40, padTop = 24, padBottom = 56;
      const chartW = W - padLeft - padRight;
      const chartH = H - padTop - padBottom;

      const x = i => padLeft + (chartW / (labels.length - 1)) * i;
      const y = v => padTop + chartH - (v / niceMax) * chartH;

      const gridLines = [0, 0.25, 0.5, 0.75, 1].map(f => {
        const gy = padTop + chartH - f * chartH;
        const val = Math.round(niceMax * f);
        return `<line x1="${padLeft}" x2="${W - padRight}" y1="${gy}" y2="${gy}"></line>
                <text x="8" y="${gy + 4}">R$ ${val.toLocaleString('pt-BR')}</text>`;
      }).join('');

      const points = amounts.map((v, i) => `${x(i)},${y(v)}`).join(' ');
      const areaPath = `M ${x(0)} ${y(amounts[0])} ${amounts.map((v, i) => `L ${x(i)} ${y(v)}`).join(' ')} L ${x(amounts.length - 1)} ${padTop + chartH} L ${x(0)} ${padTop + chartH} Z`;

      const circles = amounts.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="5"></circle>`).join('');

      const xLabels = labels.map((_, i) =>
        `<text text-anchor="middle" x="${x(i)}" y="${H - 16}">${WEEKDAY_LABELS[i]}</text>`
      ).join('');

      container.innerHTML = `
        <svg class="svg-chart dashboard-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Faturamento semanal">
          <defs>
            <linearGradient id="dashboardArea" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stop-color="#173f36" stop-opacity="0.25"></stop>
              <stop offset="100%" stop-color="#173f36" stop-opacity="0.01"></stop>
            </linearGradient>
          </defs>
          <g class="chart-grid">${gridLines}</g>
          <path class="chart-area" d="${areaPath}"></path>
          <polyline class="chart-line" points="${points}"></polyline>
          <g class="chart-points">${circles}</g>
          <g class="chart-x-labels">${xLabels}</g>
        </svg>
      `;
    }

    // ===========================
    // PRÓXIMOS AGENDAMENTOS
    // ===========================

    const STATUS_LABELS = {
      confirmado: { label: 'Confirmado', cls: 'green' },
      pendente: { label: 'Pendente', cls: 'yellow' },
      concluido: { label: 'Concluído', cls: 'green' },
      cancelado: { label: 'Cancelado', cls: 'yellow' },
    };

    function renderNextAppointments(list) {
      const tbody = document.getElementById('appointments-tbody');
      if (!tbody) return;

      if (!list || list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Nenhum agendamento futuro encontrado.</td></tr>';
        return;
      }

      tbody.innerHTML = list.map(appt => {
        const status = STATUS_LABELS[appt.status] || { label: appt.status, cls: 'yellow' };
        const time = String(appt.appointment_time).slice(0, 5);
        const dateLabel = formatDateShort(appt.appointment_date);
        return `
          <tr>
            <td><span class="time">${time}</span></td>
            <td><b>${escapeHtml(appt.client_name)}</b><small>${escapeHtml(appt.service_name)} · ${dateLabel}</small></td>
            <td><span class="barber"><i class="bx bx-user-circle"></i>${escapeHtml(appt.staff_name)}</span></td>
            <td><span class="pill ${status.cls}">${status.label}</span></td>
          </tr>
        `;
      }).join('');
    }

    function formatDateShort(dateStr) {
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    }

    // ===========================
    // UTILITÁRIOS
    // ===========================

    // Exporta funções globais se necessário
    window.viewClient = function(id) {
      alert(`Ver detalhes do cliente ${id} (em desenvolvimento)`);
    };
  } // Fim da função initPage()

  // Chama initPage após autenticação bem-sucedida
  initPage();

})();
