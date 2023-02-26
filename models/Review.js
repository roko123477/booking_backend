const mongoose=require('mongoose');

const reviewSchema=new mongoose.Schema({
    review:{
        type:String,
    },
    owner:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    place:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Place"
    },
    starValue:{
        type:Number
    },
},{timestamps:true});

module.exports =mongoose.model('Review',reviewSchema);