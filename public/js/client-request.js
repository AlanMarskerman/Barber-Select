requireAuth("client");
renderSidebar("client", "request.html");
renderTopbar("Solicitar horário", "client");

const requestForm = document.getElementById("request-form");

if (requestForm) {
  requestForm.addEventListener("submit", (event) => {
    event.preventDefault();

    alert(
      "No backend, esta solicitação seria ligada ao token do cliente e gravada via API protegida.",
    );
  });
}
