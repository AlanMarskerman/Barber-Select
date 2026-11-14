// features/shared/transaction.js
// Helper centralizado para transações ACID com caminho único de liberação de conexão

async function withTransaction(getPool, fn) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const result = await fn(connection);
    await connection.commit();
    return result;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

module.exports = { withTransaction };
