/**
 * 安鑫诊所 - MySQL 数据库连接
 * 与 config.js 配合使用
 */
const mysql = require('mysql2/promise');
const config = require('./config');

let pool = null;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      ...config.db,
      waitForConnections: true,
      connectionLimit: 20,
      queueLimit: 50,
      connectTimeout: 10000,
      charset: 'utf8mb4',
    });
    pool.on('error', (err) => console.error('数据库连接池错误:', err.message));
  }
  return pool;
}

async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

async function query(sql, params = []) {
  const [rows] = await getPool().execute(sql, params);
  return rows;
}

async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

async function execute(sql, params = []) {
  const [result] = await getPool().execute(sql, params);
  return { affectedRows: result.affectedRows, insertId: result.insertId };
}

async function testConnection() {
  try {
    const rows = await query('SELECT 1 AS ok');
    return rows?.[0]?.ok === 1;
  } catch (err) {
    console.error('数据库连接失败:', err.message);
    return false;
  }
}

module.exports = { getPool, query, queryOne, execute, testConnection, closePool };
