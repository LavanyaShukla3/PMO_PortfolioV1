// Debug: Check raw API response structure
const fetch = require('node-fetch');

async function debugApiResponse() {
    try {
        console.log('🔍 DEBUG: Checking raw API response structure...');
        const response = await fetch('http://localhost:5000/api/data');
        const data = await response.json();
        
        console.log('\n📋 Full Raw Response:');
        console.log('Type of data:', typeof data);
        console.log('Keys in response:', Object.keys(data));
        console.log('Full response structure:');
        console.log(JSON.stringify(data, null, 2));
        
    } catch (error) {
        console.error('Error:', error);
    }
}

debugApiResponse();
