// features/shared/audit.js
// Registro de operações de tratamento de dados pessoais (LGPD - Art. 37)

async function audit(pool, { actor, actorRole, action, resourceType, resourceId, legalBasis, request }) {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS access_audit (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        actor_id VARCHAR(64) NULL,
        actor_role ENUM('client', 'staff', 'admin', 'anonymous') NOT NULL,
        action VARCHAR(60) NOT NULL,
        resource_type VARCHAR(40) NOT NULL,
        resource_id VARCHAR(64) NULL,
        legal_basis VARCHAR(40) NULL,
        ip VARCHAR(45) NULL,
        user_agent VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_audit_resource (resource_type, resource_id, created_at),
        INDEX idx_audit_actor (actor_id, created_at)
      )
    `);

    const actorId = actor?.userId || null;
    const role = actorRole || actor?.role || "anonymous";
    const ip = request?.ip || request?.socket?.remoteAddress || null;
    const userAgent = request?.get ? request.get("user-agent") : null;

    await pool.query(
      `INSERT INTO access_audit
         (actor_id, actor_role, action, resource_type, resource_id, legal_basis, ip, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [actorId, role, action, resourceType, resourceId ? String(resourceId) : null, legalBasis || "execucao_contrato", ip, userAgent]
    );
  } catch (error) {
    // Falha em log de auditoria não deve derrubar a requisição principal, mas deve ser registrada
    console.error("[Audit Log Error]:", error.message);
  }
}

module.exports = { audit };
