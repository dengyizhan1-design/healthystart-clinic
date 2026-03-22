/**
 * 安鑫诊所 - 首页健康小贴士侧边栏
 * 提供与诊断无关的通用生活建议（饮食、作息、运动等）
 */
(function () {
  var tipsGroups = [
    {
      title: '日常作息小建议',
      items: [
        '尽量保持固定作息时间，成年人建议每晚 7–8 小时高质量睡眠。',
        '睡前 1 小时尽量不用手机、电脑，可以听轻音乐或做简单拉伸帮助放松。',
        '白天如果犯困，可选择 15–20 分钟短暂午休，避免长时间躺卧影响晚间睡眠。',
      ],
    },
    {
      title: '饮食习惯小建议',
      items: [
        '一天三餐时间尽量规律，早餐要吃好，不要长期以奶茶、油条代替正餐。',
        '一半蔬菜、一份主食、一份优质蛋白（鱼、蛋、豆制品、瘦肉）是比较均衡的一餐搭配。',
        '减少含糖饮料和零食，多喝白开水或淡茶，注意慢慢细嚼，给胃更多“准备时间”。',
      ],
    },
    {
      title: '运动与活动小建议',
      items: [
        '每周至少 5 天，每天累积 30 分钟中等强度活动，如快走、骑车、广场舞等。',
        '久坐一小时左右就起身活动 3–5 分钟，可以简单走动、伸展颈肩和腰背。',
        '运动时以“微微出汗、不明显气喘、第二天不明显酸痛”为宜，循序渐进地增加强度。',
      ],
    },
    {
      title: '情绪与压力管理',
      items: [
        '遇到压力时，可以尝试深呼吸：吸气 4 秒、憋气 4 秒、呼气 6 秒，重复数次帮助平稳情绪。',
        '给自己安排一点固定的兴趣时间，如听歌、阅读、散步，让大脑从工作中抽离出来。',
        '感觉情绪长期低落、失眠明显或影响工作生活时，建议主动与医生沟通寻求专业帮助。',
      ],
    },
  ];

  function pickGroup() {
    if (!tipsGroups.length) return null;
    var idx = Math.floor(Math.random() * tipsGroups.length);
    return tipsGroups[idx];
  }

  function renderSidebarTips() {
    var container = document.getElementById('health-tips-sidebar-content');
    if (!container) return;
    var group = pickGroup();
    if (!group) return;
    var html = '<h4 style="margin:0 0 0.35rem;font-size:0.95rem;color:var(--primary-800);">' + group.title + '</h4>';
    html += '<ul style="margin:0;padding-left:1.1rem;font-size:0.9rem;line-height:1.6;">';
    group.items.forEach(function (t) {
      html += '<li style="margin:0.2rem 0;">' + t + '</li>';
    });
    html += '</ul>';
    container.innerHTML = html;
  }

  document.addEventListener('DOMContentLoaded', function () {
    renderSidebarTips();
  });
})();

