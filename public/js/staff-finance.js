// DASHBOARD - INÍCIO DA ALTERAÇÃO: integração necessária para Dashboard/sidebar.
const session = getSession();
if (requireAuth("admin")) {
  renderSidebar(session.role, "finance.html");
  renderTopbar("Financeiro", session.role);
}
// DASHBOARD - FIM DA ALTERAÇÃO.
