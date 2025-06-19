const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const flash = require('connect-flash');
const mongoose = require('mongoose');

const app = express();
const port = 3000;

// ===========================================
//  MongoDB Connection
// ===========================================
mongoose.connect('mongodb://localhost:27017/joulesdb')
    .then(() => console.log('MongoDB Connected Successfully!'))
    .catch(err => console.error('MongoDB Connection Error:', err));

// ===========================================
//  Mongoose Schemas and Models
// ===========================================

// Product Schema
const ProductSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true },
    description: { type: String, required: true },
    image: { type: String, required: true }
});

const Product = mongoose.model('Product', ProductSchema);

// Order Schema (NEW)
const OrderSchema = new mongoose.Schema({
    orderId: { type: String, required: true, unique: true },
    userId: { type: String, required: true }, // User ID from in-memory users for now
    userName: { type: String, required: true },
    userEmail: { type: String, required: true },
    userPhone: { type: String },
    userAddress: { type: String },
    items: [ // Array of items in the order
        {
            productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true }, // Referencing Product by _id
            name: { type: String, required: true },
            price: { type: Number, required: true },
            image: { type: String, required: true },
            quantity: { type: Number, required: true }
        }
    ],
    totalPrice: { type: String, required: true }, // Storing as string to match existing usage (toFixed(2))
    status: { type: String, default: 'Pending - Cash on Delivery' },
    orderDate: { type: Date, default: Date.now }
});

const Order = mongoose.model('Order', OrderSchema); // Order Model


// ===========================================
//  In-memory "User Database" (for demonstration)
//  Users remain in-memory for this example.
// ===========================================
const users = [];

// Hardcoded Admin User (for demonstration purposes)
async function createDefaultAdmin() {
    const adminUsername = 'admin';
    const adminEmail = 'admin@example.com';
    const adminPassword = 'adminpassword';

    if (!users.find(u => u.username === adminUsername)) {
        try {
            const hashedPassword = await bcrypt.hash(adminPassword, 10);
            users.push({
                id: Date.now().toString() + '-admin',
                first_name: 'Admin',
                last_name: 'User',
                email: adminEmail,
                username: adminUsername,
                passwordHash: hashedPassword,
                isAdmin: true
            });
            console.log(`Default admin user '${adminUsername}' created.`);
        } catch (error) {
            console.error('Error creating default admin user:', error);
        }
    }
}
createDefaultAdmin();


// ===========================================
// Middleware setup order is crucial
// ===========================================
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'a_very_long_and_complex_secret_key_for_joules_app_please_change_in_production_e5a2b7c4d9f1e0a9b8c7d6e5f4a3b2c1',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 }
}));
app.use(flash());
app.use(expressLayouts);
app.set('layout', 'layouts/layout');

// Middleware to make user data (and cart count) and flash messages available to all templates (res.locals)
app.use((req, res, next) => {
    res.locals.user = req.session && req.session.user ? req.session.user : null;
    res.locals.successMessage = req.flash('success');
    res.locals.errorMessage = req.flash('error');
    console.log('res.locals.user set:', res.locals.user ? res.locals.user.username : 'No user');
    res.locals.cartItemCount = req.session.cart ?
        req.session.cart.reduce((total, item) => total + item.quantity, 0) : 0;
    next();
});

// ===========================================
// Authentication & Authorization Middlewares
// ===========================================
function isAuthenticated(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        req.flash('error', 'Please log in to access this page.');
        res.redirect('/login');
    }
}

function isAdmin(req, res, next) {
    if (req.session.user && req.session.user.isAdmin) {
        next();
    } else {
        req.flash('error', 'You are not authorized to view this page.');
        res.redirect('/');
    }
}


// ===========================================
// Routes
// ===========================================

// Home Route
app.get('/', (req, res) => {
    res.render('index', { title: 'Joules - Home' });
});

// Product Route (User View) - Fetches from MongoDB
app.get('/product', async (req, res) => {
    try {
        const products = await Product.find({});
        res.render('product', {
            title: 'Joules - Products',
            products: products
        });
    } catch (error) {
        console.error('Error fetching products:', error);
        req.flash('error', 'Could not load products. Please try again later.');
        res.render('product', { title: 'Joules - Products', products: [] });
    }
});

// About Route
app.get('/about', (req, res) => {
    res.render('about', { title: 'Joules - About Us' });
});

