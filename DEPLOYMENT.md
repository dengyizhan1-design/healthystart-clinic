# 安鑫诊所 - 生产环境部署检查清单

## 1. 环境变量（.env）

| 变量 | 必须 | 说明 |
|------|------|------|
| `NODE_ENV` | ✓ | 设为 `production` |
| `DB_HOST` | ✓ | 数据库主机 |
| `DB_PORT` |  | 默认 3306 |
| `DB_USER` | ✓ | 数据库用户 |
| `DB_PASSWORD` | ✓ | 数据库密码（不可为空） |
| `DB_NAME` | ✓ | 数据库名 |
| `JWT_SECRET` | ✓ | 至少 32 字符随机串 |
| `PORT` |  | 默认 3000 |
| `CORS_ORIGIN` | ✓ | 前端域名，如 `https://clinic.example.com` |
| `PUBLIC_URL` | ✓ | 二维码指向网址，如 `https://clinic.example.com` |

## 2. 部署前命令

```bash
# 1. 安装依赖
npm install

# 2. 创建数据库和表（二选一）
#    方式 A - 全新安装：
mysql -u root -p < database/schema.sql
mysql -u root -p clinic_management < database/seed-doctor.sql

#    方式 B - 已有数据库，补全表：
mysql -u root -p clinic_management < database/migrations.sql
mysql -u root -p clinic_management < database/seed-doctor.sql

# 3. 创建收入结账表（若 schema/migrations 已包含可跳过）
npm run db:income-settlements

# 4. 若需重置医生密码为 anxin2026
npm run init-doctor
```

## 3. 启动

```bash
NODE_ENV=production npm start
```

或使用 PM2：
```bash
NODE_ENV=production pm2 start server.js --name anxin-clinic
```

## 4. 反向代理（Nginx 示例）

生产环境务必使用 HTTPS，并通过 Nginx 反向代理：

```nginx
server {
    listen 443 ssl;
    server_name clinic.example.com;

    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 5. 安全检查

- [ ] `.env` 未提交到 Git（已在 .gitignore）
- [ ] 已修改默认 DB_PASSWORD、JWT_SECRET
- [ ] 使用 HTTPS
- [ ] 防火墙仅开放 80/443，3000 不对外
- [ ] 定期备份数据库

## 6. 稳定性与过载防护

系统内置以下机制，减轻高负载下崩溃风险：

| 机制 | 说明 |
|------|------|
| 请求超时 | 单次请求超过 30 秒自动返回 504，避免长时间占用资源 |
| 限流 | 每 15 分钟每 IP 默认 500 次请求，可通过 `RATE_LIMIT_MAX` 调整 |
| 登录限流 | 登录/注册接口每 15 分钟最多 10 次尝试，防暴力破解 |
| 数据库连接池 | 最大 20 连接，排队上限 50，连接超时 10 秒，避免连接耗尽 |
| 全局错误处理 | 捕获未处理异常，返回 500 而不 crash |
| 优雅关闭 | 收到 SIGTERM/SIGINT 时先关闭 HTTP，再释放连接池 |

PM2 部署时建议开启自动重启与内存限制：

```bash
pm2 start server.js --name anxin-clinic --max-memory-restart 300M
```

## 7. 功能验证

- [ ] 患者注册、登录
- [ ] 预约挂号
- [ ] 医生工作台登录、患者查询、添加就诊记录
- [ ] 我的病历
- [ ] 二维码页面 `/qrcode.html`
