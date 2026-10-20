const fs = require('node:fs');
const path = require('node:path');
const db = require('../config/db');

const csvPath = path.resolve(process.argv[2] || path.join(__dirname, '..', 'pos_menu_items.csv'));
const requiredColumns = [
  'item_id', 'category', 'item_name', 'description', 'food_type',
  'price_inr', 'available', 'image_prompt'
];

function parseCsv(contents) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < contents.length; index += 1) {
    const character = contents[index];
    if (quoted) {
      if (character === '"' && contents[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && contents[index + 1] === '\n') index += 1;
      row.push(field);
      if (row.some(value => value.length > 0)) rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error('The CSV contains an unclosed quoted field.');
  if (field.length || row.length) {
    row.push(field);
    if (row.some(value => value.length > 0)) rows.push(row);
  }
  return rows;
}

function categoryKey(name) {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function categoryMatchKey(name) {
  const value = name.trim().toLowerCase().replace(/\s+/g, ' ');
  if (value === 'starter' || value === 'starters') return 'starter';
  return value;
}

function readMenuRows() {
  const rows = parseCsv(fs.readFileSync(csvPath, 'utf8').replace(/^\uFEFF/, ''));
  const headers = rows.shift()?.map(value => value.trim());
  if (!headers || requiredColumns.some(column => !headers.includes(column))) {
    throw new Error(`CSV must include these columns: ${requiredColumns.join(', ')}`);
  }

  return rows.map((values, index) => {
    const record = Object.fromEntries(headers.map((header, column) => [header, (values[column] || '').trim()]));
    const line = index + 2;
    const price = Number(record.price_inr);
    if (!record.item_id || !record.category || !record.item_name || !Number.isFinite(price) || price < 0) {
      throw new Error(`CSV row ${line} is missing a required value or has an invalid price.`);
    }
    if (!['yes', 'no', 'true', 'false', '1', '0'].includes(record.available.toLowerCase())) {
      throw new Error(`CSV row ${line} has an invalid availability value.`);
    }
    if (!['veg', 'vegetarian', 'non-veg', 'nonveg', 'non-vegetarian'].includes(record.food_type.toLowerCase())) {
      throw new Error(`CSV row ${line} has an invalid food type.`);
    }
    return {
      ...record,
      image_url: record.image_url || null,
      price,
      isVeg: ['veg', 'vegetarian'].includes(record.food_type.toLowerCase()) ? 1 : 0,
      available: ['yes', 'true', '1'].includes(record.available.toLowerCase()) ? 1 : 0
    };
  });
}

async function ensureItemColumns(connection) {
  const [columns] = await connection.query('SHOW COLUMNS FROM items');
  const existing = new Set(columns.map(column => column.Field));
  const migrations = [
    ['description', 'ALTER TABLE items ADD COLUMN description TEXT NULL'],
    ['image_prompt', 'ALTER TABLE items ADD COLUMN image_prompt TEXT NULL'],
    ['image_url', 'ALTER TABLE items ADD COLUMN image_url VARCHAR(2048) NULL']
  ];
  for (const [name, statement] of migrations) {
    if (!existing.has(name)) await connection.query(statement);
  }
}

async function importMenu() {
  const records = readMenuRows();
  if (new Set(records.map(record => record.item_id)).size !== records.length) {
    throw new Error('The CSV contains duplicate item_id values.');
  }

  const connection = await db.getConnection();
  let transactionStarted = false;
  try {
    await ensureItemColumns(connection);
    await connection.beginTransaction();
    transactionStarted = true;

    const [categoryRows] = await connection.query('SELECT id, name FROM categories');
    const categoryIds = new Map(categoryRows.map(category => [categoryKey(category.name), category.id]));
    const importedCategoryNames = new Set(records.map(record => record.category));
    for (const categoryName of importedCategoryNames) {
      const key = categoryKey(categoryName);
      if (!categoryIds.has(key)) {
        const [result] = await connection.query('INSERT INTO categories(name) VALUES(?)', [categoryName]);
        categoryIds.set(key, result.insertId);
      }
    }

    let created = 0;
    let updated = 0;
    for (const record of records) {
      const categoryId = categoryIds.get(categoryKey(record.category));
      const [[sku]] = await connection.query('SELECT item_id FROM item_skus WHERE sku=?', [record.item_id]);
      let itemId = sku?.item_id;

      if (!itemId) {
        const [matches] = await connection.query(
          'SELECT i.id, c.name category_name FROM items i LEFT JOIN categories c ON c.id=i.category_id WHERE LOWER(i.name)=LOWER(?)',
          [record.item_name]
        );
        itemId = matches.find(match => categoryMatchKey(match.category_name || '') === categoryMatchKey(record.category))?.id;
      }

      if (itemId) {
        await connection.query(
          'UPDATE items SET name=?, category_id=?, base_price=?, is_veg=?, available=?, description=?, image_prompt=?, image_url=COALESCE(?, image_url) WHERE id=?',
          [record.item_name, categoryId, record.price, record.isVeg, record.available, record.description, record.image_prompt, record.image_url, itemId]
        );
        updated += 1;
      } else {
        const [result] = await connection.query(
          'INSERT INTO items(name, category_id, base_price, is_veg, available, description, image_prompt, image_url) VALUES(?,?,?,?,?,?,?,?)',
          [record.item_name, categoryId, record.price, record.isVeg, record.available, record.description, record.image_prompt, record.image_url]
        );
        itemId = result.insertId;
        created += 1;
      }

      await connection.query(
        'INSERT INTO item_skus(item_id, sku) VALUES(?, ?) ON DUPLICATE KEY UPDATE item_id=VALUES(item_id)',
        [itemId, record.item_id]
      );
    }

    await connection.commit();
    console.log(`Imported ${records.length} menu items (${created} created, ${updated} updated) across ${importedCategoryNames.size} CSV categories.`);
    console.log('Existing image URLs were preserved. The CSV contains image prompts, not actual pictures.');
  } catch (error) {
    if (transactionStarted) await connection.rollback();
    throw error;
  } finally {
    connection.release();
    await db.end();
  }
}

if (require.main === module) {
  importMenu().catch(error => {
    console.error(`Menu import failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { parseCsv, readMenuRows };
