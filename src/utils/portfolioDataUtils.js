/**
 * Data processing utilities for Portfolio Gantt Chart
 * Processes live API data from backend and transforms it for the Gantt chart
 */

/**
 * Fetches portfolio data from the backend API
 * @returns {Promise<Array>} Portfolio hierarchy data filtered for Portfolio type
 */
export const fetchPortfolioData = async () => {
    try {
        const response = await fetch('/api/portfolios');
        
        if (!response.ok) {
            throw new Error(`Failed to fetch portfolio data: ${response.status} ${response.statusText}`);
        }
        
        const result = await response.json();
        
        if (result.status !== 'success') {
            throw new Error(result.message || 'Failed to fetch portfolio data');
        }
        
        console.log(`✅ Fetched ${result.count} portfolio records from backend`);
        return result.data;
    } catch (error) {
        console.error('Error fetching portfolio data:', error);
        throw error;
    }
};

/**
 * Fetches investment data from the backend API
 * @returns {Promise<Array>} Investment/roadmap data with all elements
 */
export const fetchInvestmentData = async () => {
    try {
        const response = await fetch('/api/investments');
        
        if (!response.ok) {
            throw new Error(`Failed to fetch investment data: ${response.status} ${response.statusText}`);
        }
        
        const result = await response.json();
        
        if (result.status !== 'success') {
            throw new Error(result.message || 'Failed to fetch investment data');
        }
        
        console.log(`✅ Fetched ${result.count} investment records from backend`);
        return result.data;
    } catch (error) {
        console.error('Error fetching investment data:', error);
        throw error;
    }
};

/**
 * Processes portfolio and investment data for the Gantt chart
 * This replaces the static JSON processing logic
 * @returns {Promise<Array>} Processed data ready for the Gantt chart
 */
export const processPortfolioDataFromAPI = async () => {
    try {
        console.log('🔄 Loading portfolio data from API...');
        
        // Fetch both datasets concurrently
        const [portfolioData, investmentData] = await Promise.all([
            fetchPortfolioData(),
            fetchInvestmentData()
        ]);
        
        console.log(`📊 Processing ${portfolioData.length} portfolio records with ${investmentData.length} investment records`);
        
        // Process the data using the same logic as the original dataService
        const processedData = portfolioData
            .map((item, index) => {
                // Debug: Log first few items to see data structure
                if (index < 3) {
                    console.log(`🔍 Portfolio item ${index}:`, item);
                }
                
                const investment = investmentData.find(inv =>
                    inv.INV_EXT_ID === item.CHILD_ID &&
                    inv.ROADMAP_ELEMENT === "Investment"
                );

                if (!investment) {
                    console.log(`❌ No investment record for CHILD_ID: ${item.CHILD_ID}`);
                    return null;
                }
                
                // Debug: Log matching investment
                if (index < 3) {
                    console.log(`🔍 Matching investment for ${item.CHILD_ID}:`, investment);
                }

                // Updated milestone mapping logic: Filter for SG3 milestones only
                const milestones = investmentData
                    .filter(inv =>
                        inv.INV_EXT_ID === item.CHILD_ID &&
                        (inv.ROADMAP_ELEMENT === "Milestones - Deployment" ||
                         inv.ROADMAP_ELEMENT === "Milestones - Other") &&
                        inv.TASK_NAME?.toLowerCase().includes('sg3') // Only SG3 milestones
                    )
                    .map(milestone => ({
                        date: milestone.TASK_START,
                        status: milestone.MILESTONE_STATUS,
                        label: milestone.TASK_NAME,
                        isSG3: true // All filtered milestones are SG3
                    }));

                const processedItem = {
                    id: item.CHILD_ID,
                    name: investment.INVESTMENT_NAME || item.CHILD_NAME,
                    parentId: item.COE_ROADMAP_PARENT_ID,
                    parentName: item.COE_ROADMAP_PARENT_NAME,
                    isProgram: item.COE_ROADMAP_PARENT_ID === item.CHILD_ID,
                    isDrillable: item.ROADMAP_OWNER === 1, // Using ROADMAP_OWNER instead of If_parent_exist
                    startDate: investment.TASK_START,
                    endDate: investment.TASK_FINISH,
                    status: investment.INV_OVERALL_STATUS,
                    sortOrder: investment.SortOrder || 0,
                    milestones
                };
                
                // Debug: Log final processed item
                if (index < 3) {
                    console.log(`🔍 Processed item ${index}:`, processedItem);
                    console.log(`📅 Raw dates from SQL - Start: "${investment.TASK_START}" (${typeof investment.TASK_START}), End: "${investment.TASK_FINISH}" (${typeof investment.TASK_FINISH})`);
                    console.log(`📅 Processed dates - Start: ${processedItem.startDate}, End: ${processedItem.endDate}`);
                }
                
                return processedItem;
            })
            .filter(Boolean)
            .sort((a, b) => {
                // First, sort by parent name to group programs together
                if (a.parentName !== b.parentName) {
                    return a.parentName.localeCompare(b.parentName);
                }
                // Within the same program, put the program itself first
                if (a.isProgram && !b.isProgram) return -1;
                if (!a.isProgram && b.isProgram) return 1;
                // Finally, sort by sortOrder
                return a.sortOrder - b.sortOrder;
            });

        console.log(`✅ Processed ${processedData.length} portfolio items for Gantt chart`);
        
        // Debug: Log sample of final data
        if (processedData.length > 0) {
            console.log(`📋 Sample processed data (first 3 items):`, processedData.slice(0, 3));
            console.log(`📊 Data structure check:`, {
                hasStartDates: processedData.filter(item => item.startDate).length,
                hasEndDates: processedData.filter(item => item.endDate).length,
                totalItems: processedData.length,
                sampleDates: processedData.slice(0, 3).map(item => ({
                    name: item.name,
                    start: item.startDate,
                    end: item.endDate
                }))
            });
        }
        
        return processedData;
        
    } catch (error) {
        console.error('❌ Error processing portfolio data from API:', error);
        throw error;
    }
};
