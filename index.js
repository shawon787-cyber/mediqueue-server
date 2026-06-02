const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

dotenv.config();

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

    // =====================
    // ➕ CREATE TUTOR
    // =====================
    app.post("/tutors", async (req, res) => {
      const tutor = req.body;

      tutor.totalSlot = Number(tutor.totalSlot) || 0;
      tutor.createdAt = new Date();

      const result = await tutorsCollection.insertOne(tutor);

      res.status(201).json({
        success: true,
        message: "Tutor created",
        data: result,
      });
    });

    // =====================
    // 📄 GET ONLY 6 TUTORS
    // =====================
    app.get("/tutors", async (req, res) => {
      const result = await tutorsCollection.find().limit(6).toArray();

      res.json({
        success: true,
        data: result,
      });
    });

    // =====================
    // 📄 SINGLE TUTOR
    // =====================
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

    // =====================
    // ➕ BOOK TUTOR (FIXED LOGIC)
    // =====================
  app.post("/bookings", async (req, res) => {
  try {
    const booking = req.body;
    const tutorId = booking.tutorId;

    if (!ObjectId.isValid(tutorId)) {
      return res.status(400).json({ message: "Invalid tutor ID" });
    }

    if (!booking.phone) {
      return res.status(400).json({
        message: "Phone number required",
      });
    }

    const tutor = await tutorsCollection.findOne({
      _id: new ObjectId(tutorId),
    });

    if (!tutor) {
      return res.status(404).json({ message: "Tutor not found" });
    }

    // ✅ ONLY THIS RULE (IMPORTANT)
    if (tutor.totalSlot <= 0) {
      return res.status(400).json({
        message: "No slots available",
      });
    }

    booking.status = "Pending";
    booking.createdAt = new Date();

    await bookingsCollection.insertOne(booking);

    await tutorsCollection.updateOne(
      { _id: new ObjectId(tutorId) },
      { $inc: { totalSlot: -1 } }
    );

    res.status(201).json({
      success: true,
      message: "Booking successful",
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

    // =====================
    // ❌ CANCEL BOOKING (FIXED)
    // =====================
    app.patch("/bookings/:id", async (req, res) => {
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

        // update booking
        await bookingsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status: "Cancelled" } }
        );

        // restore slot
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

    // =====================
    // 📄 BOOKINGS BY EMAIL
    // =====================
    app.get("/bookings/:email", async (req, res) => {
      const result = await bookingsCollection
        .find({ studentEmail: req.params.email })
        .toArray();

      res.json({ success: true, data: result });
    });

    // =====================
    // 🗑️ DELETE TUTOR
    // =====================
    app.delete("/tutors/:id", async (req, res) => {
      await tutorsCollection.deleteOne({
        _id: new ObjectId(req.params.id),
      });

      res.json({ success: true });
    });

    // =====================
    // ROOT
    // =====================
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