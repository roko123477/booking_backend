const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const dotenv=require("dotenv");
dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_KEY,
  api_secret: process.env.CLOUDINARY_SECRET,
});
//console.log(process.env.CLOUDINARY_CLOUD_NAME);
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "pibook",
    allowedFormats: ["jpeg", "png", "jpg", "webp"],
  }
});

module.exports = {
  cloudinary,
  storage,
};