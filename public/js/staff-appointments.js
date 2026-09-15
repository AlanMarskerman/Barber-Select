requireAuth("staff");
renderSidebar("staff", "appointments.html");
renderTopbar("Agenda", "staff");

const appointmentForm = document.getElementById("appointment-form");

if (appointmentForm) {
  appointmentForm.addEventListener("submit", (event) => {
    event.preventDefault();

    alert("Este formulário usaria o token para gravar no backend.");
  });
}
