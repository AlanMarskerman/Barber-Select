const params = new URLSearchParams(window.location.search);
const role = params.get("role") || "client";

const roleLabels = {
  client: "Área do cliente",
  staff: "Área da equipe",
  admin: "Administração",
};

const endpoints = {
  client: "/auth/login/cliente",
  staff: "/auth/login/colaborador",
  admin: "/auth/login/admin",
};

const destinations = {
  client: "/client/home.html",
  staff: "/staff/dashboard.html",
  admin: "/staff/finance.html",
};

const roleLabel = document.getElementById("role-label");
const loginForm = document.getElementById("login-form");
const authMessage = document.getElementById("auth-msg");

if (roleLabel) {
  roleLabel.textContent = roleLabels[role] || "Acesso";
}

if (!loginForm) {
  console.error("Formulário #login-form não foi encontrado.");
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const form = new FormData(loginForm);
  const identity = form.get("identity");
  const password = form.get("password");
  const endpoint = endpoints[role];

  console.log("Enviando login para:", endpoint);
  console.log("Perfil:", role);

  authMessage.textContent = "Verificando acesso...";

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        identity,
        password,
      }),
    });

    console.log("Status recebido:", response.status);

    const data = await response.json();

    if (!response.ok) {
      authMessage.textContent = data.error || "Usuário ou senha incorretos.";
      return;
    }

    sessionStorage.setItem("token", data.token);
    sessionStorage.setItem("role", data.role);

    authMessage.textContent = "Login realizado.";

    window.location.href = destinations[data.role];
  } catch (error) {
    console.error("Erro completo no login:", error);

    authMessage.textContent = "Não foi possível conectar ao servidor.";
  }
});
