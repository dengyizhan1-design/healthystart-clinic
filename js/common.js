/**
 * 安鑫诊所 - 前端公共模块
 * 在所有页面引入，提供统一的 API 地址、认证和工具函数
 */
const Clinic = (function () {
  const API_BASE = window.location.protocol === 'file:' ? 'http://localhost:3000' : '';

  const STORAGE_KEYS = {
    token: 'clinicToken',
    patientName: 'patientName',
    patientId: 'patientId',
    patientPhone: 'patientPhone',
  };

  const API = {
    register: API_BASE + '/api/register',
    login: API_BASE + '/api/login',
    verify: API_BASE + '/api/auth/verify',
    appointments: API_BASE + '/api/appointments',
    myAppointments: API_BASE + '/api/my/appointments',
    myRecords: API_BASE + '/api/my/records',
    registrationStatus: API_BASE + '/api/patient/registration-status',
    doctorLogin: API_BASE + '/api/doctor/login',
    doctorPatients: API_BASE + '/api/doctor/patients',
    pendingAppointments: API_BASE + '/api/doctor/pending-appointments',
    patientByPhone: (phone) => API_BASE + '/api/patients/' + encodeURIComponent(phone),
    patientImages: (id) => API_BASE + '/api/patients/' + encodeURIComponent(id) + '/images',
    records: API_BASE + '/api/records',
    appointmentStatus: (id) => API_BASE + '/api/appointments/' + id + '/status',
    income: API_BASE + '/api/income',
    incomeReset: API_BASE + '/api/income/reset',
    patientsCount: API_BASE + '/api/patients/count',
  };

  function normalizePhone(phone) {
    return String(phone || '').replace(/\D/g, '');
  }

  function isValidPhone(phone) {
    const n = normalizePhone(phone);
    return n.length === 11 && /^1[3-9]\d{9}$/.test(n);
  }

  function getToken() {
    return localStorage.getItem(STORAGE_KEYS.token);
  }

  function authHeaders() {
    const token = getToken();
    return token
      ? { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }
      : { 'Content-Type': 'application/json' };
  }

  function savePatientSession(token, name, id, phone) {
    if (token) localStorage.setItem(STORAGE_KEYS.token, token);
    if (name != null) localStorage.setItem(STORAGE_KEYS.patientName, name);
    if (id != null) localStorage.setItem(STORAGE_KEYS.patientId, String(id));
    if (phone != null) localStorage.setItem(STORAGE_KEYS.patientPhone, String(phone));
  }

  function clearPatientSession() {
    Object.keys(STORAGE_KEYS).forEach((k) => localStorage.removeItem(STORAGE_KEYS[k]));
  }

  function showMessage(el, text, isError) {
    if (!el) return;
    el.textContent = text;
    el.className = 'form-message ' + (isError ? 'error' : 'success');
    el.hidden = false;
  }

  function initMobileMenu() {
    var btn = document.querySelector('.menu-btn');
    var nav = document.querySelector('.nav');
    if (!btn || !nav) return;
    btn.addEventListener('click', function () {
      var expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', expanded ? 'false' : 'true');
      nav.classList.toggle('is-open');
    });
  }

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  return {
    API_BASE,
    API,
    STORAGE_KEYS,
    normalizePhone,
    isValidPhone,
    getToken,
    authHeaders,
    savePatientSession,
    clearPatientSession,
    showMessage,
    initMobileMenu,
    escapeHtml,
  };
})();

