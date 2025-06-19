// File: package.json
// You'll need to install these dependencies:
// npm install express mongoose ejs multer bcryptjs dotenv express-session connect-flash
/*
{
  "name": "e-commerce-vehicle-crud",
  "version": "1.0.0",
  "description": "E-Commerce Vehicle CRUD Module",
  "main": "app.js",
  "scripts": {
    "start": "node app.js",
    "dev": "nodemon app.js" // If you have nodemon installed
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "connect-flash": "^0.1.1",
    "dotenv": "^16.4.5",
    "ejs": "^3.1.9",
    "express": "^4.19.2",
    "express-session": "^1.18.0",
    "mongoose": "^8.4.3",
    "multer": "^1.4.5-lts.1"
  },
  "devDependencies": {
    "nodemon": "^3.1.4"
  }
}
*/

// ================================================================
// File: .env
// Create a .env file in your root directory for environment variables
// Replace with your actual MongoDB connection string
/*
MONGO_URI=mongodb://localhost:27017/ecommerce_db
SESSION_SECRET=supersecretkey
*/

// ================================================================
// File: app.js (Main Express Application File)

const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const session = require('express-session');
const flash = require('connect-flash');
const path = require('path');
const bcrypt = require('bcryptjs'); // For user password hashing/comparison

dotenv.config(); // Load environment variables

const app = express();
const PORT = process.env.PORT || 3000;

// Database Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => console.error('MongoDB connection error:', err));

// Middleware
app.use(express.urlencoded({ extended: true })); // For parsing form data
app.use(express.json()); // For parsing JSON data
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files from 'public' directory

// Session Middleware
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true in production with HTTPS
}));

// Connect Flash for messages
app.use(flash());

// Global variables for flash messages and user session
app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    res.locals.error = req.flash('error');
    res.locals.user = req.session.user || null; // Make user available in all views for conditional rendering
    next();
});

// Set EJS as the view engine and specify views directory
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Import Models
const User = require('./models/User'); // Assume you have a User model for admin authentication
const Vehicle = require('./models/Vehicle'); // Our new Vehicle model

// Import Routes
const vehicleRoutes = require('./routes/vehicleRoutes');

// ================================================================
// User/Admin Authentication Routes (For demonstration)
// You would typically integrate this with your existing authentication system.

// GET /login - Display login form
app.get('/login', (req, res) => {
    res.render('login', { title: 'Login' });
});

// POST /login - Handle login submission
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
        req.flash('error_msg', 'No user found with that email.');
        return res.redirect('/login');
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (isMatch) {
        // Set user session
        req.session.user = {
            id: user._id,
            email: user.email,
            isAdmin: user.isAdmin
        };
        req.flash('success_msg', 'Logged in successfully!');
        // Redirect based on role
        if (user.isAdmin) {
            return res.redirect('/vehicles/admin'); // Admin users go to vehicle management
        } else {
            return res.redirect('/vehicles'); // Regular users go to public vehicle list
        }
    } else {
        req.flash('error_msg', 'Invalid credentials.');
        res.redirect('/login');
    }
});

// GET /logout - Handle user logout
app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) console.error('Error destroying session:', err);
        req.flash('success_msg', 'You are logged out.');
        res.redirect('/login');
    });
});

// ================================================================
// Core Application Routes focusing on Vehicles

// Route for homepage (can be a simple redirect or introductory page)
// As per request, this is just a placeholder, focus is on /vehicles routes
app.get('/', (req, res) => {
    res.render('home', { title: 'Welcome to E-Commerce' });
});

// Use Vehicle Routes - All vehicle-related logic handled here
app.use('/vehicles', vehicleRoutes); // This will handle public and admin vehicle routes

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Visit http://localhost:${PORT}`);
});

