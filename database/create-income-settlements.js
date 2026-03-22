/**
 * 创建 income_settlements 表（用于月度收入重置/结账）
 * 运行: node database/create-income-settlements.js
 */
const db = require('../db');

const SQL = `
CREATE TABLE IF NOT EXISTS income_settlements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  settled_at DATETIME NOT NULL,
  period VARCHAR(7) NOT NULL,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  record_count INT NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

async function main() {
  try {
    await db.execute(SQL);
    console.log('income_settlements 表已创建或已存在');
    process.exit(0);
  } catch (err) {
    console.error('创建表失败:', err.message);
    process.exit(1);
  }
}

main();
