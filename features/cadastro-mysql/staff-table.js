// features/cadastro-mysql/staff-table.js
// Cria a tabela staff_users (colaboradores e donos) se ela ainda não existir.
// Quem usa: staff-auth.js (login e rotas da equipe) e client-auth.js (o
// cadastro de cliente confere se o e-mail já é de alguém da equipe).
// O mesmo comando está no arquivo staff-schema.sql, caso você prefira criar a
// tabela à mão no phpMyAdmin. Se mudar um, mude o outro.

const CREATE_STAFF_TABLE = `
CREATE TABLE IF NOT EXISTS staff_users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  username VARCHAR(30) NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('staff', 'admin') NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`;
// role: 'staff' = colaborador, 'admin' = dono/administrador (são os mesmos
// nomes que o server.js já usa nos tokens).
// username é opcional: quem tiver pode entrar por e-mail OU por usuário.

let tableReady = null;

function ensureStaffTable(getPool) {
  // Roda o CREATE TABLE uma única vez (as chamadas seguintes reaproveitam a
  // mesma promessa). Se falhar, tenta de novo na próxima chamada.
  if (!tableReady) {
    tableReady = getPool()
      .query(CREATE_STAFF_TABLE)
      .catch((error) => {
        tableReady = null;
        throw error;
      });
  }
  return tableReady;
}

module.exports = { ensureStaffTable };
