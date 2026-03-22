/**
 * 安鑫诊所 - 我的病历与用药记录页面前端逻辑
 * 依赖 js/common.js 中的 Clinic
 */
(function () {
  var CONDITION_KEYWORDS = [
    {
      key: '糖尿病',
      title: '糖尿病相关生活建议',
      tips: [
        '主食建议粗细搭配，例如：白米饭中加入适量糙米、燕麦、杂豆，控制每餐主食量，不盲目“断碳水”。',
        '少吃含糖饮料、甜点、奶茶、果汁，多选择白开水、无糖茶，水果要少量分次吃，尽量放在两餐之间。',
        '保证每天至少 30 分钟中等强度运动（快走、骑车、慢跑等），每周不少于 5 天，饭后 1 小时适当散步有助于控制血糖。',
        '规律作息，避免长期熬夜和情绪大起大落，保持体重在医生建议范围内。'
      ],
    },
    {
      key: '高血压',
      title: '高血压相关生活建议',
      tips: [
        '减少盐的摄入量，每日食盐总量不超过 5 克（大约一个啤酒瓶盖平装），少吃咸菜、酱菜、腌制食品和重口味外卖。',
        '学会阅读食品营养成分表，选择低钠、少油的食物，多吃新鲜蔬菜和适量水果。',
        '保持规律运动，每周至少 150 分钟中等强度有氧运动，如快走、太极、广场舞等，运动前后做好热身和拉伸。',
        '戒烟限酒，控制体重，保持心情平稳，定期在家或门诊测量血压并记录，方便医生调整用药。'
      ],
    },
    {
      key: '冠心病',
      title: '冠心病 / 心脏病相关生活建议',
      tips: [
        '避免暴饮暴食和一次性大量高脂肪、高油炸食物，饮食以清淡、易消化为主，适量增加鱼类和优质蛋白。',
        '活动时量力而行，不剧烈运动，爬坡、搬重物等应根据医生建议控制强度，如出现胸闷、胸痛应立即休息并按医嘱处理。',
        '保持情绪平稳，尽量避免过度紧张、生气和熬夜，可通过深呼吸、散步、听音乐等方式放松。',
        '按时服药，不随意停药或自行加减药物剂量，如有不适及时联系医生。'
      ],
    },
    {
      key: '高血脂',
      title: '血脂偏高相关生活建议',
      tips: [
        '减少油炸食品、肥肉、动物内脏、奶油蛋糕等高脂肪食物，多选清蒸、炖煮、凉拌等烹饪方式。',
        '适量增加粗粮、豆制品、深色蔬菜和适量坚果，有助于改善血脂，但坚果不宜过量。',
        '合理安排三餐，不暴饮暴食，晚餐不过饱，睡前 2～3 小时避免进食大量食物。'
      ],
    },
    {
      key: '肥胖',
      title: '超重 / 肥胖相关生活建议',
      tips: [
        '在医生指导下逐步控制总热量摄入，不盲目节食或极端减肥，建议少量多餐，细嚼慢咽。',
        '减少含糖饮料、甜食和高热量零食，多喝水，多吃蔬菜和高纤维食物，增加饱腹感。',
        '结合自身情况制定可长期坚持的运动计划，例如每天快走 30～60 分钟，每周坚持 5 天以上。'
      ],
    },
    {
      key: '慢性胃炎',
      title: '胃部不适 / 慢性胃炎相关生活建议',
      tips: [
        '规律饮食，避免暴饮暴食和过度饥饿，尽量做到少量多餐，细嚼慢咽。',
        '少吃辛辣、油炸、生冷、过硬的食物，戒烟限酒，咖啡和浓茶要适量或遵医嘱控制。',
        '睡前 2～3 小时避免进食大量食物，避免饭后立刻躺下，可适当散步活动。'
      ],
    },
  ];

  function formatDate(d) {
    if (!d) return '';
    try {
      var dt = new Date(d);
      if (Number.isNaN(dt.getTime())) return d;
      var y = dt.getFullYear();
      var m = String(dt.getMonth() + 1).padStart(2, '0');
      var day = String(dt.getDate()).padStart(2, '0');
      return y + '-' + m + '-' + day;
    } catch (_) {
      return d;
    }
  }

  function escapeHtml(str) {
    if (typeof Clinic !== 'undefined' && Clinic.escapeHtml) {
      return Clinic.escapeHtml(str);
    }
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderRecord(rec) {
    var rxRows = '';
    var list = Array.isArray(rec.prescriptions) ? rec.prescriptions : [];
    if (list.length > 0) {
      rxRows +=
        '<table class="rx-list"><thead><tr><th>药品名称</th><th>用法用量</th><th>数量</th><th>单价</th></tr></thead><tbody>';
      list.forEach(function (r) {
        // 兼容两种处方结构：
        // 1) 旧结构：{name, usage, dose, frequency}
        // 2) 当前医生端结构：{name, dosage, qty, unit_price}
        var usageDose =
          (r.usage || r.dose || r.frequency
            ? [r.usage, r.dose, r.frequency].filter(Boolean).join(' ')
            : r.dosage) || '';
        var qty = r.qty != null ? r.qty : r.quantity;
        var price = r.unit_price != null ? r.unit_price : r.price;
        rxRows +=
          '<tr><td>' +
          escapeHtml(r.name || '') +
          '</td><td>' +
          escapeHtml(usageDose) +
          '</td><td>' +
          escapeHtml(qty == null ? '' : String(qty)) +
          '</td><td>' +
          escapeHtml(price == null ? '' : String(price)) +
          '</td></tr>';
      });
      rxRows += '</tbody></table>';
    }

    return (
      '<article class="card record-block">' +
      '<div class="record-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem">' +
      '<div><h2 style="margin:0;font-size:1rem">就诊日期：' +
      escapeHtml(formatDate(rec.visit_date)) +
      '</h2><p style="margin:0.2rem 0 0;color:var(--slate-500);font-size:0.85rem">接诊医生：' +
      escapeHtml(rec.doctor_name || '—') +
      '</p></div>' +
      (rec.total_fee != null
        ? '<div style="font-weight:600;color:var(--primary-700)">总费用：¥' +
          escapeHtml(String(rec.total_fee)) +
          '</div>'
        : '') +
      '</div>' +
      '<div class="record-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:0.75rem;">' +
      '<div><h3>症状/主诉</h3><p class="value">' +
      escapeHtml(rec.symptoms || '—') +
      '</p></div>' +
      '<div><h3>诊断</h3><p class="value">' +
      escapeHtml(rec.diagnosis || '—') +
      '</p></div>' +
      '<div><h3>治疗方案</h3><p class="value">' +
      escapeHtml(rec.treatment || '—') +
      '</p></div>' +
      '</div>' +
      (rxRows || '') +
      '</article>'
    );
  }

  function extractConditionsFromRecords(records) {
    var diagnosisText = records
      .map(function (r) {
        return (r.diagnosis || '') + ' ' + (r.symptoms || '');
      })
      .join(' ');
    var lowered = diagnosisText.toLowerCase();
    var matched = [];
    CONDITION_KEYWORDS.forEach(function (c) {
      if (!c.key) return;
      if (diagnosisText.indexOf(c.key) !== -1 || lowered.indexOf(c.key.toLowerCase()) !== -1) {
        matched.push(c);
      }
    });
    return matched;
  }

  function renderLifeTips(conditions) {
    var section = document.getElementById('life-tips-section');
    var box = document.getElementById('life-tips-content');
    if (!section || !box) return;
    if (!conditions || !conditions.length) {
      section.style.display = 'none';
      box.innerHTML = '';
      return;
    }
    var html = '';
    conditions.forEach(function (c) {
      html += '<div style="margin-bottom:0.9rem;">';
      html += '<h3 style="margin:0 0 0.35rem;font-size:0.95rem;color:var(--primary-800);">' + escapeHtml(c.title) + '</h3>';
      html += '<ul style="margin:0;padding-left:1.1rem;">';
      (c.tips || []).forEach(function (t) {
        html += '<li style="margin:0.15rem 0;">' + escapeHtml(t) + '</li>';
      });
      html += '</ul>';
      html += '</div>';
    });
    box.innerHTML = html;
    section.style.display = 'block';
  }

  function showRecords() {
    var msgEl = document.getElementById('records-message');
    var listEl = document.getElementById('records-list');
    if (msgEl) {
      msgEl.hidden = false;
      msgEl.textContent = '正在加载就诊记录…';
      msgEl.className = 'form-message';
    }
    if (listEl) listEl.innerHTML = '';

    if (typeof Clinic === 'undefined' || !Clinic.API || !Clinic.API.myRecords) {
      if (msgEl) {
        msgEl.textContent = '前端配置错误，请联系诊所';
        msgEl.className = 'form-message error';
      }
      return;
    }

    fetch(Clinic.API.myRecords, {
      method: 'GET',
      headers: Clinic.authHeaders(),
    })
      .then(function (r) {
        if (r.status === 401 || r.status === 403) {
          return { unauthorized: true };
        }
        if (!r.ok) {
          return r.json().catch(function () {
            return { success: false, records: [] };
          });
        }
        return r.json();
      })
      .then(function (res) {
        if (!res) res = { success: false, records: [] };
        if (res.unauthorized) {
          if (typeof Clinic !== 'undefined') Clinic.clearPatientSession();
          var authBox = document.getElementById('auth-required');
          var container = document.getElementById('records-container');
          if (authBox) authBox.hidden = false;
          if (container) container.hidden = true;
          return;
        }

        var records = Array.isArray(res.records) ? res.records : [];
        if (records.length === 0) {
          if (listEl) {
            listEl.innerHTML =
              '<div class="empty-records"><p>目前还没有就诊记录。</p><button type="button" id="refresh-records-btn" class="btn btn-outline btn-sm">刷新列表</button></div>';
          }
          renderLifeTips([]);
        } else {
          if (listEl) {
            listEl.innerHTML = records.map(renderRecord).join('');
          }
          // 根据诊断提取疾病类型并展示对应生活建议（不包含任何用药推荐）
          var conditions = extractConditionsFromRecords(records);
          renderLifeTips(conditions);
        }
        if (msgEl) msgEl.hidden = true;

        var btn = document.getElementById('refresh-records-btn');
        if (btn) {
          btn.addEventListener('click', function () {
            showRecords();
          });
        }
      })
      .catch(function () {
        if (msgEl) {
          msgEl.hidden = false;
          msgEl.textContent = '加载失败，请稍后重试';
          msgEl.className = 'form-message error';
        }
      });
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (typeof Clinic !== 'undefined') {
      Clinic.initMobileMenu();
    }
    var authBox = document.getElementById('auth-required');
    var container = document.getElementById('records-container');
    if (authBox) authBox.hidden = false;
    if (container) container.hidden = true;

    if (typeof Clinic === 'undefined' || !Clinic.API || !Clinic.API.verify) return;
    var token = Clinic.getToken();
    if (!token) return;

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
        if (!res || !res.success) {
          return;
        }
        if (authBox) authBox.hidden = true;
        if (container) container.hidden = false;
        showRecords();
      })
      .catch(function () {
        // keep auth-required visible
      });
  });
})();

