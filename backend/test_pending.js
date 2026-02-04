
const axios = require('axios');

const API_URL = 'http://localhost:5000/api';

async function testPending() {
  try {
    // 1. Login
    console.log('Logging in...');
    const loginRes = await axios.post(`${API_URL}/auth/login`, {
      email: 'admin@pos.com',
      password: 'Admin@123'
    });
    const token = loginRes.data.token;
    console.log('Login successful. Token obtained.');

    // 2. Create Pending Sale
    console.log('Creating a pending sale...');
    // Fetch a product first to make a valid sale
    const productsRes = await axios.get(`${API_URL}/products`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    const product = productsRes.data[0];
    
    if (!product) {
        console.log("No products available to create a sale.");
    } else {
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
          amount_paid: 0,
          status: 'pending', // Pending status
          tax_percent: 0,
          additional_charges_percent: 0
        };
    
        await axios.post(`${API_URL}/sales`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        console.log('Pending sale created.');
    }

    // 3. Get Pending Sales
    console.log('Fetching pending sales...');
    const pendingRes = await axios.get(`${API_URL}/sales/pending`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log('Pending sales fetched successfully!');
    console.log('Count:', pendingRes.data.length);
    console.log('Data:', JSON.stringify(pendingRes.data, null, 2));

  } catch (error) {
    console.error('Test failed!');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

testPending();
