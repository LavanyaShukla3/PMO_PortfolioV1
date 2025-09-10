/**
 * Progressive API Service for PMO Portfolio
 * 
 * This service replaces the old "fetch all data" approach with progressive loading.
 * Instead of loading hundreds of thousands of records at once, data is loaded
 * on-demand with pagination and filtering.
 * 
 * Key Benefits:
 * - Fast initial page loads (50 items vs 100,000+ items)
 * - Reduced memory usage in browser
 * - Better user experience with loading states
 * - Secure parameterized queries prevent SQL injection
 * - Efficient database queries with WHERE clauses and pagination
 */

// Base API configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

/**
 * Generic API call handler with error handling
 */
async function apiCall(endpoint, params = {}) {
    try {
        const url = new URL(`${API_BASE_URL}${endpoint}`);
        
        // Add query parameters
        Object.keys(params).forEach(key => {
            if (params[key] !== null && params[key] !== undefined) {
                url.searchParams.append(key, params[key]);
            }
        });

        console.log(`🔍 API Call: ${url.toString()}`);
        
        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.status !== 'success') {
            throw new Error(data.message || 'API request failed');
        }

        console.log(`✅ API Success: ${endpoint}`, {
            hierarchyCount: data.data?.hierarchy?.length || 0,
            investmentCount: data.data?.investment?.length || 0,
            pagination: data.data?.pagination,
            cached: data.cache_info?.cached
        });

        return data;
        
    } catch (error) {
        console.error(`❌ API Error: ${endpoint}`, error);
        throw error;
    }
}

/**
 * Process raw API data into the format expected by the frontend components
 */
function processRawApiData(apiResponse) {
    console.log('🔄 Processing API response:', apiResponse);
    
    if (!apiResponse?.data?.hierarchy || !apiResponse?.data?.investment) {
        console.warn('Invalid API response structure:', apiResponse);
        return [];
    }

    const hierarchyData = apiResponse.data.hierarchy;
    const investmentData = apiResponse.data.investment;

    console.log('📊 Data counts - Hierarchy:', hierarchyData.length, 'Investment:', investmentData.length);

    // NEW APPROACH: Use investment records directly to create displayable portfolio items
    // This gives us records that actually have timeline data for Gantt charts
    
    // Get all Investment records (not Phases or Milestones)
    const investmentRecords = investmentData.filter(inv => inv.ROADMAP_ELEMENT === 'Investment');
    console.log('📈 Investment records found:', investmentRecords.length);
    
    const processedData = [];
    
    // Process each investment record
    investmentRecords.forEach(investment => {
        console.log('🔄 Processing investment:', investment.INV_EXT_ID, investment.INVESTMENT_NAME);
        
        // Find milestones for this investment
        const milestones = investmentData
            .filter(inv => 
                inv.INV_EXT_ID === investment.INV_EXT_ID && 
                inv.ROADMAP_ELEMENT && 
                inv.ROADMAP_ELEMENT.includes('Milestones')
            )
            .map(milestone => ({
                date: milestone.TASK_START,
                status: milestone.MILESTONE_STATUS,
                label: milestone.TASK_NAME,
                isSG3: milestone.ROADMAP_ELEMENT?.includes('SG3') || milestone.TASK_NAME?.includes('SG3')
            }));

        console.log('🎯 Milestones found for', investment.INV_EXT_ID, ':', milestones.length);

        // Create portfolio item using investment data (compatible with PortfolioGanttChart.jsx)
        const portfolioData = {
            id: investment.INV_EXT_ID,
            name: investment.INVESTMENT_NAME,
            parentId: `FUNC_${investment.INV_FUNCTION || 'Unknown'}`, // Group by function
            parentName: investment.INV_FUNCTION || 'Unknown Function',
            startDate: investment.TASK_START,
            endDate: investment.TASK_FINISH,
            status: investment.INV_OVERALL_STATUS || 'Grey',
            sortOrder: 0,
            isProgram: true, // Keep consistent with original structure
            milestones,
            hasInvestmentData: true, // All these records have investment data
            isDrillable: false, // Investment level records are not drillable
            // Additional fields for compatibility
            region: investment.INV_MARKET,
            market: investment.INV_MARKET,
            function: investment.INV_FUNCTION,
            tier: investment.INV_TIER
        };
        
        processedData.push(portfolioData);
    });
    
    console.log('✅ Processed data:', processedData.length, 'investment-based items');
    console.log('📋 Items with timeline data:', processedData.filter(item => item.startDate && item.endDate).length);
    
    if (processedData.length > 0) {
        console.log('📋 Sample processed item:', processedData[0]);
    }
    
    return processedData;
}

