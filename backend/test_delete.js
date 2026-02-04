
const axios = require('axios');

const API_URL = 'http://localhost:5000/api';

async function testDelete() {
  try {
    // 1. Login
    console.log('Logging in...');
    const loginRes = await axios.post(`${API_URL}/auth/login`, {
      email: 'admin@pos.com',
      password: 'Admin@123'
    });
    const token = loginRes.data.token;
    
    // 2. Create Pending Sale
    console.log('Creating sale to delete...');
    const productsRes = await axios.get(`${API_URL}/products`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    const product = productsRes.data[0];
    
    if (!product) {
        console.log("No products.");
        return;
    }

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
      status: 'pending',
      tax_percent: 0,
      additional_charges_percent: 0
    };

    const saleRes = await axios.post(`${API_URL}/sales`, payload, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const saleId = saleRes.data.sale_id;
    console.log(`Sale created: ${saleId}`);

    // 3. Delete Sale
    console.log(`Deleting sale ${saleId}...`);
    await axios.delete(`${API_URL}/sales/${saleId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Sale deleted.');

    // 4. Verify
    try {
        await axios.get(`${API_URL}/sales/${saleId}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log('Error: Sale still exists!');
    } catch (e) {
        if (e.response && e.response.status === 404) {
            console.log('Success: Sale not found (as expected).');
        } else {
            console.log('Error checking sale:', e.message);
        }
    }

  } catch (error) {
    console.error('Test failed!', error.message);
    if (error.response) console.error(error.response.data);
  }
}

testDelete();
