/**
 * 安鑫诊所 - 全局配置
 * 所有模块统一引用，保证配置一致
 */
require('dotenv').config();

const fs = require('fs');
const os = require('os');
const path = require('path');
let dbSocket = process.env.DB_SOCKET;
if (!dbSocket && process.platform === 'darwin') {
  const candidates = [
    `/tmp/mysql.sock`,
    `/opt/homebrew/var/mysql/${os.hostname()}.sock`,
    `/opt/homebrew/var/mysql/${os.hostname()}.local.sock`,
    `/usr/local/var/mysql/${os.hostname()}.sock`,
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        dbSocket = p;
        break;
      }
    } catch (_) {}
  }
  if (!dbSocket) {
    const dataDirs = ['/opt/homebrew/var/mysql', '/usr/local/var/mysql'];
    for (const dir of dataDirs) {
      try {
        const files = fs.readdirSync(dir);
        const sock = files.find((f) => f.endsWith('.sock'));
        if (sock) {
          dbSocket = path.join(dir, sock);
          break;
        }
      } catch (_) {}
    }
  }
}
const isProduction = process.env.NODE_ENV === 'production';
const dbPassword = process.env.DB_PASSWORD;
const jwtSecret = process.env.JWT_SECRET;

if (isProduction) {
  if (!dbPassword || dbPassword.trim() === '') {
    console.error('FATAL: DB_PASSWORD must be set in production. Refusing to start.');
    process.exit(1);
  }
  if (!jwtSecret || jwtSecret.trim() === '' || jwtSecret.length < 32) {
    console.error('FATAL: JWT_SECRET must be set in production and at least 32 chars. Refusing to start.');
    process.exit(1);
  }
  if (!process.env.PUBLIC_URL) {
    console.warn('⚠️ 生产环境建议设置 PUBLIC_URL，以便二维码指向正确网址');
  }
}

const db = {
  user: process.env.DB_USER || 'root',
  password: isProduction ? dbPassword : (dbPassword || 'Dyz051025'),
  database: process.env.DB_NAME || 'clinic_management',
};
if (dbSocket) {
  db.socketPath = dbSocket;
} else {
  db.host = process.env.DB_HOST || 'localhost';
  db.port = parseInt(process.env.DB_PORT, 10) || 3306;
}

const smsEnabled = process.env.SMS_ENABLED === 'true' || process.env.SMS_ENABLED === '1';
const smsProvider = process.env.SMS_PROVIDER || 'log';
const publicUrl = process.env.PUBLIC_URL || ''; // 二维码指向的网址，如 https://clinic.example.com

module.exports = {
  publicUrl,
  port: parseInt(process.env.PORT, 10) || 3000,
  jwtSecret: isProduction ? jwtSecret : (jwtSecret || 'anxin-clinic-secret-key-2026'),
  isProduction,
  saltRounds: 10,
  db,
  defaultDoctorUsername: 'dr_deng',
  sms: {
    enabled: smsEnabled,
    provider: smsProvider,
    aliyun: smsProvider === 'aliyun' ? {
      accessKeyId: process.env.SMS_ALIYUN_ACCESS_KEY_ID,
      accessKeySecret: process.env.SMS_ALIYUN_ACCESS_KEY_SECRET,
      signName: process.env.SMS_ALIYUN_SIGN_NAME,
      templateCode: process.env.SMS_ALIYUN_TEMPLATE_CODE,
      regionId: process.env.SMS_ALIYUN_REGION_ID || 'cn-hangzhou',
      endpoint: process.env.SMS_ALIYUN_ENDPOINT || undefined,
    } : null,
  },
  genderMap: { '男': 'male', '女': 'female', '其他': 'other' },
  genderReverse: { male: '男', female: '女', other: '其他' },
  appointmentStatusLabels: {
    pending: '待确认',
    confirmed: '已确认',
    completed: '已完成',
    cancelled: '已取消',
  },
};
