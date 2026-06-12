const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

dotenv.config();

// ==============================
// ENVIRONMENT VARIABLE VALIDATION
// ==============================
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

// Validate critical environment variables during startup
if (!JWT_SECRET) {
  console.error("❌ FATAL: JWT_SECRET is not defined. Application startup aborted.");
  process.exit(1);
}

if (!MONGODB_URI) {
  console.error("❌ FATAL: MONGODB_URI is not defined. Application startup aborted.");
  process.exit(1);
}

// ==============================
// VALIDATION HELPERS
// ==============================

// Validates email format
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Validates password strength (minimum 6 characters)
const isValidPassword = (password) => {
  return password && password.length >= 6;
};

// Validates MongoDB ObjectId
const isValidObjectId = (id) => {
  return ObjectId.isValid(id);
};

// Checks if required fields are present in request body
const validateRequiredFields = (fields, body) => {
  const missing = fields.filter((field) => !body[field]);
  return missing.length > 0 ? missing : null;
};

// ==============================
// IMPROVED JWT MIDDLEWARE
// ==============================
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized: Missing or invalid authorization header",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Token has expired",
      });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Invalid token",
      });
    }

    return res.status(401).json({
      success: false,
      message: "Unauthorized: Token verification failed",
    });
  }
};

// ==============================
// SECURITY: CORS CONFIGURATION
// ==============================
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      "http://localhost:3000",
      FRONTEND_URL,
    ];

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
};

const app = express();
app.use(cors(corsOptions));
app.use(express.json());

