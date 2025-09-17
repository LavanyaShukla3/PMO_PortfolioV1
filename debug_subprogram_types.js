/**
 * Debug SubProgram Data Types
 * Check what COE_ROADMAP_TYPE values exist in the database
 */

const fetch = require('node-fetch');

async function debugSubProgramTypes() {
    console.log('🔍 Debugging SubProgram Data Types\n');
    
    try {
        // Get full hierarchy data to see what types exist
        console.log('=== FETCHING FULL HIERARCHY DATA ===');
        const response = await fetch('http://localhost:5000/api/data/portfolio?page=1&limit=100');
        const data = await response.json();
        
        if (data.status === 'success' && data.data.hierarchy.length > 0) {
            // Count all COE_ROADMAP_TYPE values
            const typeCount = {};
            data.data.hierarchy.forEach(item => {
                const type = item.COE_ROADMAP_TYPE;
                typeCount[type] = (typeCount[type] || 0) + 1;
            });
            
            console.log('📊 COE_ROADMAP_TYPE Distribution:');
            Object.entries(typeCount).forEach(([type, count]) => {
                console.log(`   ${type}: ${count} records`);
            });
            
            // Look for SubProgram-like records
            const subProgramLike = data.data.hierarchy.filter(item => 
                item.COE_ROADMAP_TYPE?.toLowerCase().includes('sub') ||
                item.COE_ROADMAP_TYPE?.toLowerCase().includes('program')
            );
            
            console.log(`\n🔍 Records containing 'sub' or 'program': ${subProgramLike.length}`);
            
            if (subProgramLike.length > 0) {
                console.log('📋 Sample SubProgram-like records:');
                subProgramLike.slice(0, 3).forEach((item, index) => {
                    console.log(`   ${index + 1}. Type: "${item.COE_ROADMAP_TYPE}", Name: "${item.CHILD_NAME}"`);
                });
            }
        }
        
    } catch (error) {
        console.error('❌ Debug failed:', error.message);
    }
}

// Run the debug
debugSubProgramTypes();
