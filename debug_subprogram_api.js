/**
 * Debug script to test SubProgram API response
 * Run this in the browser console while on the SubProgram page
 */

async function debugSubProgramAPI() {
    console.log('🔍 Starting SubProgram API Debug...');
    
    try {
        // Test the API directly
        const response = await fetch('http://localhost:5000/api/data/subprogram?page=1&limit=1000&_timestamp=' + Date.now());
        const data = await response.json();
        
        console.log('📡 Raw API Response:', data);
        console.log('📊 Hierarchy Data Count:', data.data?.hierarchy?.length || 0);
        console.log('📊 Investment Data Count:', data.data?.investment?.length || 0);
        
        if (data.data?.hierarchy?.length > 0) {
            console.log('📋 First 3 Hierarchy Records:');
            data.data.hierarchy.slice(0, 3).forEach((item, index) => {
                console.log(`  ${index + 1}. ${item.CHILD_NAME} (${item.CHILD_ID})`);
            });
        }
        
        if (data.data?.investment?.length > 0) {
            console.log('📋 First 10 Investment Records:');
            data.data.investment.slice(0, 10).forEach((item, index) => {
                console.log(`  ${index + 1}. ${item.INV_EXT_ID} - ${item.ROADMAP_ELEMENT} - ${item.TASK_NAME} (${item.TASK_START} to ${item.TASK_FINISH})`);
            });
            
            // Group by project to see phase structure
            const projectGroups = {};
            data.data.investment.forEach(inv => {
                if (!projectGroups[inv.INV_EXT_ID]) {
                    projectGroups[inv.INV_EXT_ID] = {
                        name: inv.INVESTMENT_NAME,
                        phases: [],
                        investment: [],
                        milestones: []
                    };
                }
                
                if (inv.ROADMAP_ELEMENT === 'Phases') {
                    projectGroups[inv.INV_EXT_ID].phases.push(inv);
                } else if (inv.ROADMAP_ELEMENT === 'Investment') {
                    projectGroups[inv.INV_EXT_ID].investment.push(inv);
                } else {
                    projectGroups[inv.INV_EXT_ID].milestones.push(inv);
                }
            });
            
            console.log('📊 Processed Project Groups:');
            Object.keys(projectGroups).slice(0, 5).forEach(projectId => {
                const project = projectGroups[projectId];
                console.log(`\n🎯 Project: ${project.name} (${projectId})`);
                console.log(`   💰 Investment Records: ${project.investment.length}`);
                console.log(`   🔄 Phase Records: ${project.phases.length}`);
                console.log(`   🎯 Milestone Records: ${project.milestones.length}`);
                
                if (project.phases.length > 0) {
                    console.log(`   📋 Phases:`);
                    project.phases.forEach(phase => {
                        console.log(`      - ${phase.TASK_NAME} (${phase.TASK_START} to ${phase.TASK_FINISH})`);
                    });
                }
                
                if (project.investment.length > 0) {
                    console.log(`   💰 Investment Data:`);
                    project.investment.forEach(inv => {
                        console.log(`      - ${inv.TASK_NAME} (${inv.TASK_START} to ${inv.TASK_FINISH}) Status: ${inv.INV_OVERALL_STATUS}`);
                    });
                }
            });
        }
        
    } catch (error) {
        console.error('❌ Debug API Error:', error);
    }
}

// Auto-run the debug
debugSubProgramAPI();
