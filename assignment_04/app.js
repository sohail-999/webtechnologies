const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcryptjs');

const app = express();
const port = 3000;

// ===========================================
//  In-memory "User Database" (for demonstration)
//  In a real application, you would use a database like MongoDB, PostgreSQL, etc.
//  For a real MongoDB integration, you'd use a driver like 'mongoose' here.
const users = []; // Stores objects like { id, username, email, first_name, last_name, passwordHash }
const orders = []; // Simulates a MongoDB 'orders' collection. Stores order objects.
// ===========================================

// ===========================================
//  Sample Product Data (for demonstration)
// ===========================================
const productList = [
    {
        id: 'p1',
        name: 'Striped Rugby Shirt',
        price: 39.99,
        image: '/images/image1.jpg',
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
        image: 'https://placehold.co/300x300/e0e0e0/000?text=Floral+Dress',
        description: 'A beautiful floral dress, perfect for spring and summer outings.'
    },
    {
        id: 'p6',
        name: 'Men\'s Denim Jacket',
        price: 75.00,
        image: 'https://placehold.co/300x300/e0e0e0/000?text=Denim+Jacket',
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
    secret: 'a_very_long_and_complex_secret_key_for_joules_app_please_change_in_production_e5a2b7c4d9f1e0a9b8c7d6e5f4a3b2c1',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 } // 24 hours (1 day)
}));

// Use express-ejs-layouts - MUST come after view engine setup and session, but before routes
app.use(expressLayouts);
app.set('layout', 'layouts/layout'); // Default layout

// Middleware to make user data (and cart count) available to all templates (res.locals)
// This MUST be placed AFTER session middleware and BEFORE your routes
app.use((req, res, next) => {
    res.locals.user = req.session && req.session.user ? req.session.user : null;
    // Add success/error messages to res.locals for EJS templates
    res.locals.successMessage = req.session.successMessage;
    res.locals.errorMessage = req.session.errorMessage;
    // Clear them immediately after use
    delete req.session.successMessage;
    delete req.session.errorMessage;

    console.log('res.locals.user set:', res.locals.user ? res.locals.user.username : 'No user');

    // Calculate cart item count for display in header
    res.locals.cartItemCount = req.session.cart ?
        req.session.cart.reduce((total, item) => total + item.quantity, 0) : 0;

    next();
});

// ===========================================
// Authentication Middleware
// ===========================================
function isAuthenticated(req, res, next) {
    if (req.session.user) {
        // User is authenticated, proceed to the next middleware/route handler
        next();
    } else {
        // User is not authenticated, redirect to login page with an error message
        req.session.errorMessage = 'Please log in to access this page.';
        res.redirect('/login');
    }
}


// ===========================================
// Routes
// ===========================================

// Home Route
app.get('/', (req, res) => {
    res.render('index', { title: 'Joules - Home' });
});

// Product Route
app.get('/product', (req, res) => {
    res.render('product', {
        title: 'Joules - Products',
        products: productList
    });
});

// About Route
app.get('/about', (req, res) => {
    res.render('about', { title: 'Joules - About Us' });
});

// Add to Cart Logic
app.post('/add-to-cart', (req, res) => {
    const { productId } = req.body;

    const productToAdd = productList.find(p => p.id === productId);

    if (!productToAdd) {
        req.session.errorMessage = 'Product not found.';
        return res.redirect('/product');
    }

    if (!req.session.cart) {
        req.session.cart = [];
    }

    const existingCartItem = req.session.cart.find(item => item.productId === productId);

    if (existingCartItem) {
        existingCartItem.quantity += 1;
        console.log(`Increased quantity for ${productToAdd.name}. New quantity: ${existingCartItem.quantity}`);
    } else {
        req.session.cart.push({
            productId: productToAdd.id,
            name: productToAdd.name,
            price: productToAdd.price,
            image: productToAdd.image,
            quantity: 1
        });
        console.log(`Added ${productToAdd.name} to cart.`);
    }
    req.session.successMessage = `${productToAdd.name} added to cart!`;
    res.redirect('/product');
});


// Cart View Page Route - PROTECTED
app.get('/cart', isAuthenticated, (req, res) => { // Apply isAuthenticated middleware
    const cart = req.session.cart || [];
    let cartTotal = 0;

    cart.forEach(item => {
        cartTotal += item.price * item.quantity;
    });

    res.render('cart', {
        title: 'Your Shopping Cart',
        cart: cart,
        cartTotal: cartTotal.toFixed(2)
    });
});

