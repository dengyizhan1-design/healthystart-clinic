/**
 * 安鑫诊所 - 患者注册页面前端逻辑
 * 依赖 js/common.js 中的 Clinic
 */
(function () {
  function initDatepickers() {
    if (typeof flatpickr === 'undefined' || !window.flatpickr) return;
    var zh = (window.flatpickr && window.flatpickr.l10ns && window.flatpickr.l10ns.zh) || {};
    var opts = {
      locale: zh,
      dateFormat: 'Y-m-d',
      allowInput: false,
    };
    var birth = document.getElementById('reg-birth-date');
    if (birth) window.flatpickr(birth, opts);
  }

  function collectFormData() {
    var name = document.getElementById('reg-name').value.trim();
    var age = parseInt(document.getElementById('reg-age').value, 10);
    var gender = document.getElementById('reg-gender').value;
    var phone = document.getElementById('reg-phone').value.trim();
    var password = document.getElementById('reg-password').value;
    var birthDate = (document.getElementById('reg-birth-date') && document.getElementById('reg-birth-date').value.trim()) || null;
    var idNumber = (document.getElementById('reg-id-number') && document.getElementById('reg-id-number').value.trim()) || null;
    var symptoms = document.getElementById('reg-symptoms').value.trim();
    var medicalHistory = (document.getElementById('reg-medical-history') && document.getElementById('reg-medical-history').value.trim()) || null;
    var allergyHistory = (document.getElementById('reg-allergy-history') && document.getElementById('reg-allergy-history').value.trim()) || null;
    var hasInsuranceInput = document.querySelector('input[name="has_insurance"]:checked');
    var hasInsurance = hasInsuranceInput ? hasInsuranceInput.value : '';

    return {
      name,
      age,
      gender,
      phone,
      password,
      birth_date: birthDate,
      id_number: idNumber,
      address: null,
      emergency_contact: null,
      emergency_phone: null,
      symptoms,
      medical_history: medicalHistory,
      allergy_history: allergyHistory,
      has_insurance: hasInsurance,
      preferred_date: null,
      preferred_time: null,
    };
  }

  function validate(data, msgEl) {
    if (!data.name) {
      Clinic.showMessage(msgEl, '请输入姓名', true);
      return false;
    }
    if (!Number.isInteger(data.age) || data.age < 1 || data.age > 150) {
      Clinic.showMessage(msgEl, '请输入正确的年龄', true);
      return false;
    }
    if (!data.gender) {
      Clinic.showMessage(msgEl, '请选择性别', true);
      return false;
    }
    if (!Clinic.isValidPhone(data.phone)) {
      Clinic.showMessage(msgEl, '请输入11位有效手机号', true);
      return false;
    }
    if (!data.password || data.password.length < 6) {
      Clinic.showMessage(msgEl, '密码至少6位', true);
      return false;
    }
    if (!data.symptoms) {
      Clinic.showMessage(msgEl, '请填写症状/主诉', true);
      return false;
    }
    if (!data.has_insurance) {
      Clinic.showMessage(msgEl, '请选择有无保险', true);
      return false;
    }
    return true;
  }

  function onSubmit(e) {
    e.preventDefault();
    var msgEl = document.getElementById('reg-message');
    if (msgEl) {
      msgEl.hidden = true;
      msgEl.textContent = '';
    }
    if (typeof Clinic === 'undefined' || !Clinic.API || !Clinic.API.register) {
      if (msgEl) Clinic.showMessage(msgEl, '前端配置错误，请联系诊所', true);
      return;
    }
    var btn = document.getElementById('reg-submit-btn');
    if (btn) btn.disabled = true;

    var data = collectFormData();
    if (!validate(data, msgEl)) {
      if (btn) btn.disabled = false;
      return;
    }

    fetch(Clinic.API.register, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
      .then(function (r) {
        if (!r.ok) return r.json().catch(function () { return { success: false, message: '服务器错误' }; });
        return r.json();
      })
      .then(function (res) {
        if (!res) res = { success: false, message: '服务器无响应' };
        if (res.success) {
          Clinic.showMessage(msgEl, res.message || '注册成功，正在跳转预约挂号页面…', false);
          try {
            Clinic.savePatientSession(res.token, res.name, res.patientId, data.phone);
          } catch (_) {}
          setTimeout(function () {
            window.location.href = 'appointment.html';
          }, 1200);
        } else {
          Clinic.showMessage(msgEl, res.message || '注册失败，请稍后重试', true);
        }
      })
      .catch(function () {
        Clinic.showMessage(msgEl, '无法连接服务器，请检查网络或稍后重试', true);
      })
      .finally(function () {
        if (btn) btn.disabled = false;
      });
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (typeof Clinic !== 'undefined') {
      Clinic.initMobileMenu();
    }
    initDatepickers();
    var form = document.getElementById('registration-form');
    if (form) {
      form.addEventListener('submit', onSubmit);
    }
  });
})();

