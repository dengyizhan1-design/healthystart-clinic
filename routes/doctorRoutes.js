/**
 * 安鑫诊所 - 医生端路由
 * 路径前缀: /api
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../db');
const config = require('../config');
const { doctorRequired, isValidPhone, normalizePhone } = require('../lib/auth');

const router = express.Router();
const { genderReverse, jwtSecret, defaultDoctorUsername } = config;

// 确保本地影像上传目录存在（后续可替换为云存储）
const uploadRoot = path.join(__dirname, '..', 'uploads');
const imageDir = path.join(uploadRoot, 'patient-images');
try {
  fs.mkdirSync(imageDir, { recursive: true });
} catch (_) {}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, imageDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname || '') || '.jpg';
    const name = Date.now() + '-' + Math.round(Math.random() * 1e9) + ext;
    cb(null, name);
  },
});

const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const imageUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (IMAGE_MIMES.includes(file.mimetype)) return cb(null, true);
    cb(new Error('仅允许上传图片文件（JPEG/PNG/WebP/GIF）'), false);
  },
});

// POST /api/doctor/login
router.post('/doctor/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const u = username || defaultDoctorUsername;
    if (!password) return res.json({ success: false, message: '请输入密码' });

    const user = await db.queryOne(
      "SELECT id, username, password, name FROM users WHERE username = ? AND role = 'doctor'",
      [u]
    );
    if (!user) return res.json({ success: false, message: '账号不存在或无医生权限' });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.json({ success: false, message: '密码错误' });

    const token = jwt.sign({ id: user.id, role: 'doctor', name: user.name }, jwtSecret, { expiresIn: '8h' });
    res.json({ success: true, message: '登录成功', token, doctorName: user.name });
  } catch (err) {
    console.error('医生登录错误:', err);
    res.json({ success: false, message: '服务器错误' });
  }
});

// GET /api/patients/count (需医生登录) — 必须定义在 /patients/:phone 之前，否则 "count" 会被当作 :phone
router.get('/patients/count', doctorRequired, async (req, res) => {
  try {
    const row = await db.queryOne('SELECT COUNT(*) AS total FROM patients');
    res.json({ success: true, total: row ? parseInt(row.total, 10) : 0 });
  } catch (err) {
    res.json({ success: true, total: 0 });
  }
});

// GET /api/doctor/pending-appointments (需医生登录) — 待确认的新预约
router.get('/doctor/pending-appointments', doctorRequired, async (req, res) => {
  try {
    const rows = await db.query(
      `SELECT a.id, a.appointment_date, a.notes, p.name AS patient_name, p.phone AS patient_phone
       FROM appointments a
       JOIN patients p ON a.patient_id = p.id
       WHERE a.status = 'pending'
       ORDER BY a.appointment_date ASC`
    );
    const list = rows.map((r) => {
      const d = r.appointment_date ? new Date(r.appointment_date) : null;
      return {
        id: r.id,
        patient_name: r.patient_name,
        patient_phone: r.patient_phone,
        date: d ? d.toISOString().slice(0, 10) : '',
        time: d ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : '',
        notes: r.notes || '',
      };
    });
    res.json({ success: true, appointments: list });
  } catch (err) {
    console.error('获取待确认预约错误:', err);
    res.json({ success: false, appointments: [] });
  }
});

// GET /api/doctor/patients (需医生登录)
router.get('/doctor/patients', doctorRequired, async (req, res) => {
  try {
    const rows = await db.query(
      `SELECT p.id, p.name, p.phone, p.gender, p.birth_date, p.created_at FROM patients p ORDER BY p.created_at DESC`
    );
    const patients = rows.map((p) => ({
      id: p.id,
      name: p.name,
      phone: p.phone,
      gender: genderReverse[p.gender] || p.gender,
      age: p.birth_date ? new Date().getFullYear() - new Date(p.birth_date).getFullYear() : null,
    }));
    res.json({ success: true, patients });
  } catch (err) {
    console.error('获取患者列表错误:', err);
    res.json({ success: false, patients: [] });
  }
});

// 生成短期签名 URL 供前端 img 加载影像（5 分钟有效）
function createImageToken(filename) {
  return jwt.sign(
    { file: filename, exp: Math.floor(Date.now() / 1000) + 5 * 60 },
    jwtSecret
  );
}

// GET /api/patients/:id/images (需医生登录) - 查看患者影像列表，返回带签名 token 的 URL
router.get('/patients/:id/images', doctorRequired, async (req, res) => {
  const patientId = parseInt(req.params.id, 10);
  if (!Number.isInteger(patientId) || patientId < 1) {
    return res.json({ success: false, message: '无效患者ID', images: [] });
  }
  try {
    const rows = await db.query(
      'SELECT id, image_url, category, note, created_at FROM patient_images WHERE patient_id = ? ORDER BY created_at DESC',
      [patientId]
    );
    const images = rows.map((r) => {
      const fn = path.basename(r.image_url || '');
      const signedUrl = fn
        ? '/api/patient-images/' + encodeURIComponent(fn) + '?token=' + createImageToken(fn)
        : r.image_url;
      return { ...r, image_url: signedUrl };
    });
    res.json({ success: true, images });
  } catch (err) {
    console.error('获取影像列表错误:', err);
    res.json({ success: false, images: [] });
  }
});

// GET /api/patients/:phone (需医生登录)
router.get('/patients/:phone', doctorRequired, async (req, res) => {
  const phone = normalizePhone(req.params.phone);
  if (!isValidPhone(phone)) return res.json({ success: false, message: '无效手机号' });

  try {
    const patient = await db.queryOne(
      'SELECT id, name, phone, gender, birth_date, address, created_at FROM patients WHERE phone = ?',
      [phone]
    );
    if (!patient) return res.json({ success: false, message: '未找到该患者' });

    const reg = await db.queryOne('SELECT * FROM patient_registrations WHERE patient_id = ?', [patient.id]);
    const appointmentsRaw = await db.query(
      'SELECT * FROM appointments WHERE patient_id = ? ORDER BY appointment_date DESC',
      [patient.id]
    );
    const recordsRaw = await db.query(
      'SELECT * FROM medical_records WHERE patient_id = ? ORDER BY visit_date DESC',
      [patient.id]
    );

    const appointments = appointmentsRaw.map((apt) => {
      const d = apt.appointment_date ? new Date(apt.appointment_date) : null;
      return {
        ...apt,
        date: d ? d.toISOString().slice(0, 10) : '',
        time: d ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : '',
        reason: apt.notes || '',
      };
    });

    const records = recordsRaw.map((r) => {
      let prescriptions = [];
      try {
        prescriptions = JSON.parse(r.prescription || '[]');
      } catch (_) {}
      return {
        ...r,
        prescriptions,
        create_at: r.visit_date,
        price: r.total_fee != null ? r.total_fee : 0,
      };
    });

    // 身份证号脱敏：仅展示后4位
    const safeReg = reg
      ? {
          ...reg,
          id_number:
            reg.id_number && reg.id_number.length > 4
              ? '*'.repeat(reg.id_number.length - 4) + reg.id_number.slice(-4)
              : reg.id_number,
        }
      : reg;

    res.json({
      success: true,
      patient: {
        id: patient.id,
        name: patient.name,
        phone: patient.phone,
        gender: genderReverse[patient.gender] || patient.gender,
        age: patient.birth_date ? new Date().getFullYear() - new Date(patient.birth_date).getFullYear() : null,
        address: patient.address,
        created_at: patient.created_at,
      },
      registration: safeReg,
      appointments,
      records,
    });
  } catch (err) {
    console.error('查询患者错误:', err);
    res.json({ success: false, message: '查询失败' });
  }
});

// POST /api/patients/:id/images (需医生登录) - 上传患者影像（本地存储，后续可替换云存储）
router.post('/patients/:id/images', doctorRequired, (req, res, next) => {
  imageUpload.single('image')(req, res, (err) => {
    if (err) {
      return res.json({ success: false, message: err.message || '请上传图片文件（JPEG/PNG/WebP/GIF）' });
    }
    next();
  });
}, async (req, res) => {
  const patientId = parseInt(req.params.id, 10);
  if (!Number.isInteger(patientId) || patientId < 1) {
    return res.json({ success: false, message: '无效患者ID' });
  }
  if (!req.file) {
    return res.json({ success: false, message: '请上传图片文件' });
  }
  const doctorId = req.user?.id;
  let category = (req.body.category || '').trim() || null;
  let note = (req.body.note || '').trim() || null;
  if (category && category.length > 100) category = category.slice(0, 100);
  if (note && note.length > 500) note = note.slice(0, 500);
  const urlPath = '/uploads/patient-images/' + req.file.filename;
  try {
    await db.execute(
      'INSERT INTO patient_images (patient_id, doctor_id, image_url, category, note, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
      [patientId, doctorId, urlPath, category, note]
    );
    res.json({ success: true, message: '上传成功', image: { image_url: urlPath, category, note } });
  } catch (err) {
    console.error('保存影像错误:', err);
    res.json({ success: false, message: '保存失败' });
  }
});

const MAX_TEXT = 2000; // 症状、诊断、治疗方案等单字段最大字符
const MAX_PRESCRIPTION_JSON = 10000; // 处方 JSON 字符串最大长度

// POST /api/records (需医生登录)
router.post('/records', doctorRequired, async (req, res) => {
  try {
    const { patient_id, symptoms, diagnosis, treatment, doctor, prescriptions, price } = req.body;
    const doctorId = req.user?.id;
    const pid = parseInt(patient_id, 10);
    if (!Number.isInteger(pid) || pid < 1 || !symptoms || !diagnosis || !doctor) {
      return res.json({ success: false, message: '请填写必填项（症状、诊断、医生）并选择有效患者' });
    }
    const s = String(symptoms || '').trim();
    const d = String(diagnosis || '').trim();
    const t = String(treatment || '').trim();
    const doc = String(doctor || '').trim();
    if (s.length > MAX_TEXT || d.length > MAX_TEXT || t.length > MAX_TEXT || doc.length > 200) {
      return res.json({ success: false, message: '输入内容过长，请精简后重试' });
    }
    const prescriptionText = JSON.stringify(prescriptions || []);
    if (prescriptionText.length > MAX_PRESCRIPTION_JSON) {
      return res.json({ success: false, message: '处方内容过长，请减少药品数量或备注' });
    }
    const totalFee = parseFloat(price) || 0;

    try {
      await db.execute(
        `INSERT INTO medical_records (patient_id, doctor_id, symptoms, diagnosis, treatment, prescription, total_fee, visit_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
        [pid, doctorId, s, d, t, prescriptionText, totalFee]
      );
    } catch (colErr) {
      if (colErr.code === 'ER_BAD_FIELD_ERROR' && colErr.message?.includes('total_fee')) {
        await db.execute(
          `INSERT INTO medical_records (patient_id, doctor_id, symptoms, diagnosis, treatment, prescription, visit_date)
           VALUES (?, ?, ?, ?, ?, ?, NOW())`,
          [pid, doctorId, s, d, t, prescriptionText]
        );
      } else throw colErr;
    }
    res.json({ success: true, message: '病历保存成功' });
  } catch (err) {
    console.error('保存病历错误:', err);
    res.json({ success: false, message: '保存失败' });
  }
});

// PUT /api/appointments/:id/status (需医生登录)
router.put('/appointments/:id/status', doctorRequired, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id < 1) return res.json({ success: false, message: '无效预约ID' });
  const { status } = req.body;
  const valid = ['pending', 'confirmed', 'completed', 'cancelled'];
  if (!valid.includes(status)) return res.json({ success: false, message: '无效状态' });
  try {
    const r = await db.execute('UPDATE appointments SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ success: r.affectedRows > 0, message: r.affectedRows > 0 ? '状态更新成功' : '预约不存在' });
  } catch (err) {
    res.json({ success: false, message: '更新失败' });
  }
});

// 获取最近一次收入结账时间（用于计算“本月收入”起算点）
async function getLastSettlementCutoff() {
  try {
    const row = await db.queryOne('SELECT settled_at FROM income_settlements ORDER BY settled_at DESC LIMIT 1');
    return row ? row.settled_at : null;
  } catch (_) {
    return null;
  }
}

// POST /api/income/reset (需医生登录) — 必须定义在 GET /income 之前，否则 Express 可能无法正确匹配
router.post('/income/reset', doctorRequired, async (req, res) => {
  const fail = (step, err) => {
    const msg = (err && (err.sqlMessage || err.message)) || String(err);
    console.error('收入结账失败 [' + step + ']:', msg);
    res.json({ success: false, message: step + ': ' + msg });
  };

  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS income_settlements (
        id INT AUTO_INCREMENT PRIMARY KEY,
        settled_at DATETIME NOT NULL,
        period VARCHAR(7) NOT NULL,
        amount DECIMAL(12,2) NOT NULL DEFAULT 0,
        record_count INT NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  } catch (e) {
    return fail('创建表', e);
  }

  try {
    const lastCutoff = await getLastSettlementCutoff();
    let cutoffStr = '1970-01-01 00:00:00';
    if (lastCutoff) {
      const d = lastCutoff instanceof Date ? lastCutoff : new Date(lastCutoff);
      cutoffStr = d.toISOString().slice(0, 19).replace('T', ' ');
    }

    const row = await db.queryOne(
      `SELECT COALESCE(SUM(total_fee),0) AS amount, COUNT(*) AS record_count FROM medical_records WHERE visit_date > ?`,
      [cutoffStr]
    );
    const amount = parseFloat(row?.amount || 0) || 0;
    const recordCount = parseInt(row?.record_count, 10) || 0;

    const now = new Date();
    const yearMonth = now.toISOString().slice(0, 7);

    await db.execute(
      'INSERT INTO income_settlements (settled_at, period, amount, record_count) VALUES (NOW(), ?, ?, ?)',
      [yearMonth, amount, recordCount]
    );

    res.json({
      success: true,
      message: '本月收入已结账，计数已重置',
      settled: { amount, record_count: recordCount, year_month: yearMonth },
    });
  } catch (err) {
    return fail('结账', err);
  }
});

// GET /api/income (需医生登录)
router.get('/income', doctorRequired, async (req, res) => {
  const empty = { total_income: 0, total_records: 0, today_income: 0, today_count: 0, month_income: 0, month_count: 0, recent_transactions: [] };
  try {
    let totalRow = empty;
    let todayRow = { income: 0, count: 0 };
    let monthRow = { income: 0, count: 0 };
    let recentRaw = [];
    try {
      totalRow = (await db.queryOne('SELECT COALESCE(SUM(total_fee),0) AS total_income, COUNT(*) AS total_records FROM medical_records')) || totalRow;
    } catch (_) {}
    const today = new Date().toISOString().slice(0, 10);
    try {
      todayRow = (await db.queryOne(`SELECT COALESCE(SUM(total_fee),0) AS income, COUNT(*) AS count FROM medical_records WHERE DATE(visit_date)=?`, [today])) || todayRow;
    } catch (_) {}
    // 本月收入：自上次结账之后的记录；若从未结账，则从当月 1 日起算
    const lastCutoff = await getLastSettlementCutoff();
    const monthStart = today.slice(0, 7) + '-01';
    const cutoff = lastCutoff ? lastCutoff : monthStart;
    try {
      monthRow = (await db.queryOne(
        `SELECT COALESCE(SUM(total_fee),0) AS income, COUNT(*) AS count FROM medical_records WHERE visit_date > ?`,
        [cutoff]
      )) || monthRow;
    } catch (_) {}
    try {
      recentRaw = await db.query(
        `SELECT mr.total_fee AS price, mr.diagnosis, p.name AS patient_name FROM medical_records mr
         LEFT JOIN patients p ON mr.patient_id=p.id ORDER BY mr.visit_date DESC LIMIT 10`
      );
    } catch (_) {}

    res.json({
      success: true,
      total_income: parseFloat(totalRow.total_income) || 0,
      total_records: parseInt(totalRow.total_records, 10) || 0,
      today_income: parseFloat(todayRow.income) || 0,
      today_count: parseInt(todayRow.count, 10) || 0,
      month_income: parseFloat(monthRow.income) || 0,
      month_count: parseInt(monthRow.count, 10) || 0,
      recent_transactions: (recentRaw || []).map((r) => ({
        patient_name: r.patient_name,
        diagnosis: r.diagnosis,
        price: parseFloat(r.price) || 0,
      })),
    });
  } catch (err) {
    res.json({ ...empty, success: true });
  }
});

module.exports = router;
