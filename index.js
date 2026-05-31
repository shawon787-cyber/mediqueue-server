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

    // ➕ CREATE
    app.post("/tutors", async (req, res) => {
      const result = await tutorsCollection.insertOne(req.body);

      res.send({
        success: true,
        message: "Tutor added successfully",
        data: result,
      });
    });

    // 📄 GET (MAX 6)
    app.get("/tutors", async (req, res) => {
      const result = await tutorsCollection
        .find()
        .limit(6)
        .toArray();

      res.send({
        success: true,
        data: result,
      });
    });

    // 📄 SINGLE
    app.get("/tutors/:id", async (req, res) => {
      const result = await tutorsCollection.findOne({
        _id: new ObjectId(req.params.id),
      });

      res.send({
        success: true,
        data: result,
      });
    });

    // ✏️ UPDATE
    app.put("/tutors/:id", async (req, res) => {
      const result = await tutorsCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        {
          $set: req.body,
        }
      );

      res.send({
        success: true,
        message: "Tutor updated successfully",
        data: result,
      });
    });

    // 🗑️ DELETE
    app.delete("/tutors/:id", async (req, res) => {
      const result = await tutorsCollection.deleteOne({
        _id: new ObjectId(req.params.id),
      });

      res.send({
        success: true,
        message: "Tutor deleted successfully",
        data: result,
      });
    });

    await client.db("admin").command({ ping: 1 });
    console.log("✅ MongoDB Ping Successful");
  } catch (error) {
    console.error(error);
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("🚀 MediQueue Server Running");
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});