// ================================================================
// File: models/User.js (Example User Model for Admin Check)
// This model is provided as an example for the authentication middleware.
// You should adapt it to your existing User model if you have one.

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    isAdmin: {
        type: Boolean,
        default: false // Set this to true for admin accounts
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Pre-save hook to hash password before saving to database
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) {
        return next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

const User = mongoose.model('User', userSchema);

// Example function to create an admin user for testing.
// UNCOMMENT AND RUN THIS ONCE to create the admin user if you don't have one.
// Remember to RE-COMMENT IT after the user is created to avoid re-creation on server restart.
/*
const createAdminUser = async () => {
    try {
        const adminExists = await User.findOne({ email: 'admin@example.com' });
        if (!adminExists) {
            const adminUser = new User({
                email: 'admin@example.com',
                password: 'adminpassword', // This will be hashed by the pre-save hook
                isAdmin: true
            });
            await adminUser.save();
            console.log('Admin user created successfully! Email: admin@example.com, Password: adminpassword');
        } else {
            console.log('Admin user already exists.');
        }
    } catch (error) {
        console.error('Error creating admin user:', error);
    }
};
createAdminUser();
*/
module.exports = User;

// ================================================================
// File: models/Vehicle.js (Mongoose Vehicle Model)
// This is the core model for your vehicles.

const vehicleSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Vehicle name is required'],
        trim: true // Remove whitespace from both ends of a string
    },
    brand: {
        type: String,
        required: [true, 'Brand is required'],
        trim: true
    },
    price: {
        type: Number,
        required: [true, 'Price is required'],
        min: [0, 'Price cannot be negative'] // Price must be non-negative
    },
    type: {
        type: String,
        required: [true, 'Vehicle type is required'],
        enum: ['sedan', 'SUV', 'truck', 'motorcycle', 'hatchback', 'coupe', 'van', 'other'], // Allowed vehicle types
        lowercase: true // Store type in lowercase
    },
    image: {
        type: String, // Stores the relative path to the image file
        default: '/uploads/placeholder.png' // Default image if none uploaded or removed
    },
    createdAt: {
        type: Date,
        default: Date.now // Automatically set creation date
    },
    updatedAt: {
        type: Date,
        default: Date.now // Automatically set update date
    }
});

// Pre-save hook to update `updatedAt` field on every save operation
vehicleSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

const Vehicle = mongoose.model('Vehicle', vehicleSchema);

module.exports = Vehicle;

// ================================================================
// File: middlewares/authMiddleware.js (Authentication & Authorization Middleware)
// These middlewares protect your routes, ensuring only authenticated/authorized users can access them.

const ensureAuthenticated = (req, res, next) => {
    // Check if a user session exists
    if (req.session.user) {
        return next(); // User is logged in, proceed to the next middleware/route handler
    }
    // If not authenticated, flash an error message and redirect to login
    req.flash('error_msg', 'Please log in to view that resource');
    res.redirect('/login');
};

const ensureAdmin = (req, res, next) => {
    // Check if a user session exists AND if the user is an admin
    if (req.session.user && req.session.user.isAdmin) {
        return next(); // User is an admin, proceed
    }
    // If not an admin, flash an error message and redirect to login (or a forbidden page)
    req.flash('error_msg', 'You are not authorized to view that resource');
    res.redirect('/login'); // Consider redirecting to a 403 Forbidden page in a production app
};

module.exports = {
    ensureAuthenticated,
    ensureAdmin
};

// ================================================================
// File: routes/vehicleRoutes.js (Express Routes for Vehicles)
// This file defines all the CRUD routes for vehicles, both public and admin.

const express = require('express');
const router = express.Router();
const Vehicle = require('../models/Vehicle');
const { ensureAuthenticated, ensureAdmin } = require('../middlewares/authMiddleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs'); // Node.js File System module for deleting images

// Multer storage configuration: where to store files and how to name them
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../public/uploads');
        // Create the 'uploads' directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir); // Store uploaded files in 'public/uploads'
    },
    filename: (req, file, cb) => {
        // Generate a unique filename: timestamp + original filename
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

// Multer upload middleware: configured with storage, file size limit, and file type filter
const upload = multer({
    storage: storage,
    limits: { fileSize: 1024 * 1024 * 5 }, // 5MB file size limit
    fileFilter: (req, file, cb) => {
        // Allow only specific image file types
        const filetypes = /jpeg|jpg|png|gif/;
        const mimetype = filetypes.test(file.mimetype); // Check mimetype
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase()); // Check file extension

        if (mimetype && extname) {
            return cb(null, true); // Accept the file
        }
        cb('Error: Images Only! (jpeg, jpg, png, gif)'); // Reject the file with an error message
    }
}).single('image'); // Expect a single file upload from an input field named 'image'

// Helper function to wrap Multer upload with Express error handling and flash messages
const handleImageUpload = (req, res, next) => {
    upload(req, res, (err) => {
        if (err) {
            req.flash('error_msg', err); // Flash the error message from Multer
            // Determine redirect URL based on whether it's a new creation or an edit
            const redirectUrl = req.params.id ? `/vehicles/admin/edit/${req.params.id}` : '/vehicles/admin/new';
            return res.redirect(redirectUrl);
        }
        next(); // If upload is successful, proceed to the next middleware/route handler
    });
};

// ======================= Public Routes (Read-Only Access for All Users) =======================

