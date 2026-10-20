const db = require('../config/db');

async function migrateCheckoutSchema() {
  const connection = await db.getConnection();
  try {
    const [orderColumns] = await connection.query('SHOW COLUMNS FROM orders');
    const existingOrderColumns = new Set(orderColumns.map(column => column.Field));
    if (!existingOrderColumns.has('discount')) {
      await connection.query('ALTER TABLE orders ADD COLUMN discount DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER tax');
    }
    if (!existingOrderColumns.has('round_off')) {
      await connection.query('ALTER TABLE orders ADD COLUMN round_off DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER discount');
    }

    const [[duplicatePhones]] = await connection.query(
      "SELECT COUNT(*) AS count FROM (SELECT phone FROM customers WHERE phone IS NOT NULL AND phone <> '' GROUP BY phone HAVING COUNT(*) > 1) duplicates"
    );
    if (duplicatePhones.count) {
      throw new Error(`Cannot make customer mobile numbers unique: ${duplicatePhones.count} duplicate number groups need to be resolved first.`);
    }

    const [indexes] = await connection.query('SHOW INDEX FROM customers');
    if (!indexes.some(index => index.Key_name === 'phone' && index.Non_unique === 0)) {
      await connection.query('ALTER TABLE customers ADD UNIQUE INDEX phone (phone)');
    }
    console.log('Checkout columns and unique customer mobile number index are ready.');
  } finally {
    connection.release();
    await db.end();
  }
}

migrateCheckoutSchema().catch(error => {
  console.error(`Checkout database migration failed: ${error.message}`);
  process.exitCode = 1;
});
