/**
 * 安鑫诊所 - 患者端路由
 * 路径前缀: /api
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const config = require('../config');
const {
  generateToken,
  verifyToken,
  authRequired,
  isValidPhone,
  normalizePhone,
} = require('../lib/auth');
const { sendAppointmentReminder } = require('../lib/sms');
const router = express.Router();
const { genderMap } = config;

// POST /api/register
router.post('/register', async (req, res) => {
  try {
    const {
      name, phone, password, gender, age, birth_date,
      symptoms, preferred_date, preferred_time, medical_history, allergy_history,
      has_insurance, id_number, address, emergency_contact, emergency_phone,
    } = req.body;

    if (!name || !phone || !gender) {
      return res.json({ success: false, message: '请填写必填项（姓名、手机、性别）' });
    }
    if (name.length > 100 || (symptoms && symptoms.length > 2000)) {
      return res.json({ success: false, message: '输入内容过长' });
    }
    const cleanPhone = normalizePhone(phone);
    if (!isValidPhone(cleanPhone)) {
      return res.json({ success: false, message: '请输入有效的11位手机号' });
    }
    if (!password || password.length < 6) {
      return res.json({ success: false, message: '密码至少6位' });
    }
    if (!symptoms?.trim()) {
      return res.json({ success: false, message: '请描述症状或主诉' });
    }
    if (!has_insurance || !['有', '无'].includes(String(has_insurance))) {
      return res.json({ success: false, message: '请选择有无保险' });
    }

    const genderDb = genderMap[gender] || 'other';
    let birthDateVal = birth_date || null;
    if (!birthDateVal && age) {
      const ageNum = parseInt(age, 10);
      if (!Number.isNaN(ageNum) && ageNum >= 1 && ageNum <= 150) {
        birthDateVal = `${new Date().getFullYear() - ageNum}-01-01`;
      }
    }

    const passwordHash = await bcrypt.hash(password, config.saltRounds);
    const existing = await db.queryOne('SELECT id FROM patients WHERE phone = ?', [cleanPhone]);
    let patientId;

    if (existing) {
      patientId = existing.id;
      await db.execute(
        `UPDATE patients SET name=?, gender=?, birth_date=?, address=?,
         emergency_contact=?, emergency_phone=?, password_hash=?, updated_at=NOW() WHERE id=?`,
        [name, genderDb, birthDateVal, address || null, emergency_contact || null, emergency_phone || null, passwordHash, patientId]
      );
    } else {
      const ins = await db.execute(
        `INSERT INTO patients (name, gender, birth_date, phone, address, emergency_contact, emergency_phone, password_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [name, genderDb, birthDateVal, cleanPhone, address || null, emergency_contact || null, emergency_phone || null, passwordHash]
      );
      patientId = ins.insertId;
    }

    const regExists = await db.queryOne('SELECT id FROM patient_registrations WHERE patient_id = ?', [patientId]);
    const regData = [id_number || null, symptoms, medical_history || '', allergy_history || '', has_insurance, preferred_date || null, preferred_time || null];
    if (regExists) {
      await db.execute(
        `UPDATE patient_registrations SET id_number=?, symptoms=?, medical_history=?, allergy_history=?,
         has_insurance=?, preferred_date=?, preferred_time=?, updated_at=NOW() WHERE patient_id=?`,
        [...regData, patientId]
      );
    } else {
      await db.execute(
        `INSERT INTO patient_registrations (patient_id, id_number, symptoms, medical_history, allergy_history, has_insurance, preferred_date, preferred_time)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [patientId, ...regData]
      );
    }

    const token = generateToken({ id: patientId, role: 'patient' });
    res.json({ success: true, message: '注册成功', token, name, id: patientId, patientId });
  } catch (err) {
    const devMsg = process.env.NODE_ENV !== 'production' && err.message
      ? err.message
      : '服务器错误，请稍后重试';
    console.error('注册错误:', err.code || '', err.sqlMessage || err.message);
    if (err.stack) console.error(err.stack);
    res.json({ success: false, message: devMsg });
  }
});

// POST /api/login
router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    const cleanPhone = normalizePhone(phone);
    if (!isValidPhone(cleanPhone)) {
      return res.json({ success: false, message: '请输入有效的11位手机号' });
    }

    const patient = await db.queryOne('SELECT id, name, password_hash FROM patients WHERE phone = ?', [cleanPhone]);
    if (!patient) return res.json({ success: false, message: '该手机号未注册' });
    if (!patient.password_hash) return res.json({ success: false, message: '该账号尚未设置密码，请先完成注册' });

    const valid = await bcrypt.compare(password, patient.password_hash);
    if (!valid) return res.json({ success: false, message: '密码错误' });

    const token = generateToken({ id: patient.id, role: 'patient' });
    res.json({ success: true, message: '登录成功', token, name: patient.name, patientId: patient.id });
  } catch (err) {
    console.error('登录错误:', err);
    res.json({ success: false, message: '服务器错误' });
  }
});

// GET /api/auth/verify
router.get('/auth/verify', (req, res) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.json({ success: false });
  const decoded = verifyToken(header.slice(7));
  res.json({ success: !!decoded, user: decoded || null });
});

// POST /api/appointments (需登录)
router.post('/appointments', authRequired, async (req, res) => {
  try {
    const { date, time, reason } = req.body;
    const patientId = req.user?.id;
    if (!patientId || req.user?.role !== 'patient') {
      return res.json({ success: false, message: '请先登录' });
    }
    if (!date || !time) {
      return res.json({ success: false, message: '请选择预约日期和时间' });
    }

    const appointmentDate = `${date} ${time}:00`;
    const doctor = await db.queryOne('SELECT id FROM users WHERE role = ? LIMIT 1', ['doctor']);
    const doctorId = doctor?.id ?? 1;

    await db.execute(
      `INSERT INTO appointments (patient_id, doctor_id, appointment_date, status, notes) VALUES (?, ?, ?, 'pending', ?)`,
      [patientId, doctorId, appointmentDate, reason || '']
    );

    const patient = await db.queryOne('SELECT phone, name FROM patients WHERE id = ?', [patientId]);
    const phone = patient?.phone || '';
    const name = patient?.name || '';
    sendAppointmentReminder(phone, date, time, name).catch((err) => {
      console.error('预约短信发送失败:', err);
    });

    res.json({ success: true, message: '预约成功' });
  } catch (err) {
    console.error('预约错误:', err);
    res.json({ success: false, message: '预约失败' });
  }
});

// GET /api/my/appointments (需登录)
router.get('/my/appointments', authRequired, async (req, res) => {
  const patientId = req.user?.id;
  if (!patientId || req.user?.role !== 'patient') {
    return res.json({ success: false, message: '请先登录' });
  }
  try {
    const rows = await db.query(
      `SELECT id, appointment_date, status, notes, created_at FROM appointments
       WHERE patient_id = ? ORDER BY appointment_date DESC`,
      [patientId]
    );
    const appointments = rows.map((r) => {
      const d = r.appointment_date ? new Date(r.appointment_date) : null;
      return {
        id: r.id,
        date: d ? d.toISOString().slice(0, 10) : '',
        time: d ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : '',
        reason: r.notes || '',
        status: r.status,
        created_at: r.created_at,
      };
    });
    res.json({ success: true, appointments });
  } catch (err) {
    console.error('获取预约列表错误:', err);
    res.json({ success: false, appointments: [] });
  }
});

// GET /api/patient/registration-status (需登录)
router.get('/patient/registration-status', authRequired, async (req, res) => {
  const patientId = req.user?.id;
  if (!patientId || req.user?.role !== 'patient') {
    return res.json({ success: false, registered: false });
  }
  try {
    const reg = await db.queryOne('SELECT id FROM patient_registrations WHERE patient_id = ?', [patientId]);
    res.json({ success: true, registered: !!reg });
  } catch (err) {
    res.json({ success: false, registered: false });
  }
});

// GET /api/my/records (需登录) — 患者查看自己的就诊记录与处方
router.get('/my/records', authRequired, async (req, res) => {
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

module.exports = router;
