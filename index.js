const express = require("express");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const User = require("./models/User");
const Place = require("./models/Place");
const Review = require("./models/Review");
const Booking = require("./models/Booking");
const bcrypt = require("bcryptjs");

const mongoSanitize = require("express-mongo-sanitize");
const otpGenerator = require("otp-generator");
const nodemailer = require("nodemailer");
const Mailgen = require("mailgen");
let OTP = "";
dotenv.config();

const EMAIL = process.env.EMAIL;
const PASS = process.env.PASSWORD;

const stripe = require("stripe")(process.env.STRIPE_KEY);
const jwt = require("jsonwebtoken");
const { format, differenceInCalendarDays } = require("date-fns");
const cookieParser = require("cookie-parser");

mongoose.set("strictQuery", true);
const db_url = process.env.MONGO_URL;
mongoose
  .connect(db_url)
  .then(() => console.log("database connected"))
  .catch((err) => console.log(err));

// const imageDownloader = require("image-downloader");
const multer = require("multer");
const { storage, cloudinary } = require("./cloudinary");
const uploadMiddleware = multer({ storage });
// const fs = require("fs");
const salt = bcrypt.genSaltSync(12);
const jwtSecret = process.env.JWT_SECRET;

const cors = require("cors");
const app = express();
app.disable("x-powered-by");

app.use(cookieParser());

app.use(
  mongoSanitize({
    replaceWith: "_",
  })
);

app.use("/uploads", express.static(__dirname + "/uploads"));
app.use(express.json({ limit: "50mb" }));



//this session should come first

app.use(
  cors({
    credentials: true,
    origin: process.env.CLIENT_URL,
  })
);

app.get("/test", (req, res) => {
  res.json("test ok");
});

