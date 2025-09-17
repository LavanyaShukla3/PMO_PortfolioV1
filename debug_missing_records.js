// Debug script to investigate missing records
// Run with: node debug_missing_records.js

const fetch = require('node-fetch');

async function debugMissingRecords() {
    try {
        console.log('🔍 Fetching data from backend...');
        
        const response = await fetch('http://localhost:5000/api/data');
        const result = await response.json();
        
        if (result.status !== 'success') {
            console.error('❌ API Error:', result.message);
            return;
        }
        
        const hierarchyData = result.data.hierarchy;
        const investmentData = result.data.investment;
        
        console.log(`📊 Total hierarchy records: ${hierarchyData.length}`);
        console.log(`📊 Total investment records: ${investmentData.length}`);
        
        // Find the specific missing records mentioned by user
        const missingRecords = [
            'PROG000328', // Account IQ
            'PROG000268'  // B2B PepsiConnect
        ];
        
        console.log('\n🔍 Investigating specific missing records:');
        
        for (const recordId of missingRecords) {
            console.log(`\n--- Investigating ${recordId} ---`);
            
            // Check hierarchy data
            const hierarchyRecord = hierarchyData.find(h => h.CHILD_ID === recordId);
            if (hierarchyRecord) {
                console.log('✅ Found in hierarchy:', {
                    CHILD_ID: hierarchyRecord.CHILD_ID,
                    CHILD_NAME: hierarchyRecord.CHILD_NAME,
                    COE_ROADMAP_TYPE: hierarchyRecord.COE_ROADMAP_TYPE,
                    COE_ROADMAP_PARENT_ID: hierarchyRecord.COE_ROADMAP_PARENT_ID,
                    COE_ROADMAP_PARENT_NAME: hierarchyRecord.COE_ROADMAP_PARENT_NAME
                });
            } else {
                console.log('❌ NOT found in hierarchy');
            }
            
            // Check investment data
            const investmentRecord = investmentData.find(i => i.INV_EXT_ID === recordId && i.ROADMAP_ELEMENT === 'Investment');
            if (investmentRecord) {
                console.log('✅ Found investment data:', {
                    INV_EXT_ID: investmentRecord.INV_EXT_ID,
                    INVESTMENT_NAME: investmentRecord.INVESTMENT_NAME,
                    ROADMAP_ELEMENT: investmentRecord.ROADMAP_ELEMENT,
                    INV_OVERALL_STATUS: investmentRecord.INV_OVERALL_STATUS,
                    TASK_START: investmentRecord.TASK_START,
                    TASK_FINISH: investmentRecord.TASK_FINISH
                });
            } else {
                console.log('❌ NO investment data found');
                
                // Check if there are any investment records with this ID (different ROADMAP_ELEMENT)
                const anyInvestmentRecord = investmentData.filter(i => i.INV_EXT_ID === recordId);
                if (anyInvestmentRecord.length > 0) {
                    console.log('📋 Found other investment records with this ID:');
                    anyInvestmentRecord.forEach(record => {
                        console.log(`  - ROADMAP_ELEMENT: ${record.ROADMAP_ELEMENT}, TASK_NAME: ${record.TASK_NAME}`);
                    });
                }
            }
        }
        
        // Now simulate the portfolio processing logic
        console.log('\n🔄 Simulating full portfolio processing logic...');
        
        const portfolioRecords = hierarchyData.filter(item => 
            item.COE_ROADMAP_TYPE === 'Portfolio'
        );
        
        console.log(`📊 Portfolio records found: ${portfolioRecords.length}`);
        
        // Group by PTF ID
        const portfolioGroups = {};
        portfolioRecords.forEach(portfolio => {
            const ptfId = portfolio.COE_ROADMAP_PARENT_ID;
            if (!portfolioGroups[ptfId]) {
                portfolioGroups[ptfId] = [];
            }
            portfolioGroups[ptfId].push(portfolio);
        });
        
        const ptfIds = Object.keys(portfolioGroups);
        console.log(`📊 PTF groups: ${ptfIds.length}`);
        
        // Process all portfolios and show which ones would be included
        const processedData = [];
        
        for (const ptfId of ptfIds) {
            const portfoliosInGroup = portfolioGroups[ptfId];
            
            for (const portfolio of portfoliosInGroup) {
                const investment = investmentData.find(inv => 
                    inv.INV_EXT_ID === portfolio.CHILD_ID && inv.ROADMAP_ELEMENT === 'Investment'
                );
                
                const portfolioData = {
                    id: portfolio.CHILD_ID,
                    name: investment ? investment.INVESTMENT_NAME : portfolio.CHILD_NAME,
                    parentId: ptfId,
                    parentName: portfolio.COE_ROADMAP_PARENT_NAME,
                    hasInvestmentData: !!investment,
                    status: investment ? investment.INV_OVERALL_STATUS : 'No Investment Data'
                };
                
                processedData.push(portfolioData);
                
                // Log our target records
                if (missingRecords.includes(portfolio.CHILD_ID)) {
                    console.log(`\n✅ TARGET RECORD ${portfolio.CHILD_ID}:`, portfolioData);
                }
            }
        }
        
        console.log(`\n📊 Total processed portfolios: ${processedData.length}`);
        console.log(`📊 Portfolios with investment data: ${processedData.filter(p => p.hasInvestmentData).length}`);
        console.log(`📊 Portfolios without investment data: ${processedData.filter(p => !p.hasInvestmentData).length}`);
        
        // Show all portfolios without investment data
        const portfoliosWithoutInvestment = processedData.filter(p => !p.hasInvestmentData);
        if (portfoliosWithoutInvestment.length > 0) {
            console.log('\n📋 All portfolios without investment data:');
            portfoliosWithoutInvestment.forEach(p => {
                console.log(`  - ${p.id}: ${p.name} (${p.parentName})`);
            });
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

// Install node-fetch if needed: npm install node-fetch@2
debugMissingRecords();
