// routes/admin/vehicles.js

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs'); // Node.js file system module

const Vehicle = require('../../models/vehicle'); // Import the Vehicle model

// --- Multer Configuration for Image Upload ---
// Set storage engine for Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Define the directory where images will be stored
        const uploadDir = path.join(__dirname, '../../public/uploads');
        // Ensure the directory exists, create if not
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Generate a unique filename for each uploaded image
        // Example: image-123456789.jpg
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});

// Initialize upload middleware
const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // Limit file size to 5MB
    fileFilter: (req, file, cb) => {
        // Allow only certain image file types
        const filetypes = /jpeg|jpg|png|gif/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

        if (mimetype && extname) {
            return cb(null, true); // Accept the file
        } else {
            cb('Error: Images Only! (jpeg, jpg, png, gif)'); // Reject the file
        }
    }
}).single('image'); // 'image' is the name of the input field in the form


// --- Middleware for Admin Authorization ---
function ensureAdmin(req, res, next) {
    if (req.isAuthenticated() && req.isAdmin()) {
        return next(); // User is authenticated and is an admin, proceed
    }
    // If not authenticated or not an admin, redirect to home or show an error
    // req.flash('error_msg', 'You are not authorized to view this page.'); // Requires connect-flash
    res.redirect('/'); // Or render an error page
}

// NOTE: For simplicity, `req.flash` is commented out as it requires `connect-flash` middleware
// and session management, which are outside the scope of this vehicle CRUD module.
// If your existing project uses it, uncomment and ensure it's set up in app.js.


// --- Admin Routes for Vehicles ---

