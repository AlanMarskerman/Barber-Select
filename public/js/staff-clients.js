// DASHBOARD - INÍCIO DA ALTERAÇÃO: integração necessária para Dashboard/sidebar.
const session = getSession();
if (requireAuth("staff")) {
  renderSidebar(session.role, "clients.html");
  renderTopbar("Clientes", session.role);
}
// DASHBOARD - FIM DA ALTERAÇÃO.
