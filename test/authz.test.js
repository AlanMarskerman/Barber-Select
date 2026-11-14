// test/authz.test.js
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

describe("Validação de regras e autorização", () => {
  const { STAFF_ROLES, ADMIN_ROLES } = require("../features/shared/roles");
  const { isValidEmail, isValidPhone, isValidCPF, isValidPassword } = require("../features/shared/validation");

  test("STAFF_ROLES deve conter apenas staff e admin", () => {
    assert.deepEqual(STAFF_ROLES, ["staff", "admin"]);
    assert.equal(STAFF_ROLES.includes("client"), false);
  });

  test("ADMIN_ROLES deve conter apenas admin", () => {
    assert.deepEqual(ADMIN_ROLES, ["admin"]);
    assert.equal(ADMIN_ROLES.includes("client"), false);
    assert.equal(ADMIN_ROLES.includes("staff"), false);
  });

  test("Validação de CPF deve validar dígitos verificadores e rejeitar sequências", () => {
    assert.equal(isValidCPF("11111111111"), false);
    assert.equal(isValidCPF("12345678900"), false);
    assert.equal(isValidCPF(""), true); // opcional
    assert.equal(isValidCPF(null), true);
  });

  test("Validação de e-mail deve aceitar apenas formatos válidos", () => {
    assert.equal(isValidEmail("cliente@barberselect.local"), true);
    assert.equal(isValidEmail("invalido"), false);
    assert.equal(isValidEmail("sem-arroba.com"), false);
  });

  test("Validação de telefone brasileiro", () => {
    assert.equal(isValidPhone("(11) 99999-8888"), true);
    assert.equal(isValidPhone("11999998888"), true);
    assert.equal(isValidPhone("123"), false);
  });

  test("Validação de senha deve ter tamanho mínimo e limite de 72 bytes", () => {
    assert.equal(isValidPassword("12345", 8), false);
    assert.equal(isValidPassword("12345678", 8), true);
    assert.equal(isValidPassword("a".repeat(73), 8), false);
  });
});