// Update Cart Item Quantity - PROTECTED
app.post('/update-cart-item', isAuthenticated, (req, res) => { // Apply isAuthenticated middleware
    const { productId, quantity } = req.body;
    const newQuantity = parseInt(quantity, 10);
    let cart = req.session.cart || [];

    const itemIndex = cart.findIndex(item => item.productId === productId);

    if (itemIndex > -1) {
        if (newQuantity > 0) {
            cart[itemIndex].quantity = newQuantity;
            req.session.successMessage = `Quantity for ${cart[itemIndex].name} updated to ${newQuantity}.`;
            console.log(`Updated quantity for ${cart[itemIndex].name} to ${newQuantity}`);
        } else {
            req.session.successMessage = `${cart[itemIndex].name} removed from cart.`;
            cart.splice(itemIndex, 1);
            console.log(`Removed ${cart[itemIndex].name} from cart (quantity 0).`);
        }
    } else {
        req.session.errorMessage = 'Item not found in cart.';
    }

    req.session.cart = cart;
    res.redirect('/cart');
});

// Remove Item from Cart - PROTECTED
app.post('/remove-from-cart', isAuthenticated, (req, res) => { // Apply isAuthenticated middleware
    const { productId } = req.body;
    let cart = req.session.cart || [];

    const initialLength = cart.length;
    const removedItem = cart.find(item => item.productId === productId);
    req.session.cart = cart.filter(item => item.productId !== productId);

    if (req.session.cart.length < initialLength) {
        req.session.successMessage = `${removedItem ? removedItem.name : 'Item'} removed from cart.`;
        console.log(`Removed product ID ${productId} from cart.`);
    } else {
        req.session.errorMessage = 'Item not found in cart for removal.';
        console.log(`Product ID ${productId} not found in cart for removal.`);
    }

    res.redirect('/cart');
});

// Checkout Page Route - PROTECTED
app.get('/checkout', isAuthenticated, (req, res) => { // Apply isAuthenticated middleware
    const cart = req.session.cart || [];
    let cartTotal = 0;

    cart.forEach(item => {
        cartTotal += item.price * item.quantity;
    });

    if (cart.length === 0) {
        req.session.errorMessage = 'Your cart is empty. Please add items before checking out.';
        return res.redirect('/product');
    }

    // Pre-fill user details if logged in
    const userDetails = req.session.user ? {
        name: `${req.session.user.first_name || ''} ${req.session.user.last_name || ''}`.trim(),
        email: req.session.user.email || '',
        phone: '', // Placeholder, would come from user profile in a real app
        address: '' // Placeholder, would come from user profile in a real app
    } : {
        name: '',
        email: '',
        phone: '',
        address: ''
    };


    res.render('checkout', {
        title: 'Checkout',
        cart: cart,
        cartTotal: cartTotal.toFixed(2),
        userDetails: userDetails,
    });
});

// Handle Checkout Form Submission - Place Order (Pay Later with Cash) - PROTECTED
app.post('/checkout', isAuthenticated, (req, res) => { // Apply isAuthenticated middleware
    const { full_name, email, phone, address } = req.body;
    const cart = req.session.cart || [];
    let cartTotal = 0;

    cart.forEach(item => {
        cartTotal += item.price * item.quantity;
    });

    if (cart.length === 0) {
        req.session.errorMessage = 'Your cart is empty. Cannot place an empty order.';
        return res.redirect('/product');
    }

    if (!full_name || !email || !phone || !address) {
        req.session.errorMessage = 'Please fill in all shipping information fields.';
        // Re-render checkout with error and pre-filled data
        return res.render('checkout', {
            title: 'Checkout',
            cart: cart,
            cartTotal: cartTotal.toFixed(2),
            userDetails: { name: full_name, email: email, phone: phone, address: address },
        });
    }

    try {
        const orderId = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const newOrder = {
            orderId: orderId,
            userId: req.session.user ? req.session.user.id : 'guest',
            userName: full_name,
            userEmail: email,
            userPhone: phone,
            userAddress: address,
            items: cart,
            totalPrice: cartTotal.toFixed(2),
            status: 'Pending - Cash on Delivery',
            orderDate: new Date().toISOString()
        };

        orders.push(newOrder);
        console.log('Order placed successfully:', newOrder);

        req.session.cart = [];
        console.log('Cart cleared for session.');

        req.session.successMessage = `Your order #${orderId} has been placed successfully!`;
        res.redirect(`/order-confirmation?orderId=${orderId}`);
    } catch (error) {
        console.error('Error placing order:', error);
        req.session.errorMessage = 'An error occurred while placing your order. Please try again.';
        res.redirect('/checkout');
    }
});

// Order Confirmation Page
app.get('/order-confirmation', (req, res) => {
    const orderId = req.query.orderId || 'N/A';
    res.render('order-confirmation', {
        title: 'Order Confirmation',
        orderId: orderId,
    });
});


