/**
 * 重置默认医生账号密码为 anxin2026
 * 账号: dr_deng, dr_li, nurse li
 */
const bcrypt = require('bcryptjs');
const db = require('../db');
const config = require('../config');

async function main() {
  const plain = 'anxin2026';
  const hash = await bcrypt.hash(plain, config.saltRounds || 10);

  const usernames = ['dr_deng', 'dr_li', 'nurse li'];
  for (const u of usernames) {
    try {
      const r = await db.execute(
        "UPDATE users SET password = ? WHERE username = ? AND role = 'doctor'",
        [hash, u]
      );
      console.log(`医生账号 ${u}: 已更新 ${r.affectedRows} 行`);
    } catch (err) {
      console.error(`更新医生账号 ${u} 失败:`, err.message);
    }
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('重置医生密码脚本失败:', err);
  process.exit(1);
});

