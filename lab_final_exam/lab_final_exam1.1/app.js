// app.js

const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session'); // For session management
const flash = require('connect-flash');   // For flash messages (optional but good for auth feedback)

const app = express();
const PORT = process.env.PORT || 3000;

// --- MongoDB Connection ---
mongoose.connect('mongodb://localhost:27017/ecommerceDB')
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.error('MongoDB connection error:', err));

// --- Middleware Setup ---
// Serve static files from the 'public' directory (for images, CSS, etc.)
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads'))); // Serve uploaded images

// Body parser middleware to parse URL-encoded bodies and JSON bodies
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Session middleware (required for connect-flash)
app.use(session({
    secret: 'secretadminkey', // Change this to a strong, random string in production
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 60 * 60 * 1000 } // 1 hour
}));

// Connect-flash middleware
app.use(flash());

// Set global variables for flash messages (make them available in all EJS templates)
app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    res.locals.error = req.flash('error'); // Generic error from form validation
    res.locals.user = req.session.user || null; // Pass user to all views
    next();
});

// Set EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// --- Authentication Middleware ---
// Replaces the old mock middleware
app.use((req, res, next) => {
    // Check if user is authenticated (mock check based on session)
    req.isAuthenticated = () => {
        return !!req.session.user; // True if req.session.user exists
    };
    // Check if user is an admin (mock check based on session user role)
    req.isAdmin = () => {
        return req.session.user && req.session.user.role === 'admin';
    };
    next();
});

// --- Import Routes ---
const publicVehiclesRoutes = require('./routes/public/vehicles');
const adminVehiclesRoutes = require('./routes/admin/vehicles');

// --- User/Auth Routes ---
// GET Login Page
app.get('/login', (req, res) => {
    res.render('login', { title: 'Admin Login' });
});

// POST Login Attempt
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    // Hardcoded admin credentials for simplicity.
    // In a real app, you would hash passwords and check against a database.
    if (username === 'admin' && password === 'password123') {
        req.session.user = {
            id: 'adminId123',
            username: 'admin',
            role: 'admin'
        };
        req.flash('success_msg', 'Logged in as Admin!');
        res.redirect('/admin/vehicles'); // Redirect to admin panel on successful login
    } else {
        req.flash('error', 'Invalid username or password.'); // Use 'error' for general login errors
        res.redirect('/login');
    }
});

// GET Logout
app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Error destroying session:', err);
            return res.status(500).send('Could not log out.');
        }
        req.flash('success_msg', 'You have been logged out.');
        res.redirect('/login'); // Redirect to login page after logout
    });
});


// --- Use Routes ---
app.use('/vehicles', publicVehiclesRoutes); // Public read-only access
app.use('/admin/vehicles', adminVehiclesRoutes); // Admin CRUD access

// --- Basic Home Route ---
app.get('/', (req, res) => {
    res.render('index', { title: 'E-Commerce Home' });
});


// --- Server Start ---
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
