-- 安鑫诊所 - 默认医生账号
-- 运行 schema.sql 或 migrations.sql 后执行
-- 使用: mysql -u root -p clinic_management < database/seed-doctor.sql
-- 密码为 anxin2026（bcrypt 加密）。如需修改，运行: npm run init-doctor

USE clinic_management;

INSERT INTO users (username, password, name, role) VALUES
  ('dr_deng', '$2a$10$xF28U4x3b4fR0A0CU05HiuFfqWEilzqyDiNqJtKG2JCCpMJP.OQu6', '邓医生', 'doctor'),
  ('dr_li', '$2a$10$xF28U4x3b4fR0A0CU05HiuFfqWEilzqyDiNqJtKG2JCCpMJP.OQu6', '李医生', 'doctor'),
  ('nurse li', '$2a$10$xF28U4x3b4fR0A0CU05HiuFfqWEilzqyDiNqJtKG2JCCpMJP.OQu6', '李护士', 'doctor')
ON DUPLICATE KEY UPDATE username=username;
