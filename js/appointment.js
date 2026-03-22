/**
 * 安鑫诊所 - 预约挂号页面前端逻辑
 * 依赖 js/common.js 中的 Clinic 与 Flatpickr
 */
(function () {
  var timeSlotsMorning = ['09:00', '09:30', '10:00', '10:30', '11:00'];
  var timeSlotsAfternoon = ['14:00', '14:30', '15:00', '15:30', '16:00'];

  function initDatepicker() {
    if (typeof flatpickr === 'undefined' || !window.flatpickr) return;
    var input = document.getElementById('booking-date');
    if (!input) return;
    var zh = (window.flatpickr && window.flatpickr.l10ns && window.flatpickr.l10ns.zh) || {};
    window.flatpickr(input, {
      locale: zh,
      dateFormat: 'Y-m-d',
      minDate: 'today',
      allowInput: false,
    });
  }

  function renderTimeSlots() {
    var morningEl = document.getElementById('morning-slots');
    var afternoonEl = document.getElementById('afternoon-slots');
    var hiddenInput = document.getElementById('booking-time');
    if (!morningEl || !afternoonEl || !hiddenInput) return;

    function makeBtn(t) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'slot-btn';
      btn.textContent = t;
      btn.addEventListener('click', function () {
        var all = document.querySelectorAll('.slot-btn');
        Array.prototype.forEach.call(all, function (b) {
          b.classList.remove('slot-btn-selected');
        });
        btn.classList.add('slot-btn-selected');
        hiddenInput.value = t;
      });
      return btn;
    }

    morningEl.innerHTML = '';
    afternoonEl.innerHTML = '';
    timeSlotsMorning.forEach(function (t) {
      morningEl.appendChild(makeBtn(t));
    });
    timeSlotsAfternoon.forEach(function (t) {
      afternoonEl.appendChild(makeBtn(t));
    });
  }

  function showSection(id, show) {
    var el = document.getElementById(id);
    if (!el) return;
    el.hidden = !show;
  }

  function initVisibility() {
    showSection('auth-notice', false);
    showSection('reg-required-notice', false);
    showSection('booking-form-wrap', false);
  }

  function checkAuthAndRegistration() {
    if (typeof Clinic === 'undefined' || !Clinic.API || !Clinic.API.verify) {
      showSection('auth-notice', true);
      return;
    }
    var token = Clinic.getToken();
    if (!token) {
      showSection('auth-notice', true);
      return;
    }

    fetch(Clinic.API.verify, {
      method: 'GET',
      headers: Clinic.authHeaders(),
    })
      .then(function (r) {
        if (r.status === 401 || r.status === 403) {
          return null;
        }
        if (!r.ok) return null;
        return r.json().catch(function () {
          return null;
        });
      })
      .then(function (res) {
        if (!res || !res.success || !res.user) {
          showSection('auth-notice', true);
          return;
        }
        // 已登录，填充姓名
        var nameEl = document.getElementById('logged-in-name');
        if (nameEl) {
          nameEl.textContent = res.user.name || localStorage.getItem(Clinic.STORAGE_KEYS.patientName) || '患者';
        }
        // 再检查是否已完成登记
        if (!Clinic.API.registrationStatus) {
          showSection('booking-form-wrap', true);
          return;
        }
        fetch(Clinic.API.registrationStatus, {
          method: 'GET',
          headers: Clinic.authHeaders(),
        })
          .then(function (r2) {
            if (!r2.ok) return r2.json().catch(function () { return { success: false }; });
            return r2.json();
          })
          .then(function (res2) {
            if (res2 && res2.success && res2.registered) {
              showSection('booking-form-wrap', true);
            } else {
              showSection('reg-required-notice', true);
            }
          })
          .catch(function () {
            showSection('booking-form-wrap', true);
          });
      })
      .catch(function () {
        showSection('auth-notice', true);
      });
  }

  function handleSubmit(e) {
    e.preventDefault();
    var msgEl = document.getElementById('booking-message');
    if (msgEl) {
      msgEl.hidden = true;
      msgEl.textContent = '';
    }
    if (typeof Clinic === 'undefined' || !Clinic.API || !Clinic.API.appointments) {
      if (msgEl) Clinic.showMessage(msgEl, '前端配置错误，请联系诊所', true);
      return;
    }
    var date = document.getElementById('booking-date').value.trim();
    var time = document.getElementById('booking-time').value.trim();
    var reason = document.getElementById('booking-reason').value.trim() || null;

    if (!date) {
      Clinic.showMessage(msgEl, '请选择预约日期', true);
      return;
    }
    if (!time) {
      Clinic.showMessage(msgEl, '请选择预约时间段', true);
      return;
    }

    var btn = e.target.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;

    fetch(Clinic.API.appointments, {
      method: 'POST',
      headers: Clinic.authHeaders(),
      body: JSON.stringify({ date: date, time: time, reason: reason }),
    })
      .then(function (r) {
        return r.json().catch(function () {
          return { success: false, message: '服务器错误' };
        });
      })
      .then(function (res) {
        if (!res) res = { success: false, message: '服务器无响应' };
        if (res.success) {
          Clinic.showMessage(msgEl, res.message || '预约成功', false);
        } else {
          Clinic.showMessage(msgEl, res.message || '预约失败，请稍后重试', true);
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
    initVisibility();
    initDatepicker();
    renderTimeSlots();
    checkAuthAndRegistration();

    var form = document.getElementById('booking-form');
    if (form) {
      form.addEventListener('submit', handleSubmit);
    }
  });
})();