// GET /vehicles - Display a list of all vehicles
router.get('/', async (req, res) => {
    try {
        const vehicles = await Vehicle.find().sort({ createdAt: 'desc' }); // Fetch all vehicles, sorted by creation date
        res.render('vehicles/index', { // Render the public index view
            title: 'All Vehicles',
            vehicles: vehicles
        });
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error fetching vehicles.'); // Flash error message
        res.redirect('/'); // Redirect to homepage on error
    }
});

// GET /vehicles/:id - Display details of a single vehicle
router.get('/:id', async (req, res) => {
    try {
        const vehicle = await Vehicle.findById(req.params.id); // Find vehicle by ID from URL parameter
        if (!vehicle) {
            req.flash('error_msg', 'Vehicle not found.');
            return res.redirect('/vehicles'); // Redirect if vehicle not found
        }
        res.render('vehicles/show', { // Render the public show view
            title: vehicle.name,
            vehicle: vehicle
        });
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error fetching vehicle details.');
        res.redirect('/vehicles'); // Redirect on error
    }
});


// ======================= Admin Routes (CRUD Operations - Admin-Only) =======================

// GET /vehicles/admin - View all vehicles for administrative management
router.get('/admin', ensureAdmin, async (req, res) => {
    try {
        const vehicles = await Vehicle.find().sort({ createdAt: 'desc' });
        res.render('vehicles/admin/index', { // Render admin index view
            title: 'Manage Vehicles',
            vehicles: vehicles
        });
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error fetching vehicles for admin.');
        res.redirect('/vehicles'); // Redirect on error
    }
});

// GET /vehicles/admin/new - Show form to create a new vehicle
router.get('/admin/new', ensureAdmin, (req, res) => {
    res.render('vehicles/admin/new', { // Render the new vehicle form
        title: 'Add New Vehicle',
        errors: {} // Pass an empty errors object for initial render
    });
});

// POST /vehicles/admin - Handle creation of a new vehicle
router.post('/admin', ensureAdmin, handleImageUpload, async (req, res) => {
    const { name, brand, price, type } = req.body;
    let errors = {}; // Object to store validation errors

    // Server-side validation
    if (!name) errors.name = 'Name is required.';
    if (!brand) errors.brand = 'Brand is required.';
    if (!price || isNaN(price) || price < 0) errors.price = 'Valid price is required.';
    if (!type) errors.type = 'Type is required.';

    if (Object.keys(errors).length > 0) {
        // If validation fails, re-render the form with errors and previous input
        if (req.file) { // If an image was uploaded but validation failed, delete it
            fs.unlink(req.file.path, (err) => {
                if (err) console.error('Error deleting temporary image after validation fail:', err);
            });
        }
        return res.render('vehicles/admin/new', {
            title: 'Add New Vehicle',
            errors: errors,
            vehicle: { name, brand, price, type } // Pass back old input for convenience
        });
    }

    try {
        // Create a new Vehicle instance
        const newVehicle = new Vehicle({
            name,
            brand,
            price,
            type,
            image: req.file ? `/uploads/${req.file.filename}` : undefined // Store path relative to 'public'
        });
        await newVehicle.save(); // Save the new vehicle to MongoDB
        req.flash('success_msg', 'Vehicle added successfully!');
        res.redirect('/vehicles/admin'); // Redirect to admin vehicle list
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error adding vehicle.');
        // If database save fails, delete the uploaded file
        if (req.file) {
            fs.unlink(req.file.path, (unlinkErr) => {
                if (unlinkErr) console.error('Error deleting uploaded file after DB error:', unlinkErr);
            });
        }
        res.redirect('/vehicles/admin/new'); // Redirect back to new vehicle form
    }
});

// GET /vehicles/admin/edit/:id - Show form to edit an existing vehicle
router.get('/admin/edit/:id', ensureAdmin, async (req, res) => {
    try {
        const vehicle = await Vehicle.findById(req.params.id); // Find vehicle by ID
        if (!vehicle) {
            req.flash('error_msg', 'Vehicle not found.');
            return res.redirect('/vehicles/admin');
        }
        res.render('vehicles/admin/edit', { // Render the edit vehicle form
            title: `Edit ${vehicle.name}`,
            vehicle: vehicle,
            errors: {} // Pass an empty errors object initially
        });
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error fetching vehicle for edit.');
        res.redirect('/vehicles/admin');
    }
});

