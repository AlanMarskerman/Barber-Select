// auth-unified.js
// Sistema de login unificado que detecta automaticamente o perfil do usuário

// Mapeamento de credenciais para perfis (baseado no .env do servidor)
const PROFILE_MAP = {
  client: {
    endpoint: "http://localhost:3001/api/login",
    destination: "/client/home.html",
    label: "Cliente"
  },
  staff: {
    endpoint: "/auth/login/colaborador",
    destination: "/staff/dashboard.html",
    label: "Colaborador"
  },
  admin: {
    endpoint: "/auth/login/admin",
    destination: "/staff/finance.html",
    label: "Administrador"
  }
};

// Elementos do DOM
const loginForm = document.getElementById("unified-login-form");
const authMessage = document.getElementById("auth-message");
const togglePassword = document.getElementById("toggle-password");
const passwordInput = document.getElementById("password");

// Toggle mostrar/ocultar senha
if (togglePassword && passwordInput) {
  togglePassword.addEventListener("click", () => {
    const type = passwordInput.type === "password" ? "text" : "password";
    passwordInput.type = type;

    // Alterna o ícone
    togglePassword.classList.toggle("bx-show");
    togglePassword.classList.toggle("bx-hide");
  });
}

// Função para exibir mensagens
function showMessage(text, type = "info") {
  authMessage.textContent = text;
  authMessage.className = `auth-message ${type}`;
  authMessage.style.display = "block";
}

function hideMessage() {
  authMessage.style.display = "none";
  authMessage.textContent = "";
}

// Função para tentar login em um perfil específico
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
        token: data.token,
        role: data.role,
        destination: config.destination,
      };
    }

    return { success: false, error: data.error };
  } catch (error) {
    return { success: false, error: "Erro de conexão" };
  }
}

// Função principal de login unificado
async function unifiedLogin(identity, password) {
  // Tenta autenticar em todos os perfis em ordem de prioridade
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
    error: "Usuário ou senha incorretos."
  };
}

// Handler do formulário
if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    // Obtém os valores do formulário
    const formData = new FormData(loginForm);
    const identity = formData.get("identity")?.trim();
    const password = formData.get("password")?.trim();

    // Validação básica
    if (!identity || !password) {
      showMessage("Por favor, preencha todos os campos.", "error");
      return;
    }

    // Desabilita o botão durante o processo
    const submitButton = loginForm.querySelector(".btn-submit");
    const originalText = submitButton.innerHTML;
    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> Verificando...';

    // Exibe mensagem de loading
    showMessage("Verificando suas credenciais...", "info");

    // Tenta fazer login
    const result = await unifiedLogin(identity, password);

    if (result.success) {
      // Salva token e role no sessionStorage
      sessionStorage.setItem("token", result.token);
      sessionStorage.setItem("role", result.role);

      // Exibe mensagem de sucesso
      showMessage("Login realizado com sucesso! Redirecionando...", "success");

      // Redireciona após um breve delay
      setTimeout(() => {
        window.location.href = result.destination;
      }, 800);
    } else {
      // Exibe mensagem de erro
      showMessage(result.error || "Erro ao fazer login. Tente novamente.", "error");

      // Reabilita o botão
      submitButton.disabled = false;
      submitButton.innerHTML = originalText;
    }
  });
} else {
  console.error("Formulário de login não encontrado. Verifique o ID 'unified-login-form'.");
}

// Limpa mensagens quando o usuário começa a digitar
const inputs = loginForm?.querySelectorAll("input");
inputs?.forEach((input) => {
  input.addEventListener("input", hideMessage);
});