// Register Page (GET)
app.get('/register', (req, res) => {
    if (req.session.user) {
        return res.redirect('/');
    }
    res.render('register', { title: 'Register', errorMessage: null });
});

// Register Logic (POST)
app.post('/register', async (req, res) => {
    const { first_name, last_name, email, username, password, confirm_password } = req.body;

    if (!first_name || !last_name || !email || !username || !password || !confirm_password) {
        req.session.errorMessage = 'All fields are required.';
        return res.render('register', { title: 'Register', errorMessage: null });
    }

    if (password !== confirm_password) {
        req.session.errorMessage = 'Passwords do not match.';
        return res.render('register', { title: 'Register', errorMessage: null });
    }

    if (users.find(u => u.username === username)) {
        req.session.errorMessage = 'Username already taken.';
        return res.render('register', { title: 'Register', errorMessage: null });
    }
    if (users.find(u => u.email === email)) {
        req.session.errorMessage = 'Email already registered.';
        return res.render('register', { title: 'Register', errorMessage: null });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = {
            id: Date.now().toString(),
            first_name: first_name,
            last_name: last_name,
            email: email,
            username: username,
            passwordHash: hashedPassword
        };
        users.push(newUser);
        console.log('New user registered:', newUser.username, 'Email:', newUser.email);
        req.session.successMessage = 'Registration successful! Please log in.';

        req.session.destroy(err => {
            if (err) {
                console.error('Error destroying session after registration:', err);
                req.session.errorMessage = 'Error during registration redirect.';
                return res.redirect('/register');
            }
            res.clearCookie('connect.sid');
            res.redirect('/login');
        });

    } catch (error) {
        console.error('Registration error:', error);
        req.session.errorMessage = 'An error occurred during registration. Please try again.';
        res.render('register', { title: 'Register', errorMessage: null });
    }
});

// Login Page (GET)
app.get('/login', (req, res) => {
    if (req.session.user) {
        return res.redirect('/');
    }
    res.render('login', { title: 'Login', errorMessage: null });
});

// Login Logic (POST)
app.post('/login', async (req, res) => {
    const { username_or_email, password } = req.body;

    if (!username_or_email || !password) {
        req.session.errorMessage = 'Please enter both username/email and password.';
        return res.render('login', { title: 'Login', errorMessage: null });
    }

    const user = users.find(u => u.username === username_or_email || u.email === username_or_email);

    if (!user) {
        req.session.errorMessage = 'Invalid username/email or password.';
        return res.render('login', { title: 'Login', errorMessage: null });
    }

    try {
        const isMatch = await bcrypt.compare(password, user.passwordHash);

        if (isMatch) {
            req.session.user = {
                id: user.id,
                username: user.username,
                first_name: user.first_name,
                last_name: user.last_name,
                email: user.email,
            };
            console.log('User logged in:', user.username);
            req.session.successMessage = `Welcome back, ${user.username}!`;
            res.redirect('/');
        } else {
            req.session.errorMessage = 'Invalid username/email or password.';
            res.render('login', { title: 'Login', errorMessage: null });
        }
    } catch (error) {
        console.error('Login error:', error);
        req.session.errorMessage = 'An error occurred during login. Please try again.';
        res.render('login', { title: 'Login', errorMessage: null });
    }
});

// Logout Route (Final Robust Fix for Redirect and TypeError)
app.get('/logout', (req, res) => {
    console.log('Logout initiated for user:', req.session.user ? req.session.user.username : 'guest');

    // Set success message BEFORE calling destroy(), if a session exists
    if (req.session) {
        req.session.successMessage = 'You have been logged out.';
    }

    // Now, proceed with session destruction or direct redirect if no session
    if (req.session) {
        req.session.destroy(err => {
            if (err) {
                console.error('Error destroying session:', err);
                // If an error occurs during destroy, set error message.
                // Note: Setting req.session.errorMessage *here* might still be problematic if the session is truly gone.
                // A dedicated flash library is best for this, but for now, we ensure a redirect.
                req.session.errorMessage = 'An error occurred during logout. Please try again.';
            }
            // Always clear the cookie and redirect to login, regardless of destroy success/failure
            res.clearCookie('connect.sid');
            console.log('Session destruction attempted. Redirecting to /login.');
            res.redirect('/login');
        });
    } else {
        // No session to destroy (already logged out or session expired)
        res.clearCookie('connect.sid'); // Just ensure the cookie is cleared
        console.log('No active session found to destroy. Redirecting to /login.');
        // No req.session to set successMessage on here, so it won't show.
        // This is the limitation without `connect-flash`.
        res.redirect('/login');
    }
});


// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