// POST /vehicles/admin/edit/:id - Handle update of an existing vehicle
router.post('/admin/edit/:id', ensureAdmin, handleImageUpload, async (req, res) => {
    const { name, brand, price, type } = req.body;
    let errors = {};

    // Server-side validation
    if (!name) errors.name = 'Name is required.';
    if (!brand) errors.brand = 'Brand is required.';
    if (!price || isNaN(price) || price < 0) errors.price = 'Valid price is required.';
    if (!type) errors.type = 'Type is required.';

    if (Object.keys(errors).length > 0) {
        // If validation fails, re-render the form with errors and previous input
        if (req.file) { // If a new image was uploaded but validation failed, delete it
            fs.unlink(req.file.path, (err) => {
                if (err) console.error('Error deleting temp image for failed edit:', err);
            });
        }
        return res.render('vehicles/admin/edit', {
            title: `Edit Vehicle`,
            errors: errors,
            // Pass back old input and current image (from hidden field)
            vehicle: { _id: req.params.id, name, brand, price, type, image: req.body.currentImage }
        });
    }

    try {
        const vehicle = await Vehicle.findById(req.params.id); // Find the vehicle to update
        if (!vehicle) {
            req.flash('error_msg', 'Vehicle not found.');
            if (req.file) { // If a new file was uploaded but target vehicle doesn't exist, delete it
                fs.unlink(req.file.path, (err) => {
                    if (err) console.error('Error deleting new image for non-existent vehicle:', err);
                });
            }
            return res.redirect('/vehicles/admin');
        }

        // Update vehicle fields
        vehicle.name = name;
        vehicle.brand = brand;
        vehicle.price = price;
        vehicle.type = type;

        // Handle image update if a new file was uploaded
        if (req.file) {
            // Delete the old image file if it exists and is not the default placeholder
            if (vehicle.image && vehicle.image !== '/uploads/placeholder.png') {
                const oldImagePath = path.join(__dirname, '../public', vehicle.image);
                fs.unlink(oldImagePath, (err) => {
                    if (err && err.code !== 'ENOENT') { // 'ENOENT' means file not found, which is okay
                        console.error('Error deleting old image:', err);
                    }
                });
            }
            vehicle.image = `/uploads/${req.file.filename}`; // Set the new image path
        }

        await vehicle.save(); // Save the updated vehicle
        req.flash('success_msg', 'Vehicle updated successfully!');
        res.redirect('/vehicles/admin');
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error updating vehicle.');
        if (req.file) { // If a new image was uploaded but database update failed, delete it
            fs.unlink(req.file.path, (unlinkErr) => {
                if (unlinkErr) console.error('Error deleting uploaded file after DB error:', unlinkErr);
            });
        }
        res.redirect(`/vehicles/admin/edit/${req.params.id}`); // Redirect back to edit form
    }
});

// POST /vehicles/admin/delete/:id - Handle deletion of a vehicle
router.post('/admin/delete/:id', ensureAdmin, async (req, res) => {
    try {
        const vehicle = await Vehicle.findById(req.params.id); // Find vehicle by ID
        if (!vehicle) {
            req.flash('error_msg', 'Vehicle not found.');
            return res.redirect('/vehicles/admin');
        }

        // Delete the associated image file from the server if it exists and is not the default
        if (vehicle.image && vehicle.image !== '/uploads/placeholder.png') {
            const imagePath = path.join(__dirname, '../public', vehicle.image);
            fs.unlink(imagePath, (err) => {
                if (err && err.code !== 'ENOENT') {
                    console.error('Error deleting vehicle image file:', err);
                }
            });
        }

        await Vehicle.findByIdAndDelete(req.params.id); // Delete the vehicle from MongoDB
        req.flash('success_msg', 'Vehicle deleted successfully!');
        res.redirect('/vehicles/admin'); // Redirect to admin vehicle list
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error deleting vehicle.');
        res.redirect('/vehicles/admin');
    }
});

module.exports = router;

// ================================================================
// VIEWS (EJS Templates)
// Please ensure you have these EJS files in the specified directory structure.
// They use Bootstrap 5 for styling.

// Directory Structure:
//
// your-ecommerce-project/
// ├── public/
// │   ├── css/
// │   │   └── style.css (optional, for custom styles)
// │   └── uploads/       <-- This directory will store uploaded images
// ├── views/
// │   ├── partials/
// │   │   ├── _header.ejs
// │   │   ├── _footer.ejs
// │   │   └── _messages.ejs
// │   ├── vehicles/
// │   │   ├── admin/
// │   │   │   ├── index.ejs (Admin list of vehicles)
// │   │   │   ├── new.ejs   (Admin create form)
// │   │   │   └── edit.ejs  (Admin edit form)
// │   │   ├── index.ejs     (Public list of vehicles)
// │   │   └── show.ejs      (Public single vehicle view)
// │   ├── home.ejs          (Simple homepage)
// │   └── login.ejs         (Login form)
// ├── models/
// │   ├── User.js        <-- Required for admin check
// │   └── Vehicle.js     <-- The Mongoose Vehicle Model
// ├── middlewares/
// │   └── authMiddleware.js
// ├── routes/
// │   └── vehicleRoutes.js
// ├── .env               <-- Environment variables (e.g., MONGO_URI, SESSION_SECRET)
// ├── app.js             <-- Main application file
// └── package.json

