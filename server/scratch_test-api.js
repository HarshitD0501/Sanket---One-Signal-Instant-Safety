const axios = require('axios');

const run = async () => {
  try {
    const baseURL = 'http://localhost:5000/api';
    console.log('1. Registering user...');
    const regRes = await axios.post(`${baseURL}/auth/register`, {
      name: 'Diagnostic User',
      email: `test-${Date.now()}@test.com`,
      password: 'password123',
      phone: '9999999999'
    });
    console.log('Registration success. Token:', regRes.data.data.token);

    const token = regRes.data.data.token;
    const authHeaders = {
      headers: { Authorization: `Bearer ${token}` }
    };

    console.log('2. Adding contact...');
    const contactRes = await axios.post(`${baseURL}/contacts`, {
      name: 'Emergency Contact 1',
      phone: '8888888888',
      relation: 'Mother'
    }, authHeaders);
    console.log('Add Contact success:', contactRes.data);

  } catch (error) {
    console.error('API Test Failed:', error.response ? error.response.data : error.message);
  }
};

run();
