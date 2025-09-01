// JSON Export Utilities for Region Roadmap Data
// This file contains functions to export data to JSON files for debugging

/**
 * Exports filter options data to JSON file
 */
export const exportRegionFilterOptionsToJSON = async () => {
    try {
        console.log('📁 Exporting Region Filter Options to JSON...');
        
        // Import the function (assuming it's available in the same module)
        const { getRegionFilterOptions } = await import('./apiDataService.js');
        
        // Get the filter options data
        const filterOptions = await getRegionFilterOptions();
        
        // Create the export data with metadata
        const exportData = {
            exportTime: new Date().toISOString(),
            dataType: 'regionFilterOptions',
            summary: {
                totalRegions: filterOptions.regions.length,
                totalMarkets: filterOptions.markets.length,
                totalFunctions: filterOptions.functions.length,
                totalTiers: filterOptions.tiers.length
            },
            data: filterOptions
        };
        
        // Create and download the JSON file
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `region_filter_options_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        console.log('✅ Filter options exported to:', link.download);
        return link.download;
        
    } catch (error) {
        console.error('❌ Failed to export filter options:', error);
        throw error;
    }
};

/**
 * Exports processed region data to JSON file
 */
export const exportProcessRegionDataToJSON = async (filters = { region: 'All', market: 'All', function: 'All', tier: 'All' }) => {
    try {
        console.log('📁 Exporting Process Region Data to JSON with filters:', filters);
        
        // Import the function (assuming it's available in the same module)
        const { processRegionData } = await import('./apiDataService.js');
        
        // Get the processed region data
        const regionData = await processRegionData(filters);
        
        // Create the export data with metadata
        const exportData = {
            exportTime: new Date().toISOString(),
            dataType: 'processRegionData',
            filters: filters,
            summary: {
                totalProjects: regionData.length,
                statusBreakdown: {},
                regionBreakdown: {},
                functionBreakdown: {},
                tierBreakdown: {}
            },
            data: regionData
        };
        
        // Generate summary statistics
        regionData.forEach(project => {
            // Status breakdown
            const status = project.status || 'Unknown';
            exportData.summary.statusBreakdown[status] = (exportData.summary.statusBreakdown[status] || 0) + 1;
            
            // Region breakdown
            const region = project.region || 'Unknown';
            exportData.summary.regionBreakdown[region] = (exportData.summary.regionBreakdown[region] || 0) + 1;
            
            // Function breakdown
            const func = project.function || 'Unknown';
            exportData.summary.functionBreakdown[func] = (exportData.summary.functionBreakdown[func] || 0) + 1;
            
            // Tier breakdown
            const tier = project.tier || 'Unknown';
            exportData.summary.tierBreakdown[tier] = (exportData.summary.tierBreakdown[tier] || 0) + 1;
        });
        
        // Create and download the JSON file
        const filterSuffix = Object.entries(filters)
            .filter(([key, value]) => value !== 'All')
            .map(([key, value]) => `${key}_${value}`)
            .join('_') || 'all_filters';
            
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `process_region_data_${filterSuffix}_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        console.log('✅ Process region data exported to:', link.download);
        return link.download;
        
    } catch (error) {
        console.error('❌ Failed to export process region data:', error);
        throw error;
    }
};

/**
 * Exports both filter options and process region data
 */
export const exportAllRegionData = async (filters = { region: 'All', market: 'All', function: 'All', tier: 'All' }) => {
    try {
        console.log('📁 Exporting all region data...');
        
        const filterOptionsFile = await exportRegionFilterOptionsToJSON();
        const processDataFile = await exportProcessRegionDataToJSON(filters);
        
        console.log('✅ All exports completed:');
        console.log('  1. Filter Options:', filterOptionsFile);
        console.log('  2. Process Data:', processDataFile);
        
        return {
            filterOptionsFile,
            processDataFile
        };
        
    } catch (error) {
        console.error('❌ Failed to export all region data:', error);
        throw error;
    }
};

// Browser console helper functions
window.exportRegionFilterOptions = exportRegionFilterOptionsToJSON;
window.exportProcessRegionData = exportProcessRegionDataToJSON;
window.exportAllRegionData = exportAllRegionData;

console.log('📁 JSON Export utilities loaded. Available functions:');
console.log('  - exportRegionFilterOptions()');
console.log('  - exportProcessRegionData(filters)');
console.log('  - exportAllRegionData(filters)');