// Add to Cart Logic - Fetches product details from MongoDB
app.post('/add-to-cart', async (req, res) => {
    const { productId } = req.body;

    try {
        const productToAdd = await Product.findById(productId);

        if (!productToAdd) {
            req.flash('error', 'Product not found.');
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
                productId: productToAdd._id, // Use MongoDB's _id
                name: productToAdd.name,
                price: productToAdd.price,
                image: productToAdd.image,
                quantity: 1
            });
            console.log(`Added ${productToAdd.name} to cart.`);
        }
        req.flash('success', `${productToAdd.name} added to cart!`);
        res.redirect('/product');
    } catch (error) {
        console.error('Error adding to cart:', error);
        req.flash('error', 'An error occurred while adding to cart.');
        res.redirect('/product');
    }
});


// Cart View Page Route - PROTECTED
app.get('/cart', isAuthenticated, (req, res) => {
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
app.post('/update-cart-item', isAuthenticated, (req, res) => {
    const { productId, quantity } = req.body;
    const newQuantity = parseInt(quantity, 10);
    let cart = req.session.cart || [];

    const itemIndex = cart.findIndex(item => item.productId === productId);

    if (itemIndex > -1) {
        if (newQuantity > 0) {
            cart[itemIndex].quantity = newQuantity;
            req.flash('success', `Quantity for ${cart[itemIndex].name} updated to ${newQuantity}.`);
            console.log(`Updated quantity for ${cart[itemIndex].name} to ${newQuantity}`);
        } else {
            req.flash('success', `${cart[itemIndex].name} removed from cart.`);
            cart.splice(itemIndex, 1);
            console.log(`Removed ${cart[itemIndex].name} from cart (quantity 0).`);
        }
    } else {
        req.flash('error', 'Item not found in cart.');
    }

    req.session.cart = cart;
    res.redirect('/cart');
});

// Remove Item from Cart - PROTECTED
app.post('/remove-from-cart', isAuthenticated, (req, res) => {
    const { productId } = req.body;
    let cart = req.session.cart || [];

    const initialLength = cart.length;
    const removedItem = cart.find(item => item.productId === productId);
    req.session.cart = cart.filter(item => item.productId !== productId);

    if (req.session.cart.length < initialLength) {
        req.flash('success', `${removedItem ? removedItem.name : 'Item'} removed from cart.`);
        console.log(`Removed product ID ${productId} from cart.`);
    } else {
        req.flash('error', 'Item not found in cart for removal.');
        console.log(`Product ID ${productId} not found in cart for removal.`);
    }

    res.redirect('/cart');
});

// Checkout Page Route - PROTECTED - NOW SAVES ORDER TO MONGODB
app.get('/checkout', isAuthenticated, (req, res) => {
    const cart = req.session.cart || [];
    let cartTotal = 0;

    cart.forEach(item => {
        cartTotal += item.price * item.quantity;
    });

    if (cart.length === 0) {
        req.flash('error', 'Your cart is empty. Please add items before checking out.');
        return res.redirect('/product');
    }

    const userDetails = req.session.user ? {
        name: `${req.session.user.first_name || ''} ${req.session.user.last_name || ''}`.trim(),
        email: req.session.user.email || '',
        phone: '',
        address: ''
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

// Handle Checkout Form Submission - Place Order (Pay Later with Cash) - NOW SAVES TO MONGODB
app.post('/checkout', isAuthenticated, async (req, res) => {
    const { full_name, email, phone, address } = req.body;
    const cart = req.session.cart || [];
    let cartTotal = 0;

    cart.forEach(item => {
        cartTotal += item.price * item.quantity;
    });

    if (cart.length === 0) {
        req.flash('error', 'Your cart is empty. Cannot place an empty order.');
        return res.redirect('/product');
    }

    if (!full_name || !email || !phone || !address) {
        req.flash('error', 'Please fill in all shipping information fields.');
        return res.render('checkout', {
            title: 'Checkout',
            cart: cart,
            cartTotal: cartTotal.toFixed(2),
            userDetails: { name: full_name, email: email, phone: phone, address: address },
        });
    }

    try {
        const orderId = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        
        // Map cart items to match the OrderSchema's items structure
        const orderItems = cart.map(item => ({
            productId: item.productId, // Use the MongoDB _id from the cart item
            name: item.name,
            price: item.price,
            image: item.image,
            quantity: item.quantity
        }));

        const newOrder = new Order({ // Create a new Mongoose Order instance
            orderId: orderId,
            userId: req.session.user ? req.session.user.id : 'guest',
            userName: full_name,
            userEmail: email,
            userPhone: phone,
            userAddress: address,
            items: orderItems,
            totalPrice: cartTotal.toFixed(2),
            status: 'Pending - Cash on Delivery', // Default status
            orderDate: new Date()
        });

        await newOrder.save(); // Save the new order to MongoDB
        console.log('Order placed successfully:', newOrder);

        req.session.cart = []; // Clear cart only after successful order save
        console.log('Cart cleared for session.');

        req.flash('success', `Your order #${orderId} has been placed successfully!`);
        res.redirect(`/order-confirmation?orderId=${orderId}`);
    } catch (error) {
        console.error('Error placing order:', error);
        req.flash('error', 'An error occurred while placing your order. Please try again.');
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

// My Orders Page Route - PROTECTED - NOW FETCHES FROM MONGODB
app.get('/my-orders', isAuthenticated, async (req, res) => {
    const userId = req.session.user.id;
    try {
        // Fetch orders from MongoDB where userId matches
        const userOrders = await Order.find({ userId: userId }).sort({ orderDate: -1 }); // Sort by newest first
        res.render('my-orders', {
            title: 'My Orders',
            orders: userOrders
        });
    } catch (error) {
        console.error('Error fetching user orders:', error);
        req.flash('error', 'Could not load your orders. Please try again.');
        res.render('my-orders', { title: 'My Orders', orders: [] });
    }
});

// Admin Dashboard Route - PROTECTED BY ADMIN MIDDLEWARE
app.get('/admin/dashboard', isAuthenticated, isAdmin, (req, res) => {
    res.render('admin/dashboard', {
        title: 'Admin Dashboard',
        allUsers: users, // Users still in-memory
        // We'll fetch orders for the dedicated admin/orders page
        allOrders: [] // No need to fetch all orders here directly, as it's for a separate page
    });
});

// ===========================================
// Product Management Routes (Admin Only) - Using MongoDB
// ===========================================

// 1. List Products (Admin)
app.get('/admin/products', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const products = await Product.find({});
        res.render('admin/product_list', {
            title: 'Admin Product List',
            products: products
        });
    } catch (error) {
        console.error('Error fetching products for admin:', error);
        req.flash('error', 'Could not load products for admin. Please try again.');
        res.redirect('/admin/dashboard');
    }
});

// 2. Add Product (GET - Display Form)
app.get('/admin/products/add', isAuthenticated, isAdmin, (req, res) => {
    res.render('admin/product_form', {
        title: 'Add New Product',
        product: null
    });
});

// 3. Add Product (POST - Handle Form Submission)
app.post('/admin/products/add', isAuthenticated, isAdmin, async (req, res) => {
    const { name, price, description, image } = req.body;

    if (!name || !price || !description || !image) {
        req.flash('error', 'All product fields are required.');
        return res.render('admin/product_form', { title: 'Add New Product', product: null });
    }

    try {
        const newProduct = new Product({
            name,
            price: parseFloat(price),
            description,
            image
        });
        await newProduct.save();
        req.flash('success', `Product "${newProduct.name}" added successfully!`);
        res.redirect('/admin/products');
    } catch (error) {
        console.error('Error adding product:', error);
        req.flash('error', 'An error occurred while adding the product.');
        res.render('admin/product_form', { title: 'Add New Product', product: req.body });
    }
});

// 4. Edit Product (GET - Display Form with existing data)
app.get('/admin/products/edit/:id', isAuthenticated, isAdmin, async (req, res) => {
    const productId = req.params.id;
    try {
        const productToEdit = await Product.findById(productId);

        if (!productToEdit) {
            req.flash('error', 'Product not found for editing.');
            return res.redirect('/admin/products');
        }

        res.render('admin/product_form', {
            title: `Edit Product: ${productToEdit.name}`,
            product: productToEdit
        });
    } catch (error) {
        console.error('Error fetching product for edit:', error);
        req.flash('error', 'An error occurred while fetching the product for editing.');
        res.redirect('/admin/products');
    }
});

// 5. Edit Product (POST - Handle Form Submission)
app.post('/admin/products/edit/:id', isAuthenticated, isAdmin, async (req, res) => {
    const productId = req.params.id;
    const { name, price, description, image } = req.body;

    if (!name || !price || !description || !image) {
        req.flash('error', 'All product fields are required for update.');
        const product = await Product.findById(productId).catch(() => null);
        return res.render('admin/product_form', { title: 'Edit Product', product: product || req.body });
    }

    try {
        const updatedProduct = await Product.findByIdAndUpdate(productId, {
            name,
            price: parseFloat(price),
            description,
            image
        }, { new: true });

        if (!updatedProduct) {
            req.flash('error', 'Product not found for updating.');
            return res.redirect('/admin/products');
        }

        req.flash('success', `Product "${updatedProduct.name}" updated successfully!`);
        res.redirect('/admin/products');
    } catch (error) {
        console.error('Error updating product:', error);
        req.flash('error', 'An error occurred while updating the product.');
        res.redirect('/admin/products');
    }
});

// 6. Delete Product (POST - Handle Deletion)
app.post('/admin/products/delete/:id', isAuthenticated, isAdmin, async (req, res) => {
    const productId = req.params.id;
    try {
        const deletedProduct = await Product.findByIdAndDelete(productId);

        if (!deletedProduct) {
            req.flash('error', 'Product not found for deletion.');
        } else {
            req.flash('success', `Product "${deletedProduct.name}" deleted successfully!`);
        }
        res.redirect('/admin/products');
    } catch (error) {
        console.error('Error deleting product:', error);
        req.flash('error', 'An error occurred while deleting the product.');
        res.redirect('/admin/products');
    }
});

// ===========================================
// NEW: Admin Order Management Routes
// ===========================================

// 1. List All Orders (Admin)
app.get('/admin/orders', isAuthenticated, isAdmin, async (req, res) => {
    try {
        // Populate 'items.productId' to get product details in the order
        const allOrders = await Order.find({}).sort({ orderDate: -1 });
        res.render('admin/order_list', {
            title: 'Manage Orders',
            orders: allOrders
        });
    } catch (error) {
        console.error('Error fetching all orders for admin:', error);
        req.flash('error', 'Could not load orders for admin. Please try again.');
        res.redirect('/admin/dashboard');
    }
});

// 2. Mark Order as Completed (Admin) - Optional functionality
app.post('/admin/orders/complete/:id', isAuthenticated, isAdmin, async (req, res) => {
    const orderId = req.params.id;
    try {
        const updatedOrder = await Order.findByIdAndUpdate(orderId, { status: 'Completed' }, { new: true });

        if (!updatedOrder) {
            req.flash('error', 'Order not found for completion.');
        } else {
            req.flash('success', `Order #${updatedOrder.orderId} marked as Completed.`);
        }
        res.redirect('/admin/orders');
    } catch (error) {
        console.error('Error marking order as completed:', error);
        req.flash('error', 'An error occurred while marking the order as completed.');
        res.redirect('/admin/orders');
    }
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
        req.flash('error', 'All fields are required.');
        return res.render('register', { title: 'Register', errorMessage: null });
    }

    if (password !== confirm_password) {
        req.flash('error', 'Passwords do not match.');
        return res.render('register', { title: 'Register', errorMessage: null });
    }

    if (users.find(u => u.username === username)) {
        req.flash('error', 'Username already taken.');
        return res.render('register', { title: 'Register', errorMessage: null });
    }
    if (users.find(u => u.email === email)) {
        req.flash('error', 'Email already registered.');
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
            passwordHash: hashedPassword,
            isAdmin: false // IMPORTANT: New users are NOT admins by default
        };
        users.push(newUser);
        console.log('New user registered:', newUser.username, 'Email:', newUser.email);
        req.flash('success', 'Registration successful! Please log in.');

        req.session.destroy(err => {
            if (err) {
                console.error('Error destroying session after registration:', err);
                req.flash('error', 'Error during registration redirect.');
            }
            res.clearCookie('connect.sid');
            res.redirect('/login');
        });

    } catch (error) {
        console.error('Registration error:', error);
        req.flash('error', 'An error occurred during registration. Please try again.');
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
        req.flash('error', 'Please enter both username/email and password.');
        return res.render('login', { title: 'Login', errorMessage: null });
    }

    const user = users.find(u => u.username === username_or_email || u.email === username_or_email);

    if (!user) {
        req.flash('error', 'Invalid username/email or password.');
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
                isAdmin: user.isAdmin || false
            };
            console.log('User logged in:', user.username, 'Is Admin:', req.session.user.isAdmin);
            req.flash('success', `Welcome back, ${user.username}!`);
            res.redirect('/');
        } else {
            req.flash('error', 'Invalid username/email or password.');
            res.render('login', { title: 'Login', errorMessage: null });
        }
    } catch (error) {
        console.error('Login error:', error);
        req.flash('error', 'An error occurred during login. Please try again.');
        res.render('login', { title: 'Login', errorMessage: null });
    }
});

// Logout Route
app.get('/logout', (req, res) => {
    console.log('Logout initiated for user:', req.session.user ? req.session.user.username : 'guest');
    res.clearCookie('connect.sid');
    if (req.session) {
        req.flash('success', 'You have been logged out.');
        req.session.destroy(err => {
            if (err) {
                console.error('Error destroying session:', err);
                req.flash('error', 'An error occurred during logout. Please try again.');
            }
            console.log('Session destruction attempted. Redirecting to /login.');
            res.redirect('/login');
        });
    } else {
        console.log('No active session found to destroy. Redirecting to /login.');
        res.redirect('/login');
    }
});


// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
