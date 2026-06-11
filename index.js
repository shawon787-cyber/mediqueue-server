const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

dotenv.config();

const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
  }
};

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

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
        const lowerEmail = email.toLowerCase();

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
          name,
          createdAt: new Date(),
        };

        const result = await usersCollection.insertOne(user);

        const token = jwt.sign(
          { id: result.insertedId, email: lowerEmail, name },
          JWT_SECRET,
          { expiresIn: JWT_EXPIRES_IN }
        );

        res.status(201).json({
          success: true,
          token,
          user: { email: lowerEmail, name, id: result.insertedId },
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
        const lowerEmail = email.toLowerCase();

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
          { id: user._id, email: user.email, name: user.name },
          JWT_SECRET,
          { expiresIn: JWT_EXPIRES_IN }
        );

        res.json({
          success: true,
          token,
          user: { email: user.email, name: user.name, id: user._id },
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

        if (!ObjectId.isValid(id)) {
          return res.status(400).json({ success: false });
        }

        const tutor = await tutorsCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!tutor) {
          return res.status(404).json({ success: false });
        }

        res.json({ success: true, data: tutor });
      } catch (err) {
        res.status(500).json({ success: false });
      }
    });

    // MY TUTORS (Protected - use req.user.email)
    app.get("/my-tutors/:email", verifyToken, async (req, res) => {
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

        if (!ObjectId.isValid(tutorId)) {
          return res.status(400).json({
            success: false,
            message: "Invalid tutor ID",
          });
        }

        if (!booking.phone) {
          return res.status(400).json({
            success: false,
            message: "Phone number required",
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

    // CONFIRM BOOKING (Protected)
    app.patch("/bookings/confirm/:id", verifyToken, async (req, res) => {
      try {
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
          return res.status(400).json({
            message: "Invalid ID",
          });
        }

        const booking = await bookingsCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!booking) {
          return res.status(404).json({
            message: "Booking not found",
          });
        }

        if (booking.status === "Confirmed") {
          return res.status(400).json({
            message: "Already confirmed",
          });
        }

        if (booking.status === "Cancelled") {
          return res.status(400).json({
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
          message: err.message,
        });
      }
    });

    // CANCEL BOOKING (Protected)
    app.patch("/bookings/:id", verifyToken, async (req, res) => {
      try {
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
          return res.status(400).json({ message: "Invalid ID" });
        }

        const booking = await bookingsCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!booking) {
          return res.status(404).json({ message: "Not found" });
        }

        if (booking.status === "Cancelled") {
          return res.status(400).json({
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
        res.status(500).json({ message: err.message });
      }
    });

    // BOOKINGS BY EMAIL (Protected - use req.user.email)
    app.get("/bookings/:email", verifyToken, async (req, res) => {
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

    // UPDATE TUTOR (Protected)
    app.patch("/tutors/:id", verifyToken, async (req, res) => {
      try {
        const id = req.params.id;
        const updatedData = req.body;

        if (!ObjectId.isValid(id)) {
          return res.status(400).json({
            success: false,
            message: "Invalid Tutor ID",
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

    // DELETE TUTOR (Protected)
    app.delete("/tutors/:id", verifyToken, async (req, res) => {
      try {
        await tutorsCollection.deleteOne({
          _id: new ObjectId(req.params.id),
        });

        res.json({ success: true });
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
    console.error(err);
  }
}

run();