// ================================================================
// File: views/layout.ejs (Basic Layout for all EJS views)

/*
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><%= title %></title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" xintegrity="sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH" crossorigin="anonymous">
    <link rel="stylesheet" href="/css/style.css"> // Optional: custom CSS file
</head>
<body>
    <%- include('./partials/_header') %>

    <div class="container mt-4">
        <%- include('./partials/_messages') %>
        <%- body %> // This is where content from other views will be injected. If using `express-ejs-layouts` library, otherwise just put the content here directly.
    </div>

    <%- include('./partials/_footer') %>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js" xintegrity="sha384-YvpcrYf0tY3lHB60NNkmXc5s9fDVZLESaAA55NDzOxhy9GkcIdslK1eN7N6jIeHz" crossorigin="anonymous"></script>
</body>
</html>
*/

// ================================================================
// File: views/partials/_header.ejs (Navigation Bar)

/*
<nav class="navbar navbar-expand-lg navbar-dark bg-primary">
    <div class="container-fluid">
        <a class="navbar-brand" href="/">E-Shop</a>
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
            <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="navbarNav">
            <ul class="navbar-nav me-auto mb-2 mb-lg-0">
                <li class="nav-item">
                    <a class="nav-link" href="/">Home</a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" href="/vehicles">Vehicles (Public)</a>
                </li>
                <% if (user && user.isAdmin) { %>
                    <li class="nav-item">
                        <a class="nav-link" href="/vehicles/admin">Manage Vehicles (Admin)</a>
                    </li>
                <% } %>
            </ul>
            <ul class="navbar-nav">
                <% if (user) { %>
                    <li class="nav-item">
                        <span class="nav-link text-light">Welcome, <%= user.email %>!</span>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="/logout">Logout</a>
                    </li>
                <% } else { %>
                    <li class="nav-item">
                        <a class="nav-link" href="/login">Login</a>
                    </li>
                <% } %>
            </ul>
        </div>
    </div>
</nav>
*/

// ================================================================
// File: views/partials/_footer.ejs (Page Footer)

/*
<footer class="bg-light text-center text-lg-start mt-5 py-3">
    <div class="container p-4">
        <div class="text-center">
            © 2025 E-Commerce Vehicles
        </div>
    </div>
</footer>
*/

// ================================================================
// File: views/partials/_messages.ejs (For displaying Connect-Flash messages)

/*
<% if (success_msg && success_msg.length > 0) { %>
    <div class="alert alert-success alert-dismissible fade show" role="alert">
        <%= success_msg %>
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>
<% } %>

<% if (error_msg && error_msg.length > 0) { %>
    <div class="alert alert-danger alert-dismissible fade show" role="alert">
        <%= error_msg %>
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>
<% } %>

<% if (error && error.length > 0) { %> // For Passport.js integration or similar
    <div class="alert alert-danger alert-dismissible fade show" role="alert">
        <%= error %>
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>
<% } %>
*/

// ================================================================
// File: views/home.ejs (Simple Homepage - a placeholder as requested)

/*
<%- layout('layout') %> // If you use express-ejs-layouts
<div class="text-center">
    <h1>Welcome to Our E-Commerce Store!</h1>
    <p class="lead">Explore our wide range of vehicles.</p>
    <a href="/vehicles" class="btn btn-primary btn-lg">View All Vehicles</a>
    <% if (user && user.isAdmin) { %>
        <a href="/vehicles/admin" class="btn btn-secondary btn-lg ms-3">Manage Vehicles (Admin)</a>
    <% } %>
</div>
*/

// ================================================================
// File: views/login.ejs (Simple Login Form for Admin/User Authentication)