const client = new MongoClient(MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// ==============================
// HELPER: Convert ObjectId to string for JWT payload
// ==============================
const objectIdToString = (id) => {
  return id ? id.toString() : null;
};

async function run() {
  try {
    await client.connect();
    console.log("✅ MongoDB Connected");

    const db = client.db("mediquee");
    const tutorsCollection = db.collection("tutors");
    const bookingsCollection = db.collection("bookings");
    const usersCollection = db.collection("users");

    // =====================
    // REGISTER USER
    // =====================
    app.post("/register", async (req, res) => {
      try {
        const { email, password, name } = req.body;

        // Validate required fields
        const missingFields = validateRequiredFields(["email", "password", "name"], req.body);
        if (missingFields) {
          return res.status(400).json({
            success: false,
            message: `Missing required fields: ${missingFields.join(", ")}`,
          });
        }

        // Validate email format
        if (!isValidEmail(email)) {
          return res.status(400).json({
            success: false,
            message: "Invalid email format",
          });
        }

        // Validate password strength
        if (!isValidPassword(password)) {
          return res.status(400).json({
            success: false,
            message: "Password must be at least 6 characters long",
          });
        }

        const lowerEmail = email.toLowerCase().trim();

        const existingUser = await usersCollection.findOne({ email: lowerEmail });
        if (existingUser) {
          return res.status(400).json({
            success: false,
            message: "Invalid email or password",
          });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = {
          email: lowerEmail,
          password: hashedPassword,
          name: name.trim(),
          createdAt: new Date(),
        };

        const result = await usersCollection.insertOne(user);

        const token = jwt.sign(
          {
            id: objectIdToString(result.insertedId),
            email: lowerEmail,
            name: name.trim(),
          },
          JWT_SECRET,
          { expiresIn: JWT_EXPIRES_IN }
        );

        res.status(201).json({
          success: true,
          token,
          user: {
            email: lowerEmail,
            name: name.trim(),
            id: objectIdToString(result.insertedId),
          },
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          message: "An error occurred",
        });
      }
    });

    // =====================
    // LOGIN USER
    // =====================
    app.post("/login", async (req, res) => {
      try {
        const { email, password } = req.body;

        // Validate required fields
        const missingFields = validateRequiredFields(["email", "password"], req.body);
        if (missingFields) {
          return res.status(400).json({
            success: false,
            message: `Missing required fields: ${missingFields.join(", ")}`,
          });
        }

        // Validate email format
        if (!isValidEmail(email)) {
          return res.status(400).json({
            success: false,
            message: "Invalid email format",
          });
        }

        const lowerEmail = email.toLowerCase().trim();

        const user = await usersCollection.findOne({ email: lowerEmail });
        if (!user) {
          return res.status(401).json({
            success: false,
            message: "Invalid email or password",
          });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
          return res.status(401).json({
            success: false,
            message: "Invalid email or password",
          });
        }

        const token = jwt.sign(
          {
            id: objectIdToString(user._id),
            email: user.email,
            name: user.name,
          },
          JWT_SECRET,
          { expiresIn: JWT_EXPIRES_IN }
        );

        res.json({
          success: true,
          token,
          user: {
            email: user.email,
            name: user.name,
            id: objectIdToString(user._id),
          },
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          message: "An error occurred",
        });
      }
    });

    // =====================
    // CREATE TUTOR (Protected)
    // =====================
    app.post("/tutors", verifyToken, async (req, res) => {
      try {
        const tutor = req.body;

        // Validate required fields
        const missingFields = validateRequiredFields(
          ["tutorName", "subject"],
          tutor
        );
        if (missingFields) {
          return res.status(400).json({
            success: false,
            message: `Missing required fields: ${missingFields.join(", ")}`,
          });
        }

        tutor.userEmail = req.user.email;
        tutor.totalSlot = Number(tutor.totalSlot) || 0;
        tutor.createdAt = new Date();

        const result = await tutorsCollection.insertOne(tutor);

        res.status(201).json({
          success: true,
          message: "Tutor created",
          data: result,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          message: error.message,
        });
      }
    });

    // GET TUTORS (Public - no auth required)
    app.get("/tutors", async (req, res) => {
      try {
        const search = req.query.search || "";
        const startDate = req.query.startDate;
        const endDate = req.query.endDate;

        const query = {};

        if (search) {
          query.tutorName = {
            $regex: search,
            $options: "i",
          };
        }

        if (startDate || endDate) {
          query.sessionStartDate = {};

          if (startDate) {
            query.sessionStartDate.$gte = startDate;
          }

          if (endDate) {
            query.sessionStartDate.$lte = endDate;
          }
        }

        const result = await tutorsCollection.find(query).limit(6).toArray();

        res.json({
          success: true,
          data: result,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          message: error.message,
        });
      }
    });

    // SINGLE TUTOR (Public)
    app.get("/tutors/:id", async (req, res) => {
      try {
        const id = req.params.id;

        if (!isValidObjectId(id)) {
          return res.status(400).json({ success: false, message: "Invalid tutor ID" });
        }

        const tutor = await tutorsCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!tutor) {
          return res.status(404).json({ success: false, message: "Tutor not found" });
        }

        res.json({ success: true, data: tutor });
      } catch (err) {
        res.status(500).json({ success: false, message: "An error occurred" });
      }
    });

    // ==============================
    // MY TUTORS (Protected - email from JWT)
    // Removed unnecessary :email parameter
    // ==============================
    app.get("/my-tutors", verifyToken, async (req, res) => {
      try {
        const result = await tutorsCollection
          .find({
            userEmail: req.user.email,
          })
          .toArray();

        res.json({
          success: true,
          data: result,
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          message: error.message,
        });
      }
    });

    // =====================
    // BOOK TUTOR (Protected)
    // =====================
    app.post("/bookings", verifyToken, async (req, res) => {
      try {
        const booking = req.body;
        const tutorId = booking.tutorId;

        // Validate tutorId
        if (!tutorId) {
          return res.status(400).json({
            success: false,
            message: "Tutor ID is required",
          });
        }

        if (!isValidObjectId(tutorId)) {
          return res.status(400).json({
            success: false,
            message: "Invalid tutor ID",
          });
        }

        // Validate required fields
        if (!booking.phone) {
          return res.status(400).json({
            success: false,
            message: "Phone number is required",
          });
        }

        const tutor = await tutorsCollection.findOne({
          _id: new ObjectId(tutorId),
        });

        if (!tutor) {
          return res.status(404).json({
            success: false,
            message: "Tutor not found",
          });
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const sessionDate = new Date(tutor.sessionStartDate);
        sessionDate.setHours(0, 0, 0, 0);

        if (today < sessionDate) {
          return res.status(400).json({
            success: false,
            message: "Booking is not available yet for this tutor",
          });
        }

        if (tutor.totalSlot <= 0) {
          return res.status(400).json({
            success: false,
            message: "No slots available",
          });
        }

        const existingBooking = await bookingsCollection.findOne({
          tutorId,
          studentEmail: req.user.email,
          status: {
            $ne: "Cancelled",
          },
        });

        if (existingBooking) {
          return res.status(400).json({
            success: false,
            message: "You have already booked this tutor",
          });
        }

        booking.studentEmail = req.user.email;
        booking.status = "Pending";
        booking.createdAt = new Date();

        await bookingsCollection.insertOne(booking);

        await tutorsCollection.updateOne(
          {
            _id: new ObjectId(tutorId),
          },
          {
            $inc: {
              totalSlot: -1,
            },
          }
        );

        res.status(201).json({
          success: true,
          message: "Booking successful",
        });
      } catch (err) {
        res.status(500).json({
          success: false,
          message: err.message,
        });
      }
    });

    // ==============================
    // CONFIRM BOOKING (Protected)
    // Verifies user owns the tutor associated with the booking
    // ==============================
    app.patch("/bookings/confirm/:id", verifyToken, async (req, res) => {
      try {
        const id = req.params.id;

        if (!isValidObjectId(id)) {
          return res.status(400).json({
            success: false,
            message: "Invalid booking ID",
          });
        }

        const booking = await bookingsCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!booking) {
          return res.status(404).json({
            success: false,
            message: "Booking not found",
          });
        }

        // AUTHORIZATION: Verify the authenticated user owns the tutor for this booking
        const tutor = await tutorsCollection.findOne({
          _id: new ObjectId(booking.tutorId),
        });

        if (!tutor || tutor.userEmail !== req.user.email) {
          return res.status(403).json({
            success: false,
            message: "Forbidden: You are not authorized to confirm this booking",
          });
        }

        if (booking.status === "Confirmed") {
          return res.status(400).json({
            success: false,
            message: "Already confirmed",
          });
        }

        if (booking.status === "Cancelled") {
          return res.status(400).json({
            success: false,
            message: "Cancelled booking cannot be confirmed",
          });
        }

        await bookingsCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              status: "Confirmed",
            },
          }
        );

        res.json({
          success: true,
          message: "Booking confirmed successfully",
        });
      } catch (err) {
        res.status(500).json({
          success: false,
          message: err.message,
        });
      }
    });

    // ==============================
    // CANCEL BOOKING (Protected)
    // Verifies user is the student who made the booking
    // ==============================
    app.patch("/bookings/:id", verifyToken, async (req, res) => {
      try {
        const id = req.params.id;

        if (!isValidObjectId(id)) {
          return res.status(400).json({
            success: false,
            message: "Invalid booking ID",
          });
        }

        const booking = await bookingsCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!booking) {
          return res.status(404).json({
            success: false,
            message: "Booking not found",
          });
        }

        // AUTHORIZATION: Verify the authenticated user is the student who made the booking
        if (booking.studentEmail !== req.user.email) {
          return res.status(403).json({
            success: false,
            message: "Forbidden: You are not authorized to cancel this booking",
          });
        }

        if (booking.status === "Cancelled") {
          return res.status(400).json({
            success: false,
            message: "Already cancelled",
          });
        }

        await bookingsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status: "Cancelled" } }
        );

        await tutorsCollection.updateOne(
          { _id: new ObjectId(booking.tutorId) },
          { $inc: { totalSlot: 1 } }
        );

        res.json({
          success: true,
          message: "Cancelled successfully",
        });
      } catch (err) {
        res.status(500).json({
          success: false,
          message: err.message,
        });
      }
    });

    // ==============================
    // MY BOOKINGS (Protected - email from JWT)
    // Removed unnecessary :email parameter
    // ==============================
    app.get("/bookings", verifyToken, async (req, res) => {
      try {
        const result = await bookingsCollection
          .find({ studentEmail: req.user.email })
          .toArray();

        res.json({ success: true, data: result });
      } catch (error) {
        res.status(500).json({
          success: false,
          message: error.message,
        });
      }
    });

    // ==============================
    // UPDATE TUTOR (Protected)
    // Verifies user owns the tutor before updating
    // ==============================
    app.patch("/tutors/:id", verifyToken, async (req, res) => {
      try {
        const id = req.params.id;
        const updatedData = req.body;

        if (!isValidObjectId(id)) {
          return res.status(400).json({
            success: false,
            message: "Invalid Tutor ID",
          });
        }

        // Check if tutor exists and belongs to the authenticated user
        const tutor = await tutorsCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!tutor) {
          return res.status(404).json({
            success: false,
            message: "Tutor not found",
          });
        }

        // AUTHORIZATION: Verify the authenticated user owns this tutor
        if (tutor.userEmail !== req.user.email) {
          return res.status(403).json({
            success: false,
            message: "Forbidden: You are not authorized to update this tutor",
          });
        }

        const result = await tutorsCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              tutorName: updatedData.tutorName,
              subject: updatedData.subject,
              hourlyFee: Number(updatedData.hourlyFee),
              totalSlot: Number(updatedData.totalSlot),
              sessionStartDate: updatedData.sessionStartDate,
            },
          }
        );

        res.json({
          success: true,
          data: result,
          message: "Tutor updated successfully",
        });
      } catch (err) {
        res.status(500).json({
          success: false,
          message: err.message,
        });
      }
    });

    // ==============================
    // DELETE TUTOR (Protected)
    // Verifies user owns the tutor before deleting
    // ==============================
    app.delete("/tutors/:id", verifyToken, async (req, res) => {
      try {
        const id = req.params.id;

        if (!isValidObjectId(id)) {
          return res.status(400).json({
            success: false,
            message: "Invalid Tutor ID",
          });
        }

        // Check if tutor exists and belongs to the authenticated user
        const tutor = await tutorsCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!tutor) {
          return res.status(404).json({
            success: false,
            message: "Tutor not found",
          });
        }

        // AUTHORIZATION: Verify the authenticated user owns this tutor
        if (tutor.userEmail !== req.user.email) {
          return res.status(403).json({
            success: false,
            message: "Forbidden: You are not authorized to delete this tutor",
          });
        }

        await tutorsCollection.deleteOne({
          _id: new ObjectId(id),
        });

        res.json({ success: true, message: "Tutor deleted successfully" });
      } catch (err) {
        res.status(500).json({
          success: false,
          message: err.message,
        });
      }
    });

    // ROOT
    app.get("/", (req, res) => {
      res.send("🚀 Server Running");
    });

    app.listen(PORT, () => {
      console.log("🚀 Server running on", PORT);
    });
  } catch (err) {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
  }
}

run();
