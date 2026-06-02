const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

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

    // ➕ CREATE TUTOR
    app.post("/tutors", async (req, res) => {
      const result = await tutorsCollection.insertOne(req.body);

      return res.status(201).json({
        success: true,
        message: "Tutor added successfully",
        data: result,
      });
    });

    // 📄 GET ALL TUTORS
    app.get("/tutors", async (req, res) => {
      const result = await tutorsCollection.find().limit(6).toArray();

      return res.status(200).json({
        success: true,
        data: result,
      });
    });

    // 📄 GET SINGLE TUTOR (🔥 FULL FIXED)
    app.get("/tutors/:id", async (req, res) => {
  try {
    const id = req.params.id.trim();

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ID format",
      });
    }

    const tutor = await tutorsCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!tutor) {
      return res.status(404).json({
        success: false,
        message: "Tutor not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: tutor,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

    // ➕ BOOKING (WITH SLOT SYSTEM)
    app.post("/bookings", async (req, res) => {
      try {
        const booking = req.body;
        const tutorId = String(booking.tutorId || "").trim();

        if (!ObjectId.isValid(tutorId)) {
          return res.status(400).json({
            success: false,
            message: "Invalid tutor ID",
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

        if ((tutor.totalSlot || 0) <= 0) {
          return res.status(400).json({
            success: false,
            message: "No slots available",
          });
        }

        const result = await bookingsCollection.insertOne(booking);

        await tutorsCollection.updateOne(
          { _id: new ObjectId(tutorId) },
          { $inc: { totalSlot: -1 } }
        );

        return res.status(201).json({
          success: true,
          message: "Booking successful",
          data: result,
        });
      } catch (error) {
        return res.status(500).json({
          success: false,
          message: error.message,
        });
      }
    });

    // 📄 GET BOOKINGS BY EMAIL
    app.get("/bookings/:email", async (req, res) => {
      try {
        const email = req.params.email;

        const result = await bookingsCollection
          .find({ studentEmail: email })
          .toArray();

        return res.status(200).json({
          success: true,
          data: result,
        });
      } catch (error) {
        return res.status(500).json({
          success: false,
          message: error.message,
        });
      }
    });

    // ❌ CANCEL BOOKING
    app.patch("/bookings/:id", async (req, res) => {
      try {
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
          return res.status(400).json({
            success: false,
            message: "Invalid booking ID",
          });
        }

        const result = await bookingsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status: "Cancelled" } }
        );

        return res.status(200).json({
          success: true,
          data: result,
        });
      } catch (error) {
        return res.status(500).json({
          success: false,
          message: error.message,
        });
      }
    });

    // ✏️ UPDATE TUTOR
    app.put("/tutors/:id", async (req, res) => {
      try {
        const id = String(req.params.id || "").trim();

        if (!ObjectId.isValid(id)) {
          return res.status(400).json({
            success: false,
            message: "Invalid tutor ID",
          });
        }

        const result = await tutorsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: req.body }
        );

        return res.status(200).json({
          success: true,
          message: "Tutor updated successfully",
          data: result,
        });
      } catch (error) {
        return res.status(500).json({
          success: false,
          message: error.message,
        });
      }
    });

    // 🗑️ DELETE TUTOR
    app.delete("/tutors/:id", async (req, res) => {
      try {
        const id = req.params.id.trim();

        if (!ObjectId.isValid(id)) {
          return res.status(400).json({
            success: false,
            message: "Invalid tutor ID",
          });
        }

        const result = await tutorsCollection.deleteOne({
          _id: new ObjectId(id),
        });

        return res.status(200).json({
          success: true,
          message: "Tutor deleted successfully",
          data: result,
        });
      } catch (error) {
        return res.status(500).json({
          success: false,
          message: error.message,
        });
      }
    });

    await client.db("admin").command({ ping: 1 });
    console.log("✅ MongoDB Ping Successful");
  } catch (error) {
    console.error("❌ Server Error:", error);
  }
}

run().catch(console.dir);

// 🏠 Root route
app.get("/", (req, res) => {
  res.send("🚀 MediQueue Server Running");
});

// 🚀 Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});