/*
<%- layout('layout') %>
<div class="row mt-5">
    <div class="col-md-6 m-auto">
        <div class="card card-body shadow-sm rounded-3">
            <h1 class="text-center mb-3">Login</h1>
            <form action="/login" method="POST">
                <div class="mb-3">
                    <label for="email" class="form-label">Email address</label>
                    <input type="email" id="email" name="email" class="form-control" required>
                </div>
                <div class="mb-3">
                    <label for="password" class="form-label">Password</label>
                    <input type="password" id="password" name="password" class="form-control" required>
                </div>
                <div class="d-grid gap-2">
                    <button type="submit" class="btn btn-primary">Login</button>
                </div>
            </form>
        </div>
    </div>
</div>
*/

// ================================================================
// File: views/vehicles/index.ejs (Public Read-Only List of Vehicles)

/*
<%- layout('layout') %>
<div class="container my-4">
    <h1 class="text-center mb-4">Our Vehicle Collection</h1>

    <% if (vehicles.length > 0) { %>
        <div class="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-4">
            <% vehicles.forEach(vehicle => { %>
                <div class="col">
                    <div class="card h-100 shadow-sm rounded-3">
                        <img src="<%= vehicle.image ? vehicle.image : '/uploads/placeholder.png' %>" class="card-img-top rounded-top-3" alt="<%= vehicle.name %>" style="height: 200px; object-fit: cover;">
                        <div class="card-body d-flex flex-column">
                            <h5 class="card-title mb-1"><%= vehicle.name %> (<%= vehicle.brand %>)</h5>
                            <p class="card-text text-muted mb-2"><%= vehicle.type.charAt(0).toUpperCase() + vehicle.type.slice(1) %></p>
                            <h4 class="card-subtitle mb-3 text-primary">$<%= vehicle.price.toLocaleString() %></h4>
                            <div class="mt-auto">
                                <a href="/vehicles/<%= vehicle._id %>" class="btn btn-info btn-sm rounded-pill">View Details</a>
                            </div>
                        </div>
                    </div>
                </div>
            <% }) %>
        </div>
    <% } else { %>
        <p class="text-center lead">No vehicles available yet.</p>
    <% } %>
</div>
*/

// ================================================================
// File: views/vehicles/show.ejs (Public Single Vehicle Detail View)

/*
<%- layout('layout') %>
<div class="container my-5">
    <div class="card shadow-lg rounded-3">
        <div class="row g-0">
            <div class="col-md-5">
                <img src="<%= vehicle.image ? vehicle.image : '/uploads/placeholder.png' %>" class="img-fluid rounded-start-3" alt="<%= vehicle.name %>" style="height: 100%; object-fit: cover;">
            </div>
            <div class="col-md-7">
                <div class="card-body p-4">
                    <h1 class="card-title text-primary"><%= vehicle.name %></h1>
                    <h4 class="card-subtitle mb-3 text-muted"><%= vehicle.brand %></h4>
                    <p class="card-text fs-5"><strong>Type:</strong> <%= vehicle.type.charAt(0).toUpperCase() + vehicle.type.slice(1) %></p>
                    <p class="card-text fs-4 fw-bold text-success">Price: $<%= vehicle.price.toLocaleString() %></p>
                    <hr>
                    <p class="card-text"><small class="text-muted">Added: <%= vehicle.createdAt.toLocaleDateString() %></small></p>
                    <div class="mt-4">
                        <a href="/vehicles" class="btn btn-outline-secondary rounded-pill me-2">Back to Vehicles</a>
                        <button class="btn btn-success rounded-pill">Add to Cart</button> // Example action
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
*/

// ================================================================
// File: views/vehicles/admin/index.ejs (Admin List of Vehicles with CRUD Actions)

/*
<%- layout('layout') %>
<div class="container my-4">
    <div class="d-flex justify-content-between align-items-center mb-4">
        <h1 class="mb-0">Manage Vehicles</h1>
        <a href="/vehicles/admin/new" class="btn btn-success rounded-pill shadow-sm">Add New Vehicle</a>
    </div>

    <% if (vehicles.length > 0) { %>
        <div class="table-responsive rounded-3 shadow-sm">
            <table class="table table-hover table-striped mb-0">
                <thead class="table-dark">
                    <tr>
                        <th scope="col">#</th>
                        <th scope="col">Image</th>
                        <th scope="col">Name</th>
                        <th scope="col">Brand</th>
                        <th scope="col">Type</th>
                        <th scope="col">Price</th>
                        <th scope="col">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    <% vehicles.forEach((vehicle, index) => { %>
                        <tr>
                            <th scope="row"><%= index + 1 %></th>
                            <td>
                                <img src="<%= vehicle.image ? vehicle.image : '/uploads/placeholder.png' %>" alt="<%= vehicle.name %>" style="width: 50px; height: 50px; object-fit: cover; border-radius: 8px;">
                            </td>
                            <td><%= vehicle.name %></td>
                            <td><%= vehicle.brand %></td>
                            <td><%= vehicle.type.charAt(0).toUpperCase() + vehicle.type.slice(1) %></td>
                            <td>$<%= vehicle.price.toLocaleString() %></td>
                            <td>
                                <a href="/vehicles/admin/edit/<%= vehicle._id %>" class="btn btn-warning btn-sm me-2 rounded-pill">Edit</a>
                                <form action="/vehicles/admin/delete/<%= vehicle._id %>" method="POST" class="d-inline" onsubmit="return confirm('Are you sure you want to delete <%= vehicle.name %>?');">
                                    <button type="submit" class="btn btn-danger btn-sm rounded-pill">Delete</button>
                                </form>
                            </td>
                        </tr>
                    <% }) %>
                </tbody>
            </table>
        </div>
    <% } else { %>
        <p class="text-center lead">No vehicles have been added yet. Click "Add New Vehicle" to get started!</p>
    <% } %>
</div>
*/

