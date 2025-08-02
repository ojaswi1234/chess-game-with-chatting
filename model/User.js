const express = require('express');
const Mongoose = require('mongoose');

Mongoose.connect('mongodb://localhost:27017/chess', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const userSchema = new Mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    }
})
module.exports = Mongoose.model('User', userSchema);