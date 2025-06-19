// models/vehicle.js

const mongoose = require('mongoose');

// Define the schema for the Vehicle model
const VehicleSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Vehicle name is required'], // Name is mandatory
        trim: true // Remove whitespace from both ends of a string
    },
    brand: {
        type: String,
        required: [true, 'Vehicle brand is required'], // Brand is mandatory
        trim: true
    },
    price: {
        type: Number,
        required: [true, 'Vehicle price is required'], // Price is mandatory
        min: [0, 'Price cannot be negative'] // Price must be non-negative
    },
    type: {
        type: String,
        required: [true, 'Vehicle type is required'], // Type (e.g., sedan, SUV) is mandatory
        enum: ['sedan', 'SUV', 'truck', 'sports', 'hatchback', 'van', 'electric', 'hybrid', 'motorcycle', 'other'], // Predefined types for consistency
        trim: true
    },
    image: {
        type: String, // Store the path/filename of the image
        default: 'no-image.jpg' // Default image if none is uploaded
    },
    createdAt: {
        type: Date,
        default: Date.now // Automatically set creation timestamp
    },
    updatedAt: {
        type: Date,
        default: Date.now // Automatically set update timestamp
    }
});

// Update the `updatedAt` field on save
VehicleSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Create and export the Vehicle model based on the schema
const Vehicle = mongoose.model('Vehicle', VehicleSchema);

module.exports = Vehicle;
