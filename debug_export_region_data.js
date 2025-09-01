// Debug script to export all processRegionData results to JSON files
// Run this in the browser console on the Region Roadmap page

async function exportRegionDataToJSON() {
    console.log('🚀 Starting comprehensive region data export...');
    
    try {
        // Step 1: Get raw API data
        console.log('\n=== STEP 1: Fetching raw API data ===');
        const apiResponse = await fetch('/api/data');
        const apiData = await apiResponse.json();
        
        console.log('API Status:', apiData.status);
        console.log('Hierarchy records:', apiData.data?.hierarchy?.length || 0);
        console.log('Investment records:', apiData.data?.investment?.length || 0);
        
        // Export raw API data
        const rawDataBlob = new Blob([JSON.stringify(apiData, null, 2)], { type: 'application/json' });
        const rawDataUrl = URL.createObjectURL(rawDataBlob);
        const rawDataLink = document.createElement('a');
        rawDataLink.href = rawDataUrl;
        rawDataLink.download = 'raw_api_data.json';
        rawDataLink.click();
        console.log('✅ Exported: raw_api_data.json');
        
        // Step 2: Test processRegionData with different filters
        console.log('\n=== STEP 2: Testing processRegionData with various filters ===');
        
        const testFilters = [
            { region: 'All', market: 'All', function: 'All', tier: 'All' },
            { region: 'All', market: 'All', function: 'Supply Chain', tier: 'All' },
            { region: 'EMEA', market: 'All', function: 'All', tier: 'All' },
            { region: 'All', market: 'All', function: 'Commercial', tier: 'All' },
            { region: 'Global', market: 'All', function: 'All', tier: 'All' }
        ];
        
        // We need to manually implement processRegionData logic since we can't import it
        const investmentResponse = await fetch('/api/investments?page=1&per_page=2000');
        const investmentResult = await investmentResponse.json();
        const investmentData = investmentResult.data || [];
        
        console.log('Investment data loaded:', investmentData.length, 'records');
        
        for (const filters of testFilters) {
            console.log(`\n🔍 Testing filters:`, filters);
            
            // Manual implementation of processRegionData logic
            const projectData = investmentData.filter(item =>
                ["Non-Clarity item", "Project", "Programs"].includes(item.CLRTY_INV_TYPE)
            );
            
            console.log('Step 1 - Project data after type filter:', projectData.length);
            
            // Group by project ID
            const projectGroups = {};
            projectData.forEach(item => {
                if (!projectGroups[item.INV_EXT_ID]) {
                    projectGroups[item.INV_EXT_ID] = [];
                }
                projectGroups[item.INV_EXT_ID].push(item);
            });
            
            console.log('Step 2 - Project groups created:', Object.keys(projectGroups).length);
            
            const processedProjects = [];
            
            Object.keys(projectGroups).forEach(projectId => {
                const projectItems = projectGroups[projectId];
                
                // Filter out records without INV_MARKET
                const itemsWithMarket = projectItems.filter(item => 
                    item.INV_MARKET && 
                    item.INV_MARKET.trim() !== '' &&
                    item.INV_MARKET !== '-Unrecognised-'
                );
                
                if (itemsWithMarket.length === 0) {
                    return;
                }
                
                // Find main investment record
                const mainRecord = itemsWithMarket.find(item =>
                    item.ROADMAP_ELEMENT === "Investment"
                );
                
                if (!mainRecord) {
                    return;
                }
                
                // Parse market
                const parseMarket = (invMarket) => {
                    if (!invMarket) return { region: '', market: '' };
                    const parts = invMarket.split('/');
                    return {
                        region: parts[0] || '',
                        market: parts[1] || ''
                    };
                };
                const { region, market } = parseMarket(mainRecord.INV_MARKET);
                
                // Apply filters
                if (filters.region && filters.region !== 'All' && region !== filters.region) {
                    console.log(`🚫 ${projectId} filtered by region: ${region} !== ${filters.region}`);
                    return;
                }
                if (filters.market && filters.market !== 'All' && market !== filters.market) {
                    console.log(`🚫 ${projectId} filtered by market: ${market} !== ${filters.market}`);
                    return;
                }
                if (filters.function && filters.function !== 'All' && mainRecord.INV_FUNCTION !== filters.function) {
                    console.log(`🚫 ${projectId} filtered by function: ${mainRecord.INV_FUNCTION} !== ${filters.function}`);
                    return;
                }
                if (filters.tier && filters.tier !== 'All' && mainRecord.INV_TIER?.toString() !== filters.tier) {
                    console.log(`🚫 ${projectId} filtered by tier: ${mainRecord.INV_TIER} !== ${filters.tier}`);
                    return;
                }
                
                console.log(`✅ ${projectId} (${mainRecord.INVESTMENT_NAME}) passed filters`);
                
                // Create project object
                processedProjects.push({
                    id: projectId,
                    name: mainRecord.INVESTMENT_NAME,
                    region,
                    market,
                    function: mainRecord.INV_FUNCTION || '',
                    tier: mainRecord.INV_TIER?.toString() || '',
                    startDate: mainRecord.TASK_START,
                    endDate: mainRecord.TASK_FINISH,
                    status: mainRecord.INV_OVERALL_STATUS,
                    rawRecord: mainRecord // Include raw record for debugging
                });
            });
            
            console.log(`Results for ${JSON.stringify(filters)}: ${processedProjects.length} projects`);
            
            // Export this filter result
            const filterName = `${filters.region}_${filters.market}_${filters.function}_${filters.tier}`.replace(/[^a-zA-Z0-9]/g, '_');
            const filterBlob = new Blob([JSON.stringify({
                filters: filters,
                results: processedProjects,
                summary: {
                    totalRawRecords: investmentData.length,
                    afterTypeFilter: projectData.length,
                    projectGroups: Object.keys(projectGroups).length,
                    finalResults: processedProjects.length
                }
            }, null, 2)], { type: 'application/json' });
            const filterUrl = URL.createObjectURL(filterBlob);
            const filterLink = document.createElement('a');
            filterLink.href = filterUrl;
            filterLink.download = `region_data_${filterName}.json`;
            filterLink.click();
            console.log(`✅ Exported: region_data_${filterName}.json`);
        }
        
        // Step 3: Analyze Supply Chain specifically
        console.log('\n=== STEP 3: Deep dive into Supply Chain data ===');
        
        const supplyChainRecords = investmentData.filter(item => 
            item.INV_FUNCTION === 'Supply Chain'
        );
        
        console.log('Total Supply Chain records:', supplyChainRecords.length);
        
        // Group Supply Chain by project
        const supplyChainGroups = {};
        supplyChainRecords.forEach(item => {
            if (!supplyChainGroups[item.INV_EXT_ID]) {
                supplyChainGroups[item.INV_EXT_ID] = [];
            }
            supplyChainGroups[item.INV_EXT_ID].push(item);
        });
        
        const supplyChainAnalysis = {
            totalRecords: supplyChainRecords.length,
            uniqueProjects: Object.keys(supplyChainGroups).length,
            projects: {}
        };
        
        Object.keys(supplyChainGroups).forEach(projectId => {
            const records = supplyChainGroups[projectId];
            const investmentRecord = records.find(r => r.ROADMAP_ELEMENT === 'Investment');
            
            supplyChainAnalysis.projects[projectId] = {
                name: investmentRecord?.INVESTMENT_NAME || 'NO INVESTMENT RECORD',
                hasInvestmentRecord: !!investmentRecord,
                hasMarket: !!(investmentRecord?.INV_MARKET && investmentRecord.INV_MARKET.trim() !== ''),
                market: investmentRecord?.INV_MARKET || 'NO MARKET',
                type: investmentRecord?.CLRTY_INV_TYPE || 'NO TYPE',
                isCorrectType: investmentRecord && ["Non-Clarity item", "Project", "Programs"].includes(investmentRecord.CLRTY_INV_TYPE),
                wouldBeProcessed: investmentRecord && 
                                investmentRecord.INV_MARKET && 
                                investmentRecord.INV_MARKET.trim() !== '' &&
                                ["Non-Clarity item", "Project", "Programs"].includes(investmentRecord.CLRTY_INV_TYPE),
                allRecords: records
            };
        });
        
        // Export Supply Chain analysis
        const scBlob = new Blob([JSON.stringify(supplyChainAnalysis, null, 2)], { type: 'application/json' });
        const scUrl = URL.createObjectURL(scBlob);
        const scLink = document.createElement('a');
        scLink.href = scUrl;
        scLink.download = 'supply_chain_analysis.json';
        scLink.click();
        console.log('✅ Exported: supply_chain_analysis.json');
        
        console.log('\n=== EXPORT COMPLETE ===');
        console.log('Files exported:');
        console.log('1. raw_api_data.json - Raw API response');
        console.log('2. region_data_*.json - Processed data for each filter combination');
        console.log('3. supply_chain_analysis.json - Detailed Supply Chain analysis');
        console.log('\nCheck your Downloads folder for the JSON files!');
        
    } catch (error) {
        console.error('❌ Export failed:', error);
    }
}

// Instructions
console.log('🚀 Run exportRegionDataToJSON() to export all data for analysis');
console.log('📁 Files will be downloaded to your Downloads folder');
