// features/shared/validation.js
// Camada centralizada de validação

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email) {
  return typeof email === "string" && email.length <= 150 && EMAIL_REGEX.test(email.trim());
}

function isValidPhone(phone) {
  if (!phone) return true;
  const digits = String(phone).replace(/\D/g, "");
  return digits.length === 10 || digits.length === 11;
}

function isValidPassword(password, min = 8) {
  if (typeof password !== "string") return false;
  if (password.length < min) return false;
  if (Buffer.byteLength(password, "utf8") > 72) return false;
  return true;
}

function isValidCPF(cpf) {
  if (!cpf || String(cpf).trim() === "") return true;
  const cleanCpf = String(cpf).replace(/\D/g, "");
  if (cleanCpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cleanCpf)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleanCpf.charAt(i), 10) * (10 - i);
  }
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(cleanCpf.charAt(9), 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleanCpf.charAt(i), 10) * (11 - i);
  }
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(cleanCpf.charAt(10), 10)) return false;

  return true;
}

function escapeLike(val) {
  return String(val ?? "").replace(/[\\%_]/g, (match) => `\\${match}`);
}

module.exports = {
  isValidEmail,
  isValidPhone,
  isValidPassword,
  isValidCPF,
  escapeLike,
};
