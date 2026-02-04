
const axios = require('axios');

const API_URL = 'http://localhost:5000/api';

async function testCheckout() {
  try {
    // 1. Login
    console.log('Logging in...');
    const loginRes = await axios.post(`${API_URL}/auth/login`, {
      email: 'admin@pos.com',
      password: 'Admin@123'
    });
    const token = loginRes.data.token;
    console.log('Login successful. Token obtained.');

    // 2. Get Products
    console.log('Fetching products...');
    const productsRes = await axios.get(`${API_URL}/products`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const products = productsRes.data;
    
    if (products.length === 0) {
      console.log('No products found. Cannot test checkout.');
      return;
    }

    // Find a product with stock
    const product = products.find(p => p.available_stock > 0);
    if (!product) {
      console.log('No products with stock found. Cannot test checkout.');
      return;
    }
    console.log(`Found product: ${product.product_name} (ID: ${product.product_id}, Stock: ${product.available_stock}, Price: ${product.price})`);

    // 3. Create Sale
    console.log('Attempting checkout...');
    const payload = {
      items: [{
        product_id: product.product_id,
        product_name: product.product_name,
        quantity: 1,
        unit_price: Number(product.price)
      }],
      discount: 0,
      total_amount: Number(product.price),
      payment_method: 'cash',
      amount_paid: Number(product.price),
      user_id: 1,
      status: 'completed',
      tax_percent: 0,
      additional_charges_percent: 0
    };

    const saleRes = await axios.post(`${API_URL}/sales`, payload, {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log('Checkout successful!');
    console.log('Sale ID:', saleRes.data.sale_id);
    console.log('Response:', JSON.stringify(saleRes.data, null, 2));

  } catch (error) {
    console.error('Checkout failed!');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

testCheckout();