// ================================================================
// File: views/vehicles/admin/new.ejs (Admin Form for Creating New Vehicle)

/*
<%- layout('layout') %>
<div class="container my-4">
    <div class="card shadow-sm rounded-3">
        <div class="card-header bg-primary text-white rounded-top-3">
            <h2 class="mb-0">Add New Vehicle</h2>
        </div>
        <div class="card-body">
            <form action="/vehicles/admin" method="POST" enctype="multipart/form-data">
                <div class="mb-3">
                    <label for="name" class="form-label">Vehicle Name</label>
                    <input type="text" class="form-control <%= errors.name ? 'is-invalid' : '' %>" id="name" name="name" value="<%= typeof vehicle != 'undefined' ? vehicle.name : '' %>" required>
                    <% if (errors.name) { %>
                        <div class="invalid-feedback"><%= errors.name %></div>
                    <% } %>
                </div>
                <div class="mb-3">
                    <label for="brand" class="form-label">Brand</label>
                    <input type="text" class="form-control <%= errors.brand ? 'is-invalid' : '' %>" id="brand" name="brand" value="<%= typeof vehicle != 'undefined' ? vehicle.brand : '' %>" required>
                    <% if (errors.brand) { %>
                        <div class="invalid-feedback"><%= errors.brand %></div>
                    <% } %>
                </div>
                <div class="mb-3">
                    <label for="price" class="form-label">Price ($)</label>
                    <input type="number" step="0.01" class="form-control <%= errors.price ? 'is-invalid' : '' %>" id="price" name="price" value="<%= typeof vehicle != 'undefined' ? vehicle.price : '' %>" required>
                    <% if (errors.price) { %>
                        <div class="invalid-feedback"><%= errors.price %></div>
                    <% } %>
                </div>
                <div class="mb-3">
                    <label for="type" class="form-label">Vehicle Type</label>
                    <select class="form-select <%= errors.type ? 'is-invalid' : '' %>" id="type" name="type" required>
                        <option value="">Select Type</option>
                        <option value="sedan" <%= (typeof vehicle != 'undefined' && vehicle.type === 'sedan') ? 'selected' : '' %>>Sedan</option>
                        <option value="suv" <%= (typeof vehicle != 'undefined' && vehicle.type === 'suv') ? 'selected' : '' %>>SUV</option>
                        <option value="truck" <%= (typeof vehicle != 'undefined' && vehicle.type === 'truck') ? 'selected' : '' %>>Truck</option>
                        <option value="motorcycle" <%= (typeof vehicle != 'undefined' && vehicle.type === 'motorcycle') ? 'selected' : '' %>>Motorcycle</option>
                        <option value="hatchback" <%= (typeof vehicle != 'undefined' && vehicle.type === 'hatchback') ? 'selected' : '' %>>Hatchback</option>
                        <option value="coupe" <%= (typeof vehicle != 'undefined' && vehicle.type === 'coupe') ? 'selected' : '' %>>Coupe</option>
                        <option value="van" <%= (typeof vehicle != 'undefined' && vehicle.type === 'van') ? 'selected' : '' %>>Van</option>
                        <option value="other" <%= (typeof vehicle != 'undefined' && vehicle.type === 'other') ? 'selected' : '' %>>Other</option>
                    </select>
                    <% if (errors.type) { %>
                        <div class="invalid-feedback"><%= errors.type %></div>
                    <% } %>
                </div>
                <div class="mb-3">
                    <label for="image" class="form-label">Vehicle Image</label>
                    <input class="form-control <%= errors.image ? 'is-invalid' : '' %>" type="file" id="image" name="image" accept="image/*">
                    <% if (errors.image) { %>
                        <div class="invalid-feedback"><%= errors.image %></div>
                    <% } %>
                    <small class="form-text text-muted">Max file size 5MB. Accepted formats: JPG, JPEG, PNG, GIF.</small>
                </div>
                <div class="d-grid gap-2">
                    <button type="submit" class="btn btn-primary rounded-pill">Add Vehicle</button>
                    <a href="/vehicles/admin" class="btn btn-outline-secondary rounded-pill">Cancel</a>
                </div>
            </form>
        </div>
    </div>
</div>
*/

