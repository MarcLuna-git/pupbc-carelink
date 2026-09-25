Here's the **complete `docs/API.md`** - ready to copy-paste:

```markdown
# 🏥 PUPBC CareLink API Documentation

> Version: 1.0.0  
> Base URL: `http://127.0.0.1:8000/api`  
> Authentication: Bearer Token (JWT)

---

## 🔐 Authentication

### Student Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "student_id": "2023-00057-BN-0",
  "birthday": "2004-09-24",
  "password": "********"
}
```

**Success Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJ0eXAiOiJKV1Q...",
    "user": {
      "student_id": "2023-00057-BN-0",
      "first_name": "Marc Laurence",
      "last_name": "Luna"
    }
  }
}
```

### Nurse Login
```http
POST /api/auth/admin-login
Content-Type: application/json

{
  "email": "pupbc.clinic@iskolarngbayan.pup.edu.ph",
  "password": "********"
}
```

**Success Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJ0eXAiOiJKV1Q...",
    "user": {
      "role": "nurse",
      "name": "Clinic Nurse"
    }
  }
}
```

---

## 👨‍🎓 Student Routes

> Header: `Authorization: Bearer {token}`

### Appointments

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/student/appointments` | List all appointments |
| POST | `/student/appointments` | Book new appointment |
| GET | `/student/appointments/{id}` | View appointment detail |
| PATCH | `/student/appointments/{id}/cancel` | Cancel appointment |
| GET | `/student/available-slots?date=YYYY-MM-DD` | Check available time slots |

**Book Appointment:**
```http
POST /api/student/appointments
Content-Type: application/json

{
  "service": "Consultation",
  "appointment_date": "2026-07-15",
  "time_slot": "9:00 AM",
  "concern": "Headache and fever"
}
```

**Available Slots Response:**
```json
{
  "success": true,
  "data": {
    "date": "2026-07-15",
    "slots": [
      {
        "time": "8:00 AM",
        "max": 10,
        "booked": 5,
        "available": 5,
        "is_full": false
      }
    ]
  }
}
```

### Health Profile

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/student/health-profile` | Get health profile |
| POST | `/student/health-profile` | Create health profile |
| PUT | `/student/health-profile` | Update health profile |
| GET | `/student/health-profile/status` | Check if profile completed |

### Dashboard & Others

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/student/dashboard-stats` | Dashboard statistics |
| GET | `/student/qr` | Get QR code data |
| GET | `/student/consultations` | Health records history |
| GET | `/student/profile` | Get user profile |
| PUT | `/student/profile` | Update user profile |

---

## 👩‍⚕️ Nurse Routes

> Header: `Authorization: Bearer {token}`

### Appointment Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/nurse/appointments` | All appointments |
| GET | `/nurse/appointments/{id}` | Appointment details |
| PATCH | `/nurse/appointments/{id}/approve` | Approve appointment |
| PATCH | `/nurse/appointments/{id}/reject` | Reject with reason |
| PATCH | `/nurse/appointments/{id}/complete` | Mark as completed |
| PATCH | `/nurse/appointments/{id}/reschedule` | Reschedule appointment |

**Reject Appointment:**
```http
PATCH /api/nurse/appointments/{id}/reject
Content-Type: application/json

{
  "reason": "Time slot conflict"
}
```

### Student Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/nurse/students` | List all students |
| GET | `/nurse/students/search?q=` | Search students |
| GET | `/nurse/students/{id}` | Student details |
| GET | `/nurse/students/{id}/health-profile` | Student health profile |
| GET | `/nurse/students/{id}/appointments` | Student appointments |

### Consultation

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/nurse/consultations` | All consultations |
| POST | `/nurse/consultations` | Create consultation |
| GET | `/nurse/consultations/{id}` | View consultation |

### Dashboard

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/nurse/dashboard-stats` | Dashboard statistics |
| GET | `/nurse/reports/consultations` | Consultation reports |
| GET | `/nurse/reports/appointments` | Appointment reports |

---

## 🖥️ Kiosk Routes

> Public (no authentication required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/kiosk/lookup` | Lookup student by ID |
| POST | `/kiosk/checkin` | Check-in student |
| GET | `/kiosk/queue` | Get today's queue |
| POST | `/kiosk/call-next` | Call next patient |
| GET | `/kiosk/available-slots?date=` | Get available time slots |

**Lookup Student:**
```http
POST /api/kiosk/lookup
Content-Type: application/json

{
  "student_id": "2023-00057-BN-0"
}
```

**Check-in:**
```http
POST /api/kiosk/checkin
Content-Type: application/json

{
  "student_id": "2023-00057-BN-0",
  "reason": "Fever and cough",
  "is_walk_in": true
}
```

**Queue Response:**
```json
{
  "success": true,
  "data": {
    "now_serving": { "queue_number": "P-001" },
    "queue": [],
    "total_waiting": 5
  }
}
```

---

## 📊 Rate Limits

| Route Group | Limit | Description |
|-------------|-------|-------------|
| Auth (login/register) | 10 req/min | Prevent brute force |
| Kiosk | 30 req/min | Tablet kiosk access |
| Protected (student/nurse) | 60 req/min | Normal API usage |
| Public | 60 req/min | Announcements, health check |

---

## ❌ Error Codes

| HTTP Code | Meaning | Example |
|-----------|---------|---------|
| 200 | Success | Request processed |
| 400 | Bad Request | Invalid parameters |
| 401 | Unauthenticated | Login required |
| 404 | Not Found | Resource doesn't exist |
| 422 | Validation Error | Missing required fields |
| 429 | Rate Limited | Too many requests |
| 500 | Server Error | Internal issue |

**Error Response Format:**
```json
{
  "success": false,
  "message": "Error description here",
  "error_code": "ERROR_CODE"
}
```

---

## 🔒 Security

| Feature | Description |
|---------|-------------|
| Password Hashing | **bcrypt** encryption |
| Authentication | **JWT tokens** (24-hour expiry) |
| Rate Limiting | All endpoints protected |
| CORS | Restricted to allowed origins |
| Logging | Daily rotating logs (30-day retention) |
| Input Sanitization | Sensitive data redacted in logs |
| Database Backup | Automated backup script |

---

## 📁 Project Structure

```
pupbc-carelink/
├── backend/          # Laravel API (PHP)
├── frontend/         # React SPA (JavaScript)
├── database/         # Backup scripts
├── docs/             # Documentation
│   └── API.md        # This file
└── README.md
```

---

## 🚀 Quick Start

1. Start backend: `php -S 0.0.0.0:8000 -t public`
2. Start frontend: `npm run dev`
3. Access: `http://localhost:3000`
```

---
