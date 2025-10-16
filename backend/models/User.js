const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    pin: {
        type: String,
        required: true,
        unique: true,
        minlength: 4,
        maxlength: 6
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Hash PIN before saving
userSchema.pre('save', async function(next) {
    if (!this.isModified('pin')) return next();
    this.pin = await bcrypt.hash(this.pin, 10);
    next();
});

// Compare PIN
userSchema.methods.comparePin = async function(candidatePin) {
    return await bcrypt.compare(candidatePin, this.pin);
};

module.exports = mongoose.model('User', userSchema);