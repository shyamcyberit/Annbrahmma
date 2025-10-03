import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

// --- IMPORTANT: Change this IP address to your system's LAN IP ---
// For example, if your system's IP is 192.168.0.221, use that.
// Ensure your backend server is also configured to listen on this IP or '0.0.0.0'.
const API_BASE_URL = 'http://192.168.0.221:5000/api'; 

function UserView() {
    const [mealTypes, setMealTypes] = useState([]);
    const [selectedMealTypeId, setSelectedMealTypeId] = useState('');
    const [menuItems, setMenuItems] = useState([]);
    const [cart, setCart] = useState({});
    const [customerName, setCustomerName] = useState('');
    const [orderReceipt, setOrderReceipt] = useState(null);
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [isUpdatingOrder, setIsUpdatingOrder] = useState(false);
    const [updateOrderId, setUpdateOrderId] = useState('');

    const receiptPrintRef = useRef(null);

    useEffect(() => {
        fetchMealTypes();
    }, []);

    const fetchMealTypes = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/meal-types`);
            setMealTypes(response.data);
            if (response.data.length > 0) {
                setSelectedMealTypeId(response.data[0].id);
                fetchMenuItems(response.data[0].id);
            }
        } catch (error) {
            console.error('Error fetching meal types:', error);
            setErrorMessage('Failed to load meal types.');
        }
    };

    const fetchMenuItems = async (mealTypeId) => {
        try {
            const response = await axios.get(`${API_BASE_URL}/menu/${mealTypeId}`);
            setMenuItems(response.data);
        }
        catch (error) {
            console.error('Error fetching menu items:', error);
            setErrorMessage('Failed to load menu items.');
        }
    };

    const handleMealTypeChange = (mealTypeId) => {
        setSelectedMealTypeId(mealTypeId);
        fetchMenuItems(mealTypeId);
        setCart({});
    };

    const handleQuantityChange = (menuItemId, quantity) => {
        setCart(prevCart => ({
            ...prevCart,
            [menuItemId]: Math.max(0, parseInt(quantity, 10) || 0)
        }));
    };

    const calculateCurrentCartTotal = () => {
        let total = 0;
        for (const itemId in cart) {
            const item = menuItems.find(m => m.id === parseInt(itemId));
            if (item) {
                total += item.price * cart[itemId];
            }
        }
        return total.toFixed(2);
    };

    const handlePlaceOrder = async () => {
        setErrorMessage('');
        setSuccessMessage('');
        setOrderReceipt(null);
        if (!customerName.trim()) {
            setErrorMessage('Please enter your name.');
            return;
        }
        const selectedItems = Object.keys(cart)
            .filter(itemId => cart[itemId] > 0)
            .map(itemId => ({
                menuItemId: parseInt(itemId),
                quantity: cart[itemId]
            }));

        if (selectedItems.length === 0) {
            setErrorMessage('Please select at least one item.');
            return;
        }

        try {
            const response = await axios.post(`${API_BASE_URL}/orders`, {
                customerName,
                items: selectedItems
            });
            setOrderReceipt(response.data);
            setSuccessMessage(`Order placed successfully! Your Order ID: ${response.data.id}`);
            setCart({});
            setCustomerName('');
            setIsUpdatingOrder(false);
            setUpdateOrderId('');
        } catch (error) {
            console.error('Error placing order:', error.response ? error.response.data : error.message);
            setErrorMessage(error.response?.data?.details || 'Failed to place order.');
        }
    };

    const handleFetchOrderToUpdate = async () => {
        setErrorMessage('');
        setSuccessMessage('');
        setOrderReceipt(null);
        if (!updateOrderId.trim()) {
            setErrorMessage('Please enter an Order ID to view/modify.');
            return;
        }
        try {
            const response = await axios.get(`${API_BASE_URL}/orders/${updateOrderId}`);
            const order = response.data;
            setCustomerName(order.customer_name);
            const newCart = {};
            order.items.forEach(item => {
                newCart[item.menu_item_id] = item.quantity;
            });
            setCart(newCart);
            setIsUpdatingOrder(true);
            setOrderReceipt(order);
            setSuccessMessage(`Order ${updateOrderId} loaded for modification.`);
            if (mealTypes.length > 0 && selectedMealTypeId) {
                 fetchMenuItems(selectedMealTypeId);
            } else if (mealTypes.length > 0) {
                 setSelectedMealTypeId(mealTypes[0].id);
                 fetchMenuItems(mealTypes[0].id);
            }

        } catch (error) {
            console.error('Error fetching order for update:', error.response ? error.response.data : error.message);
            setErrorMessage(error.response?.data?.error || 'Order not found or failed to fetch.');
            setCart({});
            setCustomerName('');
            setIsUpdatingOrder(false);
            setOrderReceipt(null);
        }
    };


    const handleUpdateOrder = async () => {
        setErrorMessage('');
        setSuccessMessage('');
        setOrderReceipt(null);
        if (!customerName.trim()) {
            setErrorMessage('Please enter your name.');
            return;
        }
        const selectedItems = Object.keys(cart)
            .filter(itemId => cart[itemId] > 0)
            .map(itemId => ({
                menuItemId: parseInt(itemId),
                quantity: cart[itemId]
            }));

        if (selectedItems.length === 0) {
            setErrorMessage('Please select at least one item.');
            return;
        }

        try {
            const response = await axios.put(`${API_BASE_URL}/orders/${updateOrderId}`, {
                customerName,
                items: selectedItems
            });
            setOrderReceipt(response.data.order);
            setSuccessMessage(`Order ${updateOrderId} updated successfully!`);
            setCart({});
            setCustomerName('');
            setIsUpdatingOrder(false);
            setUpdateOrderId('');
        } catch (error) {
            console.error('Error updating order:', error.response ? error.response.data : error.message);
            setErrorMessage(error.response?.data?.details || 'Failed to update order.');
        }
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

    return (
        <div>
            <h2>Users: Book Your Meal!</h2>
            <p className="feature-message">
                **Please book your meal and keep your Order ID and receipt ready to show.**
            </p>

            {errorMessage && <p className="error-message">{errorMessage}</p>}
            {successMessage && <p className="success-message">{successMessage}</p>}

            <div>
                <h3>1. Enter Your Name:</h3>
                <input
                    type="text"
                    placeholder="Your Name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    required
                    style={{ width: 'calc(100% - 20px)' }}
                />
            </div>

            <div style={{ marginTop: '20px' }}>
                <h3>2. Select Meal Type:</h3>
                <div className="meal-type-selector">
                    {mealTypes.map(type => (
                        <button
                            key={type.id}
                            onClick={() => handleMealTypeChange(type.id)}
                            className={selectedMealTypeId === type.id ? 'active' : ''}
                        >
                            {type.name}
                        </button>
                    ))}
                </div>
            </div>

            <div style={{ marginTop: '20px' }}>
                <h3>3. Choose Menu Items:</h3>
                {menuItems.length === 0 ? (
                    <p>No menu items available for this meal type.</p>
                ) : (
                    <div>
                        {menuItems.map(item => (
                            <div key={item.id} className="menu-item">
                                <span>{item.name} - ₹{item.price}</span>
                                <div>
                                    <input
                                        type="number"
                                        min="0"
                                        value={cart[item.id] || 0}
                                        onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                                        style={{ width: '60px' }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="order-summary" style={{ marginTop: '20px' }}>
                <h3>4. Order Summary:</h3>
                <p>Total Amount: ₹{calculateCurrentCartTotal()}</p>
                {!isUpdatingOrder ? (
                    <button onClick={handlePlaceOrder}>Place Order</button>
                ) : (
                    <button onClick={handleUpdateOrder}>Update Order</button>
                )}
            </div>

            <div style={{ marginTop: '30px', borderTop: '1px solid #eee', paddingTop: '20px' }}>
                <h3>5. View or Modify Existing Order:</h3>
                <input
                    type="text"
                    placeholder="Enter Order ID to View/Modify"
                    value={updateOrderId}
                    onChange={(e) => setUpdateOrderId(e.target.value)}
                    style={{ marginRight: '10px' }}
                />
                <button onClick={handleFetchOrderToUpdate}>Load Order</button>
            </div>


            {orderReceipt && (
                <div ref={receiptPrintRef} className="order-receipt" style={{ marginTop: '30px' }}>
                    <h3>Order Receipt (ID: {orderReceipt.id})</h3>
                    <p><strong>Customer Name:</strong> {orderReceipt.customer_name}</p>
                    <p><strong>Order Date:</strong> {new Date(orderReceipt.order_date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
                    <p><strong>Status:</strong> {orderReceipt.status}</p>
                    <h4>Items:</h4>
                    {orderReceipt.items && orderReceipt.items.length > 0 ? (
                        <ul>
                            {orderReceipt.items.map((item, index) => (
                                <li key={index}>
                                    {item.item_name} x {item.quantity} - ₹{(item.price_at_order * item.quantity).toFixed(2)}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p>No items found for this order.</p>
                    )}
                    <p><strong>Final Total: ₹{parseFloat(orderReceipt.total_amount).toFixed(2)}</strong></p>
                    <button className="no-print" onClick={() => handlePrint(receiptPrintRef)}>Print Receipt</button>
                </div>
            )}
        </div>
    );
}

export default UserView;