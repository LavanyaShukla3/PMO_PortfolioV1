/**
 * Debug SubProgram Data Matching - Find why only 3 records show
 * This will help understand the mismatch between hierarchy and investment data
 */

const fetch = require('node-fetch');

async function apiCall(endpoint, params) {
    const url = new URL(`http://localhost:5000${endpoint}`);
    
    Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined) {
            url.searchParams.append(key, params[key]);
        }
    });
    
    const response = await fetch(url.toString());
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
}

async function debugSubProgramDataMatching() {
    console.log('🔍 Debug SubProgram Data Matching\n');
    
    try {
        // Get SubProgram data from fast API
        const result = await apiCall('/api/data/subprogram', { page: 1, limit: 1000 });
        
        if (result.status !== 'success') {
            throw new Error(result.message || 'Failed to fetch subprogram data');
        }
        
        const hierarchyData = result.data.hierarchy;
        const investmentData = result.data.investment;

        console.log('📊 Raw API Data:');
        console.log(`   Hierarchy records: ${hierarchyData.length}`);
        console.log(`   Investment records: ${investmentData.length}`);

        // Filter for Sub-Program records
        const subProgramTypeData = hierarchyData.filter(item => 
            item.COE_ROADMAP_TYPE === 'Sub-Program'
        );

        console.log(`\n📋 Sub-Program Hierarchy Records: ${subProgramTypeData.length}`);

        // Check how many Sub-Programs have matching investment data
        let matchedCount = 0;
        let unmatchedCount = 0;
        const unmatchedSubPrograms = [];
        const matchedSubPrograms = [];

        subProgramTypeData.forEach(subProgram => {
            const projectId = subProgram.CHILD_ID;
            
            // Find investment data for this sub-program
            const projectInvestments = investmentData.filter(inv => 
                inv.INV_EXT_ID === projectId
            );
            
            if (projectInvestments.length > 0) {
                matchedCount++;
                const projectInfo = projectInvestments.find(inv => inv.ROADMAP_ELEMENT === 'Investment') || projectInvestments[0];
                matchedSubPrograms.push({
                    id: projectId,
                    name: subProgram.CHILD_NAME,
                    parentName: subProgram.COE_ROADMAP_PARENT_NAME,
                    investmentName: projectInfo.INVESTMENT_NAME,
                    investmentCount: projectInvestments.length
                });
            } else {
                unmatchedCount++;
                unmatchedSubPrograms.push({
                    id: projectId,
                    name: subProgram.CHILD_NAME,
                    parentName: subProgram.COE_ROADMAP_PARENT_NAME
                });
            }
        });

        console.log(`\n🎯 Matching Results:`);
        console.log(`   Sub-Programs WITH investment data: ${matchedCount}`);
        console.log(`   Sub-Programs WITHOUT investment data: ${unmatchedCount}`);

        console.log(`\n✅ MATCHED Sub-Programs (showing in UI):`);
        matchedSubPrograms.forEach((item, index) => {
            console.log(`   ${index + 1}. ${item.name} (${item.id})`);
            console.log(`      Parent: ${item.parentName}`);
            console.log(`      Investment: ${item.investmentName}`);
            console.log(`      Records: ${item.investmentCount}`);
        });

        console.log(`\n❌ UNMATCHED Sub-Programs (missing from UI):`);
        unmatchedSubPrograms.slice(0, 10).forEach((item, index) => {
            console.log(`   ${index + 1}. ${item.name} (${item.id})`);
            console.log(`      Parent: ${item.parentName}`);
        });
        
        if (unmatchedSubPrograms.length > 10) {
            console.log(`   ... and ${unmatchedSubPrograms.length - 10} more`);
        }

        // Check if we should show ALL Sub-Programs with default data
        console.log(`\n💡 SOLUTION OPTIONS:`);
        console.log(`   Option 1: Show only Sub-Programs with investment data (current: ${matchedCount} items)`);
        console.log(`   Option 2: Show ALL Sub-Programs with default data for missing investment (total: ${subProgramTypeData.length} items)`);
        
        if (unmatchedCount > 0) {
            console.log(`\n🔧 To show all ${subProgramTypeData.length} Sub-Programs, we need to:`);
            console.log(`   1. Remove the "if (projectInvestments.length > 0)" condition`);
            console.log(`   2. Add default values for Sub-Programs without investment data`);
            console.log(`   3. This will match the behavior you expect from /api/data`);
        }

    } catch (error) {
        console.error('❌ Debug failed:', error.message);
    }
}

// Run the debug
debugSubProgramDataMatching();
