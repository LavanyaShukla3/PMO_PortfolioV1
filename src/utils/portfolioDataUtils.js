/**
 * Data processing utilities for Portfolio Gantt Chart
 * Processes live API data from backend and transforms it for the Gantt chart
 */

/**
 * Fetches unified roadmap data from the backend API (all types)
 * @returns {Promise<Array>} All roadmap data including Portfolio, Program, SubProgram types
 */
export const fetchUnifiedRoadmapData = async () => {
    try {
        const response = await fetch('/api/data'); // Use the unified endpoint
        
        if (!response.ok) {
            throw new Error(`Failed to fetch unified roadmap data: ${response.status} ${response.statusText}`);
        }
        
        const result = await response.json();
        
        if (result.status !== 'success') {
            throw new Error(result.message || 'Failed to fetch unified roadmap data');
        }
        
        // Extract hierarchy data from structured response
        const hierarchyData = result.data.hierarchy;
        console.log(`✅ Fetched ${hierarchyData.length} unified roadmap records from backend`);
        return hierarchyData;
    } catch (error) {
        console.error('Error fetching unified roadmap data:', error);
        throw error;
    }
};

/**
 * Fetches investment data from the backend API
 * @returns {Promise<Array>} Investment/roadmap data with all elements
 */
export const fetchInvestmentData = async () => {
    try {
        const response = await fetch('/api/data'); // Use the unified endpoint
        
        if (!response.ok) {
            throw new Error(`Failed to fetch investment data: ${response.status} ${response.statusText}`);
        }
        
        const result = await response.json();
        
        if (result.status !== 'success') {
            throw new Error(result.message || 'Failed to fetch investment data');
        }
        
        // Extract investment data from structured response
        const investmentData = result.data.investment;
        console.log(`✅ Fetched ${investmentData.length} investment records from backend`);
        return investmentData;
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
        
        // Fetch unified data once to get both hierarchy and investment data
        const response = await fetch('/api/data');
        
        if (!response.ok) {
            throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
        }
        
        const result = await response.json();
        
        if (result.status !== 'success') {
            throw new Error(result.message || 'Failed to fetch data');
        }
        
        const unifiedRoadmapData = result.data.hierarchy;
        const investmentData = result.data.investment;
        
        // Filter for Portfolio-type entries only
        const portfolioData = unifiedRoadmapData.filter(item => item.COE_ROADMAP_TYPE === 'Portfolio');
        
        console.log(`📊 Processing ${portfolioData.length} portfolio records with ${investmentData.length} investment records`);
        
        // First pass: Process the basic portfolio data structure
        const basicProcessedData = portfolioData
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
                    isDrillable: false, // Will be updated in second pass
                    startDate: investment.TASK_START,
                    endDate: investment.TASK_FINISH,
                    status: investment.INV_OVERALL_STATUS,
                    sortOrder: investment.SortOrder || 0,
                    milestones,
                    coeRoadmapType: item.COE_ROADMAP_TYPE // Keep original type for drill-through logic
                };
                
                // Debug: Log final processed item
                if (index < 3) {
                    console.log(`🔍 Processed item ${index}:`, processedItem);
                    console.log(`📅 Raw dates from SQL - Start: "${investment.TASK_START}" (${typeof investment.TASK_START}), End: "${investment.TASK_FINISH}" (${typeof investment.TASK_FINISH})`);
                    console.log(`📅 Processed dates - Start: ${processedItem.startDate}, End: ${processedItem.endDate}`);
                }
                
                return processedItem;
            })
            .filter(Boolean);

        // Second pass: Determine isDrillable based on CHILD_ID === COE_ROADMAP_PARENT_ID relationships
        // A Portfolio (COE_ROADMAP_TYPE=Portfolio) is drillable if there are Program entries (COE_ROADMAP_TYPE=Program) 
        // where COE_ROADMAP_PARENT_ID === this Portfolio's CHILD_ID
        
        // Create a set of CHILD_IDs that are referenced as parents by Program entries
        const programData = unifiedRoadmapData.filter(item => item.COE_ROADMAP_TYPE === 'Program');
        const portfoliosWithPrograms = new Set(
            programData
                .map(item => item.COE_ROADMAP_PARENT_ID)
                .filter(Boolean)
        );
        
        console.log(`🔍 Found ${portfoliosWithPrograms.size} portfolios that have program children:`, Array.from(portfoliosWithPrograms));
        console.log(`🎯 Program entries found: ${programData.length}`);
        console.log(`📋 Sample program data:`, programData.slice(0, 3).map(p => ({
            id: p.CHILD_ID,
            name: p.CHILD_NAME,
            parentId: p.COE_ROADMAP_PARENT_ID,
            type: p.COE_ROADMAP_TYPE
        })));
        
        // Update isDrillable flag
        const finalProcessedData = basicProcessedData.map(item => {
            const isDrillable = item.coeRoadmapType === 'Portfolio' && portfoliosWithPrograms.has(item.id);
            if (isDrillable) {
                console.log(`✅ Portfolio "${item.name}" (${item.id}) is drillable - has program children`);
            }
            return {
                ...item,
                isDrillable
            };
        });

        const sortedData = finalProcessedData.sort((a, b) => {
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

        console.log(`✅ Processed ${sortedData.length} portfolio items for Gantt chart`);
        console.log(`🎯 Drillable items: ${sortedData.filter(item => item.isDrillable).length}`);
        
        // Debug: Log sample of final data
        if (sortedData.length > 0) {
            console.log(`📋 Sample processed data (first 3 items):`, sortedData.slice(0, 3));
            console.log(`🔗 Drillable items:`, sortedData.filter(item => item.isDrillable).map(item => ({
                id: item.id,
                name: item.name,
                type: item.coeRoadmapType
            })));
            console.log(`📊 Data structure check:`, {
                hasStartDates: sortedData.filter(item => item.startDate).length,
                hasEndDates: sortedData.filter(item => item.endDate).length,
                totalItems: sortedData.length,
                drillableItems: sortedData.filter(item => item.isDrillable).length,
                portfolioEntries: sortedData.filter(item => item.coeRoadmapType === 'Portfolio').length,
                sampleDates: sortedData.slice(0, 3).map(item => ({
                    name: item.name,
                    start: item.startDate,
                    end: item.endDate
                }))
            });
        }
        
        return sortedData;
        
    } catch (error) {
        console.error('❌ Error processing portfolio data from API:', error);
        throw error;
    }
};
