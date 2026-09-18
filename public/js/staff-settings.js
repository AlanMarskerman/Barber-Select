// DASHBOARD - INÍCIO DA ALTERAÇÃO: integração necessária para Dashboard/sidebar.
const session = getSession();
if (requireAuth(["staff", "admin"])) {
  renderSidebar(session.role, "settings.html");
  renderTopbar("Configurações", session.role);
}
// DASHBOARD - FIM DA ALTERAÇÃO.
