/**
 * API validation utilities for checking backend connectivity
 * Enhanced with debugging to troubleshoot connection issues
 */

/**
 * Debug API responses to see what's being returned
 */
const debugApiResponse = async (url, description) => {
    try {
        console.log(`🔍 Testing ${description}: ${url}`);
        
        const response = await fetch(url);
        const responseText = await response.text();
        
        console.log(`📡 Status: ${response.status} ${response.statusText}`);
        console.log(`📝 Response headers:`, [...response.headers.entries()]);
        console.log(`📄 First 200 chars of response:`, responseText.substring(0, 200));
        
        if (responseText.startsWith('<!DOCTYPE')) {
            console.log('❌ Received HTML instead of JSON - Backend likely not running or wrong URL');
            return { error: 'HTML_RESPONSE', response: responseText };
        }
        
        try {
            const jsonData = JSON.parse(responseText);
            console.log('✅ Valid JSON received:', jsonData);
            return { success: true, data: jsonData };
        } catch (parseError) {
            console.log('❌ Invalid JSON:', parseError.message);
            return { error: 'INVALID_JSON', response: responseText };
        }
        
    } catch (networkError) {
        console.log('❌ Network error:', networkError.message);
        return { error: 'NETWORK_ERROR', message: networkError.message };
    }
};

/**
 * Validates that the backend API is accessible and returns expected data
 * @returns {Promise<Object>} Validation result with isValid, errors, and mode
 */
export const validateApiData = async () => {
    console.log('🚀 Starting API validation...');
    
    const endpoints = [
        { url: '/api/health', name: 'Health Check' },
        { url: '/api/data', name: 'Main Data Endpoint' }
    ];
    
    const results = [];
    
    for (const endpoint of endpoints) {
        const result = await debugApiResponse(endpoint.url, endpoint.name);
        results.push({ ...endpoint, ...result });
    }
    
    // Check if all succeeded
    const allSuccess = results.every(r => r.success);
    
    if (allSuccess) {
        // Get mode from health check
        const healthResult = results.find(r => r.name === 'Health Check');
        const dataResult = results.find(r => r.name === 'Main Data Endpoint');
        const mode = healthResult?.data?.mode || 'unknown';
        
        return {
            isValid: true,
            errors: [],
            mode: mode,
            counts: {
                portfolios: dataResult?.data?.counts?.hierarchy || 0,
                investments: dataResult?.data?.counts?.investment || 0
            }
        };
    } else {
        const errors = results
            .filter(r => !r.success)
            .map(r => {
                if (r.error === 'HTML_RESPONSE') {
                    return `${r.name}: Backend server not running - received HTML instead of JSON. Please start Flask server with: python backend/app.py`;
                } else if (r.error === 'NETWORK_ERROR') {
                    return `${r.name}: ${r.message} - Check if backend is running on localhost:5000`;
                } else {
                    return `${r.name}: ${r.error}`;
                }
            });
            
        return {
            isValid: false,
            errors: errors,
            mode: 'unknown',
            counts: {
                portfolios: 0,
                investments: 0
            }
        };
    }
};
