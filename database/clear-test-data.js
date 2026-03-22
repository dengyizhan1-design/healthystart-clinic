/**
 * 清空测试数据：患者、预约、就诊记录、处方、影像、收入结账记录
 * 运行: node database/clear-test-data.js
 */
const db = require('../db');

async function main() {
  try {
    await db.execute('SET FOREIGN_KEY_CHECKS = 0');

    await db.execute('DELETE FROM patient_images');
    await db.execute('DELETE FROM medical_records');
    await db.execute('DELETE FROM appointments');
    await db.execute('DELETE FROM patient_registrations');
    try {
      await db.execute('DELETE FROM income_settlements');
    } catch (_) {}
    await db.execute('DELETE FROM patients');

    await db.execute('SET FOREIGN_KEY_CHECKS = 1');

    console.log('已清空：患者、预约、就诊记录、影像、收入结账');
  } catch (err) {
    console.error('清空失败:', err.message);
    process.exit(1);
  }
  process.exit(0);
}

main();
