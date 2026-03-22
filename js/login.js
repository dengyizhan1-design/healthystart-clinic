/**
 * 安鑫诊所 - 患者登录页面前端逻辑
 * 依赖 js/common.js 中的 Clinic
 */
(function () {
  function fillProfile(name, phone) {
    var avatar = document.getElementById('profile-avatar');
    var nameEl = document.getElementById('profile-name');
    var phoneEl = document.getElementById('profile-phone');
    if (nameEl) nameEl.textContent = name || '--';
    if (phoneEl) phoneEl.textContent = phone || '--';
    if (avatar && name) {
      avatar.textContent = name.charAt(0);
    }
  }

  function toggleSections(loggedIn) {
    var loginSec = document.getElementById('login-section');
    var profileSec = document.getElementById('profile-section');
    if (loginSec) loginSec.hidden = !!loggedIn;
    if (profileSec) profileSec.hidden = !loggedIn;
  }

  function renderAppointments(list) {
    var box = document.getElementById('my-appointments');
    if (!box) return;
    if (!list || list.length === 0) {
      box.innerHTML = '<p class="empty-notice">当前暂无预约记录</p>';
      return;
    }
    var html = '<h3 style="margin-bottom:0.5rem;font-size:0.95rem">我的预约</h3>';
    html += '<ul class="simple-list">';
    list.forEach(function (a) {
      var date = a.date || a.visit_date || '';
      var time = a.time_slot || a.time || '';
      var status = a.status || '';
      html +=
        '<li><span>' +
        Clinic.escapeHtml(date) +
        ' ' +
        Clinic.escapeHtml(time) +
        '</span><span style="margin-left:0.5rem;color:var(--primary-700)">' +
        Clinic.escapeHtml(status) +
        '</span></li>';
    });
    html += '</ul>';
    box.innerHTML = html;
  }

  function fetchMyAppointments() {
    if (typeof Clinic === 'undefined' || !Clinic.API || !Clinic.API.myAppointments) return;
    fetch(Clinic.API.myAppointments, {
      method: 'GET',
      headers: Clinic.authHeaders(),
    })
      .then(function (r) {
        if (!r.ok) return r.json().catch(function () { return { success: false, appointments: [] }; });
        return r.json();
      })
      .then(function (res) {
        if (!res) res = { success: false, appointments: [] };
        if (res.success && Array.isArray(res.appointments)) {
          renderAppointments(res.appointments);
        } else {
          renderAppointments([]);
        }
      })
      .catch(function () {
        renderAppointments([]);
      });
  }

  function handleLoginSubmit(e) {
    e.preventDefault();
    var msgEl = document.getElementById('login-message');
    if (msgEl) {
      msgEl.hidden = true;
      msgEl.textContent = '';
    }
    if (typeof Clinic === 'undefined' || !Clinic.API || !Clinic.API.login) {
      if (msgEl) Clinic.showMessage(msgEl, '前端配置错误，请联系诊所', true);
      return;
    }

    var phoneInput = document.getElementById('login-phone');
    var pwdInput = document.getElementById('login-password');
    var phone = phoneInput.value.trim();
    var password = pwdInput.value;

    if (!Clinic.isValidPhone(phone)) {
      Clinic.showMessage(msgEl, '请输入11位有效手机号', true);
      return;
    }
    if (!password || password.length < 6) {
      Clinic.showMessage(msgEl, '密码至少6位', true);
      return;
    }

    var btn = document.getElementById('login-btn');
    var btnText = document.getElementById('login-btn-text');
    var spinner = document.getElementById('login-btn-spinner');
    if (btn) btn.disabled = true;
    if (btnText) btnText.style.display = 'none';
    if (spinner) spinner.style.display = 'inline-block';

    fetch(Clinic.API.login, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: phone, password: password }),
    })
      .then(function (r) {
        return r.json().catch(function () {
          return { success: false, message: '服务器错误' };
        });
      })
      .then(function (res) {
        if (!res) res = { success: false, message: '服务器无响应' };
        if (res.success) {
          Clinic.savePatientSession(res.token, res.name, res.patientId, phone);
          Clinic.showMessage(msgEl, res.message || '登录成功', false);
          fillProfile(res.name || '患者', phone);
          toggleSections(true);
          fetchMyAppointments();
        } else {
          Clinic.showMessage(msgEl, res.message || '手机号或密码错误', true);
        }
      })
      .catch(function () {
        Clinic.showMessage(msgEl, '无法连接服务器，请检查网络或稍后重试', true);
      })
      .finally(function () {
        if (btn) btn.disabled = false;
        if (btnText) btnText.style.display = 'inline';
        if (spinner) spinner.style.display = 'none';
      });
  }

  function handleLogout() {
    if (typeof Clinic !== 'undefined') {
      Clinic.clearPatientSession();
    }
    toggleSections(false);
    var msgEl = document.getElementById('login-message');
    if (msgEl) {
      Clinic.showMessage(msgEl, '已退出登录', false);
    }
  }

  function autoLoginIfToken() {
    if (typeof Clinic === 'undefined' || !Clinic.API || !Clinic.API.verify) return;
    var token = Clinic.getToken();
    if (!token) return;

    fetch(Clinic.API.verify, {
      method: 'GET',
      headers: Clinic.authHeaders(),
    })
      .then(function (r) {
        if (!r.ok) return null;
        return r.json().catch(function () {
          return null;
        });
      })
      .then(function (res) {
        if (!res || !res.success || !res.user) return;
        var user = res.user;
        var name = user.name || localStorage.getItem(Clinic.STORAGE_KEYS.patientName) || '患者';
        var phone = localStorage.getItem(Clinic.STORAGE_KEYS.patientPhone) || '';
        fillProfile(name, phone);
        toggleSections(true);
        fetchMyAppointments();
      })
      .catch(function () {
        // ignore; user will see normal login form
      });
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (typeof Clinic !== 'undefined') {
      Clinic.initMobileMenu();
    }
    toggleSections(false);
    autoLoginIfToken();

    var form = document.getElementById('login-form');
    if (form) form.addEventListener('submit', handleLoginSubmit);

    var logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
  });
})();