/**
 * Portfolio-level data fetching
 * Use this for the main portfolio page
 */
export async function fetchPortfolioData(page = 1, limit = 50, options = {}) {
    const {
        portfolioId = null,
        status = null
    } = options;

    const response = await apiCall('/api/data/portfolio', {
        page,
        limit,
        portfolioId,
        status
    });

    // Process the raw data into the format expected by frontend
    const processedData = processRawApiData(response);

    return {
        data: processedData,
        totalCount: response.data?.pagination?.total_items || processedData.length,
        page: response.data?.pagination?.page || page,
        limit: response.data?.pagination?.limit || limit,
        hasMore: response.data?.pagination?.has_more || false
    };
}

/**
 * Program-level data fetching
 * Use this when a user clicks on a portfolio to view its programs
 */
export async function fetchProgramData(portfolioId, options = {}) {
    if (!portfolioId) {
        throw new Error('portfolioId is required for fetchProgramData');
    }

    const {
        page = 1,
        limit = 50
    } = options;

    return apiCall('/api/data/program', {
        portfolioId,
        page,
        limit
    });
}

/**
 * Subprogram-level data fetching
 * Use this when a user clicks on a program to view its subprograms
 */
export async function fetchSubProgramData(programId, options = {}) {
    if (!programId) {
        throw new Error('programId is required for fetchSubProgramData');
    }

    const {
        page = 1,
        limit = 50
    } = options;

    return apiCall('/api/data/subprogram', {
        programId,
        page,
        limit
    });
}

/**
 * Region-filtered data fetching
 * Use this for region-specific views
 */
export async function fetchRegionData(region = null, options = {}) {
    const {
        page = 1,
        limit = 50,
        supplyChain = null
    } = options;

    const params = {
        page,
        limit
    };
    
    if (region) {
        params.region = region;
    }
    
    if (supplyChain) {
        params.supply_chain = supplyChain;
    }

    return apiCall('/api/data/region', params);
}

/**
 * Get available filter options for regions
 */
export async function getRegionFilterOptions() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/data/region/filters`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error fetching region filter options:', error);
        // Return empty filters if API call fails
        return {
            regions: [],
            supplyChains: []
        };
    }
}

/**
 * Debug supply chain data
 */
export async function debugSupplyChainData(limit = 10) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/data/region/debug?limit=${limit}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error fetching debug supply chain data:', error);
        throw error;
    }
}

/**
 * Cache management utilities
 */
export async function clearApiCache(pattern = null) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/cache/clear`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ pattern })
        });

        const data = await response.json();
        
        if (data.status === 'success') {
            console.log('✅ Cache cleared successfully');
            return true;
        } else {
            console.error('❌ Failed to clear cache:', data.message);
            return false;
        }
    } catch (error) {
        console.error('❌ Cache clear error:', error);
        return false;
    }
}

export async function getCacheStats() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/cache/stats`);
        const data = await response.json();
        
        if (data.status === 'success') {
            return data.cache_stats;
        } else {
            throw new Error(data.message || 'Failed to get cache stats');
        }
    } catch (error) {
        console.error('❌ Cache stats error:', error);
        throw error;
    }
}

/**
 * Legacy API support (for backward compatibility)
 * These should be phased out in favor of the progressive methods above
 */
export async function fetchPaginatedData(page = 1, pageSize = 25) {
    console.warn('⚠️ fetchPaginatedData is legacy - consider using specific fetch methods for better performance');
    
    return apiCall('/api/data/paginated', {
        page,
        page_size: Math.min(pageSize, 50), // Cap to prevent performance issues
        cache: 'true'
    });
}

/**
 * Health check utility
 */
export async function checkApiHealth() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/health`);
        const data = await response.json();
        return data.status === 'healthy';
    } catch (error) {
        console.error('❌ Health check failed:', error);
        return false;
    }
}

/**
 * Test database connectivity
 */
export async function testDatabaseConnection() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/test-connection`);
        const data = await response.json();
        return data.status === 'success';
    } catch (error) {
        console.error('❌ Database connection test failed:', error);
        return false;
    }
}

// Export all functions as default for easy importing
export default {
    fetchPortfolioData,
    fetchProgramData,
    fetchSubProgramData,
    fetchRegionData,
    getRegionFilterOptions,
    debugSupplyChainData,
    fetchPaginatedData,
    clearApiCache,
    getCacheStats,
    checkApiHealth,
    testDatabaseConnection
};
