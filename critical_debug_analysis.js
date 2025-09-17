// CRITICAL DEBUG SCRIPT
// This will help us see exactly what's happening with the fetchProgramData function

async function debugFetchProgramDataInRealTime() {
    console.log('🔬 CRITICAL DEBUG: Starting real-time analysis of fetchProgramData...');
    
    try {
        // Step 1: Check if the function exists and what it returns
        console.log('\n=== STEP 1: Function Call Analysis ===');
        
        // Simulate the exact call from ProgramGanttChart.jsx
        const selectedPortfolioId = null; // or whatever value is being passed
        const options = { page: 1, limit: 1000 };
        
        console.log('🔍 Calling fetchProgramData with:');
        console.log('  selectedPortfolioId:', selectedPortfolioId);
        console.log('  options:', options);
        
        // Step 2: Check the API endpoint directly
        console.log('\n=== STEP 2: API Endpoint Analysis ===');
        const apiResponse = await fetch('/api/data');
        console.log('API Response status:', apiResponse.status);
        console.log('API Response ok:', apiResponse.ok);
        
        const apiData = await apiResponse.json();
        console.log('API Data status:', apiData.status);
        console.log('API Data structure:', {
            hasHierarchy: !!apiData.data?.hierarchy,
            hierarchyLength: apiData.data?.hierarchy?.length || 0,
            hasInvestment: !!apiData.data?.investment,
            investmentLength: apiData.data?.investment?.length || 0
        });
        
        // Step 3: Simulate the processing logic step by step
        console.log('\n=== STEP 3: Processing Logic Analysis ===');
        
        const hierarchyData = apiData.data.hierarchy;
        const investmentData = apiData.data.investment;
        
        // Filter hierarchy for Program and SubProgram data
        const programTypeData = hierarchyData.filter(item => 
            item.COE_ROADMAP_TYPE === 'Program' || item.COE_ROADMAP_TYPE === 'SubProgram'
        );
        console.log('🔍 Program/SubProgram records found:', programTypeData.length);
        
        // Apply portfolio filtering
        let filteredData = programTypeData;
        if (selectedPortfolioId) {
            filteredData = programTypeData.filter(item => 
                item.COE_ROADMAP_PARENT_ID === selectedPortfolioId ||
                programTypeData.some(parent => 
                    parent.CHILD_ID === item.COE_ROADMAP_PARENT_ID && 
                    parent.COE_ROADMAP_PARENT_ID === selectedPortfolioId
                )
            );
            console.log('🔍 Filtered for portfolio', selectedPortfolioId, ':', filteredData.length);
        } else {
            console.log('🔍 No portfolio filter, using all programs:', filteredData.length);
        }
        
        // Find parent programs (the critical step)
        const parentPrograms = filteredData.filter(item => 
            item.COE_ROADMAP_PARENT_ID === item.CHILD_ID && item.COE_ROADMAP_TYPE === 'Program'
        );
        console.log('🔍 Self-referencing parent programs:', parentPrograms.length);
        
        if (parentPrograms.length === 0) {
            console.log('🚨 CRITICAL ISSUE: No self-referencing parent programs found!');
            console.log('🚨 This means processedData will be empty!');
            console.log('🚨 This is why the UI shows "Loading..." indefinitely!');
            
            console.log('\n=== DIAGNOSTIC: Sample Program Records ===');
            filteredData.slice(0, 5).forEach((item, index) => {
                console.log(`Program ${index + 1}:`);
                console.log('  CHILD_ID:', item.CHILD_ID);
                console.log('  COE_ROADMAP_TYPE:', item.COE_ROADMAP_TYPE);
                console.log('  COE_ROADMAP_PARENT_ID:', item.COE_ROADMAP_PARENT_ID);
                console.log('  Self-referencing:', item.COE_ROADMAP_PARENT_ID === item.CHILD_ID);
            });
        }
        
        // Step 4: Check what would be returned
        console.log('\n=== STEP 4: Return Value Analysis ===');
        const finalResult = {
            data: [], // This will be empty if no parent programs
            totalCount: 0,
            page: 1,
            limit: 1000,
            hasMore: false,
            fromCache: false
        };
        
        console.log('🔍 Function would return:', finalResult);
        console.log('🔍 response.data.length would be:', finalResult.data.length);
        
        if (finalResult.data.length === 0) {
            console.log('🚨 ROOT CAUSE IDENTIFIED:');
            console.log('🚨 fetchProgramData returns empty array');
            console.log('🚨 ProgramGanttChart.jsx sets processedData to empty array');
            console.log('🚨 Component thinks data is loading but no data to display');
            console.log('🚨 Loading state never gets resolved because no content renders');
        }
        
    } catch (error) {
        console.error('❌ Debug analysis failed:', error);
    }
}

// Run the analysis
debugFetchProgramDataInRealTime();
