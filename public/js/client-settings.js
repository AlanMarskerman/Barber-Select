const session = getSession();

requireAuth();

if (!session.role) {
  window.location.replace("/pages/auth.html?role=client");
} else {
  renderSidebar(session.role, "settings.html");
  renderTopbar("Configurações", session.role);
}
