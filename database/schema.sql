-- 安鑫诊所 - 数据库完整结构
-- 使用: mysql -u root -p < database/schema.sql
-- 或: mysql -u root -p clinic_management < database/schema.sql (若数据库已存在)

CREATE DATABASE IF NOT EXISTS clinic_management DEFAULT CHARSET utf8mb4;
USE clinic_management;

-- 医生/管理员账号
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'doctor',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 患者
CREATE TABLE IF NOT EXISTS patients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL UNIQUE,
  gender VARCHAR(10) NOT NULL DEFAULT 'other',
  birth_date DATE NULL,
  address VARCHAR(255) NULL,
  emergency_contact VARCHAR(100) NULL,
  emergency_phone VARCHAR(20) NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 患者登记扩展信息（症状、病史、过敏史等）
CREATE TABLE IF NOT EXISTS patient_registrations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL,
  id_number VARCHAR(30) NULL,
  symptoms TEXT NULL,
  medical_history TEXT NULL,
  allergy_history TEXT NULL,
  has_insurance VARCHAR(10) NULL,
  preferred_date DATE NULL,
  preferred_time VARCHAR(50) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_patient (patient_id),
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 预约
CREATE TABLE IF NOT EXISTS appointments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL,
  doctor_id INT NOT NULL,
  appointment_date DATETIME NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  notes TEXT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 就诊记录
CREATE TABLE IF NOT EXISTS medical_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL,
  doctor_id INT NOT NULL,
  symptoms TEXT NULL,
  diagnosis TEXT NULL,
  treatment TEXT NULL,
  prescription TEXT NULL,
  total_fee DECIMAL(12,2) DEFAULT 0,
  visit_date DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 患者影像
CREATE TABLE IF NOT EXISTS patient_images (
  id INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL,
  doctor_id INT NOT NULL,
  image_url VARCHAR(500) NOT NULL,
  category VARCHAR(100) NULL,
  note VARCHAR(500) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 收入结账记录（月度重置）
CREATE TABLE IF NOT EXISTS income_settlements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  settled_at DATETIME NOT NULL,
  period VARCHAR(7) NOT NULL,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  record_count INT NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
