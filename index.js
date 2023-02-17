const express = require("express");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const User = require("./models/User");
const Place = require("./models/Place");
const Booking = require("./models/Booking");
const bcrypt = require("bcryptjs");
String.prototype.toObjectId = function () {
  var ObjectId = require("mongoose").Types.ObjectId;
  return new ObjectId(this.toString());
};
// const { Vonage } = require("@vonage/server-sdk");

const stripe = require("stripe")(
  "sk_test_51KNXbXSCQUIMF4gQrSpjOQbxxMBzQOzoXv5YHCG9cetv7wAekwy0MF96pUF6Hc5X0YA3Y3A96SR4Y35Z1xigRTX500t9UW1VK3"
);
const jwt = require("jsonwebtoken");
const { format, differenceInCalendarDays} = require("date-fns");
const cookieParser = require("cookie-parser");
const imageDownloader = require("image-downloader");
const multer = require("multer");
const fs = require("fs");
const salt = bcrypt.genSaltSync(12);
const jwtSecret = "dfgdrdfbdrzxrqacbfbzdfgb";
dotenv.config();
const cors = require("cors");
const app = express();

app.use(cookieParser());
app.use("/uploads", express.static(__dirname + "/uploads"));
app.use(express.json());
app.use(
  cors({
    credentials: true,
    origin: " http://127.0.0.1:5173",
  })
);
mongoose.set("strictQuery", true);
const db_url = process.env.MONGO_URL;
mongoose
  .connect(db_url)
  .then(() => console.log("database connected"))
  .catch((err) => console.log(err));

app.get("/test", (req, res) => {
  res.json("test ok");
});

app.post("/register", async (req, res) => {
  const { name, email, phone, password } = req.body;
  try {
    // const from = "Vonage APIs";
    // const to = "91"+phone;
    // const text = "You are successfully registered in our website pibook";
    // await vonage.sms.send({to, from, text})
    //     .then(resp => { console.log('Message sent successfully'); console.log(resp); })
    //     .catch(err => { console.log('There was an error sending the messages.'); console.error(err); });
    const createdUser = await User.create({
      name,
      email,
      phonenumber: bcrypt.hashSync(phone, salt),
      password: bcrypt.hashSync(password, salt),
    });
    res.status(200).json(createdUser);
  } catch (error) {
    res.status(422).json({ error });
  }
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const userDoc = await User.findOne({ email });
    if (userDoc) {
      const passOk = bcrypt.compareSync(password, userDoc.password);
      if (passOk) {
        jwt.sign(
          { email: userDoc.email, id: userDoc._id },
          jwtSecret,
          {},
          (err, token) => {
            if (err) throw err;
            res.cookie("token", token).json(userDoc);
          }
        );
      } else {
        res.status(422).json("pass not ok");
      }
    } else {
      res.status(400).json("not found");
    }
  } catch (error) {
    res.status(400).json(error.message);
  }
});

app.get("/profile", (req, res) => {
  const { token } = req.cookies;
  if (token) {
    jwt.verify(token, jwtSecret, {}, async (err, user) => {
      if (err) throw err;
      const { name, email, _id } = await User.findById(user.id);
      res.status(200).json({ name, email, _id });
    });
  } else {
    res.json(null);
  }
});

app.post("/logout", (req, res) => {
  res.cookie("token", "").json(true);
});

app.post("/upload-by-link", async (req, res) => {
  const { link } = req.body;
  const newName = "photo" + Date.now() + ".jpg";
  await imageDownloader.image({
    url: link,
    dest: __dirname + "/uploads/" + newName,
  });
  res.json(newName);
});

const photosMiddleware = multer({ dest: "uploads/" });
app.post("/upload", photosMiddleware.array("photos", 100), (req, res) => {
  const uploadedFiles = [];
  for (let i = 0; i < req.files.length; i++) {
    const { path, originalname } = req.files[i];
    const parts = originalname.split(".");
    const ext = parts[parts.length - 1];
    const newPath = path + "." + ext;
    fs.renameSync(path, newPath);
    uploadedFiles.push(newPath.replace("uploads\\", ""));
  }
  res.json(uploadedFiles);
});

app.post("/places", async (req, res) => {
  const { token } = req.cookies;
  const {
    title,
    address,
    addedPhotos,
    description,
    perks,
    extraInfo,
    checkIn,
    checkOut,
    maxGuests,
    price,
  } = req.body;

  if (token) {
    jwt.verify(token, jwtSecret, {}, async (err, user) => {
      if (err) throw err;
      const placeDoc = await Place.create({
        owner: user.id,
        title,
        address,
        photos: addedPhotos,
        description,
        perks,
        extraInfo,
        checkIn,
        checkOut,
        maxGuests,
        price,
      });
      res.status(200).json(placeDoc);
    });
  }
});

app.get("/user-places", (req, res) => {
  const { token } = req.cookies;
  jwt.verify(token, jwtSecret, {}, async (err, user) => {
    if (err) throw err;
    const { id } = user;
    res.json(await Place.find({ owner: id }));
  });
});

