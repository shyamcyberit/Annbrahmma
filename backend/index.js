require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bcrypt = require('bcryptjs'); // For password hashing - kept for future use, not currently used for plaintext

const app = express();
const PORT = process.env.PORT || 5000;
// Define the host to listen on. '0.0.0.0' makes it accessible from any IP on the network.
const HOST = '0.0.0.0'; 

// Middleware
app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Parse JSON request bodies

// PostgreSQL Connection Pool
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

pool.connect()
    .then(() => console.log('Connected to PostgreSQL database'))
    .catch(err => console.error('Database connection error', err.stack));

// Basic Route
app.get('/', (req, res) => {
    res.send('Canteen App Backend is running!');
});

// --- API Routes ---

// 1. User/Customer Routes

// Get all meal types
app.get('/api/meal-types', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM meal_types ORDER BY id');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get menu items by meal type
app.get('/api/menu/:mealTypeId', async (req, res) => {
    const { mealTypeId } = req.params;
    try {
        const result = await pool.query(
            'SELECT * FROM menu_items WHERE meal_type_id = $1 AND is_available = TRUE ORDER BY name',
            [mealTypeId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Place a new order
app.post('/api/orders', async (req, res) => {
    const { customerName, items } = req.body; // items is an array [{ menuItemId, quantity }]
    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN'); // Start transaction

        let totalAmount = 0;
        const processedItems = []; // Store items with their details for later insertion and response

        for (const item of items) {
            const menuItemResult = await client.query(
                'SELECT id, name, price FROM menu_items WHERE id = $1', // Also fetch name
                [item.menuItemId]
            );
            if (menuItemResult.rows.length === 0) {
                throw new Error(`Menu item with ID ${item.menuItemId} not found.`);
            }
            const { id: menuItem_id, name: item_name, price: rawPrice } = menuItemResult.rows[0];
            const price = parseFloat(rawPrice);
            const itemTotal = price * item.quantity;
            totalAmount += itemTotal;
            processedItems.push({ menuItem_id, item_name, quantity: item.quantity, priceAtOrder: price });
        }

        const orderResult = await client.query(
            'INSERT INTO orders (customer_name, total_amount, status) VALUES ($1, $2, $3) RETURNING id, order_date, status',
            [customerName, totalAmount, 'Pending']
        );
        const orderId = orderResult.rows[0].id;
        const orderDate = orderResult.rows[0].order_date;
        const orderStatus = orderResult.rows[0].status;

        for (const item of processedItems) { // Use processedItems here
            await client.query(
                'INSERT INTO order_items (order_id, menu_item_id, quantity, price_at_order) VALUES ($1, $2, $3, $4)',
                [orderId, item.menuItem_id, item.quantity, item.priceAtOrder]
            );
        }

        await client.query('COMMIT'); // Commit transaction

        // Fetch the inserted order_items with their names for the receipt
        const itemsResult = await pool.query( // Using pool directly as transaction is committed
            'SELECT oi.quantity, oi.price_at_order, mi.name AS item_name, mi.id AS menu_item_id FROM order_items oi JOIN menu_items mi ON oi.menu_item_id = mi.id WHERE oi.order_id = $1',
            [orderId]
        );
        const orderedItemsForReceipt = itemsResult.rows;

        res.status(201).json({
            message: 'Order placed successfully',
            id: orderId, // Use 'id' to be consistent with GET /orders/:orderId response
            customer_name: customerName,
            total_amount: totalAmount,
            order_date: orderDate,
            status: orderStatus,
            items: orderedItemsForReceipt // Include the fetched items here
        });

    } catch (err) {
        if (client) await client.query('ROLLBACK'); // Rollback transaction on error
        console.error('Error placing order:', err);
        res.status(500).json({ error: 'Failed to place order', details: err.message });
    } finally {
        if (client) client.release();
    }
});

// Get order details by ID (for user to view/print receipt)
app.get('/api/orders/:orderId', async (req, res) => {
    const { orderId } = req.params;
    try {
        const orderResult = await pool.query(
            'SELECT * FROM orders WHERE id = $1',
            [orderId]
        );
        if (orderResult.rows.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }
        const order = orderResult.rows[0];

        const itemsResult = await pool.query(
            'SELECT oi.quantity, oi.price_at_order, mi.name AS item_name, mi.id AS menu_item_id FROM order_items oi JOIN menu_items mi ON oi.menu_item_id = mi.id WHERE oi.order_id = $1',
            [orderId]
        );
        order.items = itemsResult.rows;

        res.json(order);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update an existing order
app.put('/api/orders/:orderId', async (req, res) => {
    const { orderId } = req.params;
    const { customerName, items } = req.body;
    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN'); // Start transaction

        // First, check if the order exists and its status allows modification
        const orderCheck = await client.query('SELECT status FROM orders WHERE id = $1', [orderId]);
        if (orderCheck.rows.length === 0) {
            throw new Error('Order not found.');
        }
        const currentStatus = orderCheck.rows[0].status;
        // For simplicity, allowing update always for now. In production, add status-based restrictions.
        // if (currentStatus !== 'Pending') {
        //      throw new Error(`Order cannot be modified as its status is '${currentStatus}'.`);
        // }

        // Delete existing order items
        await client.query('DELETE FROM order_items WHERE order_id = $1', [orderId]);

        let totalAmount = 0;
        const newOrderItemsData = [];

        for (const item of items) {
            const menuItemResult = await client.query(
                'SELECT id, name, price FROM menu_items WHERE id = $1', // Also fetch name
                [item.menuItemId]
            );
            if (menuItemResult.rows.length === 0) {
                throw new Error(`Menu item with ID ${item.menuItemId} not found.`);
            }
            const { id: menuItem_id, name: item_name, price: rawPrice } = menuItemResult.rows[0];
            const price = parseFloat(rawPrice);
            const itemTotal = price * item.quantity;
            totalAmount += itemTotal;
            newOrderItemsData.push({ menuItem_id, item_name, quantity: item.quantity, priceAtOrder: price });
        }

        // Update order details
        const updateOrderResult = await client.query(
            'UPDATE orders SET customer_name = $1, total_amount = $2, order_date = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
            [customerName, totalAmount, orderId]
        );
        const updatedOrder = updateOrderResult.rows[0];

        // Insert new order items
        for (const item of newOrderItemsData) {
            await client.query(
                'INSERT INTO order_items (order_id, menu_item_id, quantity, price_at_order) VALUES ($1, $2, $3, $4)',
                [orderId, item.menuItem_id, item.quantity, item.priceAtOrder]
            );
        }

        await client.query('COMMIT'); // Commit transaction

        // Fetch the updated order_items with their names for the receipt
        const itemsResult = await pool.query( // Using pool directly as transaction is committed
            'SELECT oi.quantity, oi.price_at_order, mi.name AS item_name, mi.id AS menu_item_id FROM order_items oi JOIN menu_items mi ON oi.menu_item_id = mi.id WHERE oi.order_id = $1',
            [orderId]
        );
        updatedOrder.items = itemsResult.rows; // Add items to the updated order object

        res.json({
            message: 'Order updated successfully',
            order: updatedOrder // Send the full updated order object including items
        });

    } catch (err) {
        if (client) await client.query('ROLLBACK'); // Rollback transaction on error
        console.error('Error updating order:', err);
        res.status(500).json({ error: 'Failed to update order', details: err.message });
    } finally {
        if (client) client.release();
    }
});


// 2. Admin Routes (Authentication middleware needed for production)

// Simple admin login (for quick start, improve with JWT in production)
app.post('/api/admin/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const userResult = await pool.query('SELECT * FROM users WHERE username = $1 AND role = $2', [username, 'admin']);
        if (userResult.rows.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        const user = userResult.rows[0];

        // DANGER: Plaintext password comparison for quick local development.
        // In production, user.password MUST be a hashed password and compared with bcrypt.compare.
        const isMatch = (password === user.password);

        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        // In a real app, generate and send a JWT token here
        res.json({ message: 'Admin login successful', user: { id: user.id, username: user.username, role: user.role } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Middleware to check if user is admin (very basic for now)
const isAdmin = (req, res, next) => {
    // In a real app, you'd check a JWT token for the user's role
    // For now, we'll assume the client handles sending 'admin' role, or
    // we'll implement a simple session/token later if needed.
    // For initial testing, we'll bypass this or expect a dummy header.
    // This needs to be robust in a production system.
    // For now, we'll assume if an admin route is hit, it's by an admin after a successful login (for dev).
    next(); // Bypass for quick dev, implement proper auth later.
};


// Admin: Add new menu item
app.post('/api/admin/menu-items', isAdmin, async (req, res) => {
    const { name, price, mealTypeId, isAvailable } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO menu_items (name, price, meal_type_id, is_available) VALUES ($1, $2, $3, $4) RETURNING *',
            [name, price, mealTypeId, isAvailable]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Admin: Update menu item
app.put('/api/admin/menu-items/:id', isAdmin, async (req, res) => {
    const { id } = req.params;
    const { name, price, mealTypeId, isAvailable } = req.body;
    try {
        const result = await pool.query(
            'UPDATE menu_items SET name = $1, price = $2, meal_type_id = $3, is_available = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5 RETURNING *',
            [name, price, mealTypeId, isAvailable, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Menu item not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Admin: Delete menu item
app.delete('/api/admin/menu-items/:id', isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM menu_items WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Menu item not found' });
        }
        res.status(204).send(); // No content
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Admin: Get all menu items (for admin view)
app.get('/api/admin/all-menu-items', isAdmin, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM menu_items ORDER BY meal_type_id, name');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});


// Admin: Get all orders
app.get('/api/admin/orders', isAdmin, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM orders ORDER BY order_date DESC');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Admin: Update order status
app.put('/api/admin/orders/:id/status', isAdmin, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
        const result = await pool.query(
            'UPDATE orders SET status = $1 WHERE id = $2 RETURNING *',
            [status, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Admin: Calculate total quantities of items needed for preparation (for current day or all pending)
app.get('/api/admin/preparation-summary', isAdmin, async (req, res) => {
    // You can add a date filter here if needed, e.g., for 'today's orders'
    try {
        const result = await pool.query(`
            SELECT
                mi.name AS item_name,
                SUM(oi.quantity) AS total_quantity
            FROM
                order_items oi
            JOIN
                menu_items mi ON oi.menu_item_id = mi.id
            JOIN
                orders o ON oi.order_id = o.id
            WHERE
                o.status IN ('Pending', 'Confirmed') -- Consider only orders that need preparation
                AND o.order_date::date = CURRENT_DATE -- For today's orders
            GROUP BY
                mi.name
            ORDER BY
                mi.name;
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Admin: Get daily financial summary (today's orders with their totals)
app.get('/api/admin/daily-financial-summary', isAdmin, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                id,
                customer_name,
                total_amount,
                order_date,
                status
            FROM
                orders
            WHERE
                order_date::date = CURRENT_DATE
            ORDER BY
                order_date DESC;
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});


// Server Listen
// app.listen(PORT, () => {
//     console.log(`Server running on port ${PORT}`);
// });

app.listen(PORT, HOST, () => {
    console.log(`Server running on http://${HOST}:${PORT}`);
    console.log(`Accessible locally via http://localhost:${PORT} or http://<Your_System_IP_Address>:${PORT}`);
});