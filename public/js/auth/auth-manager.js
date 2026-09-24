// js/auth/auth-manager.js
// Sistema de autenticação consolidado e corrigido

(function () {
  // ===========================
  // CONFIGURAÇÕES E MAPEAMENTOS
  // ===========================

  const PROFILE_MAP = {
    client: {
      endpoint: "/auth/login/cliente",
      destination: "/client/home.html",
      label: "Cliente",
    },
    staff: {
      endpoint: "/auth/login/colaborador",
      destination: "/staff/dashboard.html",
      label: "Colaborador",
    },
    admin: {
      endpoint: "/auth/login/admin",
      destination: "/staff/finance.html",
      label: "Administrador",
    },
  };

  // ===========================
  // DETECÇÃO DO TIPO DE LOGIN
  // ===========================

  // Verifica se é a página de login unificado (login.html)
  const isUnifiedLogin = document.getElementById("unified-login-form") !== null;

  // Verifica se é a página de login por role (auth.html)
  const isRoleLogin = document.getElementById("login-form") !== null && !isUnifiedLogin;

  // ===========================
  // ELEMENTOS DO DOM
  // ===========================

  const unifiedLoginForm = document.getElementById("unified-login-form");
  const roleLoginForm = document.getElementById("login-form");
  const authMessage = document.getElementById("auth-message") || document.getElementById("auth-msg");
  const togglePassword = document.getElementById("toggle-password");
  const passwordInput = document.getElementById("password");

  // ===========================
  // TOGGLE MOSTRAR/OCULTAR SENHA
  // ===========================

  if (togglePassword && passwordInput) {
    togglePassword.addEventListener("click", () => {
      const type = passwordInput.type === "password" ? "text" : "password";
      passwordInput.type = type;
      togglePassword.classList.toggle("bx-show");
      togglePassword.classList.toggle("bx-hide");
    });
  }

  // ===========================
  // FUNÇÕES DE MENSAGEM
  // ===========================

  function showMessage(text, type = "info") {
    if (!authMessage) return;
    authMessage.textContent = text;
    authMessage.className = isUnifiedLogin ? `auth-message ${type}` : "muted";
    authMessage.style.display = "block";
  }

  function hideMessage() {
    if (!authMessage) return;
    authMessage.style.display = "none";
    authMessage.textContent = "";
  }

  // ===========================
  // FUNÇÕES DE LOGIN
  // ===========================

  // Tenta fazer login em um perfil específico
  async function tryLogin(profile, identity, password) {
    const config = PROFILE_MAP[profile];

    try {
      const response = await fetch(config.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ identity, password }),
      });

      const data = await response.json();

      if (response.ok) {
        return {
          success: true,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          role: data.role,
          userId: data.userId,
          identity: data.identity,
          destination: config.destination,
        };
      }

      return { success: false, error: data.error };
    } catch (error) {
      return { success: false, error: "Erro de conexão" };
    }
  }

  // Login unificado: tenta autenticar em todos os perfis
  async function unifiedLogin(identity, password) {
    // CORREÇÃO DO BUG: Ordem de prioridade ajustada
    // Tenta client primeiro, depois staff, depois admin
    const profiles = ["client", "staff", "admin"];

    for (const profile of profiles) {
      const result = await tryLogin(profile, identity, password);

      if (result.success) {
        return result;
      }
    }

    // Se nenhum perfil funcionou
    return {
      success: false,
      error: "Usuário ou senha incorretos.",
    };
  }

  // Login por role específico (auth.html?role=client)
  async function roleBasedLogin(identity, password, role) {
    if (!PROFILE_MAP[role]) {
      return {
        success: false,
        error: "Perfil inválido.",
      };
    }

    return await tryLogin(role, identity, password);
  }

  // Salva a sessão no sessionStorage
  function saveSession(result) {
    sessionStorage.setItem("accessToken", result.accessToken);
    sessionStorage.setItem("refreshToken", result.refreshToken);
    sessionStorage.setItem("role", result.role);
    sessionStorage.setItem("userId", result.userId);
    sessionStorage.setItem("identity", result.identity);
  }

  // ===========================
  // HANDLER LOGIN UNIFICADO (login.html)
  // ===========================

  if (isUnifiedLogin && unifiedLoginForm) {
    unifiedLoginForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const formData = new FormData(unifiedLoginForm);
      const identity = formData.get("identity")?.trim();
      const password = formData.get("password")?.trim();

      if (!identity || !password) {
        showMessage("Por favor, preencha todos os campos.", "error");
        return;
      }

      const submitButton = unifiedLoginForm.querySelector(".btn-submit");
      const originalText = submitButton.innerHTML;
      submitButton.disabled = true;
      submitButton.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> Verificando...';

      showMessage("Verificando suas credenciais...", "info");

      const result = await unifiedLogin(identity, password);

      if (result.success) {
        saveSession(result);
        showMessage("Login realizado com sucesso! Redirecionando...", "success");

        setTimeout(() => {
          window.location.href = result.destination;
        }, 800);
      } else {
        showMessage(result.error || "Erro ao fazer login. Tente novamente.", "error");
        submitButton.disabled = false;
        submitButton.innerHTML = originalText;
      }
    });

    // Limpa mensagens quando o usuário começa a digitar
    const inputs = unifiedLoginForm.querySelectorAll("input");
    inputs.forEach((input) => {
      input.addEventListener("input", hideMessage);
    });
  }

  // ===========================
  // HANDLER LOGIN POR ROLE (auth.html?role=X)
  // ===========================

  if (isRoleLogin && roleLoginForm) {
    const params = new URLSearchParams(window.location.search);
    const role = params.get("role") || "client";

    const roleLabel = document.getElementById("role-label");
    if (roleLabel && PROFILE_MAP[role]) {
      roleLabel.textContent = PROFILE_MAP[role].label;
    }

    roleLoginForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const formData = new FormData(roleLoginForm);
      const identity = formData.get("identity");
      const password = formData.get("password");

      showMessage("Verificando acesso...");

      const result = await roleBasedLogin(identity, password, role);

      if (result.success) {
        saveSession(result);
        showMessage("Login realizado.");

        setTimeout(() => {
          window.location.href = result.destination;
        }, 500);
      } else {
        showMessage(result.error || "Usuário ou senha incorretos.");
      }
    });
  }
})();
