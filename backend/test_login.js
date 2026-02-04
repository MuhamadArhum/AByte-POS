
const axios = require('axios');

const API_URL = 'http://localhost:5000/api';

async function testLogin() {
  try {
    console.log('Attempting login...');
    const loginRes = await axios.post(`${API_URL}/auth/login`, {
      email: 'admin@pos.com',
      password: 'Admin@123'
    });
    
    if (loginRes.data.token) {
        console.log('Login SUCCESS!');
        console.log('Token:', loginRes.data.token.substring(0, 20) + '...');
        console.log('User:', loginRes.data.user);
    } else {
        console.log('Login response missing token:', loginRes.data);
    }

  } catch (error) {
    console.error('Login FAILED!');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

testLogin();