app.post("/register", async (req, res) => {
  const { firstname, lastname, email, password, phone, file } = req.body;
  try {
    // const from = "Vonage APIs";
    // const to = "91"+phone;
    // const text = "You are successfully registered in our website pibook";
    // await vonage.sms.send({to, from, text})
    //     .then(resp => { console.log('Message sent successfully'); console.log(resp); })
    //     .catch(err => { console.log('There was an error sending the messages.'); console.error(err); });
    //console.log(req.body);
    const createdUser = await User.create({
      firstname,
      lastname,
      file,
      email,
      phonenumber: phone,
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
          { name: userDoc.firstname, email: userDoc.email, id: userDoc._id },
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
 // console.log(token);
  if (token) {
    jwt.verify(token, jwtSecret, {}, async (err, user) => {
      if (err) throw err;
      const { firstname, email, _id } = await User.findById(user.id);
      res.status(200).json({ name: firstname, email, _id });
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
  const result = await cloudinary.uploader.upload(link, {
    folder: "pibook",
  });

  const getFilename = result.url.split("/");
  const getExactFilename = getFilename[getFilename.length - 1].split(".")[0];
  const fullFilename =
    getFilename[getFilename.length - 2] + "/" + getExactFilename;
  //console.log(fullFilename);
  let imageFiles = {
    url: result.secure_url,
    filename: fullFilename,
  };
  res.status(200).json(imageFiles);
});

app.post("/upload", uploadMiddleware.array("photos", 100), (req, res) => {
  // const uploadedFiles = [];
  // for (let i = 0; i < req.files.length; i++) {
  //   const { path, originalname } = req.files[i];
  //   const parts = originalname.split(".");
  //   const ext = parts[parts.length - 1];
  //   const newPath = path + "." + ext;
  //   fs.renameSync(path, newPath);
  //   uploadedFiles.push(newPath.replace("uploads\\", ""));
  // }
  // console.log(req.files);
  let imageFiles = req.files.map((file) => ({
    url: file.path,
    filename: file.filename,
  }));
  res.json(imageFiles);
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
  try {
    if (token) {
      jwt.verify(token, jwtSecret, {}, async (err, user) => {
        if (err) throw err;
        const { id } = user;
        res.status(200).json(await Place.find({ owner: id }));
      });
    }
  } catch (error) {
    res.status(400).json({ error });
  }
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
  res.json(await Place.find().sort({ address: -1 }));
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
                images: [places.photos[0].url],
              },
              unit_amount: price * 100,
            },

            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${process.env.CLIENT_URL}/account/bookings/${bookPlace._id}`,
        cancel_url: `${process.env.CLIENT_URL}/cancel/${bookPlace._id}`,
      });
      // console.log(session);
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
    const place = await Place.findById(id);
    await Place.deleteOne({ _id: id });
    const allbookings = await Booking.find();
    const bookingsfilter = allbookings.filter(
      (booking) => booking.place.toString() === id.toString()
    );
    for (let i = 0; i < place.photos.length; i++) {
      // console.log(place.photos[i].filename);
      await cloudinary.uploader.destroy(place.photos[i].filename);
    }
    for (let booking of bookingsfilter) {
      await Booking.deleteOne(booking);
    }
    // console.log(bookingsfilter);
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
        dateBetween = true;
        // console.log(dateBetween);
      } else if (check2 >= from && check2 <= to) {
        dateBetween = true;
        //   console.log(dateBetween);
      } else if (check1 <= from && check2 >= to) {
        dateBetween = true;
        //  console.log(dateBetween);
      } else if (check1 >= from && check2 <= to) {
        dateBetween = true;
        // console.log(dateBetween);
      } else {
        dateBetween = false;
      }
    }
    if (!dateBetween) {
      noofnights = differenceInCalendarDays(
        new Date(checkOut),
        new Date(checkIn)
      );
    }
    //console.log(dateBetween,noofnights);
    res.status(200).json({ noofnights });
  } catch (err) {
    res.status(400).json({ err });
  }
});

app.get("/booking/:id", async (req, res) => {
  const { id } = req.params;
  // console.log(id);
  try {
    const booking = await Booking.findById(id);
    // console.log(booking);
    await Booking.deleteOne({ _id: id });
    res.status(200).json({ placeId: booking.place.toString() });
  } catch (error) {
    res.status(400).json({ error });
  }
});

app.delete("/delete/images", async (req, res) => {
  const { fileObject } = req.body;
  //console.log(fileObject);
  try {
    await cloudinary.uploader.destroy(fileObject.filename);
    res.status(200).json({ success: "file deleted successfully" });
  } catch (error) {
    res.status(400).json({ error });
  }
});

app.get("/countnumberofusers", async (req, res) => {
  try {
    const userCount = await User.countDocuments({}).exec();
    res.status(200).json(userCount);
  } catch (err) {
    res.status(400).json({ err });
  }
});

app.get("/getuserdetails/:id", async (req, res) => {
  const { id } = req.params;

  try {
    //console.log(id);
    const user = await User.findOne({ _id: id });
    res.status(200).json(user);
  } catch (error) {
    res.status(400).json({ error });
  }
});

app.put("/profileupdate", async (req, res) => {
  const { id, phone, firstname, lastname, email, file } = req.body;
  //console.log(id,phone,firstname,lastname,email,file);
  try {
    await User.findOneAndUpdate(
      { _id: id },
      {
        phonenumber: phone,
        firstname: firstname,
        lastname: lastname,
        email: email,
        file: file,
      }
    );
    res.status(200).json("updated successfully");
  } catch (err) {
    res.status(400).json({ err });
  }
});

app.get("/generateotp/:id", async (req, res) => {
  const { id } = req.params;
  //console.log(id);

  OTP = await otpGenerator.generate(6, {
    lowerCaseAlphabets: false,
    upperCaseAlphabets: false,
    specialChars: false,
  });
  const user = await User.findOne({ _id: id });

  //
  let userEmail = user.email;

  let config = {
    service: "gmail",
    auth: {
      user: EMAIL,
      pass: PASS,
    },
  };

  let transporter = nodemailer.createTransport(config);

  let MailGenerator = new Mailgen({
    theme: "default",
    product: {
      name: "Mailgen",
      link: "https://mailgen.js/",
    },
  });

  let response = {
    body: {
      name: user.firstname + " " + user.lastname,
      intro: "One Time Password generated!",
      table: {
        data: [
          {
            description: `Your one time password (OTP) to change pibook password is ${OTP}`,
          },
        ],
      },
    },
  };

  let mail = MailGenerator.generate(response);

  let message = {
    from: EMAIL,
    to: userEmail,
    subject: "password change request",
    html: mail,
  };

  transporter
    .sendMail(message)
    .then(() => {
      return res.status(201).json({
        msg: "you should receive an email",
      });
    })
    .catch((error) => {
      return res.status(500).json({ error });
    });
});

app.get("/verifyotp", (req, res) => {
  const { otp } = req.query;
  try {
    if (parseInt(otp) === parseInt(OTP)) {
      res.status(200).json("valid otp");
    } else {
      res.status(200).json("");
    }
  } catch (error) {
    res.status(400).json({ error });
  }
});

app.post("/changepass", async (req, res) => {
  const { oldpass, newpass, id } = req.body;
  try {
    const user = await User.findOne({ _id: id });
    const passOk = bcrypt.compareSync(oldpass, user.password);
    if (!passOk) {
      res.status(200).json("");
    } else {
      await User.findOneAndUpdate(
        { _id: id },
        {
          password: bcrypt.hashSync(newpass, salt),
        }
      );
      res.status(200).json("password updated successfully");
    }
  } catch (error) {
    res.status(400).json({ error });
  }
});

app.post("/reviews", async (req, res) => {
  const { starValue, review, placeId, userId } = req.body;
  try {
    await Review.create({
      starValue,
      owner: userId,
      place: placeId,
      review: review,
    });
    res.status(201).json("reviews created successfully");
  } catch (error) {
    res.status(400).json({ error });
  }
});

app.post("/allreviews", async (req, res) => {
  const { id } = req.body;
  //console.log(req.body);
  try {
    const allReviews = await Review.find({}).populate("owner");
    const newReviews = allReviews.filter(
      (review) => review.place.toString() === id
    );
    res.status(200).json(newReviews);
  } catch (err) {
    res.status(400).json({ err });
  }
});

app.post("/getavgstarvalues", async (req, res) => {
  const { id } = req.body;
  // console.log(id);
  try {
    const allReviews = await Review.find({});
    const newReviews = allReviews.filter(
      (review) => review.place.toString() === id
    );
    let sum = 0.0;
    let len = newReviews.length;
    for (let i = 0; i < newReviews.length; i++) {
      //  console.log(object);
      sum += newReviews[i].starValue;
    }
    //console.log(sum/len);
    res.status(200).json({ avg: sum / len, users: len });
  } catch (err) {
    res.status(400).json({ err });
  }
});

app.delete("/deletereview", async (req, res) => {
  const { id, reviewId } = req.body;
  try {
    await Review.deleteOne({ _id: reviewId });
    res.status(200).json("review deleted successfully");
  } catch (err) {
    res.status(400).json({ err });
  }
});

const port = process.env.PORT || 4000;

app.listen(port, () => {
  console.log(`listening on port ${port}`);
});
