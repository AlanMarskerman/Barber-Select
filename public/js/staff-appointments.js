// DASHBOARD - INÍCIO DA ALTERAÇÃO: integração necessária para Dashboard/sidebar.
const session = getSession();
if (requireAuth(["staff", "admin"])) {
  renderSidebar(session.role, "appointments.html");
  renderTopbar("Agenda", session.role);
}
// DASHBOARD - FIM DA ALTERAÇÃO.
const appointmentForm = document.getElementById("appointment-form");
// DASHBOARD - INÍCIO DA ALTERAÇÃO: integração necessária para Dashboard/sidebar.
if (appointmentForm) appointmentForm.addEventListener("submit", (event) => { event.preventDefault(); alert("Este formulário usaria o token para gravar no backend."); });
// DASHBOARD - FIM DA ALTERAÇÃO.
