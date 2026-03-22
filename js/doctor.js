/**
 * 安鑫诊所 - 医生工作台（前端）
 * 依赖 js/common.js
 *
 * 注意：之前你看到“输入密码后表单被清空、没有任何反应”的原因，
 * 很大概率是这个文件不存在或未正确加载，导致表单是纯 HTML 表单，
 * 浏览器只是在提交后刷新当前页并询问是否保存密码。
 * 现在补上这个文件，所有登录和后续交互都会通过 AJAX 完成。
 */
(function () {
  var DOCTOR_TOKEN_KEY = 'doctorToken';
  var DOCTOR_NAME_KEY = 'doctorName';
  var STATUS = { pending: '待确认', confirmed: '已确认', completed: '已完成', cancelled: '已取消' };
  var currentPatient = { id: null, phone: null };

  function getDoctorToken() {
    return localStorage.getItem(DOCTOR_TOKEN_KEY);
  }
  function setDoctorToken(t) {
    if (t) localStorage.setItem(DOCTOR_TOKEN_KEY, t);
    else localStorage.removeItem(DOCTOR_TOKEN_KEY);
  }
  function setDoctorName(n) {
    if (n != null) localStorage.setItem(DOCTOR_NAME_KEY, n);
    else localStorage.removeItem(DOCTOR_NAME_KEY);
  }
  function getDoctorName() {
    return localStorage.getItem(DOCTOR_NAME_KEY) || '';
  }

  function doctorHeaders() {
    var t = getDoctorToken();
    return t
      ? { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }
      : { 'Content-Type': 'application/json' };
  }

  function authOnlyHeaders() {
    var t = getDoctorToken();
    return t ? { Authorization: 'Bearer ' + t } : {};
  }

  function formatCurrency(n) {
    return '¥' + (parseFloat(n) || 0).toFixed(2);
  }

  function showDashboard() {
    document.getElementById('login-gate').hidden = true;
    document.getElementById('dashboard').hidden = false;
    document.getElementById('header-actions').hidden = false;
    fetchIncome();
    fetchPatients();
    fetchPendingBookings();
    if (window._pendingBookingTimer) clearInterval(window._pendingBookingTimer);
    window._pendingBookingTimer = setInterval(fetchPendingBookings, 30000);
  }

  function showLogin() {
    if (window._pendingBookingTimer) { clearInterval(window._pendingBookingTimer); window._pendingBookingTimer = null; }
    document.getElementById('login-gate').hidden = true === false;
    document.getElementById('login-gate').hidden = false;
    document.getElementById('dashboard').hidden = true;
    document.getElementById('header-actions').hidden = true;
    setDoctorToken(null);
    setDoctorName(null);
  }

  function handle401(r) {
    if (r.status === 401) {
      showLogin();
      return null;
    }
    return r.json();
  }

  function fetchIncome() {
    if (typeof Clinic === 'undefined' || !Clinic.API || !Clinic.API.income) return;
    fetch(Clinic.API.income, { headers: doctorHeaders() })
      .then(handle401)
      .then(function (d) {
        if (!d || !d.success) return;
        document.getElementById('income-today').textContent = formatCurrency(d.today_income);
        document.getElementById('income-today-count').textContent = d.today_count + ' 笔';
        document.getElementById('income-month').textContent = formatCurrency(d.month_income);
        document.getElementById('income-month-count').textContent = d.month_count + ' 笔';
        document.getElementById('income-total').textContent = formatCurrency(d.total_income);
        document.getElementById('income-total-count').textContent = d.total_records + ' 笔';
        var list = document.getElementById('recent-income-list');
        var arr = d.recent_transactions || [];
        list.innerHTML = arr.length
          ? arr
              .map(function (x) {
                return (
                  '<div class="recent-item"><span>' +
                  Clinic.escapeHtml(x.patient_name || '') +
                  ' · ' +
                  Clinic.escapeHtml(x.diagnosis || '') +
                  '</span><span style="font-weight:600;color:#16a34a">+' +
                  formatCurrency(x.price) +
                  '</span></div>'
                );
              })
              .join('')
          : '<p class="empty-notice">暂无</p>';
      })
      .catch(function () {});
  }

  function fetchPendingBookings() {
    if (typeof Clinic === 'undefined' || !Clinic.API || !Clinic.API.pendingAppointments) return;
    var panel = document.getElementById('booking-alert-panel');
    var listEl = document.getElementById('pending-booking-list');
    var emptyEl = document.getElementById('pending-booking-empty');
    if (!panel || !listEl) return;
    fetch(Clinic.API.pendingAppointments, { headers: doctorHeaders() })
      .then(handle401)
      .then(function (d) {
        if (!d || !d.success || !Array.isArray(d.appointments)) return;
        var arr = d.appointments;
        panel.hidden = false;
        if (arr.length === 0) {
          listEl.innerHTML = '';
          if (emptyEl) { emptyEl.style.display = 'block'; }
          return;
        }
        if (emptyEl) emptyEl.style.display = 'none';
        listEl.innerHTML = arr
          .map(function (a) {
            return (
              '<div class="booking-item" data-id="' + a.id + '">' +
              '<div class="booking-item-info">' +
              '<strong>' + Clinic.escapeHtml(a.patient_name || '') + '</strong> ' +
              Clinic.escapeHtml(a.patient_phone || '') + ' · ' +
              Clinic.escapeHtml(a.date || '') + ' ' + Clinic.escapeHtml(a.time || '') +
              (a.notes ? '<br><span style="font-size:0.85rem;color:var(--slate-600)">就诊原因：' + Clinic.escapeHtml(a.notes) + '</span>' : '') +
              '</div>' +
              '<button type="button" class="btn btn-sm btn-success booking-confirm-btn" data-id="' + a.id + '">确认</button>' +
              '</div>'
            );
          })
          .join('');
        listEl.querySelectorAll('.booking-confirm-btn').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var id = btn.getAttribute('data-id');
            if (!id) return;
            updateApptStatus(id, 'confirmed', function () {
              fetchPendingBookings();
            });
          });
        });
      })
      .catch(function () {});
  }

  function fetchPatients() {
    if (typeof Clinic === 'undefined' || !Clinic.API || !Clinic.API.doctorPatients) return;
    fetch(Clinic.API.doctorPatients, { headers: doctorHeaders() })
      .then(handle401)
      .then(function (d) {
        var el = document.getElementById('patient-list');
        if (!el) return;
        if (!d || !d.success || !d.patients || !d.patients.length) {
          el.innerHTML = '<p class="empty-notice" style="padding:0.5rem">暂无患者</p>';
          return;
        }
        el.innerHTML = d.patients
          .map(function (p) {
            return (
              '<div class="patient-list-item" data-phone="' +
              Clinic.escapeHtml(p.phone) +
              '">' +
              Clinic.escapeHtml(p.name) +
              ' ' +
              Clinic.escapeHtml(p.phone) +
              '</div>'
            );
          })
          .join('');
        el.querySelectorAll('.patient-list-item').forEach(function (node) {
          node.addEventListener('click', function () {
            document.getElementById('search-phone').value = node.getAttribute('data-phone');
            document.getElementById('search-form').dispatchEvent(new Event('submit'));
          });
        });
      })
      .catch(function () {});
  }

  function clearBoard() {
    var searchPhone = document.getElementById('search-phone');
    if (searchPhone) searchPhone.value = '';
    var ids = [
      'search-error',
      'patient-profile',
      'patient-appointments',
      'patient-records',
      'add-record',
      'patient-images-section',
    ];
    ids.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) {
        if (id === 'search-error') el.hidden = true;
        else el.hidden = true;
      }
    });
    var listEl = document.getElementById('patient-list');
    if (listEl)
      listEl.innerHTML = '<p class="empty-notice" style="padding:0.5rem">输入手机号查询，手机号已隐藏</p>';
    var printBtn = document.getElementById('print-summary-btn');
    if (printBtn) printBtn.hidden = true;
    currentPatient = { id: null, phone: null };
  }

  function fetchPatientImages(patientId) {
    var section = document.getElementById('patient-images-section');
    if (!section || typeof Clinic === 'undefined' || !Clinic.API || !Clinic.API.patientImages) return;
    if (!patientId) {
      section.hidden = true;
      return;
    }
    fetch(Clinic.API.patientImages(patientId), { headers: authOnlyHeaders() })
      .then(handle401)
      .then(function (d) {
        if (!d || !d.success) {
          section.hidden = true;
          return;
        }
        section.hidden = false;
        var listEl = document.getElementById('patient-images-list');
        var images = d.images || [];
        if (!images.length) {
          listEl.innerHTML = '<p class="empty-notice" style="padding:0.5rem">暂无影像资料</p>';
          return;
        }
        listEl.innerHTML = images
          .map(function (img) {
            var safeUrl = Clinic.escapeHtml(img.image_url || '');
            var safeCat = Clinic.escapeHtml(img.category || '');
            var safeNote = Clinic.escapeHtml(img.note || '');
            return (
              '<div class="card" style="padding:0.5rem;"><div style="width:100%;height:120px;overflow:hidden;border-radius:6px;margin-bottom:0.35rem;background:#f1f5f9;display:flex;align-items:center;justify-content:center;"><img src="' +
              safeUrl +
              '" alt="影像" style="max-width:100%;max-height:100%;object-fit:contain;"></div><div style="font-size:0.8rem;color:var(--slate-600);margin-bottom:0.25rem;">' +
              (safeCat || '未分类') +
              '</div><div style="font-size:0.8rem;color:var(--slate-700);min-height:1.5em;">' +
              (safeNote || '无备注') +
              '</div></div>'
            );
          })
          .join('');
      })
      .catch(function () {});
  }

  function updateApptStatus(id, status, cb) {
    if (!Clinic || !Clinic.API || !Clinic.API.appointmentStatus) return;
    fetch(Clinic.API.appointmentStatus(id), {
      method: 'PUT',
      headers: doctorHeaders(),
      body: JSON.stringify({ status: status }),
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (d) {
        if (d.success && cb) cb();
      })
      .catch(function () {});
  }

  function addRxRow() {
    var tbody = document.getElementById('rx-tbody');
    if (!tbody) return;
    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td><input type="text" class="rx-name" placeholder="药品名"></td><td><input type="text" class="rx-dosage" placeholder="用法"></td><td><input type="number" class="rx-qty" value="1" min="1"></td><td><input type="number" class="rx-price" value="0" min="0" step="0.01"></td><td class="rx-sub"></td><td><button type="button" class="btn btn-sm btn-danger rx-del">删</button></td>';
    tr.querySelector('.rx-del').addEventListener('click', function () {
      tr.remove();
      updateRxTotal();
    });
    tr.querySelectorAll('input').forEach(function (inp) {
      inp.addEventListener('input', updateRxTotal);
    });
    tbody.appendChild(tr);
    updateRxTotal();
  }

  function updateRxTotal() {
    var total = 0;
    document.querySelectorAll('#rx-tbody tr').forEach(function (tr) {
      var q = parseFloat(tr.querySelector('.rx-qty').value) || 0;
      var p = parseFloat(tr.querySelector('.rx-price').value) || 0;
      var sub = q * p;
      total += sub;
      var subEl = tr.querySelector('.rx-sub');
      if (subEl) subEl.textContent = formatCurrency(sub);
    });
    var drugTotalEl = document.getElementById('rx-drug-total');
    if (drugTotalEl) drugTotalEl.textContent = formatCurrency(total);
    var consult = parseFloat(document.getElementById('rec-consult-fee').value) || 0;
    var totalEl = document.getElementById('rec-total-price');
    if (totalEl) totalEl.textContent = formatCurrency(total + consult);
  }

  function fetchPatientByPhone(phone) {
    if (!Clinic || !Clinic.API || !Clinic.API.patientByPhone) return;
    var clean = Clinic.normalizePhone ? Clinic.normalizePhone(phone) : String(phone || '').replace(/\D/g, '');
    var errEl = document.getElementById('search-error');
    if (!Clinic.isValidPhone || !Clinic.isValidPhone(clean)) {
      if (errEl) {
        errEl.textContent = '无效手机号';
        errEl.hidden = false;
      }
      return;
    }
    if (errEl) errEl.hidden = true;
    document.getElementById('patient-profile').hidden = true;
    document.getElementById('patient-appointments').hidden = true;
    document.getElementById('patient-records').hidden = true;
    document.getElementById('add-record').hidden = true;
    document.getElementById('patient-images-section').hidden = true;

    fetch(Clinic.API.patientByPhone(clean), { headers: doctorHeaders() })
      .then(handle401)
      .then(function (d) {
        if (!d) return;
        if (!d.success) {
          if (errEl) {
            errEl.textContent = d.message || '未找到患者';
            errEl.hidden = false;
          }
          return;
        }
        currentPatient = { id: d.patient.id, phone: clean };
        var p = d.patient;
        var reg = d.registration;
        var apts = d.appointments || [];
        var recs = d.records || [];

        var profileHtml =
          '<div class="profile-card"><h2>患者档案 — ' +
          Clinic.escapeHtml(p.name) +
          '</h2>' +
          '<p><strong>手机</strong> ' +
          Clinic.escapeHtml(p.phone) +
          ' <strong>性别</strong> ' +
          (p.gender || '-') +
          ' <strong>年龄</strong> ' +
          (p.age != null ? p.age + '岁' : '-') +
          '</p>' +
          (reg
            ? '<h3>主诉/症状</h3><p>' +
              Clinic.escapeHtml(reg.symptoms || '') +
              '</p><h3>病史</h3><p>' +
              Clinic.escapeHtml(reg.medical_history || '') +
              '</p>'
            : '<p class="empty-notice">未填写登记表</p>') +
          '</div>';
        var profileEl = document.getElementById('patient-profile');
        profileEl.innerHTML = profileHtml;
        profileEl.hidden = false;

        var apptEl = document.getElementById('patient-appointments');
        apptEl.innerHTML = apts.length
          ? '<h3>预约记录</h3>' +
            apts
              .map(function (a) {
                return (
                  '<div class="record-card"><p><strong>' +
                  a.date +
                  '</strong> ' +
                  a.time +
                  ' <span style="float:right">' +
                  (STATUS[a.status] || a.status) +
                  '</span></p>' +
                  (a.reason ? '<p>' + Clinic.escapeHtml(a.reason) + '</p>' : '') +
                  '<button class="btn btn-sm btn-success" data-id="' +
                  a.id +
                  '" data-status="confirmed">确认</button> ' +
                  '<button class="btn btn-sm btn-outline" data-id="' +
                  a.id +
                  '" data-status="completed">完成</button> ' +
                  '<button class="btn btn-sm btn-danger" data-id="' +
                  a.id +
                  '" data-status="cancelled">取消</button></div>'
                );
              })
              .join('')
          : '<p class="empty-notice">暂无预约</p>';
        apptEl.hidden = false;
        apptEl.querySelectorAll('button[data-id]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            updateApptStatus(btn.getAttribute('data-id'), btn.getAttribute('data-status'), function () {
              fetchPatientByPhone(clean);
            });
          });
        });

        var recEl = document.getElementById('patient-records');
        recEl.innerHTML = recs.length
          ? '<h3>就诊记录</h3>' +
            recs
              .map(function (r) {
                var rx = (r.prescriptions || [])
                  .map(function (x) {
                    return x.name + ' ' + (x.dosage || '') + ' ×' + (x.qty || 1);
                  })
                  .join('；');
                return (
                  '<div class="record-card"><p class="record-date">' +
                  (r.create_at || '') +
                  '</p>' +
                  '<p><strong>症状</strong> ' +
                  Clinic.escapeHtml(r.symptoms || '') +
                  '</p>' +
                  '<p><strong>诊断</strong> ' +
                  Clinic.escapeHtml(r.diagnosis || '') +
                  '</p>' +
                  (rx ? '<p><strong>处方</strong> ' + Clinic.escapeHtml(rx) + '</p>' : '') +
                  (r.price > 0 ? '<p><strong>费用</strong> ' + formatCurrency(r.price) + '</p>' : '') +
                  '</div>'
                );
              })
              .join('')
          : '<p class="empty-notice">暂无就诊记录</p>';
        recEl.hidden = false;

        document.getElementById('add-record').hidden = false;
        document.getElementById('add-record-form').reset();
        document.getElementById('rx-tbody').innerHTML = '';
        document.getElementById('rec-symptoms').value = reg ? reg.symptoms || '' : '';
        document.getElementById('rec-doctor').value = getDoctorName();
        updateRxTotal();
        fetchPatientImages(currentPatient.id);

        var printHistoryBtn = document.getElementById('print-history-btn');
        var printRxBtn = document.getElementById('print-rx-btn');
        if (printHistoryBtn) printHistoryBtn.hidden = false;
        if (printRxBtn) printRxBtn.hidden = false;
      })
      .catch(function () {
        if (errEl) {
          errEl.textContent = '网络错误，请稍后重试';
          errEl.hidden = false;
        }
      });
  }

  document.addEventListener('DOMContentLoaded', function () {
    // 尝试自动恢复登录状态
    if (getDoctorToken() && typeof Clinic !== 'undefined' && Clinic.API && Clinic.API.verify) {
      fetch(Clinic.API.verify, { headers: doctorHeaders() })
        .then(function (r) {
          return r.json();
        })
        .then(function (d) {
          if (d.success && d.user && d.user.role === 'doctor') {
            if (d.user.name) setDoctorName(d.user.name);
            showDashboard();
          } else {
            setDoctorToken(null);
            setDoctorName(null);
          }
        })
        .catch(function () {
          setDoctorToken(null);
          setDoctorName(null);
        });
    }

    var loginForm = document.getElementById('doctor-login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var usernameEl = document.getElementById('doctor-username');
        var username = usernameEl ? usernameEl.value : 'dr_deng';
        var pw = document.getElementById('doctor-password').value;
        var errEl = document.getElementById('login-error');
        if (errEl) errEl.hidden = true;

        fetch(Clinic.API.doctorLogin, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: username, password: pw }),
        })
          .then(function (r) {
            return r.json();
          })
          .then(function (d) {
            if (d.success) {
              setDoctorToken(d.token);
              if (d.doctorName) setDoctorName(d.doctorName);
              document.getElementById('doctor-password').value = '';
              showDashboard();
            } else {
              var msg = d.message || '密码错误';
              if (errEl) {
                errEl.textContent = msg;
                errEl.hidden = false;
              }
              alert('医生登录失败：' + msg);
            }
          })
          .catch(function () {
            if (errEl) {
              errEl.textContent = '无法连接服务器';
              errEl.hidden = false;
            }
            alert('医生登录失败：无法连接服务器');
          });
      });
    }

    var logoutBtn = document.getElementById('doctor-logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function () {
        setDoctorToken(null);
        setDoctorName(null);
        showLogin();
      });
    }

    var clearBoardBtn = document.getElementById('clear-board-btn');
    if (clearBoardBtn) {
      clearBoardBtn.addEventListener('click', clearBoard);
    }

    var bookingDetailSearchBtn = document.getElementById('booking-detail-search-btn');
    var bookingDetailPhone = document.getElementById('booking-detail-phone');
    var bookingDetailResult = document.getElementById('booking-detail-result');
    if (bookingDetailSearchBtn && bookingDetailPhone && bookingDetailResult) {
      function doBookingDetailSearch() {
        var phone = Clinic.normalizePhone ? Clinic.normalizePhone(bookingDetailPhone.value) : String(bookingDetailPhone.value || '').replace(/\D/g, '');
        if (!Clinic.isValidPhone || !Clinic.isValidPhone(phone)) {
          bookingDetailResult.innerHTML = '<p style="color:var(--slate-500)">请输入有效11位手机号</p>';
          bookingDetailResult.style.display = 'block';
          return;
        }
        bookingDetailResult.innerHTML = '<p>查询中…</p>';
        bookingDetailResult.style.display = 'block';
        fetch(Clinic.API.patientByPhone(phone), { headers: doctorHeaders() })
          .then(handle401)
          .then(function (d) {
            if (!d || !d.success) {
              bookingDetailResult.innerHTML = '<p style="color:var(--slate-500)">' + (d && d.message ? Clinic.escapeHtml(d.message) : '未找到该患者') + '</p>';
              return;
            }
            var p = d.patient;
            var reg = d.registration;
            var apts = d.appointments || [];
            var html = '<h4>' + Clinic.escapeHtml(p.name || '') + ' ' + Clinic.escapeHtml(p.phone || '') + '</h4>';
            html += '<p><strong>性别</strong> ' + (p.gender || '-') + ' &nbsp; <strong>年龄</strong> ' + (p.age != null ? p.age + '岁' : '-') + '</p>';
            if (reg) {
              html += '<p><strong>主诉/症状</strong><br>' + Clinic.escapeHtml(reg.symptoms || '—') + '</p>';
              html += '<p><strong>既往病史</strong><br>' + Clinic.escapeHtml(reg.medical_history || '—') + '</p>';
              html += '<p><strong>过敏史</strong><br>' + Clinic.escapeHtml(reg.allergy_history || '—') + '</p>';
              if (reg.address) html += '<p><strong>地址</strong> ' + Clinic.escapeHtml(reg.address) + '</p>';
              if (reg.emergency_contact) html += '<p><strong>紧急联系人</strong> ' + Clinic.escapeHtml(reg.emergency_contact) + ' ' + (reg.emergency_phone || '') + '</p>';
            } else {
              html += '<p>未填写登记表</p>';
            }
            if (apts.length) {
              html += '<p><strong>预约记录</strong></p><ul style="margin:0;padding-left:1.2rem">';
              apts.forEach(function (a) {
                html += '<li>' + Clinic.escapeHtml(a.date || '') + ' ' + Clinic.escapeHtml(a.time || '') + ' ' + (STATUS[a.status] || a.status);
                if (a.reason) html += ' — ' + Clinic.escapeHtml(a.reason);
                html += '</li>';
              });
              html += '</ul>';
            }
            bookingDetailResult.innerHTML = html;
          })
          .catch(function () {
            bookingDetailResult.innerHTML = '<p style="color:var(--slate-500)">查询失败</p>';
          });
      }
      bookingDetailSearchBtn.addEventListener('click', doBookingDetailSearch);
      bookingDetailPhone.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); doBookingDetailSearch(); }
      });
    }

    var clearIncomeBtn = document.getElementById('clear-income-list-btn');
    if (clearIncomeBtn) {
      clearIncomeBtn.addEventListener('click', function () {
        var el = document.getElementById('recent-income-list');
        if (el) el.innerHTML = '<p class="empty-notice">暂无</p>';
      });
    }

    var resetMonthlyBtn = document.getElementById('reset-monthly-income-btn');
    if (resetMonthlyBtn && typeof Clinic !== 'undefined' && Clinic.API && Clinic.API.incomeReset) {
      resetMonthlyBtn.addEventListener('click', function () {
        if (!confirm('确认结账并重置本月收入计数？当前未结账金额将被归档，本月收入将归零重新统计。')) return;
        var btn = resetMonthlyBtn;
        btn.disabled = true;
        fetch(Clinic.API.incomeReset, {
          method: 'POST',
          headers: doctorHeaders(),
        })
          .then(handle401)
          .then(function (d) {
            if (!d) return;
            if (d.success) {
              if (d.settled && d.settled.amount > 0) {
                alert('结账成功。已归档：¥' + (parseFloat(d.settled.amount) || 0).toFixed(2) + '（' + (d.settled.record_count || 0) + ' 笔）');
              } else {
                alert('结账成功，本月收入已重置。');
              }
              fetchIncome();
            } else {
              alert('结账失败：' + (d.message || '未知错误'));
            }
          })
          .catch(function () {
            alert('无法连接服务器');
          })
          .finally(function () {
            btn.disabled = false;
          });
      });
    }

    var clearPatientListBtn = document.getElementById('clear-patient-list-btn');
    if (clearPatientListBtn) {
      clearPatientListBtn.addEventListener('click', clearBoard);
    }

    var searchForm = document.getElementById('search-form');
    if (searchForm) {
      searchForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var phone = document.getElementById('search-phone').value;
        fetchPatientByPhone(phone);
      });
    }

    var addRxBtn = document.getElementById('add-rx-btn');
    if (addRxBtn) {
      addRxBtn.addEventListener('click', function () {
        addRxRow();
      });
    }

    var consultFeeInput = document.getElementById('rec-consult-fee');
    if (consultFeeInput) {
      consultFeeInput.addEventListener('input', updateRxTotal);
    }

    var addRecordForm = document.getElementById('add-record-form');
    if (addRecordForm) {
      addRecordForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var msgEl = document.getElementById('record-message');
        if (msgEl) msgEl.hidden = true;
        if (!currentPatient.id) {
          if (msgEl) {
            msgEl.textContent = '请先通过手机号选择患者';
            msgEl.className = 'form-message error';
            msgEl.hidden = false;
          }
          return;
        }
        var symptoms = document.getElementById('rec-symptoms').value.trim();
        var diagnosis = document.getElementById('rec-diagnosis').value.trim();
        var treatment = document.getElementById('rec-treatment').value.trim();
        var doctorName = document.getElementById('rec-doctor').value.trim();
        if (!symptoms || !diagnosis || !doctorName) {
          if (msgEl) {
            msgEl.textContent = '请填写症状、诊断、医生姓名';
            msgEl.className = 'form-message error';
            msgEl.hidden = false;
          }
          return;
        }
        var prescriptions = [];
        document.querySelectorAll('#rx-tbody tr').forEach(function (tr) {
          var name = tr.querySelector('.rx-name').value.trim();
          if (!name) return;
          prescriptions.push({
            name: name,
            dosage: tr.querySelector('.rx-dosage').value.trim(),
            qty: parseInt(tr.querySelector('.rx-qty').value, 10) || 1,
            unit_price: parseFloat(tr.querySelector('.rx-price').value) || 0,
          });
        });
        var totalPrice =
          parseFloat(
            (document.getElementById('rec-total-price').textContent || '0').replace(/[¥,]/g, '')
          ) || 0;

        fetch(Clinic.API.records, {
          method: 'POST',
          headers: doctorHeaders(),
          body: JSON.stringify({
            patient_id: currentPatient.id,
            symptoms: symptoms,
            diagnosis: diagnosis,
            treatment: treatment,
            doctor: doctorName,
            prescriptions: prescriptions,
            price: totalPrice,
          }),
        })
          .then(function (r) {
            return r.json();
          })
          .then(function (d) {
            if (d.success) {
              if (msgEl) {
                msgEl.textContent = '病历保存成功';
                msgEl.className = 'form-message success';
                msgEl.hidden = false;
              }
              addRecordForm.reset();
              document.getElementById('rx-tbody').innerHTML = '';
              updateRxTotal();
              fetchPatientByPhone(currentPatient.phone);
            } else if (msgEl) {
              msgEl.textContent = d.message || '保存失败';
              msgEl.className = 'form-message error';
              msgEl.hidden = false;
            }
          })
          .catch(function () {
            if (msgEl) {
              msgEl.textContent = '无法连接服务器';
              msgEl.className = 'form-message error';
              msgEl.hidden = false;
            }
          });
      });
    }

    var imgForm = document.getElementById('image-upload-form');
    if (imgForm) {
      imgForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var errEl = document.getElementById('image-upload-error');
        if (errEl) errEl.hidden = true;
        if (!currentPatient.id) {
          if (errEl) {
            errEl.textContent = '请先通过手机号选择患者';
            errEl.hidden = false;
          }
          return;
        }
        var fileInput = document.getElementById('image-file');
        if (!fileInput || !fileInput.files || !fileInput.files[0]) {
          if (errEl) {
            errEl.textContent = '请选择要上传的图片';
            errEl.hidden = false;
          }
          return;
        }
        var category = document.getElementById('image-category').value.trim();
        var note = document.getElementById('image-note').value.trim();
        var fd = new FormData();
        fd.append('image', fileInput.files[0]);
        if (category) fd.append('category', category);
        if (note) fd.append('note', note);

        fetch(Clinic.API.patientImages(currentPatient.id), {
          method: 'POST',
          headers: authOnlyHeaders(),
          body: fd,
        })
          .then(handle401)
          .then(function (d) {
            if (!d) return;
            if (d.success) {
              fileInput.value = '';
              document.getElementById('image-category').value = '';
              document.getElementById('image-note').value = '';
              fetchPatientImages(currentPatient.id);
            } else if (errEl) {
              errEl.textContent = d.message || '上传失败';
              errEl.hidden = false;
            }
          })
          .catch(function () {
            if (errEl) {
              errEl.textContent = '网络错误，上传失败';
              errEl.hidden = false;
            }
          });
      });
    }

    var printHistoryBtn = document.getElementById('print-history-btn');
    if (printHistoryBtn) {
      printHistoryBtn.addEventListener('click', function () {
        document.body.setAttribute('data-print-mode', 'history');
        window.print();
        setTimeout(function () {
          document.body.removeAttribute('data-print-mode');
        }, 0);
      });
    }

    var printRxBtn = document.getElementById('print-rx-btn');
    if (printRxBtn) {
      printRxBtn.addEventListener('click', function () {
        document.body.setAttribute('data-print-mode', 'rx');
        window.print();
        setTimeout(function () {
          document.body.removeAttribute('data-print-mode');
        }, 0);
      });
    }
  });
})();

