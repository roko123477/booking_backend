const mongoose=require('mongoose');

const bookingSchema=new mongoose.Schema({
    place:{
        type:mongoose.Schema.Types.ObjectId,
        required:true,
        ref:'Place'
    },
    user:{
        type:mongoose.Schema.Types.ObjectId,
        required:true
    },
    checkIn:{
        type:String,
        required:true
    },
    checkOut:{
        type:String,
        required:true
    },
    name:{
        type:String,
        required:true
    },
    phone:{
        type:String,
        required:true
    },
    numberOfGuests:Number,
    price:Number,
    secret:String,
},{timestamps:true});

module.exports=mongoose.model('Booking',bookingSchema);