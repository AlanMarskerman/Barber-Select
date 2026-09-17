// db.js
// Responsável por criar e reutilizar uma única conexão (pool) com o MySQL.
// Um "pool" é um conjunto de conexões prontas que o servidor reaproveita,
// em vez de abrir e fechar uma conexão nova para cada requisição.

const mysql = require("mysql2/promise");
// "mysql2/promise" é a versão do driver mysql2 que trabalha com async/await
// em vez de callbacks. É a biblioteca que realmente conversa com o MySQL.

let pool;
// Variável que vai guardar o pool depois que ele for criado pela primeira vez.
// Começa "undefined" porque o pool ainda não existe.

function getPool() {
  // Função exportada que qualquer outro arquivo pode chamar para
  // obter o pool de conexões, sem se preocupar se ele já existe ou não.

  if (!pool) {
    // Só cria o pool se ainda não tiver sido criado antes (evita abrir
    // várias conexões desnecessárias se getPool() for chamado várias vezes).

    pool = mysql.createPool({
      host: process.env.DB_HOST || "localhost",
      // Endereço do servidor MySQL. "localhost" porque o MySQL do XAMPP
      // roda na mesma máquina.

      user: process.env.DB_USER || "root",
      // Usuário do MySQL. "root" é o padrão do XAMPP.

      password: process.env.DB_PASSWORD || "",
      // Senha do usuário. No XAMPP, por padrão, é uma string vazia.

      database: process.env.DB_NAME || "barber_select",
      // Nome do banco que criamos no schema.sql.

      waitForConnections: true,
      // Se todas as conexões do pool estiverem ocupadas, novas requisições
      // esperam na fila em vez de dar erro imediatamente.

      connectionLimit: 10,
      // Número máximo de conexões simultâneas que o pool pode abrir.
    });
  }

  return pool;
  // Devolve o pool (recém-criado ou já existente) para quem chamou a função.
}

module.exports = { getPool };
// Exporta a função getPool para que register-server.js possa importá-la
// com: const { getPool } = require("./db");
