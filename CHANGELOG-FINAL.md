# 安鑫诊所 - 最终优化变更报告

## 安全加固

| 变更 | 说明 |
|------|------|
| **Helmet** | 添加安全响应头 (X-Content-Type-Options, X-Frame-Options 等) |
| **Rate Limiting** | 全局 200 次/15 分钟；登录/注册接口 10 次/15 分钟，防暴力破解 |
| **JSON 大小限制** | 请求体限制 256KB，防止大 payload 耗尽资源 |
| **XSS 修复** | 登录页「我的预约」中的预约原因、日期、时间均经 `escapeHtml` 转义 |
| **输入校验** | 预约 ID、患者 ID 强制为正整数；`has_insurance` 仅允许「有」「无」 |

## 健壮性与防崩溃

| 变更 | 说明 |
|------|------|
| **预约 ID 校验** | PUT `/api/appointments/:id/status` 校验 `id` 为正整数 |
| **患者 ID 校验** | POST `/api/records` 校验 `patient_id` 为正整数 |
| **出生日期** | 年龄换算时校验 `parseInt` 结果，避免 NaN |
| **字段长度** | 姓名、症状限制长度，防止超长输入 |
| **连接池错误** | 数据库连接池添加 `error` 监听，便于排查问题 |

## 患者数据保护

| 变更 | 说明 |
|------|------|
| **安全头** | 通过 Helmet 启用常用安全头 |
| **限流** | 登录/注册限流降低暴力破解风险 |
| **CORS 配置** | 支持 `CORS_ORIGIN` 环境变量，生产环境可限制来源 |

## 移动端与部署

| 变更 | 说明 |
|------|------|
| **viewport-fit** | 适配刘海屏等异形屏 |
| **theme-color** | 浏览器/系统状态栏主题色 |
| **PWA 元信息** | 添加 `apple-mobile-web-app-capable` 等，便于添加到主屏幕 |
| **触控优化** | 按钮、链接最小高度 44px；`touch-action: manipulation` 减少 300ms 延迟 |
| **输入框字体** | 移动端输入框 `font-size: 16px` 避免 iOS 自动放大 |

## 涉及文件

- `server.js` - Helmet、限流、CORS、JSON 大小限制
- `db.js` - 连接池错误监听
- `routes/patientRoutes.js` - 输入校验、长度限制、`has_insurance` 校验
- `routes/doctorRoutes.js` - 预约 ID、患者 ID 校验
- `js/login.js` - 预约列表 XSS 修复
- `styles.css` - 移动端触控样式
- `index.html`, `registration.html`, `login.html`, `appointment.html`, `doctor.html` - 移动端 meta 标签
