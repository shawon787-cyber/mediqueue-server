const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
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

    const database = client.db("mediquee");
    const tutorsCollection = database.collection("tutors");

    // Add Tutor
    app.post("/tutors", async (req, res) => {
      try {
        const tutorData = req.body;

        const result = await tutorsCollection.insertOne(tutorData);

        res.send(result);
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    // Get All Tutors
    app.get("/tutors", async (req, res) => {
      try {
        const result = await tutorsCollection.find().toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
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
  console.log(`🚀 Server is running on port ${PORT}`);
});