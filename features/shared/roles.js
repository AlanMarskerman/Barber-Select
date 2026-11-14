// features/shared/roles.js
// Definições canônicas de perfis de acesso no sistema

const ROLES = {
  CLIENT: "client",
  STAFF: "staff",
  ADMIN: "admin",
};

const STAFF_ROLES = ["staff", "admin"];
const ADMIN_ROLES = ["admin"];
const ALL_ROLES = ["client", "staff", "admin"];

module.exports = {
  ROLES,
  STAFF_ROLES,
  ADMIN_ROLES,
  ALL_ROLES,
};
