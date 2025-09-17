/**
 * Debug SubProgram Investment Matching
 * Check how Sub-Program IDs match with investment data
 */

const fetch = require('node-fetch');

async function debugSubProgramInvestmentMatching() {
    console.log('🔍 Debugging SubProgram Investment Data Matching\n');
    
    try {
        const response = await fetch('http://localhost:5000/api/data/subprogram?page=1&limit=1000');
        const data = await response.json();
        
        if (data.status === 'success') {
            const hierarchyData = data.data.hierarchy;
            const investmentData = data.data.investment;
            
            console.log(`📊 Data available:`);
            console.log(`   Hierarchy records: ${hierarchyData.length}`);
            console.log(`   Investment records: ${investmentData.length}`);
            
            // Get some sample Sub-Program IDs
            const sampleSubPrograms = hierarchyData.slice(0, 5);
            console.log('\n📋 Sample Sub-Program IDs:');
            sampleSubPrograms.forEach((subProgram, index) => {
                console.log(`   ${index + 1}. ${subProgram.CHILD_ID} - ${subProgram.CHILD_NAME}`);
            });
            
            // Get some sample Investment IDs
            const sampleInvestments = investmentData.slice(0, 10);
            console.log('\n💰 Sample Investment IDs:');
            sampleInvestments.forEach((investment, index) => {
                console.log(`   ${index + 1}. ${investment.INV_EXT_ID} - ${investment.INVESTMENT_NAME || 'No Name'} (${investment.ROADMAP_ELEMENT})`);
            });
            
            // Check for exact matches
            console.log('\n🔍 Checking for exact ID matches:');
            let matchCount = 0;
            sampleSubPrograms.forEach(subProgram => {
                const match = investmentData.find(inv => inv.INV_EXT_ID === subProgram.CHILD_ID);
                if (match) {
                    console.log(`   ✅ MATCH: ${subProgram.CHILD_ID} -> ${match.INVESTMENT_NAME} (${match.ROADMAP_ELEMENT})`);
                    matchCount++;
                } else {
                    console.log(`   ❌ NO MATCH: ${subProgram.CHILD_ID}`);
                }
            });
            
            console.log(`\n📊 Match Statistics:`);
            console.log(`   Exact matches found: ${matchCount}/${sampleSubPrograms.length}`);
            
            // Check all investment elements types
            const elementTypes = {};
            investmentData.forEach(inv => {
                const element = inv.ROADMAP_ELEMENT || 'No Element';
                elementTypes[element] = (elementTypes[element] || 0) + 1;
            });
            
            console.log('\n📊 Investment ROADMAP_ELEMENT Types:');
            Object.entries(elementTypes).forEach(([element, count]) => {
                console.log(`   ${element}: ${count} records`);
            });
            
            // Look for Investment elements specifically
            const investmentElements = investmentData.filter(inv => inv.ROADMAP_ELEMENT === 'Investment');
            console.log(`\n💰 Investment Elements Found: ${investmentElements.length}`);
            
            if (investmentElements.length > 0) {
                console.log('Sample Investment Elements:');
                investmentElements.slice(0, 5).forEach((inv, index) => {
                    console.log(`   ${index + 1}. ${inv.INV_EXT_ID} - ${inv.INVESTMENT_NAME} (${inv.INV_OVERALL_STATUS})`);
                });
                
                // Check if any Investment element IDs match Sub-Program IDs
                console.log('\n🔍 Checking Investment element matches with Sub-Programs:');
                let investmentMatchCount = 0;
                sampleSubPrograms.forEach(subProgram => {
                    const match = investmentElements.find(inv => inv.INV_EXT_ID === subProgram.CHILD_ID);
                    if (match) {
                        console.log(`   ✅ INVESTMENT MATCH: ${subProgram.CHILD_ID} -> ${match.INVESTMENT_NAME}`);
                        investmentMatchCount++;
                    }
                });
                
                console.log(`\nInvestment element matches: ${investmentMatchCount}/${sampleSubPrograms.length}`);
            }
            
        }
        
    } catch (error) {
        console.error('❌ Debug failed:', error.message);
    }
}

// Run the debug
debugSubProgramInvestmentMatching();
