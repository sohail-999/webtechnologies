const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const path = require('path');
const session = require('express-session'); // Import express-session
const bcrypt = require('bcryptjs'); // Import bcryptjs

const app = express();
const port = 3000;

// ===========================================
//  In-memory "User Database" (for demonstration)
//  In a real application, you would use a database like MongoDB, PostgreSQL, etc.
const users = []; // Stores objects like { id: '...', username: '...', email: '...', passwordHash: '...' }
// ===========================================

// ===========================================
//  Sample Product Data (for demonstration)
//  In a real application, this would come from a database.
const productList = [
    {
        id: 'p1',
        name: 'Striped Rugby Shirt',
        price: 39.99,
        image: '/images/image1.jpg', // Using existing images as product images
        description: 'Classic striped rugby shirt, perfect for everyday wear. Made from soft, durable cotton.'
    },
    {
        id: 'p2',
        name: 'Casual Green Shirt',
        price: 45.00,
        image: '/images/image2.jpg',
        description: 'Comfortable green and white striped shirt, ideal for a relaxed look.'
    },
    {
        id: 'p3',
        name: 'Red & Blue Cardigan',
        price: 55.50,
        image: '/images/image3.jpg',
        description: 'Stylish striped cardigan with button-down front. Great for layering.'
    },
    {
        id: 'p4',
        name: 'Long Waterproof Coat',
        price: 89.99,
        image: '/images/image4.jpg',
        description: 'Lightweight and waterproof coat, perfect for rainy days. Features a hood and adjustable waist.'
    },
    {
        id: 'p5',
        name: 'Floral Summer Dress',
        price: 62.00,
        image: 'https://placehold.co/300x300/e0e0e0/000?text=Floral+Dress', // Placeholder for new product
        description: 'A beautiful floral dress, perfect for spring and summer outings.'
    },
    {
        id: 'p6',
        name: 'Men\'s Denim Jacket',
        price: 75.00,
        image: 'https://placehold.co/300x300/e0e0e0/000?text=Denim+Jacket', // Placeholder for new product
        description: 'Classic fit denim jacket, a timeless addition to any wardrobe.'
    }
];
// ===========================================

// Middleware setup order is crucial
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// For parsing form data - MUST be before routes that use req.body
app.use(express.urlencoded({ extended: true }));

// Session Middleware - MUST come before any route or middleware that uses req.session
app.use(session({
    secret: 'a_very_long_and_complex_secret_key_for_joules_app_please_change_in_production_e5a2b7c4d9f1e0a9b8c7d6e5f4a3b2c1', // !!! IMPORTANT: Change this to a strong, unique secret key in production !!!
    resave: false,             // Do not save session if unmodified
    saveUninitialized: false,  // Do not create session until something stored
    cookie: { maxAge: 1000 * 60 * 60 * 24 } // 24 hours (1 day)
}));

// Use express-ejs-layouts - MUST come after view engine setup and session, but before routes
app.use(expressLayouts);
app.set('layout', 'layouts/layout'); // Default layout

// Middleware to make user data available to all templates (res.locals)
// This MUST be placed AFTER session middleware and BEFORE your routes
app.use((req, res, next) => {
    // Ensure res.locals.user is always set, even if no user is logged in (it will be null)
    // This prevents "ReferenceError: user is not defined" in EJS templates.
    res.locals.user = req.session && req.session.user ? req.session.user : null;
    console.log('res.locals.user set:', res.locals.user ? res.locals.user.username : 'No user');
    next();
});

// ===========================================
// Routes
// ===========================================

// Home Route
app.get('/', (req, res) => {
    res.render('index', { title: 'Joules - Home' });
});

// Product Route - NOW PASSING PRODUCT DATA
app.get('/product', (req, res) => {
    res.render('product', {
        title: 'Joules - Products',
        products: productList // Pass the productList array to the template
    });
});

// About Route
app.get('/about', (req, res) => {
    res.render('about', { title: 'Joules - About Us' });
});

// Register Page (GET)
app.get('/register', (req, res) => {
    // If user is already logged in, redirect them
    if (req.session.user) {
        return res.redirect('/');
    }
    res.render('register', { title: 'Register', errorMessage: null });
});

// Register Logic (POST)
app.post('/register', async (req, res) => {
    // Destructure all expected fields from req.body
    const { first_name, last_name, email, username, password, confirm_password } = req.body;

    // Basic validation
    if (!first_name || !last_name || !email || !username || !password || !confirm_password) {
        return res.render('register', { title: 'Register', errorMessage: 'All fields are required.' });
    }

    if (password !== confirm_password) {
        return res.render('register', { title: 'Register', errorMessage: 'Passwords do not match.' });
    }

    // Check if username or email already exists
    if (users.find(u => u.username === username)) {
        return res.render('register', { title: 'Register', errorMessage: 'Username already taken.' });
    }
    if (users.find(u => u.email === email)) {
        return res.render('register', { title: 'Register', errorMessage: 'Email already registered.' });
    }

    try {
        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10); // 10 is the salt rounds

        // Store the new user (in a real app, save to database)
        const newUser = {
            id: Date.now().toString(), // Simple unique ID
            first_name: first_name,
            last_name: last_name,
            email: email,
            username: username,
            passwordHash: hashedPassword
        };
        users.push(newUser);
        console.log('New user registered:', newUser.username, 'Email:', newUser.email);

        // Redirect to the login page after successful registration
        req.session.destroy(err => { // Destroy session to prevent accidental login if user already had one
            if (err) {
                console.error('Error destroying session after registration:', err);
            }
            res.clearCookie('connect.sid'); // Clear session cookie
            res.redirect('/login'); // Redirect to login page
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.render('register', { title: 'Register', errorMessage: 'An error occurred during registration. Please try again.' });
    }
});

// Login Page (GET)
app.get('/login', (req, res) => {
    // If user is already logged in, redirect them
    if (req.session.user) {
        return res.redirect('/');
    }
    res.render('login', { title: 'Login', errorMessage: null });
});

// Login Logic (POST)
app.post('/login', async (req, res) => {
    // Use the new input name: username_or_email
    const { username_or_email, password } = req.body;

    if (!username_or_email || !password) {
        return res.render('login', { title: 'Login', errorMessage: 'Please enter both username/email and password.' });
    }

    // Find user by either username or email
    const user = users.find(u => u.username === username_or_email || u.email === username_or_email);

    if (!user) {
        return res.render('login', { title: 'Login', errorMessage: 'Invalid username/email or password.' });
    }

    try {
        // Compare provided password with stored hash
        const isMatch = await bcrypt.compare(password, user.passwordHash);

        if (isMatch) {
            // Store user info in session
            req.session.user = { id: user.id, username: user.username };
            console.log('User logged in:', user.username);
            res.redirect('/'); // Redirect to home page
        } else {
            res.render('login', { title: 'Login', errorMessage: 'Invalid username/email or password.' });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.render('login', { title: 'Login', errorMessage: 'An error occurred during login. Please try again.' });
    }
});

// Logout Route
app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Error destroying session:', err);
            return res.redirect('/'); // Or render an error page
        }
        res.clearCookie('connect.sid'); // Clear the session cookie
        res.redirect('/login'); // Redirect to login page after logout
    });
});


// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
