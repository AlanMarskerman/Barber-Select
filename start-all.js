// DASHBOARD/INTEGRAÇÃO - Inicializa os servidores necessários pela versão integrada.
const { spawn } = require("child_process");
const path = require("path");

const processes = [
  spawn(process.execPath, [path.join(__dirname, "server.js")], {
    stdio: "inherit",
  }),
  spawn(process.execPath, [path.join(__dirname, "features", "cadastro-mysql", "register-server.js")], {
    stdio: "inherit",
  }),
];

function stopAll() {
  for (const child of processes) {
    if (!child.killed) child.kill();
  }
}

process.on("SIGINT", () => {
  stopAll();
  process.exit(0);
});
process.on("SIGTERM", () => {
  stopAll();
  process.exit(0);
});

for (const child of processes) {
  child.on("exit", (code) => {
    if (code && code !== 0) {
      stopAll();
      process.exit(code);
    }
  });
}
