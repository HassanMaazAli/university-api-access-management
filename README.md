# University API Access Management System

A production-grade, secure, full-stack **University API Access Management System** built with **Node.js, Express.js, MySQL (mysql2), Bootstrap 5, and jQuery AJAX**.

This application demonstrates cryptographic API-key-based authentication, role-based access control (RBAC), atomic rate limiting, and strict key-derived data isolation.

---

## 📑 Table of Contents

- [Core Features](#-core-features)
- [Architecture & Tech Stack](#-architecture--tech-stack)
- [Prerequisites](#-prerequisites)
- [Quick Setup Guide](#-quick-setup-guide)
- [Pre-Seeded Demo Credentials](#-pre-seeded-demo-credentials)
- [REST API Endpoints Reference](#-rest-api-endpoints-reference)
- [Security Model & Safeguards](#-security-model--safeguards)
- [Running Automated Verification Tests](#-running-automated-verification-tests)
- [Troubleshooting Common Issues](#-troubleshooting-common-issues)

---

## 🚀 Core Features

1. **Header-Only API Key Authentication:**
   - Keys are transmitted exclusively via the `x-api-key` HTTP request header.
   - Any API key passed in URL query parameters (`?api_key=...`) is strictly rejected (HTTP 400).
2. **Cryptographic Key Hashing:**
   - API keys are generated using 24 cryptographically random bytes (`uap_<role>_<hex>`).
   - Only the **SHA-256 hash** of the key is stored in the MySQL database.
   - Plaintext keys are revealed **only once** upon generation with a copy button.
3. **Strict Data Isolation (Identity Derived from Key):**
   - Students **never** pass their student ID in query strings or body parameters.
   - The server derives student identity strictly from the verified key hash.
   - Changing client-side IDs cannot grant access to another student's marks.
4. **Faculty Oversight Dashboard:**
   - Teachers can search, filter, and inspect marks across all departments and semesters.
   - Teachers have strictly read-only access and cannot access administrative actions.
5. **Administrative Key Lifecycle Management:**
   - View real-time statistics (students, teachers, active keys, revoked keys, API volume).
   - Generate keys with custom request quotas.
   - Dynamically adjust request limits on the fly (`PATCH /api/admin/api-keys/:id/limit`).
   - Immediately revoke compromised keys (`PATCH /api/admin/api-keys/:id/revoke`), returning HTTP 403 on subsequent requests.
6. **Atomic Concurrency-Safe Rate Limiting:**
   - Atomic SQL updates (`request_count = request_count + 1 WHERE id = ? AND request_count < request_limit`) prevent race conditions.
   - Automatically issues HTTP 429 Too Many Requests when the quota is exhausted.
7. **Audit Request Logging:**
   - Every authenticated and rejected request logs the endpoint, HTTP method, status code, and timestamp to `api_request_logs`.

---

## 🛠️ Architecture & Tech Stack

| Component | Technology | Purpose |
| :--- | :--- | :--- |
| **Backend** | Node.js & Express.js | REST API routing, cryptographic hashing, middleware pipeline |
| **Database** | MySQL 5.7+ / MariaDB 10.4+ (`mysql2/promise`) | Relational schema with foreign keys, constraints, and connection pooling |
| **Frontend** | HTML5, CSS3, JavaScript (ES6) | Responsive SaaS UI with dark navy sidebar, cards, modals, and toasts |
| **Styling** | Bootstrap 5.3 + Bootstrap Icons | Grid layout, responsive navigation, dialogs, badges, and alerts |
| **Data Fetching** | jQuery 3.7.1 AJAX | Dynamic CRUD, real-time filters, header injection, toast feedback |
| **Charts** | Chart.js 4.4 | Distribution charts and student subject performance visualizations |

---

## 📋 Prerequisites

- **Node.js** (v16+ or v20+)
- **npm** (v8+)
- **XAMPP** (Apache not required; MySQL service must be running on port 3306)

---

## ⚡ Quick Setup Guide

### 1. Clone or Open the Workspace

Open terminal in the project directory:
```bash
cd university-api-system
```

### 2. Install Node Dependencies

```bash
npm install
```

### 3. Start XAMPP MySQL

- Open the **XAMPP Control Panel**.
- Click **Start** next to **MySQL** (Default port: `3306`).

### 4. Create and Seed Database

Run the automated database seeding script:
```bash
npm run seed
```
*This command executes `database.sql`, creates the `university_api_system` database, populates 12 students, 4 teachers, 36 marks records, and seeds the initial demo API keys.*

### 5. Configure Environment Variables

The project includes an active `.env` pre-configured for default XAMPP settings:
```env
PORT=3000
NODE_ENV=development

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=university_api_system

ADMIN_API_KEY=uap_admin_secret_99887766554433221100aabbcc
```

### 6. Start the Server

```bash
npm start
```
Or for auto-reloading during development:
```bash
npm run dev
```

Visit the application in your browser:
- 🌐 **Home & Quick Launch:** [http://localhost:3000](http://localhost:3000)
- 🛡️ **Admin Console:** [http://localhost:3000/admin](http://localhost:3000/admin)
- 👨‍🎓 **Student Dashboard:** [http://localhost:3000/student/dashboard](http://localhost:3000/student/dashboard)
- 👨‍🏫 **Teacher Dashboard:** [http://localhost:3000/teacher/dashboard](http://localhost:3000/teacher/dashboard)
- ⚙️ **Key Settings:** [http://localhost:3000/settings](http://localhost:3000/settings)

---

## 🔑 Pre-Seeded Demo Credentials

The database seeding script pre-configures realistic accounts and API keys:

| Role | Entity Name | Identifier | Pre-Seeded API Key | Quota Limit |
| :--- | :--- | :--- | :--- | :--- |
| **Admin** | System Administrator | `ADMIN-MASTER` | `uap_admin_secret_99887766554433221100aabbcc` | 1,000,000 |
| **Faculty** | Dr. Alan Turing | `TCH-2021-001` (CS) | `uap_teacher_alan_turing_sec_2026_demo_key` | 500 |
| **Student** | Zainab Ahmed | `STD-2023-1001` (CS, Sem 6) | `uap_student_zainab_ahmed_2026_demo_key` | 100 |
| **Student** | Bilal Hassan | `STD-2023-1002` (CS, Sem 6) | `uap_student_bilal_hassan_2026_demo_key` | 100 |
| **Revoked Key** | Fatima Noor | `STD-2023-1003` | `uap_student_revoked_test_key_sample_403` | Revoked (HTTP 403) |
| **Rate-Limited** | Hamza Tariq | `STD-2023-1004` | `uap_student_rate_limited_sample_429` | 50/50 Used (HTTP 429) |

*You can test any of these keys instantly from the **Home** or **Settings** page using one-click preset buttons.*

---

## 📡 REST API Endpoints Reference

All secured endpoints require the `x-api-key: <key>` header.

### Authentication & Identification
| Method | Endpoint | Allowed Roles | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/validate` | Public | Validates a key and returns safe account metadata (no secrets leaked) |
| `GET` | `/api/auth/me` | Any valid key | Returns the authenticated identity attached to `req.auth` |

### Administration (`/api/admin/*`)
*Protected by `authenticateApiKey` AND `requireRole('admin')`*
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/admin/stats` | Dashboard metrics: total students, teachers, active/revoked keys, request count |
| `GET` | `/api/admin/students` | List, search, and filter student directory |
| `GET` | `/api/admin/teachers` | List, search, and filter faculty directory |
| `GET` | `/api/admin/api-keys` | List managed keys with prefixes and usage (hashes are excluded) |
| `POST` | `/api/admin/api-keys` | Generate new API key with custom request quota |
| `PATCH` | `/api/admin/api-keys/:id/limit` | Update request quota limit |
| `PATCH` | `/api/admin/api-keys/:id/revoke` | Revoke key immediately |
| `GET` | `/api/admin/logs` | View request audit logs with method, endpoint, and status code filters |

### Student Portal (`/api/student/*`)
*Protected by `authenticateApiKey` AND `requireRole('student')`*
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/student/profile` | Returns authenticated student's profile (derived from key) |
| `GET` | `/api/student/marks` | Returns authenticated student's marks and computed grade |

### Faculty Portal (`/api/teacher/*`)
*Protected by `authenticateApiKey` AND `requireRole('teacher')`*
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/teacher/profile` | Returns authenticated faculty member profile |
| `GET` | `/api/teacher/students` | View all students with search & department filters |
| `GET` | `/api/teacher/marks` | View all marks with search, department, and semester filters |

---

## 🔒 Security Model & Safeguards

1. **SHA-256 One-Way Hashing:**
   - Raw keys are never stored in the database.
   - Incoming request headers are hashed in memory (`crypto.createHash('sha256').update(rawKey).digest('hex')`) and compared against stored hashes.
2. **Key-Derived Isolation:**
   - Student endpoints don't accept `student_id` in the URL or body. Identity is bound to `req.auth.ownerId`.
3. **Atomic Quota Increments:**
   - MySQL atomic `UPDATE api_keys SET request_count = request_count + 1 WHERE id = ? AND request_count < request_limit` ensures threads cannot exceed limits in race conditions.
4. **Header Enforcement:**
   - URL query parameters (`?api_key=...`) are explicitly blocked to prevent token leakage in web server access logs and browser history.
5. **Client-Side Storage Considerations:**
   - Keys are stored in `sessionStorage` (cleared on tab close).
   - In production enterprise SaaS applications, HttpOnly cookies with CSRF tokens are recommended for browser sessions, reserving raw API keys for backend-to-backend integrations.

---

## 🧪 Running Automated Verification Tests

The project includes an end-to-end automated testing suite verifying all 8 assignment requirements:

```bash
npm test
```

### What `npm test` checks:
- ✅ Serves all 5 web routes (`/`, `/admin`, `/student/dashboard`, `/teacher/dashboard`, `/settings`) with HTTP 200
- ✅ Rejects requests without `x-api-key` header with HTTP 401
- ✅ Rejects API keys in query parameters with HTTP 400
- ✅ Rejects invalid/fake keys with HTTP 401
- ✅ Rejects revoked keys with HTTP 403 Forbidden
- ✅ Rejects quota-exceeded keys with HTTP 429 Too Many Requests
- ✅ Key validation endpoint returns safe metadata without leaking hashes
- ✅ Student identity isolation: Student 1 sees only Student 1 data, Student 2 sees only Student 2 data
- ✅ Student RBAC: blocked from Teacher (403) and Admin (403) endpoints
- ✅ Teacher RBAC: can view all students and marks, but blocked from Admin (403) endpoints
- ✅ Admin lifecycle: overview statistics, key generation, limit adjustment, key revocation, and audit logging

---

## ❓ Troubleshooting Common Issues

### 1. `Can't connect to MySQL server on '127.0.0.1' (10061)`
- **Cause:** XAMPP MySQL is not started.
- **Solution:** Open XAMPP Control Panel and click **Start** next to MySQL.

### 2. `Access denied for user 'root'@'localhost'`
- **Cause:** Your XAMPP MySQL root user has a password set.
- **Solution:** Open `.env` and set `DB_PASSWORD=your_actual_password`.

### 3. `Port 3000 is already in use`
- **Cause:** Another Node.js process is occupying port 3000.
- **Solution:** Change `PORT=3001` in `.env` or terminate the existing process.
