// Test script for processRegionData function
import { processRegionData } from './src/services/apiDataService.js';

async function testRegionData() {
    try {
        const filters = {
            function: "Commercial",
            market: "Thailand"
        };
        
        console.log('Testing processRegionData with filters:', filters);
        const result = await processRegionData(filters);
        
        console.log('\n=== RESULT ===');
        console.log(JSON.stringify(result, null, 2));
        console.log('\n=== SUMMARY ===');
        console.log(`Found ${result.length} projects matching filters`);
        
        result.forEach((project, index) => {
            console.log(`\nProject ${index + 1}:`);
            console.log(`  ID: ${project.id}`);
            console.log(`  Name: ${project.name}`);
            console.log(`  Region: ${project.region}`);
            console.log(`  Market: ${project.market}`);
            console.log(`  Function: ${project.function}`);
            console.log(`  Tier: ${project.tier}`);
            console.log(`  Status: ${project.status}`);
            console.log(`  Start: ${project.startDate}`);
            console.log(`  End: ${project.endDate}`);
            console.log(`  Unphased: ${project.isUnphased}`);
            console.log(`  Phases: ${project.phases.length}`);
            console.log(`  Milestones: ${project.milestones.length}`);
            
            if (project.milestones.length > 0) {
                project.milestones.forEach((milestone, mIndex) => {
                    console.log(`    Milestone ${mIndex + 1}: ${milestone.label} (${milestone.date}) - ${milestone.status}`);
                });
            }
        });
        
    } catch (error) {
        console.error('Error testing processRegionData:', error);
    }
}

testRegionData();
