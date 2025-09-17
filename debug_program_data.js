const fetch = require('node-fetch');

async function debugProgramDataProcessing() {
    try {
        console.log('🔍 Debugging Program Data Processing...\n');
        
        // Test the API response structure
        console.log('=== Testing API Response ===');
        const response = await fetch('http://localhost:5000/api/data/program?page=1&limit=5');
        const apiData = await response.json();
        
        console.log('API Status:', apiData.status);
        console.log('Hierarchy Count:', apiData.data?.hierarchy?.length || 0);
        console.log('Investment Count:', apiData.data?.investment?.length || 0);
        
        if (apiData.data?.hierarchy?.length > 0) {
            console.log('\n=== Sample Hierarchy Record ===');
            const sampleHierarchy = apiData.data.hierarchy[0];
            console.log('CHILD_ID:', sampleHierarchy.CHILD_ID);
            console.log('CHILD_NAME:', sampleHierarchy.CHILD_NAME);
            console.log('COE_ROADMAP_TYPE:', sampleHierarchy.COE_ROADMAP_TYPE);
            console.log('COE_ROADMAP_PARENT_ID:', sampleHierarchy.COE_ROADMAP_PARENT_ID);
            console.log('COE_ROADMAP_PARENT_NAME:', sampleHierarchy.COE_ROADMAP_PARENT_NAME);
        }
        
        if (apiData.data?.investment?.length > 0) {
            console.log('\n=== Sample Investment Record ===');
            const sampleInvestment = apiData.data.investment[0];
            console.log('INV_EXT_ID:', sampleInvestment.INV_EXT_ID);
            console.log('INVESTMENT_NAME:', sampleInvestment.INVESTMENT_NAME);
            console.log('ROADMAP_ELEMENT:', sampleInvestment.ROADMAP_ELEMENT);
            console.log('TASK_START:', sampleInvestment.TASK_START);
            console.log('TASK_FINISH:', sampleInvestment.TASK_FINISH);
            console.log('INV_OVERALL_STATUS:', sampleInvestment.INV_OVERALL_STATUS);
        }
        
        // Check if we have Program records with self-referencing parent IDs
        const programRecords = apiData.data.hierarchy.filter(item => 
            item.COE_ROADMAP_TYPE === 'Program'
        );
        console.log('\n=== Program Records Analysis ===');
        console.log('Total Program records:', programRecords.length);
        
        const selfReferencingPrograms = programRecords.filter(item => 
            item.COE_ROADMAP_PARENT_ID === item.CHILD_ID
        );
        console.log('Self-referencing Programs:', selfReferencingPrograms.length);
        
        if (selfReferencingPrograms.length > 0) {
            console.log('Sample self-referencing program:', selfReferencingPrograms[0].CHILD_ID);
        }
        
        // Check for investment matches
        console.log('\n=== Investment Matching Analysis ===');
        const investmentRecords = apiData.data.investment.filter(inv => 
            inv.ROADMAP_ELEMENT === 'Investment'
        );
        console.log('Investment records with ROADMAP_ELEMENT = "Investment":', investmentRecords.length);
        
        // Check if any program IDs match investment INV_EXT_IDs
        const programIds = programRecords.map(p => p.CHILD_ID);
        const investmentIds = investmentRecords.map(inv => inv.INV_EXT_ID);
        const matches = programIds.filter(id => investmentIds.includes(id));
        console.log('Program IDs that have matching investments:', matches.length);
        
        if (matches.length > 0) {
            console.log('Sample matching ID:', matches[0]);
        }
        
    } catch (error) {
        console.error('❌ Debug failed:', error.message);
    }
}

debugProgramDataProcessing();
