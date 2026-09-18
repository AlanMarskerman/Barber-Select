// DASHBOARD - INÍCIO DA ALTERAÇÃO: integração necessária para Dashboard/sidebar.
const session = getSession();
if (requireAuth(["staff", "admin"])) {
  renderSidebar(session.role, "dashboard.html");
  renderTopbar("Dashboard", session.role);
}
// DASHBOARD - FIM DA ALTERAÇÃO.
