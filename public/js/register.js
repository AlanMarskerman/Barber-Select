// register.js
// Sistema de cadastro de novos clientes

// Elementos do DOM
const registerForm = document.getElementById("register-form");
const registerMessage = document.getElementById("register-message");
const togglePassword = document.getElementById("toggle-password");
const togglePasswordConfirm = document.getElementById("toggle-password-confirm");
const passwordInput = document.getElementById("password");
const passwordConfirmInput = document.getElementById("password-confirm");

// Toggle mostrar/ocultar senha
if (togglePassword && passwordInput) {
  togglePassword.addEventListener("click", () => {
    const type = passwordInput.type === "password" ? "text" : "password";
    passwordInput.type = type;
    togglePassword.classList.toggle("bx-show");
    togglePassword.classList.toggle("bx-hide");
  });
}

// Toggle mostrar/ocultar confirmação de senha
if (togglePasswordConfirm && passwordConfirmInput) {
  togglePasswordConfirm.addEventListener("click", () => {
    const type = passwordConfirmInput.type === "password" ? "text" : "password";
    passwordConfirmInput.type = type;
    togglePasswordConfirm.classList.toggle("bx-show");
    togglePasswordConfirm.classList.toggle("bx-hide");
  });
}

// Função para exibir mensagens
function showMessage(text, type = "info") {
  registerMessage.textContent = text;
  registerMessage.className = `auth-message ${type}`;
  registerMessage.style.display = "block";
}

function hideMessage() {
  registerMessage.style.display = "none";
  registerMessage.textContent = "";
}

// Validação de e-mail
function isValidEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

// Validação de telefone (formato brasileiro)
function isValidPhone(phone) {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 11;
}

// Formatação de telefone enquanto digita
const phoneInput = document.getElementById("phone");
if (phoneInput) {
  phoneInput.addEventListener("input", (e) => {
    let value = e.target.value.replace(/\D/g, "");

    if (value.length <= 11) {
      if (value.length <= 2) {
        e.target.value = value;
      } else if (value.length <= 6) {
        e.target.value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
      } else if (value.length <= 10) {
        e.target.value = `(${value.slice(0, 2)}) ${value.slice(2, 6)}-${value.slice(6)}`;
      } else {
        e.target.value = `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7, 11)}`;
      }
    } else {
      e.target.value = e.target.value.slice(0, -1);
    }
  });
}

// Handler do formulário de cadastro
if (registerForm) {
  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    // Obtém os valores do formulário
    const formData = new FormData(registerForm);
    const name = formData.get("name")?.trim();
    const email = formData.get("email")?.trim();
    const phone = formData.get("phone")?.trim();
    const password = formData.get("password");
    const passwordConfirm = formData.get("password-confirm");
    const terms = formData.get("terms");

    // Validações
    if (!name || name.length < 3) {
      showMessage("Por favor, insira seu nome completo.", "error");
      return;
    }

    if (!email || !isValidEmail(email)) {
      showMessage("Por favor, insira um e-mail válido.", "error");
      return;
    }

    if (!phone || !isValidPhone(phone)) {
      showMessage("Por favor, insira um telefone válido.", "error");
      return;
    }

    if (!password || password.length < 6) {
      showMessage("A senha deve ter pelo menos 6 caracteres.", "error");
      return;
    }

    if (password !== passwordConfirm) {
      showMessage("As senhas não coincidem.", "error");
      return;
    }

    if (!terms) {
      showMessage("Você precisa aceitar os termos de uso.", "error");
      return;
    }

    // Desabilita o botão durante o processo
    const submitButton = registerForm.querySelector(".btn-submit");
    const originalText = submitButton.innerHTML;
    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> Criando conta...';

    // Simula cadastro (em produção, aqui faria uma chamada para a API)
    showMessage("Criando sua conta...", "info");

    // TODO: Implementar endpoint de cadastro no servidor
    // Por enquanto, simula um delay e depois redireciona para login
    setTimeout(() => {
      showMessage("Conta criada com sucesso! Redirecionando para o login...", "success");

      setTimeout(() => {
        window.location.href = "login.html";
      }, 1500);
    }, 1500);

    // Exemplo de como seria a chamada real para a API:
    /*
    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          phone,
          password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        showMessage("Conta criada com sucesso! Redirecionando para o login...", "success");

        setTimeout(() => {
          window.location.href = "login.html";
        }, 1500);
      } else {
        showMessage(data.error || "Erro ao criar conta. Tente novamente.", "error");
        submitButton.disabled = false;
        submitButton.innerHTML = originalText;
      }
    } catch (error) {
      console.error("Erro ao criar conta:", error);
      showMessage("Não foi possível conectar ao servidor.", "error");
      submitButton.disabled = false;
      submitButton.innerHTML = originalText;
    }
    */
  });
} else {
  console.error("Formulário de cadastro não encontrado. Verifique o ID 'register-form'.");
}

// Limpa mensagens quando o usuário começa a digitar
const inputs = registerForm?.querySelectorAll("input");
inputs?.forEach((input) => {
  input.addEventListener("input", hideMessage);
});

// Validação em tempo real da confirmação de senha
if (passwordConfirmInput) {
  passwordConfirmInput.addEventListener("input", () => {
    if (passwordInput.value && passwordConfirmInput.value) {
      if (passwordInput.value !== passwordConfirmInput.value) {
        passwordConfirmInput.setCustomValidity("As senhas não coincidem");
      } else {
        passwordConfirmInput.setCustomValidity("");
      }
    }
  });
}
