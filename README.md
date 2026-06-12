# 🚀 MediQueue Server API

> A secure, scalable REST API built with Node.js, Express, MongoDB, and JWT authentication for managing tutors, bookings, and users.

![Node.js](https://img.shields.io/badge/Node.js-18+-green?logo=node.js)
![Express](https://img.shields.io/badge/Express.js-Backend-black?logo=express)
![MongoDB](https://img.shields.io/badge/MongoDB-Database-47A248?logo=mongodb)
![JWT](https://img.shields.io/badge/JWT-Auth-000000?logo=jsonwebtokens)
![bcrypt](https://img.shields.io/badge/bcrypt-Security-blue)
![Status](https://img.shields.io/badge/Status-Production_Ready-success)

---

## 📖 Overview

This backend powers the **MediQueue platform**, handling authentication, tutor management, and booking operations with strong security practices.

Key capabilities:

* 🔐 Secure authentication (JWT + bcrypt)
* 👨‍🏫 Tutor management system
* 📅 Booking system with slot control
* 🛡️ Role-based authorization
* 🌐 CORS-protected API
* ⚡ Optimized MongoDB operations

---

## ⚙️ Tech Stack

* **Node.js** – Runtime environment
* **Express.js** – Web framework
* **MongoDB Atlas** – Cloud database
* **JWT (jsonwebtoken)** – Authentication
* **bcrypt** – Password hashing
* **dotenv** – Environment configuration
* **cors** – Cross-origin security

---

## 📁 Project Structure

```bash
server/
│
├── index.js / server.js   # Main entry point
├── .env                   # Environment variables
├── package.json
│
├── routes/                # API routes (optional structure)
├── controllers/           # Business logic (if modularized)
├── middlewares/           # JWT verification, etc.
└── utils/                 # Helper functions
```

---

## 🔐 Environment Variables

Create a `.env` file in the root:

```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string

JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=7d

FRONTEND_URL=http://localhost:3000
```

---

## 🚀 Installation & Setup

### 1️⃣ Clone Repository

```bash
git clone https://github.com/your-username/mediqueue-server.git
cd mediqueue-server
```

### 2️⃣ Install Dependencies

```bash
npm install
```

### 3️⃣ Run Development Server

```bash
npm run dev
```

Or:

```bash
node index.js
```

Server runs at:

```
http://localhost:5000
```

---

## 🔑 Authentication Flow

1. User registers → `/register`
2. User logs in → `/login`
3. Server returns JWT token
4. Token is sent in headers:

```bash
Authorization: Bearer <token>
```

5. Protected routes validate token using middleware

---

## 📡 API Endpoints

### 🔐 Auth Routes

| Method | Endpoint    | Description       |
| ------ | ----------- | ----------------- |
| POST   | `/register` | Register new user |
| POST   | `/login`    | Login user        |

---

### 👨‍🏫 Tutor Routes

| Method | Endpoint      | Access                 |
| ------ | ------------- | ---------------------- |
| GET    | `/tutors`     | Public                 |
| GET    | `/tutors/:id` | Public                 |
| POST   | `/tutors`     | Protected              |
| PATCH  | `/tutors/:id` | Protected (Owner only) |
| DELETE | `/tutors/:id` | Protected (Owner only) |
| GET    | `/my-tutors`  | Protected              |

---

### 📅 Booking Routes

| Method | Endpoint                | Access                             |
| ------ | ----------------------- | ---------------------------------- |
| POST   | `/bookings`             | Protected                          |
| GET    | `/bookings`             | Protected                          |
| PATCH  | `/bookings/:id`         | Cancel booking (Student only)      |
| PATCH  | `/bookings/confirm/:id` | Confirm booking (Tutor owner only) |

---

## 🛡️ Security Features

* 🔐 Password hashing using bcrypt
* 🎟️ JWT-based authentication
* 🚫 Protected routes middleware
* 🌍 CORS whitelist protection
* 🧪 Input validation (email, password, ObjectId)
* ⛔ Role-based authorization checks

---

## 🧠 Business Logic Highlights

* Prevent duplicate bookings per user
* Slot decrement/increment system for tutors
* Booking status lifecycle:

  ```
  Pending → Confirmed → Cancelled
  ```
* Tutor ownership validation before update/delete
* Booking ownership validation before cancel

---

## 📦 Scripts

```bash
npm start       # Production start
npm run dev     # Development (if nodemon is used)
```

---

## 🧪 Example Request

### Register User

```http
POST /register
Content-Type: application/json
```

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "123456"
}
```

---

### Create Tutor (Protected)

```http
POST /tutors
Authorization: Bearer <token>
```

```json
{
  "tutorName": "Mr. Smith",
  "subject": "Mathematics",
  "totalSlot": 10,
  "sessionStartDate": "2026-06-20"
}
```

---

## 🚀 Deployment

### Recommended Platforms

* 🌐 Backend: Render / Vercel / Railway
* 🗄️ Database: MongoDB Atlas

### Production Checklist

* Set `JWT_SECRET`
* Set `FRONTEND_URL`
* Enable MongoDB IP whitelist
* Use HTTPS in production

---

## 👨‍💻 Author

**Shawon Ahmed**

Full Stack Developer
JavaScript | React | Node.js | MongoDB

---

## ⭐ Feedback

If you like this project, give it a ⭐ and contribute improvements.

---

<p align="center">
Built with ❤️ using Node.js, Express & MongoDB
</p>
