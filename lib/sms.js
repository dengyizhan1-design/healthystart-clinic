/**
 * 安鑫诊所 - 短信通知模块
 * 预约成功后向患者手机发送短信提醒
 *
 * 支持模式：
 * - log: 开发模式，仅输出到控制台
 * - aliyun: 阿里云短信（需在控制台申请签名和模板）
 */
const config = require('../config');

let aliyunClient = null;
if (config.sms?.provider === 'aliyun' && config.sms?.aliyun?.accessKeyId && config.sms?.aliyun?.signName) {
  try {
    const DysmsapiClient = require('@alicloud/dysmsapi20170525').default;
    const OpenApiConfig = require('@alicloud/openapi-core').Config;
    const apiConfig = new OpenApiConfig({
      accessKeyId: config.sms.aliyun.accessKeyId,
      accessKeySecret: config.sms.aliyun.accessKeySecret,
      regionId: config.sms.aliyun.regionId || 'cn-hangzhou',
      endpoint: config.sms.aliyun.endpoint || undefined,
    });
    aliyunClient = new DysmsapiClient(apiConfig);
  } catch (err) {
    console.warn('SMS: 阿里云 SDK 加载失败，将使用 log 模式:', err.message);
  }
}

/**
 * 发送预约提醒短信
 * @param {string} phone - 11位手机号
 * @param {string} date - 预约日期，如 2025-03-20
 * @param {string} time - 预约时间，如 09:00
 * @param {string} [patientName] - 患者姓名，可选
 * @returns {Promise<{ ok: boolean, message?: string }>}
 */
async function sendAppointmentReminder(phone, date, time, patientName) {
  if (!config.sms?.enabled) return { ok: true };

  const normalized = String(phone || '').replace(/\D/g, '');
  if (normalized.length !== 11 || !/^1[3-9]\d{9}$/.test(normalized)) {
    return { ok: false, message: '无效手机号' };
  }

  const fullPhone = '86' + normalized;
  const dateStr = date || '';
  const timeStr = time || '';
  const nameStr = patientName || '您';

  if (config.sms.provider === 'aliyun' && aliyunClient && config.sms.aliyun.templateCode) {
    try {
      const { SendSmsRequest } = require('@alicloud/dysmsapi20170525');
      const req = new SendSmsRequest({
        phoneNumbers: fullPhone,
        signName: config.sms.aliyun.signName,
        templateCode: config.sms.aliyun.templateCode,
        templateParam: JSON.stringify({
          name: nameStr,
          date: dateStr,
          time: timeStr,
        }),
      });
      const res = await aliyunClient.sendSms(req);
      const body = res?.body;
      if (body?.code === 'OK') {
        return { ok: true };
      }
      return { ok: false, message: body?.message || '短信发送失败' };
    } catch (err) {
      console.error('SMS 发送失败:', err.message);
      return { ok: false, message: err.message };
    }
  }

  // 默认 log 模式
  const msg = `[SMS] 预约提醒 → ${normalized}：${nameStr}，您已成功预约安鑫诊所，就诊时间 ${dateStr} ${timeStr}，请按时到诊。`;
  console.log(msg);
  return { ok: true };
}

module.exports = { sendAppointmentReminder };