// ================================================================
// File: views/vehicles/admin/edit.ejs (Admin Form for Editing Existing Vehicle)

/*
<%- layout('layout') %>
<div class="container my-4">
    <div class="card shadow-sm rounded-3">
        <div class="card-header bg-warning text-white rounded-top-3">
            <h2 class="mb-0">Edit Vehicle: <%= vehicle.name %></h2>
        </div>
        <div class="card-body">
            <form action="/vehicles/admin/edit/<%= vehicle._id %>" method="POST" enctype="multipart/form-data">
                <input type="hidden" name="currentImage" value="<%= vehicle.image %>">
                <div class="mb-3">
                    <label for="name" class="form-label">Vehicle Name</label>
                    <input type="text" class="form-control <%= errors.name ? 'is-invalid' : '' %>" id="name" name="name" value="<%= vehicle.name %>" required>
                    <% if (errors.name) { %>
                        <div class="invalid-feedback"><%= errors.name %></div>
                    <% } %>
                </div>
                <div class="mb-3">
                    <label for="brand" class="form-label">Brand</label>
                    <input type="text" class="form-control <%= errors.brand ? 'is-invalid' : '' %>" id="brand" name="brand" value="<%= vehicle.brand %>" required>
                    <% if (errors.brand) { %>
                        <div class="invalid-feedback"><%= errors.brand %></div>
                    <% } %>
                </div>
                <div class="mb-3">
                    <label for="price" class="form-label">Price ($)</label>
                    <input type="number" step="0.01" class="form-control <%= errors.price ? 'is-invalid' : '' %>" id="price" name="price" value="<%= vehicle.price %>" required>
                    <% if (errors.price) { %>
                        <div class="invalid-feedback"><%= errors.price %></div>
                    <% } %>
                </div>
                <div class="mb-3">
                    <label for="type" class="form-label">Vehicle Type</label>
                    <select class="form-select <%= errors.type ? 'is-invalid' : '' %>" id="type" name="type" required>
                        <option value="">Select Type</option>
                        <option value="sedan" <%= vehicle.type === 'sedan' ? 'selected' : '' %>>Sedan</option>
                        <option value="suv" <%= vehicle.type === 'suv' ? 'selected' : '' %>>SUV</option>
                        <option value="truck" <%= vehicle.type === 'truck' ? 'selected' : '' %>>Truck</option>
                        <option value="motorcycle" <%= vehicle.type === 'motorcycle' ? 'selected' : '' %>>Motorcycle</option>
                        <option value="hatchback" <%= vehicle.type === 'hatchback' ? 'selected' : '' %>>Hatchback</option>
                        <option value="coupe" <%= vehicle.type === 'coupe' ? 'selected' : '' %>>Coupe</option>
                        <option value="van" <%= vehicle.type === 'van' ? 'selected' : '' %>>Van</option>
                        <option value="other" <%= vehicle.type === 'other' ? 'selected' : '' %>>Other</option>
                    </select>
                    <% if (errors.type) { %>
                        <div class="invalid-feedback"><%= errors.type %></div>
                    <% } %>
                </div>
                <div class="mb-3">
                    <label for="image" class="form-label">Vehicle Image</label>
                    <input class="form-control" type="file" id="image" name="image" accept="image/*">
                    <small class="form-text text-muted">Leave blank to keep current image.</small>
                    <% if (vehicle.image) { %>
                        <div class="mt-2">
                            Current Image: <img src="<%= vehicle.image %>" alt="Current Image" style="width: 100px; height: 100px; object-fit: cover; border-radius: 8px;">
                        </div>
                    <% } %>
                </div>
                <div class="d-grid gap-2">
                    <button type="submit" class="btn btn-warning rounded-pill">Update Vehicle</button>
                    <a href="/vehicles/admin" class="btn btn-outline-secondary rounded-pill">Cancel</a>
                </div>
            </form>
        </div>
    </div>
</div>
*/
