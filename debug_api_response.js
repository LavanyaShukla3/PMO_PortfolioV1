const fetch = require('node-fetch');

async function debugApiResponse() {
    try {
        console.log('🔍 Testing /api/data endpoint...');
        const response = await fetch('http://localhost:5000/api/data');
        
        console.log(`Status: ${response.status}`);
        console.log(`Content-Type: ${response.headers.get('content-type')}`);
        
        const text = await response.text();
        console.log(`Response length: ${text.length} characters`);
        console.log('Raw response preview (first 500 chars):');
        console.log(text.substring(0, 500));
        
        try {
            const data = JSON.parse(text);
            console.log('\n📊 Parsed JSON structure:');
            console.log('Keys:', Object.keys(data));
            
            if (data.hierarchyData) {
                console.log(`hierarchyData: ${data.hierarchyData.length} items`);
                if (data.hierarchyData.length > 0) {
                    console.log('Sample hierarchy item:', data.hierarchyData[0]);
                }
            }
            
            if (data.investmentData) {
                console.log(`investmentData: ${data.investmentData.length} items`);
                if (data.investmentData.length > 0) {
                    console.log('Sample investment item:', data.investmentData[0]);
                }
            }
            
        } catch (parseError) {
            console.error('❌ JSON parse error:', parseError.message);
            console.log('Response is not valid JSON');
        }
        
    } catch (error) {
        console.error('❌ Request error:', error.message);
    }
}

debugApiResponse();