app.get("/places/:id", async (req, res) => {
  const { id } = req.params;
  res.json(await Place.findById(id));
});

app.put("/places", async (req, res) => {
  const { token } = req.cookies;
  const {
    id,
    title,
    address,
    addedPhotos,
    description,
    perks,
    extraInfo,
    checkIn,
    checkOut,
    maxGuests,
    price,
  } = req.body;

  jwt.verify(token, jwtSecret, {}, async (err, user) => {
    if (err) throw err;
    const placeDoc = await Place.findById(id);
    if (user.id === placeDoc.owner.toString()) {
      placeDoc.set({
        title,
        address,
        photos: addedPhotos,
        description,
        perks,
        extraInfo,
        checkIn,
        checkOut,
        maxGuests,
        price,
      });
      await placeDoc.save();
      res.status(200).json("ok");
    }
  });
});

app.get("/places", async (req, res) => {
  res.json(await Place.find());
});

app.post("/booking", async (req, res) => {
  const { token } = req.cookies;
  const { place, checkIn, checkOut, numberOfGuests, name, phone, price } =
    req.body;
  try {
    jwt.verify(token, jwtSecret, {}, async (err, user) => {
      if (err) throw err;
      const { id } = user;

      const places = await Place.findById(place);
      //console.log((places));
      const bookPlace = await Booking.create({
        place,
        checkIn,
        checkOut,
        numberOfGuests,
        name,
        phone,
        price,
        user: user.id,
      });
      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: "inr",
              product_data: {
                name: "booking for Mr " + name + " for room " + places.title,
                images: [
                  "https://res.cloudinary.com/dg4iksxsb/image/upload/v1676121545/Blogs/sy8pg0ixii4z1kujbicf.webp",
                ],
              },
              unit_amount: price * 100,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `http://127.0.0.1:5173/account/bookings/${bookPlace._id}`,
        cancel_url: "http://localhost:4242/cancel",
      });

      res.send({ url: session.url });
    });
  } catch (error) {
    res.status(400).json({ error });
  }
});

app.get("/bookings", async (req, res) => {
  const { token } = req.cookies;
  try {
    jwt.verify(token, jwtSecret, {}, async (err, user) => {
      if (err) throw err;
      const { id } = user;
      res.json(await Booking.find({ user: id }).populate("place"));
    });
  } catch (error) {
    res.status(400).json({ error });
  }
});

app.delete("/user-places/delete/:id", async (req, res) => {
  const { id } = req.params;
  // console.log(id);
  try {
    await Place.deleteOne({ _id: id });
    await Booking.deleteOne({ place: id });
    res.status(200).json("place removed successfully");
  } catch (error) {
    res.status(400).json({ error });
  }
});

app.delete("/booking/delete/:id", async (req, res) => {
  const { id } = req.params;
  //  console.log(id);
  try {
    await Booking.deleteOne({ _id: id });
    res.status(200).json("booking removed successfully");
  } catch (err) {
    res.status(400).json({ err });
  }
});

app.post("/check-same-date", async (req, res) => {
  const { checkIn, checkOut, userId, placeId } = req.body;
  // console.log(req.body);
  try {
    const bookings = await Booking.find();
    const newbookingsFilter = bookings.filter(
      (booking) =>
        booking.place.toString() === placeId.toString() &&
        booking.user.toString() === userId.toString()
    );
    // console.log(newbookingsFilter);
    let dateBetween = false;
    let noofnights = 0;
    for (let i = 0; i < newbookingsFilter.length; i++) {
      var dateFrom = newbookingsFilter[i].checkIn;
      var dateTo = newbookingsFilter[i].checkOut;
      var dateCheck1 = checkIn;
      var dateCheck2 = checkOut;
      var d1 = dateFrom.split("-");
      var d2 = dateTo.split("-");
      var c = dateCheck1.split("-");
      var d = dateCheck2.split("-");
      var from = new Date(d1[0], parseInt(d1[1]) - 1, d1[2]);
      var to = new Date(d2[0], parseInt(d2[1]) - 1, d2[2]);
      var check1 = new Date(c[0], parseInt(c[1]) - 1, c[2]);
      var check2 = new Date(d[0], parseInt(d[1]) - 1, d[2]);
      if (check1 >= from && check1 <= to) {
        dateBetween=true;
       // console.log(dateBetween);
      } else if (check2 >= from && check2 <= to) {
        dateBetween=true;
     //   console.log(dateBetween);
      } else if (check1 <= from && check2 >= to) {
        dateBetween=true;
      //  console.log(dateBetween);
      } else if (check1 >= from && check2 <= to) {
        dateBetween=true;
       // console.log(dateBetween);
      } else {
        dateBetween=false;
      }
    }
    if(!dateBetween){
      noofnights=( differenceInCalendarDays(
        new Date(checkOut),
        new Date(checkIn)
      ));
    }
    //console.log(dateBetween,noofnights);
    res.status(200).json({noofnights});
  } catch (err) {
    res.status(400).json({ err });
  }
});

app.listen(4000, () => {
  console.log("listening on port 4000");
});
