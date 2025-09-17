const fetch = require('node-fetch');

async function checkSubPrograms() {
    console.log('🔍 Checking Sub-Programs under PTF000109 children...\n');
    
    try {
        const response = await fetch('http://localhost:5000/api/data');
        const data = await response.json();
        
        const hierarchyData = data.data.hierarchy;
        
        // Get PTF000109 children
        const ptfChildren = hierarchyData.filter(item => 
            item.COE_ROADMAP_PARENT_ID === 'PTF000109'
        );
        
        console.log(`PTF000109 has ${ptfChildren.length} direct children`);
        
        for (const child of ptfChildren) {
            console.log(`\n${child.CHILD_ID} (${child.CHILD_NAME}):`);
            
            const grandChildren = hierarchyData.filter(item => 
                item.COE_ROADMAP_PARENT_ID === child.CHILD_ID
            );
            
            console.log(`  Total children: ${grandChildren.length}`);
            
            const byType = {};
            grandChildren.forEach(gc => {
                const type = gc.COE_ROADMAP_TYPE;
                byType[type] = (byType[type] || 0) + 1;
            });
            
            Object.entries(byType).forEach(([type, count]) => {
                console.log(`    ${type}: ${count}`);
            });
            
            // Show first few
            grandChildren.slice(0, 3).forEach(gc => {
                console.log(`    - ${gc.CHILD_ID}: ${gc.CHILD_NAME} (${gc.COE_ROADMAP_TYPE})`);
            });
            if (grandChildren.length > 3) {
                console.log(`    ... and ${grandChildren.length - 3} more`);
            }
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

checkSubPrograms();
