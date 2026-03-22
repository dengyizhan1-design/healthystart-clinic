/**
 * 安鑫诊所 - 认证与通用工具
 * 被 patientRoutes 与 doctorRoutes 共用
 */
const jwt = require('jsonwebtoken');
const config = require('../config');

function generateToken(payload, expiresIn = '24h') {
  return jwt.sign(payload, config.jwtSecret, { expiresIn });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, config.jwtSecret);
  } catch {
    return null;
  }
}

function authRequired(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: '请先登录' });
  }
  const decoded = verifyToken(header.slice(7));
  if (!decoded) {
    return res.status(401).json({ success: false, message: '登录已过期' });
  }
  req.user = decoded;
  next();
}

function doctorRequired(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: '请先登录' });
  }
  const decoded = verifyToken(header.slice(7));
  if (!decoded || decoded.role !== 'doctor') {
    return res.status(403).json({ success: false, message: '无医生权限' });
  }
  req.user = decoded;
  next();
}

function isValidPhone(phone) {
  const clean = String(phone || '').replace(/\D/g, '');
  return clean.length === 11 && /^1[3-9]\d{9}$/.test(clean);
}

function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

module.exports = {
  generateToken,
  verifyToken,
  authRequired,
  doctorRequired,
  isValidPhone,
  normalizePhone,
};

