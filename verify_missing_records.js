const fetch = require('node-fetch');

async function verifyMissingRecords() {
    try {
        console.log('🔍 Fetching full dataset from backend...');
        const response = await fetch('http://localhost:5000/api/data');
        const data = await response.json();
        
        console.log(`📊 Total dataset received:
- Hierarchy records: ${data.data?.hierarchy?.length || 0}
- Investment records: ${data.data?.investment?.length || 0}`);

        // Look for the specific missing records
        const targetRecords = [
            'PROG000328', // Account IQ Programs
            'PROG000268'  // B2B PepsiConnect
        ];

        console.log('\n🎯 Searching for target records...');
        
        targetRecords.forEach(programId => {
            // Find in hierarchy data  
            const hierarchyRecord = data.data?.hierarchy?.find(h => h.CHILD_ID === programId);
            
            // Find investment data for this program
            const investmentRecords = data.data?.investment?.filter(inv => inv.PROGRAM_ID === programId) || [];
            
            console.log(`\n📋 ${programId}:`);
            if (hierarchyRecord) {
                console.log(`  ✅ Found in hierarchy: "${hierarchyRecord.CHILD_NAME}"`);
                console.log(`  📍 Full path: ${hierarchyRecord.HIERARCHY_NAME} > ${hierarchyRecord.COE_ROADMAP_PARENT_NAME} > ${hierarchyRecord.CHILD_NAME}`);
            } else {
                console.log(`  ❌ NOT found in hierarchy data`);
            }
            
            console.log(`  💰 Investment records: ${investmentRecords.length}`);
            if (investmentRecords.length > 0) {
                investmentRecords.forEach(inv => {
                    console.log(`    - ${inv.INVESTMENT_NAME} (${inv.INVESTMENT_ID}) - Status: ${inv.PROJECT_HEALTH_STATUS || 'Unknown'}`);
                });
            }
        });

        // Now simulate the frontend processing
        console.log('\n🔧 Simulating frontend data processing...');
        
        // This mimics the processPortfolioDataFromFullDataset function
        const hierarchyMap = new Map();
        data.data?.hierarchy?.forEach(item => {
            const key = `${item.COE_ROADMAP_PARENT_ID}_${item.CHILD_ID}`;
            hierarchyMap.set(key, item);
        });

        const investmentsByProgram = new Map();
        data.data?.investment?.forEach(inv => {
            const programId = inv.PROGRAM_ID;
            if (!investmentsByProgram.has(programId)) {
                investmentsByProgram.set(programId, []);
            }
            investmentsByProgram.get(programId).push(inv);
        });

        // Process portfolio records
        const portfolioRecords = [];
        for (const [key, hierarchyItem] of hierarchyMap.entries()) {
            const investments = investmentsByProgram.get(hierarchyItem.CHILD_ID) || [];
            
            const portfolioRecord = {
                id: `${hierarchyItem.COE_ROADMAP_PARENT_ID}_${hierarchyItem.CHILD_ID}`,
                portfolioId: hierarchyItem.COE_ROADMAP_PARENT_ID,
                portfolioName: hierarchyItem.COE_ROADMAP_PARENT_NAME,
                programId: hierarchyItem.CHILD_ID,
                programName: hierarchyItem.CHILD_NAME,
                hasInvestments: investments.length > 0,
                investmentCount: investments.length,
                investments: investments
            };
            
            portfolioRecords.push(portfolioRecord);
        }

        console.log(`📈 Processed ${portfolioRecords.length} portfolio records total`);

        // Check if our target records are in the processed data
        console.log('\n🎯 Checking processed portfolio records...');
        targetRecords.forEach(programId => {
            const portfolioRecord = portfolioRecords.find(p => p.programId === programId);
            if (portfolioRecord) {
                console.log(`  ✅ ${programId} found in processed data:`);
                console.log(`    - Portfolio: ${portfolioRecord.portfolioName}`);
                console.log(`    - Program: ${portfolioRecord.programName}`);
                console.log(`    - Has investments: ${portfolioRecord.hasInvestments}`);
                console.log(`    - Investment count: ${portfolioRecord.investmentCount}`);
            } else {
                console.log(`  ❌ ${programId} NOT found in processed portfolio data`);
            }
        });

        // Show sample of processed records for verification
        console.log('\n📋 Sample of processed portfolio records:');
        portfolioRecords.slice(0, 5).forEach(record => {
            console.log(`  ${record.programId}: ${record.programName} (${record.investmentCount} investments)`);
        });

        console.log('\n✅ Verification complete!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

verifyMissingRecords();
