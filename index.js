const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECERE_KEY);
const port = process.env.PORT || 5000;
// require("crypto").randomBytes(64).toString("hex")
//  middle were
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.so5yg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

console.log(uri);
// const uri = "mongodb://localhost:27017";
// console.log(uri);
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const allMenuCollection = client.db("delmartDB").collection("menu");
    const reviewCollection = client.db("delmartDB").collection("reviews");
    const cartCollection = client.db("delmartDB").collection("carts");
    const userCollection = client.db("delmartDB").collection("users");

    //  jwt post Api

    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(
        user,
        process.env.ACCESS_TOKEN,

        { expiresIn: "1h" }
      );

      res.send({ token });
    });

    //  MiddelWere Create

    const verifyToken = (req, res, next) => {
      // console.log("Token check", req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "Unathuraze Access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN, (error, decoded) => {
        if (error) {
          return res.status(403).send({ message: "Forbidden access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    // Admin Verify Middler Ware

    const veryfyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };

      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "Forbidden Access" });
      }
      next();
    };

    // user post method api create it use Google Authantication need
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user?.email };
      const existedEmail = await userCollection.findOne(query);
      // console.log(existedEmail, query);
      if (existedEmail) {
        return res.send({
          message: "Your Email Alrady Store",
          insertedId: null,
        });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    // All User Get Api Create

    app.get("/users", verifyToken, veryfyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    // User Role check

    app.get("/user/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(401).send({ message: "Forbidden access" });
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }

      res.send({ admin });
    });

    // All User role patch Api Create

    app.patch(
      "/users/admin/:id",
      verifyToken,
      veryfyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            role: "admin",
          },
        };
        const result = await userCollection.updateOne(filter, updateDoc);
        res.send(result);
      }
    );

    // User Delete Api Create

    app.delete("/users/:id", verifyToken, veryfyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });

    // menu get method api create
    app.get("/menu", async (req, res) => {
      const result = await allMenuCollection.find().toArray();
      res.send(result);
    });
    // specific data load

    app.get("/menu/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await allMenuCollection.findOne(query);
      // console.log("check", result);
      res.send(result);
    });

    // app post menu
    app.post("/menu", verifyToken, veryfyAdmin, async (req, res) => {
      const item = req.body;
      const result = await allMenuCollection.insertOne(item);
      res.send(result);
    });

    // pacth relate Api
    // exsoly patch method use just object update ,, or put method if any propaty and value , not create when use A Put method

    app.patch("/menu/:id", async (req, res) => {
      const item = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          name: item.name,
          category: item.category,
          price: item.price,
          description: item.description,
          image: item.image,
        },
      };

      const result = await allMenuCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // Deleted Api create menu

    app.delete("/menu/:id", verifyToken, veryfyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const result = await allMenuCollection.deleteOne(query);
      res.send(result);
    });
    // Reviews get method api create
    app.get("/reviews", async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    });

    // carts Collection and Post Method used
    app.get("/carts", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/carts", async (req, res) => {
      const cartItem = req.body;
      const result = await cartCollection.insertOne(cartItem);
      res.send(result);
    });

    // Payment Post Method Intern
    app.post("/create-payment-intern", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    //  put method use

    app.put("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const updatedCartItem = req.body;

      const filter = { _id: new ObjectId(id) }; // Find the cart item by its ID
      const updateDoc = {
        $set: updatedCartItem, // Update the fields with the new data
      };

      // Update the item in the cartCollection
      const result = await cartCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    });

    // Connect the client to the server	(optional starting in v4.7)

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error mongodb://localhost:27017
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Check First Sever site ");
});

app.listen(port, () => {
  console.log(`Server is running this port ${port}`);
});

/**
 * Naming CanvanTion
 *
 * app.get("/users"),
 * app.get("/users/:id"),
 * app.post("/users");
 * app.put("/users/:id")
 * app.patch("/users/:id");
 * app.delete("/users/:id")
 */
