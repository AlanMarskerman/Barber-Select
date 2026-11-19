// scripts/reset-passwords.js
// Reseta as senhas padrão de admin e staff para desenvolvimento.
// Uso: node scripts/reset-passwords.js

const bcrypt = require("bcryptjs");
const mysql = require("mysql2/promise");
require("dotenv").config();

const ADMIN_PASS = "admin123";
const STAFF_PASS = "staff123";

async function main() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    const adminHash = await bcrypt.hash(ADMIN_PASS, 12);
    const staffHash = await bcrypt.hash(STAFF_PASS, 12);

    await pool.query(
      "UPDATE staff_users SET password_hash = ? WHERE email = ?",
      [adminHash, "admin@barberselect.local"]
    );
    console.log("✅ Senha do admin resetada para:", ADMIN_PASS);

    await pool.query(
      "UPDATE staff_users SET password_hash = ? WHERE email = ?",
      [staffHash, "staff@barberselect.local"]
    );
    console.log("✅ Senha do staff resetada para:", STAFF_PASS);
  } catch (e) {
    console.error("Erro ao resetar senhas:", e.message);
  } finally {
    await pool.end();
  }
}

main();
