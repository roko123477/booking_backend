const mongoose = require("mongoose");

const placeSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    title: String,
    address: String,
    photos: [
      {
        url: String,
        filename: String,
      },
    ],
    description: String,
    perks: [String],
    extraInfo: String,
    checkIn: Number,
    checkOut: Number,
    maxGuests: Number,
    price: Number,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Place", placeSchema);