// GET /admin/vehicles - Show all vehicles (Admin)
router.get('/', ensureAdmin, async (req, res) => {
    try {
        const vehicles = await Vehicle.find({}); // Fetch all vehicles from the database
        res.render('admin/vehicles/index', { // <-- This is the line trying to find the EJS file
            title: 'Admin: Manage Vehicles',
            vehicles: vehicles,
            user: req.user // Pass user object for header partial
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// GET /admin/vehicles/new - Show form to create a new vehicle (Admin)
router.get('/new', ensureAdmin, (req, res) => {
    res.render('admin/vehicles/new', {
        title: 'Admin: Add New Vehicle',
        user: req.user // Pass user object for header partial
    });
});

// POST /admin/vehicles - Create a new vehicle (Admin)
router.post('/', ensureAdmin, (req, res) => {
    upload(req, res, async (err) => {
        if (err) {
            // If Multer error, re-render form with error message
            return res.render('admin/vehicles/new', {
                title: 'Admin: Add New Vehicle',
                error: err,
                vehicle: req.body, // Pass back form data to re-populate fields
                user: req.user // Pass user object for header partial
            });
        }

        const { name, brand, price, type } = req.body;
        const image = req.file ? req.file.filename : undefined; // Get filename if uploaded

        // Server-side validation
        if (!name || !brand || !price || !type) {
            return res.render('admin/vehicles/new', {
                title: 'Admin: Add New Vehicle',
                error: 'All fields are required.',
                vehicle: req.body,
                missingFields: { name: !name, brand: !brand, price: !price, type: !type },
                user: req.user // Pass user object for header partial
            });
        }
        if (isNaN(price) || parseFloat(price) < 0) {
            return res.render('admin/vehicles/new', {
                title: 'Admin: Add New Vehicle',
                error: 'Price must be a valid non-negative number.',
                vehicle: req.body,
                invalidPrice: true,
                user: req.user // Pass user object for header partial
            });
        }

        try {
            const newVehicle = new Vehicle({
                name,
                brand,
                price: parseFloat(price), // Convert price to a number
                type,
                image: image // Save the filename
            });
            await newVehicle.save(); // Save the new vehicle to the database
            // req.flash('success_msg', 'Vehicle added successfully!');
            res.redirect('/admin/vehicles'); // Redirect to admin vehicle list
        } catch (dbErr) {
            console.error(dbErr);
            // If there's a DB error, and an image was uploaded, delete it to prevent orphaned files
            if (req.file) {
                fs.unlink(req.file.path, (unlinkErr) => {
                    if (unlinkErr) console.error('Error deleting uploaded file:', unlinkErr);
                });
            }
            let errorMessage = 'Error saving vehicle.';
            if (dbErr.code === 11000) { // Duplicate key error
                errorMessage = 'A vehicle with this name already exists.';
            } else if (dbErr.errors) {
                 // Mongoose validation errors
                errorMessage = Object.values(dbErr.errors).map(val => val.message).join(', ');
            }
            res.render('admin/vehicles/new', {
                title: 'Admin: Add New Vehicle',
                error: errorMessage,
                vehicle: req.body,
                user: req.user // Pass user object for header partial
            });
        }
    });
});

// GET /admin/vehicles/:id/edit - Show form to edit an existing vehicle (Admin)
router.get('/:id/edit', ensureAdmin, async (req, res) => {
    try {
        const vehicle = await Vehicle.findById(req.params.id); // Find vehicle by ID
        if (!vehicle) {
            // req.flash('error_msg', 'Vehicle not found.');
            return res.redirect('/admin/vehicles');
        }
        res.render('admin/vehicles/edit', {
            title: 'Admin: Edit Vehicle',
            vehicle: vehicle,
            user: req.user // Pass user object for header partial
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// POST /admin/vehicles/:id - Update an existing vehicle (Admin)
// NOTE: For full RESTful API, this would typically be a PUT/PATCH, but for HTML forms, POST is common.
router.post('/:id', ensureAdmin, (req, res) => {
    upload(req, res, async (err) => {
        if (err) {
            const vehicle = await Vehicle.findById(req.params.id); // Fetch original vehicle for re-rendering
            return res.render('admin/vehicles/edit', {
                title: 'Admin: Edit Vehicle',
                error: err,
                vehicle: vehicle || req.body, // Pass back existing vehicle or form data
                user: req.user // Pass user object for header partial
            });
        }

        const { name, brand, price, type } = req.body;
        let image = req.file ? req.file.filename : req.body.currentImage; // New image or existing one

        // Server-side validation
        if (!name || !brand || !price || !type) {
            const vehicle = await Vehicle.findById(req.params.id);
            return res.render('admin/vehicles/edit', {
                title: 'Admin: Edit Vehicle',
                error: 'All fields are required.',
                vehicle: vehicle || req.body,
                missingFields: { name: !name, brand: !brand, price: !price, type: !type },
                user: req.user // Pass user object for header partial
            });
        }
        if (isNaN(price) || parseFloat(price) < 0) {
            const vehicle = await Vehicle.findById(req.params.id);
            return res.render('admin/vehicles/edit', {
                title: 'Admin: Edit Vehicle',
                error: 'Price must be a valid non-negative number.',
                vehicle: vehicle || req.body,
                invalidPrice: true,
                user: req.user // Pass user object for header partial
            });
        }

        try {
            const oldVehicle = await Vehicle.findById(req.params.id);
            if (!oldVehicle) {
                // req.flash('error_msg', 'Vehicle not found.');
                // If a new image was uploaded but vehicle not found, delete it
                if (req.file) {
                    fs.unlink(req.file.path, (unlinkErr) => {
                        if (unlinkErr) console.error('Error deleting uploaded file:', unlinkErr);
                    });
                }
                return res.redirect('/admin/vehicles');
            }

            // If a new image was uploaded AND it's different from the old one, delete the old image
            if (req.file && oldVehicle.image && oldVehicle.image !== 'no-image.jpg') {
                const oldImagePath = path.join(__dirname, '../../public/uploads', oldVehicle.image);
                if (fs.existsSync(oldImagePath)) {
                    fs.unlink(oldImagePath, (unlinkErr) => {
                        if (unlinkErr) console.error('Error deleting old image:', unlinkErr);
                    });
                }
            }

            // Update vehicle data
            oldVehicle.name = name;
            oldVehicle.brand = brand;
            oldVehicle.price = parseFloat(price);
            oldVehicle.type = type;
            oldVehicle.image = image; // Update image field (if new or same as old)

            await oldVehicle.save(); // Save updated vehicle
            // req.flash('success_msg', 'Vehicle updated successfully!');
            res.redirect('/admin/vehicles'); // Redirect to admin vehicle list
        } catch (dbErr) {
            console.error(dbErr);
            // If DB error, and a new image was uploaded, delete it to prevent orphaned files
            if (req.file) {
                fs.unlink(req.file.path, (unlinkErr) => {
                    if (unlinkErr) console.error('Error deleting uploaded file:', unlinkErr);
                });
            }
            let errorMessage = 'Error updating vehicle.';
            if (dbErr.code === 11000) {
                errorMessage = 'A vehicle with this name already exists.';
            } else if (dbErr.errors) {
                errorMessage = Object.values(dbErr.errors).map(val => val.message).join(', ');
            }
            const vehicle = await Vehicle.findById(req.params.id); // Fetch original vehicle for re-rendering
            res.render('admin/vehicles/edit', {
                title: 'Admin: Edit Vehicle',
                error: errorMessage,
                vehicle: vehicle || req.body,
                user: req.user // Pass user object for header partial
            });
        }
    });
});


// POST /admin/vehicles/:id/delete - Delete a vehicle (Admin)
router.post('/:id/delete', ensureAdmin, async (req, res) => {
    try {
        const vehicle = await Vehicle.findById(req.params.id);
        if (!vehicle) {
            // req.flash('error_msg', 'Vehicle not found.');
            return res.redirect('/admin/vehicles');
        }

        // Delete the image file from the server if it's not the default
        if (vehicle.image && vehicle.image !== 'no-image.jpg') {
            const imagePath = path.join(__dirname, '../../public/uploads', vehicle.image);
            if (fs.existsSync(imagePath)) {
                fs.unlink(imagePath, (err) => {
                    if (err) console.error('Error deleting image file:', err);
                });
            }
        }

        await Vehicle.findByIdAndDelete(req.params.id); // Delete vehicle from database
        // req.flash('success_msg', 'Vehicle deleted successfully!');
        res.redirect('/admin/vehicles'); // Redirect to admin vehicle list
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
