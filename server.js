/**
 * 安鑫诊所 - 后端主入口
 * 四个板块：首页、患者注册/登录/预约、医生工作台
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const db = require('./db');

const REQUEST_TIMEOUT_MS = 30000;
const { authRequired } = require('./lib/auth');
const patientRoutes = require('./routes/patientRoutes');
const doctorRoutes = require('./routes/doctorRoutes');

const app = express();

// 若部署在 Nginx/反向代理后，需信任 X-Forwarded-* 头（HTTPS、真实 IP）
app.set('trust proxy', 1);

app.use(helmet({ contentSecurityPolicy: false }));
const corsOrigin = process.env.CORS_ORIGIN || '*';
if (config.isProduction && (corsOrigin === '*' || !process.env.CORS_ORIGIN)) {
  console.warn('⚠️ CORS: In production, set CORS_ORIGIN to your frontend origin. Using strict mode (same-origin only).');
}
app.use(cors({
  origin: config.isProduction && corsOrigin === '*' ? false : corsOrigin,
  methods: ['GET', 'POST', 'PUT'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '256kb' }));

app.use((req, res, next) => {
  const timer = setTimeout(() => {
    if (!res.headersSent) {
      res.status(504).json({ success: false, message: '请求超时，请重试' });
    }
  }, REQUEST_TIMEOUT_MS);
  res.on('finish', () => clearTimeout(timer));
  next();
});

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 500,
  message: { success: false, message: '请求过于频繁，请稍后再试' },
}));
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: '登录尝试过多，请15分钟后再试' },
});
app.use('/api/login', authLimiter);
app.use('/api/register', authLimiter);
app.use('/api/doctor/login', authLimiter);

// 影像文件：使用短期签名 token 访问，避免公开静态暴露
app.get('/api/patient-images/:filename', (req, res) => {
  const raw = req.params.filename || '';
  const basename = path.basename(raw);
  if (!/^[a-zA-Z0-9._-]+$/.test(basename)) {
    return res.status(400).json({ success: false, message: '无效文件名' });
  }
  const token = req.query.token;
  if (!token) return res.status(401).json({ success: false, message: '缺少访问凭证' });
  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    return res.status(403).json({ success: false, message: '凭证无效或已过期' });
  }
  if (payload.file !== basename) return res.status(403).json({ success: false, message: '凭证不匹配' });
  const filePath = path.join(__dirname, 'uploads', 'patient-images', basename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, message: '文件不存在' });
  res.sendFile(filePath, { headers: { 'Cache-Control': 'private, max-age=300' } }, (err) => {
    if (err && !res.headersSent) res.status(500).json({ success: false, message: '文件读取失败' });
  });
});

// API routes first (before static) to avoid any path conflicts
// Explicit GET /api/my/records so patient records are always reachable
app.get('/api/my/records', authRequired, async (req, res) => {
  if (req.user?.role !== 'patient') {
    return res.status(403).json({ success: false, message: '请使用患者账号登录', records: [] });
  }
  const patientId = parseInt(req.user?.id, 10);
  if (!Number.isInteger(patientId) || patientId < 1) {
    return res.status(401).json({ success: false, message: '请先登录', records: [] });
  }
  try {
    const rows = await db.query(
      `SELECT mr.id, mr.symptoms, mr.diagnosis, mr.treatment, mr.prescription, mr.total_fee, mr.visit_date, u.name AS doctor_name
       FROM medical_records mr
       LEFT JOIN users u ON mr.doctor_id = u.id
       WHERE mr.patient_id = ?
       ORDER BY mr.visit_date DESC`,
      [patientId]
    );
    const records = rows.map((r) => {
      let prescriptions = [];
      try {
        prescriptions = JSON.parse(r.prescription || '[]');
      } catch (_) {}
      return {
        id: r.id,
        visit_date: r.visit_date,
        symptoms: r.symptoms,
        diagnosis: r.diagnosis,
        treatment: r.treatment,
        total_fee: r.total_fee != null ? parseFloat(r.total_fee) : 0,
        doctor_name: r.doctor_name || '—',
        prescriptions,
      };
    });
    res.json({ success: true, records });
  } catch (err) {
    console.error('获取就诊记录错误:', err);
    res.json({ success: false, records: [] });
  }
});
app.use('/api', doctorRoutes);  // 医生端路由优先，确保 /income/reset 等能正确匹配
app.use('/api', patientRoutes);
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

['registration', 'login', 'appointment', 'doctor', 'my-records', 'qrcode'].forEach((name) => {
  app.get(`/${name}`, (req, res) => res.sendFile(path.join(__dirname, `${name}.html`)));
});

app.get('/api/site-url', (req, res) => {
  let url = config.publicUrl;
  if (!url) {
    const proto = req.get('x-forwarded-proto') || req.protocol;
    const host = req.get('x-forwarded-host') || req.get('host');
    url = (proto === 'https' ? 'https' : 'http') + '://' + host;
  }
  res.json({ url });
});

app.get('/api/health', async (req, res) => {
  const dbOk = await db.testConnection();
  res.json({ ok: true, database: dbOk });
});

// API 404：未被前面路由匹配的 /api/* 请求
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, message: '接口不存在' });
});

// 全局错误处理（捕获路由中未处理的异常）
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  console.error('请求错误:', err.message || err);
  res.status(500).json({ success: false, message: '服务器错误，请稍后重试' });
});

// 全局未捕获的 Promise 错误（防止静默失败）
process.on('unhandledRejection', (err) => {
  console.error('未捕获的 Promise 错误:', err);
});

let server = null;

function gracefulShutdown(signal) {
  console.log('\n收到 ' + signal + '，正在关闭...');
  if (server) {
    server.close(() => {
      db.closePool()
        .then(() => {
          console.log('已安全关闭');
          process.exit(0);
        })
        .catch((err) => {
          console.error('关闭数据库池失败:', err);
          process.exit(1);
        });
    });
    setTimeout(() => {
      console.error('强制退出');
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
}

async function start() {
  const dbOk = await db.testConnection();
  server = app.listen(config.port, () => {
    console.log('\n🚀 安鑫诊所服务已启动');
    console.log('   端口: ' + config.port + (config.isProduction ? ' (生产)' : ''));
    if (!dbOk) console.log('   ⚠️ 数据库连接失败，请检查 .env 配置\n');
    else console.log('');
  });

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

start().catch((err) => {
  console.error('启动失败:', err);
  process.exit(1);
});
