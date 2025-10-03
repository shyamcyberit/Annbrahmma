import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

// --- IMPORTANT: Change this IP address to your system's LAN IP ---
// For example, if your system's IP is 192.168.0.221, use that.
// Ensure your backend server is also configured to listen on this IP or '0.0.0.0'.
const API_BASE_URL = 'http://192.168.0.221:5000/api';

function AdminView({ isAdminLoggedIn, onAdminLogin }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loginError, setLoginError] = useState('');

    const [mealTypes, setMealTypes] = useState([]);
    const [menuItems, setMenuItems] = useState([]);
    const [orders, setOrders] = useState([]);
    const [preparationSummary, setPreparationSummary] = useState([]);
    const [showPreparation, setShowPreparation] = useState(false);
    const [dailyFinancialSummary, setDailyFinancialSummary] = useState([]);
    const [showFinancialSummary, setShowFinancialSummary] = useState(false);


    const [expandedOrderId, setExpandedOrderId] = useState(null);
    const [detailedOrderItems, setDetailedOrderItems] = useState([]);

    const [newItemName, setNewItemName] = useState('');
    const [newItemPrice, setNewItemPrice] = useState('');
    const [newItemMealTypeId, setNewItemMealTypeId] = useState('');
    const [newItemIsAvailable, setNewItemIsAvailable] = useState(true);
    const [editingItemId, setEditingItemId] = useState(null);

    const preparationPrintRef = useRef(null);
    const financialPrintRef = useRef(null);

    useEffect(() => {
        if (isAdminLoggedIn) {
            fetchMealTypes();
        }
    }, [isAdminLoggedIn]);

    useEffect(() => {
        if (isAdminLoggedIn && mealTypes.length > 0) {
            fetchMenuItems();
            fetchAllOrders();
            if (!newItemMealTypeId) {
                setNewItemMealTypeId(mealTypes[0].id);
            }
        }
    }, [isAdminLoggedIn, mealTypes]);


    const handleLogin = async (e) => {
        e.preventDefault();
        setLoginError('');
        try {
            const response = await axios.post(`${API_BASE_URL}/admin/login`, { username, password });
            if (response.data.message === 'Admin login successful') {
                onAdminLogin(true);
            } else {
                setLoginError('Login failed: Invalid response from server.');
            }
        } catch (error) {
            console.error('Admin login error:', error.response ? error.response.data : error.message);
            setLoginError(error.response?.data?.message || 'Login failed. Please check credentials.');
        }
    };

    const fetchMealTypes = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/meal-types`);
            setMealTypes(response.data);
        } catch (error) {
            console.error('Error fetching meal types (admin):', error);
        }
    };

    const fetchMenuItems = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/admin/all-menu-items`);
            setMenuItems(response.data);
        } catch (error) {
            console.error('Error fetching all menu items (admin):', error);
        }
    };

    const fetchAllOrders = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/admin/orders`);
            setOrders(response.data);
        } catch (error) {
            console.error('Error fetching all orders (admin):', error);
        }
    };

    const handleUpdateOrderStatus = async (orderId, newStatus) => {
        try {
            await axios.put(`${API_BASE_URL}/admin/orders/${orderId}/status`, { status: newStatus });
            fetchAllOrders();
            if (expandedOrderId === orderId) {
                handleToggleDetails(orderId);
            }
        } catch (error) {
            console.error('Error updating order status:', error);
        }
    };

    const handleAddOrUpdateMenuItem = async (e) => {
        e.preventDefault();
        try {
            const itemData = {
                name: newItemName,
                price: parseFloat(newItemPrice),
                mealTypeId: newItemMealTypeId,
                isAvailable: newItemIsAvailable
            };

            if (editingItemId) {
                await axios.put(`${API_BASE_URL}/admin/menu-items/${editingItemId}`, itemData);
            } else {
                await axios.post(`${API_BASE_URL}/admin/menu-items`, itemData);
            }
            setNewItemName('');
            setNewItemPrice('');
            setNewItemMealTypeId(mealTypes.length > 0 ? mealTypes[0].id : '');
            setNewItemIsAvailable(true);
            setEditingItemId(null);
            fetchMenuItems();
        } catch (error) {
            console.error('Error adding/updating menu item:', error);
        }
    };

    const handleEditMenuItem = (item) => {
        setEditingItemId(item.id);
        setNewItemName(item.name);
        setNewItemPrice(item.price);
        setNewItemMealTypeId(item.meal_type_id);
        setNewItemIsAvailable(item.is_available);
    };

    const handleDeleteMenuItem = async (id) => {
        if (window.confirm('Are you sure you want to delete this menu item?')) {
            try {
                await axios.delete(`${API_BASE_URL}/admin/menu-items/${id}`);
                fetchMenuItems();
            } catch (error) {
                console.error('Error deleting menu item:', error);
            }
        }
    };

    const handleCalculatePreparation = async () => {
        setShowPreparation(true);
        try {
            const response = await axios.get(`${API_BASE_URL}/admin/preparation-summary`);
            setPreparationSummary(response.data);
        } catch (error) {
            console.error('Error fetching preparation summary:', error);
        }
    };

    const handleToggleDetails = async (orderId) => {
        if (expandedOrderId === orderId) {
            setExpandedOrderId(null);
            setDetailedOrderItems([]);
        } else {
            setExpandedOrderId(orderId);
            try {
                const response = await axios.get(`${API_BASE_URL}/orders/${orderId}`);
                setDetailedOrderItems(response.data.items || []);
            } catch (error) {
                console.error('Error fetching order details:', error);
                setDetailedOrderItems([]);
                alert('Failed to load order details.');
            }
        }
    };

    const fetchDailyFinancialSummary = async () => {
        setShowFinancialSummary(true);
        try {
            const response = await axios.get(`${API_BASE_URL}/admin/daily-financial-summary`);
            setDailyFinancialSummary(response.data);
        } catch (error) {
            console.error('Error fetching daily financial summary:', error);
        }
    };

    const calculateDailyFinancialTotal = () => {
        return dailyFinancialSummary.reduce((sum, order) => sum + parseFloat(order.total_amount), 0).toFixed(2);
    };

    const handlePrint = (ref) => {
        if (ref.current) {
            const printWrapper = document.createElement('div');
            printWrapper.className = 'printable-area-wrapper';
            printWrapper.innerHTML = ref.current.innerHTML;

            document.body.appendChild(printWrapper);
            window.print();
            document.body.removeChild(printWrapper);
        }
    };


    if (!isAdminLoggedIn) {
        return (
            <div className="login-form-container">
                <h2>Admin Login</h2>
                <form onSubmit={handleLogin}>
                    <div className="form-group">
                        <label>Username:</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Password:</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <button type="submit">Login</button>
                    {loginError && <p className="error-message">{loginError}</p>}
                </form>
            </div>
        );
    }

    return (
        <div className="admin-dashboard">
            <h2>Admin Dashboard</h2>

            <h3>Manage Menu Items</h3>
            <form onSubmit={handleAddOrUpdateMenuItem} className="menu-form-container">
                <h4>{editingItemId ? 'Edit Menu Item' : 'Add New Menu Item'}</h4>
                <div className="form-group">
                    <label>Name:</label>
                    <input type="text" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} required />
                </div>
                <div className="form-group">
                    <label>Price:</label>
                    <input type="number" step="0.01" value={newItemPrice} onChange={(e) => setNewItemPrice(e.target.value)} required />
                </div>
                <div className="form-group">
                    <label>Meal Type:</label>
                    <select value={newItemMealTypeId} onChange={(e) => setNewItemMealTypeId(parseInt(e.target.value))} required>
                        <option value="">Select Meal Type</option>
                        {mealTypes.map(type => (
                            <option key={type.id} value={type.id}>{type.name}</option>
                        ))}
                    </select>
                </div>
                <div className="form-group checkbox-group">
                    <label>Is Available:</label>
                    <input type="checkbox" checked={newItemIsAvailable} onChange={(e) => setNewItemIsAvailable(e.target.checked)} />
                </div>
                <button type="submit">{editingItemId ? 'Update Item' : 'Add Item'}</button>
                {editingItemId && <button type="button" onClick={() => { setEditingItemId(null); setNewItemName(''); setNewItemPrice(''); setNewItemMealTypeId(mealTypes.length > 0 ? mealTypes[0].id : ''); setNewItemIsAvailable(true); }} className="cancel-edit-button">Cancel Edit</button>}
            </form>

            <table className="admin-menu-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Name</th>
                        <th>Price</th>
                        <th>Meal Type</th>
                        <th>Available</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {menuItems.length === 0 ? (
                        <tr><td colSpan="6" style={{ textAlign: 'center' }}>No menu items added yet.</td></tr>
                    ) : (
                        menuItems.map(item => (
                            <tr key={item.id}>
                                <td>{item.id}</td>
                                <td>{item.name}</td>
                                <td>₹{item.price}</td>
                                <td>{mealTypes.find(type => type.id === item.meal_type_id)?.name || 'N/A'}</td>
                                <td>{item.is_available ? 'Yes' : 'No'}</td>
                                <td>
                                    <button className="edit-button" onClick={() => handleEditMenuItem(item)}>Edit</button>
                                    <button className="delete-button" onClick={() => handleDeleteMenuItem(item.id)}>Delete</button>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>

            <h3 style={{ marginTop: '40px' }}>All Incoming Orders</h3>
            <button onClick={fetchAllOrders}>Refresh Orders</button>
            <table className="admin-orders-table">
                <thead>
                    <tr>
                        <th>Order ID</th>
                        <th>Customer Name</th>
                        <th>Total Amount</th>
                        <th>Order Date</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {orders.length === 0 ? (
                        <tr><td colSpan="6">No orders found.</td></tr>
                    ) : (
                        orders.map(order => (
                            <React.Fragment key={order.id}>
                                <tr>
                                    <td>{order.id}</td>
                                    <td>{order.customer_name}</td>
                                    <td>₹{parseFloat(order.total_amount).toFixed(2)}</td>
                                    <td>{new Date(order.order_date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td>
                                    <td>
                                        <select
                                            value={order.status}
                                            onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value)}
                                        >
                                            <option value="Pending">Pending</option>
                                            <option value="Confirmed">Confirmed</option>
                                            <option value="Ready">Ready</option>
                                            <option value="Completed">Completed</option>
                                            <option value="Cancelled">Cancelled</option>
                                        </select>
                                    </td>
                                    <td>
                                        <button className="view-details-button" onClick={() => handleToggleDetails(order.id)}>
                                            {expandedOrderId === order.id ? 'Hide Details' : 'View Details'}
                                        </button>
                                    </td>
                                </tr>
                                {expandedOrderId === order.id && (
                                    <tr>
                                        <td colSpan="6">
                                            <h4>Order Items:</h4>
                                            {detailedOrderItems.length > 0 ? (
                                                <ul>
                                                    {detailedOrderItems.map((item, idx) => (
                                                        <li key={idx}>
                                                            {item.item_name} x {item.quantity} @ ₹{parseFloat(item.price_at_order).toFixed(2)} each = ₹{(item.quantity * item.price_at_order).toFixed(2)}
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <p>Loading items...</p>
                                            )}
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        ))
                    )}
                </tbody>
            </table>

            <h3 style={{ marginTop: '40px' }}>Daily Preparation Summary</h3>
            <button onClick={handleCalculatePreparation}>Calculate Items for Preparation</button>
            {showPreparation && (
                <div ref={preparationPrintRef} className="order-summary" style={{ marginTop: '20px' }}>
                    <h4>Items to Prepare for Today's Pending/Confirmed Orders:</h4>
                    {preparationSummary.length > 0 ? (
                        <ul>
                            {preparationSummary.map((item, index) => (
                                <li key={index}>
                                    <strong>{item.item_name}:</strong> {item.total_quantity} units
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p>No items to prepare for today's pending/confirmed orders.</p>
                    )}
                     {preparationSummary.length > 0 && (
                        <button className="no-print" onClick={() => handlePrint(preparationPrintRef)}>
                            Print Summary
                        </button>
                    )}
                </div>
            )}

            <h3 style={{ marginTop: '40px' }}>Daily Financial Summary (Today's Orders)</h3>
            <button onClick={fetchDailyFinancialSummary}>Show Today's Financials</button>
            {showFinancialSummary && (
                <div ref={financialPrintRef} className="order-summary" style={{ marginTop: '20px' }}>
                    <h4>Today's Orders by Total Amount:</h4>
                    {dailyFinancialSummary.length > 0 ? (
                        <table className="daily-financial-table">
                            <thead>
                                <tr>
                                    <th>Order ID</th>
                                    <th>Customer Name</th>
                                    <th>Total Amount</th>
                                    <th>Status</th>
                                    <th>Order Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {dailyFinancialSummary.map(order => (
                                    <tr key={order.id}>
                                        <td>{order.id}</td>
                                        <td>{order.customer_name}</td>
                                        <td>₹{parseFloat(order.total_amount).toFixed(2)}</td>
                                        <td>{order.status}</td>
                                        <td>{new Date(order.order_date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td>
                                    </tr>
                                ))}
                                <tr className="total-row">
                                    <td colSpan="2" style={{ textAlign: 'right', fontWeight: 'bold' }}>Total Revenue:</td>
                                    <td colSpan="3" style={{ fontWeight: 'bold' }}>₹{calculateDailyFinancialTotal()}</td>
                                </tr>
                            </tbody>
                        </table>
                    ) : (
                        <p>No orders found for today's financial summary.</p>
                    )}
                     {dailyFinancialSummary.length > 0 && (
                        <button className="no-print" onClick={() => handlePrint(financialPrintRef)}>
                            Print Financials
                        </button>
                    )}
                </div>
            )}

        </div>
    );
}

export default AdminView;