// Define variables to store client token, payment method, order amount, and billing address
let clientToken;
let paymentMethodCategory;
let orderAmount;
let billingAddress = {};

// Function to initialize the app (hide the Pay button and result div)
const initializeApp = () => {
    $('.authorize').hide();
    $('.result').hide();
};

// Function to create Klarna session
const createSession = async () => {
    try {
        // Fetch session configuration data
        const sessionData = await fetch('create-session.json').then(res => res.json());

        // If order amount is set, update order amount in session data
        if (orderAmount) {
            sessionData.order_amount = orderAmount * 100;  // Convert to cents
            sessionData.order_lines.forEach(line => {
                // Update total amount and unit price for each order line
                line.total_amount = (line.total_amount / 20000) * orderAmount * 100;
                line.unit_price = (line.unit_price / 20000) * orderAmount * 100;
            });
        }

        // Send POST request to server to create Klarna session
        const response = await fetch('http://localhost:3000/create-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sessionData),
        });

        // Parse response from server
        const result = await response.json();

        // Store client token and payment method for later use
        clientToken = result.client_token;
        paymentMethodCategory = result.payment_method_categories[0].identifier;

        // Initialize Klarna Payments
        Klarna.Payments.init({ client_token: clientToken });

        // Load Klarna payment methods into container
        Klarna.Payments.load({
            container: '#klarna_container',
            payment_method_category: paymentMethodCategory
        });

        // Show Pay button with the order amount
        $('.authorize').text(`Pay ${orderAmount.toFixed(2)} SEK`).show();
    } catch (error) {
        console.error('Error creating Klarna session:', error);
    }
};

// Function to place an order
const placeOrder = async (authorizationToken) => {
    try {
        // Fetch order data
        const orderData = await fetch('place-order.json').then(res => res.json());

        // If order amount is set, update order amount in order data
        if (orderAmount) {
            orderData.order_amount = orderAmount * 100;  // Convert to cents
            orderData.order_lines.forEach(line => {
                // Update total amount and unit price for each order line
                line.total_amount = (line.total_amount / 20000) * orderAmount * 100;
                line.unit_price = (line.unit_price / 20000) * orderAmount * 100;
            });
        }

        // Send POST request to server to place Klarna order
        const response = await fetch(`http://localhost:3000/place-order/${authorizationToken}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error placing Klarna order:', errorText);
            return;
        }

        const result = await response.json();
        console.log('Order placed:', result);

        // Update result div with order confirmation
        updateResultDiv(result);
        billingAddress = orderData.billing_address;

        // Clear amount input
        $('#amount').val('');

        // Hide Pay button and Klarna container
        $('.authorize').hide();
        $('#klarna_container').hide();
    } catch (error) {
        console.error('Error placing Klarna order:', error);
    }
};

// Function to update result div with order confirmation
const updateResultDiv = (orderResult) => {
    const totalAmount = orderAmount.toFixed(2);
    document.getElementById('customerName').textContent = `${billingAddress.given_name || ''} ${billingAddress.family_name || ''}`;
    document.getElementById('orderId').textContent = orderResult.order_id;
    document.getElementById('totalAmount').textContent = totalAmount;
    document.querySelector('.result').style.display = 'block';
};

// jQuery function to run when the DOM is fully loaded
$(function () {
    // Initialize app (hide Pay button and result div)
    initializeApp();

    // Event listener for Pay button
    $("button.authorize").on("click", async function () {
        if (clientToken) {
            // Fetch billing address from place-order.json
            const orderData = await fetch('place-order.json').then(res => res.json());
            billingAddress = orderData.billing_address;

            // Authorize payment with Klarna
            Klarna.Payments.authorize({
                payment_method_category: paymentMethodCategory
            }, {
                billing_address: billingAddress
            }, async function (res) {
                console.log("Response from the authorize call:")
                console.log(res)
                if (res.approved) {
                    // If payment is approved, place Klarna order
                    await placeOrder(res.authorization_token);
                } else {
                    console.error('Payment not approved:', res);
                }
            });
        } else {
            console.error('Client token is not available. Make sure the session is created successfully.');
        }
    });

    // Event listener for Submit button
    $("button[type='submit']").on("click", function (e) {
        e.preventDefault();
        const amount = parseFloat($("#amount").val());
        if (amount > 0) {
            // If amount is greater than 0, create Klarna session
            orderAmount = amount;
            createSession();
            $('.result').hide();  // Hide result div
            $('button.authorize').show().text(`Pay ${orderAmount.toFixed(2)} SEK`);  // Show Pay button with updated amount
        } else {
            alert('Please enter a valid amount greater than 0.');
        }
    });
});
