-- ====================================================================
-- University API Access Management System
-- Database Schema and Sample Seeding Script
-- Database: university_api_system
-- Compatibility: MySQL 5.7+ / MySQL 8.0+ / MariaDB 10.4+
-- ====================================================================

CREATE DATABASE IF NOT EXISTS `university_api_system`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `university_api_system`;

-- Disable foreign key checks during schema recreation if needed
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `api_request_logs`;
DROP TABLE IF EXISTS `academic_marks`;
DROP TABLE IF EXISTS `api_keys`;
DROP TABLE IF EXISTS `students`;
DROP TABLE IF EXISTS `teachers`;

SET FOREIGN_KEY_CHECKS = 1;

-- --------------------------------------------------------------------
-- 1. Students Table
-- --------------------------------------------------------------------
CREATE TABLE `students` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `student_number` VARCHAR(50) NOT NULL UNIQUE,
  `full_name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(120) NOT NULL UNIQUE,
  `department` VARCHAR(100) NOT NULL,
  `semester` INT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_students_department` (`department`),
  INDEX `idx_students_semester` (`semester`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 2. Teachers Table
-- --------------------------------------------------------------------
CREATE TABLE `teachers` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `teacher_number` VARCHAR(50) NOT NULL UNIQUE,
  `full_name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(120) NOT NULL UNIQUE,
  `department` VARCHAR(100) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_teachers_department` (`department`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 3. Academic Marks Table
-- --------------------------------------------------------------------
CREATE TABLE `academic_marks` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `student_id` INT NOT NULL,
  `subject_name` VARCHAR(100) NOT NULL,
  `total_marks` INT NOT NULL DEFAULT 100,
  `obtained_marks` DECIMAL(5,2) NOT NULL,
  `semester` INT NOT NULL,
  `teacher_id` INT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_marks_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_marks_teacher` FOREIGN KEY (`teacher_id`) REFERENCES `teachers` (`id`) ON DELETE CASCADE,
  INDEX `idx_marks_student` (`student_id`),
  INDEX `idx_marks_teacher` (`teacher_id`),
  INDEX `idx_marks_subject` (`subject_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 4. API Keys Table
-- --------------------------------------------------------------------
CREATE TABLE `api_keys` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `key_prefix` VARCHAR(24) NOT NULL,
  `key_hash` VARCHAR(128) NOT NULL UNIQUE,
  `owner_type` ENUM('student', 'teacher', 'admin') NOT NULL,
  `owner_id` INT NULL,
  `key_name` VARCHAR(100) NOT NULL,
  `request_limit` INT NOT NULL DEFAULT 100,
  `request_count` INT NOT NULL DEFAULT 0,
  `status` ENUM('active', 'revoked') NOT NULL DEFAULT 'active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `last_used_at` TIMESTAMP NULL DEFAULT NULL,
  `revoked_at` TIMESTAMP NULL DEFAULT NULL,
  INDEX `idx_keys_owner` (`owner_type`, `owner_id`),
  INDEX `idx_keys_status` (`status`),
  INDEX `idx_keys_hash` (`key_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 5. API Request Logs Table
-- --------------------------------------------------------------------
CREATE TABLE `api_request_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `api_key_id` INT NULL,
  `endpoint` VARCHAR(255) NOT NULL,
  `http_method` VARCHAR(10) NOT NULL,
  `response_status` INT NOT NULL,
  `requested_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_logs_api_key` FOREIGN KEY (`api_key_id`) REFERENCES `api_keys` (`id`) ON DELETE SET NULL,
  INDEX `idx_logs_key_id` (`api_key_id`),
  INDEX `idx_logs_requested_at` (`requested_at`),
  INDEX `idx_logs_status` (`response_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- Sample Seed Data
-- ====================================================================

-- Insert Teachers (4 professors across departments)
INSERT INTO `teachers` (`id`, `teacher_number`, `full_name`, `email`, `department`) VALUES
(1, 'TCH-2021-001', 'Dr. Alan Turing', 'alan.turing@university.edu', 'Computer Science'),
(2, 'TCH-2021-002', 'Prof. Ada Lovelace', 'ada.lovelace@university.edu', 'Software Engineering'),
(3, 'TCH-2022-003', 'Dr. Claude Shannon', 'claude.shannon@university.edu', 'Information Technology'),
(4, 'TCH-2023-004', 'Dr. Grace Hopper', 'grace.hopper@university.edu', 'Artificial Intelligence');

-- Insert Students (12 realistic students across semesters 3 to 8)
INSERT INTO `students` (`id`, `student_number`, `full_name`, `email`, `department`, `semester`) VALUES
(1, 'STD-2023-1001', 'Zainab Ahmed', 'zainab.ahmed@student.university.edu', 'Computer Science', 6),
(2, 'STD-2023-1002', 'Bilal Hassan', 'bilal.hassan@student.university.edu', 'Computer Science', 6),
(3, 'STD-2023-1003', 'Fatima Noor', 'fatima.noor@student.university.edu', 'Software Engineering', 4),
(4, 'STD-2023-1004', 'Hamza Tariq', 'hamza.tariq@student.university.edu', 'Software Engineering', 4),
(5, 'STD-2022-1005', 'Ayesha Khan', 'ayesha.khan@student.university.edu', 'Information Technology', 7),
(6, 'STD-2022-1006', 'Usman Ali', 'usman.ali@student.university.edu', 'Information Technology', 7),
(7, 'STD-2024-1007', 'Mariam Siddiqui', 'mariam.siddiqui@student.university.edu', 'Artificial Intelligence', 3),
(8, 'STD-2024-1008', 'Omer Farooq', 'omer.farooq@student.university.edu', 'Artificial Intelligence', 3),
(9, 'STD-2021-1009', 'Sana Malik', 'sana.malik@student.university.edu', 'Computer Science', 8),
(10, 'STD-2021-1010', 'Danish Qureshi', 'danish.qureshi@student.university.edu', 'Software Engineering', 8),
(11, 'STD-2023-1011', 'Hira Javed', 'hira.javed@student.university.edu', 'Computer Science', 5),
(12, 'STD-2023-1012', 'Mustafa Raza', 'mustafa.raza@student.university.edu', 'Information Technology', 5);

-- Insert Academic Marks (Linked to respective students & teachers)
INSERT INTO `academic_marks` (`student_id`, `subject_name`, `total_marks`, `obtained_marks`, `semester`, `teacher_id`) VALUES
-- Zainab Ahmed (Student 1) - Semester 6 (CS)
(1, 'Web Engineering & Full Stack', 100, 92.50, 6, 2),
(1, 'Design & Analysis of Algorithms', 100, 88.00, 6, 1),
(1, 'Computer Communication & Networks', 100, 84.50, 6, 3),

-- Bilal Hassan (Student 2) - Semester 6 (CS)
(2, 'Web Engineering & Full Stack', 100, 78.00, 6, 2),
(2, 'Design & Analysis of Algorithms', 100, 74.50, 6, 1),
(2, 'Computer Communication & Networks', 100, 81.00, 6, 3),

-- Fatima Noor (Student 3) - Semester 4 (SE)
(3, 'Software Architecture & Design', 100, 95.00, 4, 2),
(3, 'Database Management Systems', 100, 89.50, 4, 1),
(3, 'Object Oriented Software Engineering', 100, 91.00, 4, 2),

-- Hamza Tariq (Student 4) - Semester 4 (SE)
(4, 'Software Architecture & Design', 100, 71.00, 4, 2),
(4, 'Database Management Systems', 100, 68.50, 4, 1),
(4, 'Object Oriented Software Engineering', 100, 75.00, 4, 2),

-- Ayesha Khan (Student 5) - Semester 7 (IT)
(5, 'Cloud Computing & DevOps', 100, 94.00, 7, 3),
(5, 'Enterprise Systems Integration', 100, 87.50, 7, 3),
(5, 'Network Security & Cryptography', 100, 89.00, 7, 3),

-- Usman Ali (Student 6) - Semester 7 (IT)
(6, 'Cloud Computing & DevOps', 100, 76.50, 7, 3),
(6, 'Enterprise Systems Integration', 100, 82.00, 7, 3),
(6, 'Network Security & Cryptography', 100, 79.50, 7, 3),

-- Mariam Siddiqui (Student 7) - Semester 3 (AI)
(7, 'Introduction to Machine Learning', 100, 96.00, 3, 4),
(7, 'Linear Algebra & Optimization', 100, 93.50, 3, 1),
(7, 'Data Structures in Python', 100, 90.00, 3, 4),

-- Omer Farooq (Student 8) - Semester 3 (AI)
(8, 'Introduction to Machine Learning', 100, 83.00, 3, 4),
(8, 'Linear Algebra & Optimization', 100, 77.50, 3, 1),
(8, 'Data Structures in Python', 100, 85.00, 3, 4),

-- Sana Malik (Student 9) - Semester 8 (CS)
(9, 'Distributed Computing Systems', 100, 91.00, 8, 1),
(9, 'Deep Learning Architectures', 100, 88.50, 8, 4),
(9, 'Final Year Capstone Project I', 100, 97.00, 8, 2),

-- Danish Qureshi (Student 10) - Semester 8 (SE)
(10, 'Software Quality Assurance', 100, 82.50, 8, 2),
(10, 'DevOps & Continuous Delivery', 100, 85.00, 8, 3),
(10, 'Final Year Capstone Project I', 100, 90.00, 8, 2),

-- Hira Javed (Student 11) - Semester 5 (CS)
(11, 'Operating Systems Concepts', 100, 86.00, 5, 1),
(11, 'Theory of Automata & Computation', 100, 79.00, 5, 1),
(11, 'Database Systems & SQL', 100, 88.00, 5, 3),

-- Mustafa Raza (Student 12) - Semester 5 (IT)
(12, 'Operating Systems Concepts', 100, 74.00, 5, 1),
(12, 'Human-Computer Interaction', 100, 84.50, 5, 2),
(12, 'Database Systems & SQL', 100, 79.00, 5, 3);
