requireAuth("client");
renderSidebar("client", "profile.html");
renderTopbar("Meu perfil", "client");

const profileForm = document.getElementById("profile-form");

if (profileForm) {
  profileForm.addEventListener("submit", (event) => {
    event.preventDefault();

    alert("Backend atualizaria o perfil usando o token do cliente.");
  });
}
