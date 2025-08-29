// Test 2: API Data Service Processing
import { processSubProgramData } from './src/services/apiDataService.js';

console.log('🔧 Test 2: Testing API Data Service Processing...');

async function testApiDataService() {
    try {
        console.log('\n📡 Testing processSubProgramData function...');
        
        // Test without selectedProgramId (should return all SubPrograms)
        console.log('🔄 Calling processSubProgramData()...');
        const data = await processSubProgramData();
        
        console.log('\n✅ SUCCESS: API Data Service Working');
        console.log('📦 Processed Data:');
        console.log('  - Total SubProgram Items:', data.length);
        
        if (data.length > 0) {
            console.log('\n📋 Sample Processed SubProgram Data:');
            const sample = data[0];
            console.log('  - ID:', sample.id);
            console.log('  - Name:', sample.name);
            console.log('  - Type:', sample.type);
            console.log('  - Parent ID:', sample.parentId);
            console.log('  - Phase Data Count:', sample.phaseData?.length || 0);
            console.log('  - Milestones Count:', sample.milestones?.length || 0);
            console.log('  - Is Drillable:', sample.isDrillable);
            
            console.log('\n📋 Full Sample Record:');
            console.log(JSON.stringify(sample, null, 2));
            
            // Show phase data details
            if (sample.phaseData && sample.phaseData.length > 0) {
                console.log('\n📋 Sample Phase Data:');
                console.log(JSON.stringify(sample.phaseData.slice(0, 2), null, 2));
            }
            
            // Show milestone details
            if (sample.milestones && sample.milestones.length > 0) {
                console.log('\n📋 Sample Milestone Data:');
                console.log(JSON.stringify(sample.milestones.slice(0, 2), null, 2));
            }
        }
        
        return data;
        
    } catch (error) {
        console.error('\n❌ FAILED: API Data Service Error');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        return null;
    }
}

testApiDataService();
