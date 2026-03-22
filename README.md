# 安鑫诊所 - 诊所管理系统

面向小型中医诊所的 Web 系统，四个板块：首页、患者注册/登录/预约、医生工作台。

## 项目结构

```
├── config.js           # 全局配置（统一入口）
├── db.js               # MySQL 连接
├── lib/auth.js         # 认证工具（患者/医生共用）
├── routes/
│   ├── patientRoutes.js   # 患者 API
│   └── doctorRoutes.js    # 医生 API
├── js/
│   ├── common.js       # 前端公共模块（API、认证、工具）
│   ├── index.js        # 首页
│   ├── registration.js # 注册
│   ├── login.js        # 登录
│   ├── appointment.js  # 预约
│   └── doctor.js       # 医生工作台
├── index.html          # 首页
├── registration.html   # 患者注册
├── login.html          # 患者登录
├── appointment.html    # 预约挂号
├── doctor.html         # 医生工作台
├── styles.css          # 统一样式
└── database/
    ├── schema.sql        # 新建数据库（从零创建）
    ├── seed-doctor.sql   # 默认医生账号
    ├── migrations.sql    # 增量迁移（已有库时用）
    └── init-doctor-password.js
```

## 连接关系

- **后端**：`config.js` → `db.js`、`lib/auth.js`、`routes/*` → `server.js`
- **前端**：所有页面先加载 `js/common.js`，再加载页面脚本
- **API**：`js/common.js` 中 `Clinic.API` 与 `routes/*` 路径一一对应

## 数据库设置

**默认配置**（可在 `.env` 中覆盖）：
- Host: `localhost` (127.0.0.1)
- Port: `3306`
- Username: `root`
- Password: `Dyz051025`
- Database: `clinic_management`

1. 确保 MySQL 已安装并运行
2. 可选：`cp .env.example .env` 并填写实际值（不配置时使用上述默认）
3. 从零创建数据库：
   ```bash
   mysql -u root -pDyz051025 < database/schema.sql
   mysql -u root -pDyz051025 clinic_management < database/seed-doctor.sql
   ```
4. 如有旧库需增量更新：`mysql -u root -pDyz051025 clinic_management < database/migrations.sql`
5. 运行 `npm run init-doctor` 重置医生密码（默认 anxin2026）

## 快速开始

1. `npm install && npm start`
2. 浏览器访问 http://localhost:3000
