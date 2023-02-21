const mongoose = require('mongoose');

const UserSchema=new mongoose.Schema({
    firstname:String,
    lastname:String,
    file:String,
    email:{
        type:String,
        unique:true,
    },
    phonenumber:{
        type:String
    },
    password:String
});

module.exports = mongoose.model('User',UserSchema);