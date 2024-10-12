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

// console.log(uri);
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
    const paymentCollection = client.db("delmartDB").collection("payments");
    const categoriesCollection = client
      .db("delmartDB")
      .collection("categories");
    const allCategoryCollection = client.db("delmartDB").collection("category");

    const allShopsCollection = client.db("delmartDB").collection("shops");
    const wishlistCollection = client.db("delmartDB").collection("wishlist");
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

    // ========================== Start Point
    // Category APi
    app.get("/category", async (req, res) => {
      const result = await categoriesCollection.find().toArray();
      res.send(result);
    });

    // Id Data load
    app.get("/category/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await allCategoryCollection.findOne(query);
      // console.log(result);
      res.send(result);
    });

    // Each CateGory Check Movement API ?
    app.get("/eachCategory/:category", async (req, res) => {
      const category = req.params.category;
      const query = { category: category };
      const allCategory = await allCategoryCollection.find(query).toArray();
      res.send(allCategory);
    });

    // All Getegory Api Pagination System
    app.get("/allCategory/pagination", verifyToken, async (req, res) => {
      const page = parseInt(req.query.page);
      const size = parseInt(req.query.size);
      // console.log(page, size);
      const result = await allCategoryCollection
        .find()
        .skip(page * size)
        .limit(size)
        .toArray();
      res.send(result);
    });

    // All Product Get s

    app.get("/allCategory", async (req, res) => {
      const result = await allCategoryCollection.find().toArray();
      res.send(result);
    });
    app.post("/shops", async (req, res) => {
      const shops = req.body;
      const result = await allShopsCollection.insertOne(shops);
      res.send(result);
    });

    app.get("/shops", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await allShopsCollection.find(query).toArray();
      res.send(result);
    });

    app.delete("/shops/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await allShopsCollection.deleteOne(query);
      res.send(result);
    });

    // for Pagination Use Api
    app.get("/shopCount", async (req, res) => {
      const count = await allCategoryCollection.estimatedDocumentCount();
      res.send({ count });
    });

    // Post WishList Collection

    app.post("/wishlist", async (req, res) => {
      const wishlistInfo = req.body;
      const result = await wishlistCollection.insertOne(wishlistInfo);
      res.send(result);
    });

    // Get WishList Collect Just check true
    app.get("/wishlist", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await wishlistCollection.find(query).toArray();
      res.send(result);
    });

    // ========================== End Point

    // user post method api create it use Google Authantication need
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user?.email };
      const existedEmail = await userCollection.findOne(query);
      // console.log(existedEmail, query);
      if (existedEmail) {
        return res.send({
          message: "Your Email Alrady Stored",
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

    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);

      //  deffent Thing
      // console.log("check payment History", payment);

      const query = {
        _id: {
          $in: payment.cartIds.map((id) => new ObjectId(id)),
        },
      };

      const deleteResult = await cartCollection.deleteMany(query);

      res.send({ paymentResult, deleteResult });
    });

    // Get Method Used Payments History get api,

    app.get("/payments/:email", verifyToken, async (req, res) => {
      // const email = req.params.email;
      const query = { email: req.params.email };

      if (req.params.email !== req.decoded.email) {
        return res.status(403).send({ message: "Forbidden access" });
      }

      const result = await paymentCollection.find(query).toArray();

      res.send(result);
    });

    //Payment or Admin dashboard Show, Some Info
    app.get("/admin-stats", verifyToken, veryfyAdmin, async (req, res) => {
      const customers = await userCollection.estimatedDocumentCount();
      const menuItems = await allMenuCollection.estimatedDocumentCount();
      const orders = await paymentCollection.estimatedDocumentCount();

      // const payments = await paymentCollection.find().toArray();
      // const revenue = payments.reduce((pre, current) => pre + current.price, 0);

      const result = await paymentCollection
        .aggregate([
          {
            $group: {
              _id: null,
              totalRevenue: {
                $sum: "$price",
              },
            },
          },
        ])
        .toArray();

      const revenue = result.length > 0 ? result[0].totalRevenue : 0;

      res.send({
        customers,
        menuItems,
        orders,
        revenue,
      });
    });

    // specific or deffient way, data get , example ,, saled, pizza,total cel, and price

    app.get("/orders-stats", verifyToken, veryfyAdmin, async (req, res) => {
      const result = await paymentCollection
        .aggregate([
          // Step 1: Convert menuItemIds to ObjectId (if needed)
          {
            $addFields: {
              menuItemIds: {
                $map: {
                  input: "$menuItemIds",
                  as: "id",
                  in: { $toObjectId: "$$id" }, // Convert each ID to ObjectId
                },
              },
            },
          },

          // Step 2: Unwind menuItemIds array
          {
            $unwind: "$menuItemIds",
          },

          // Step 3: Lookup menu item details from the "menu" collection
          {
            $lookup: {
              from: "menu", // Collection to join (menu items)
              localField: "menuItemIds", // Field from the 'orders' collection
              foreignField: "_id", // Matching field from the 'menu' collection
              as: "menuItems", // Output field for matched menu items
            },
          },

          // Step 4: Unwind the menuItems array (in case lookup returns an array)
          {
            $unwind: "$menuItems",
          },

          // Step 5: Group by menu category and calculate quantity and revenue
          {
            $group: {
              _id: "$menuItems.category", // Group by category
              quantity: {
                $sum: 1, // Count items
              },
              revenue: { $sum: "$menuItems.price" }, // Sum the revenue
            },
          },

          {
            $project: {
              _id: 0,
              category: "$_id",
              quantity: "$quantity",
              revenue: "$revenue",
            },
          },
        ])
        .toArray();

      res.send(result);
    });

    // app.get("/orders-stats", async (req, res) => {
    //   try {
    //     const result = await paymentCollection
    //       .aggregate([
    //         { $unwind: "$menuItemIds" },
    //         {
    //           $lookup: {
    //             from: "menu",
    //             localField: "menuItemIds",
    //             foreignField: "_id",
    //             as: "menuItems",
    //           },
    //         },
    //         { $unwind: "$menuItems" },
    //         {
    //           $group: {
    //             _id: "$menuItems.category",
    //             quantity: { $sum: 1 },
    //             revenue: { $sum: "$menuItems.price" },
    //           },
    //         },
    //         {
    //           $project: {
    //             _id: 0,
    //             category: "$_id",
    //             quantity: "$quantity",
    //             revenue: "$revenue",
    //           },
    //         },
    //       ])
    //       .toArray();

    //     res.send(result);
    //   } catch (error) {
    //     console.error("Error in orders-stats aggregation:", error);
    //     res.status(500).send({ error: "Internal Server Error" });
    //   }
    // });

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
