// routes/public/vehicles.js

const express = require('express');
const router = express.Router();
const Vehicle = require('../../models/vehicle'); // Import the Vehicle model

// GET /vehicles - Show all vehicles (Public, read-only)
router.get('/', async (req, res) => {
    try {
        const vehicles = await Vehicle.find({}); // Fetch all vehicles from the database
        res.render('vehicles/index', {
            title: 'Our Vehicles',
            vehicles: vehicles
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
