// Legacy service file - functions moved to utils folder
// This file is kept for backward compatibility with other components

import { processPortfolioDataFromAPI } from '../utils/portfolioDataUtils';

// Export the new portfolio function for compatibility
export const processPortfolioData = processPortfolioDataFromAPI;

// API function to fetch unified backend data and process for program view
const processProgramDataFromAPI = async (selectedPortfolioId = null) => {
    try {
        console.log('🚀 Loading program data from backend API...');
        
        // Fetch unified dataset from backend
        const response = await fetch('/api/data');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const apiResponse = await response.json();
        
        // Check if response is successful
        if (apiResponse.status !== 'success') {
            throw new Error(`API error: ${apiResponse.message || 'Unknown error'}`);
        }
        
        // Extract hierarchy data from the nested response structure
        const hierarchyData = apiResponse.data?.hierarchy || [];
        console.log('📊 Raw hierarchy data loaded:', hierarchyData.length, 'records');

        // Filter for Program and SubProgram data based on COE_ROADMAP_TYPE
        const programTypeData = hierarchyData.filter(item => 
            item.COE_ROADMAP_TYPE === 'Program' || item.COE_ROADMAP_TYPE === 'SubProgram'
        );
        console.log('🎯 Filtered program/subprogram data:', programTypeData.length, 'records');

        // If a specific portfolio is selected, filter to show only its programs
        let filteredData = programTypeData;
        if (selectedPortfolioId) {
            // Find programs that belong to the selected portfolio
            filteredData = programTypeData.filter(item => 
                item.COE_ROADMAP_PARENT_ID === selectedPortfolioId ||
                programTypeData.some(parent => 
                    parent.CHILD_ID === item.COE_ROADMAP_PARENT_ID && 
                    parent.COE_ROADMAP_PARENT_ID === selectedPortfolioId
                )
            );
            console.log('🔍 Filtered for portfolio', selectedPortfolioId, ':', filteredData.length, 'records');
        }

        // Build parent-child hierarchy
        const processedData = [];
        
        // Find all parent programs (where COE_ROADMAP_PARENT_ID === CHILD_ID)
        const parentPrograms = filteredData.filter(item => 
            item.COE_ROADMAP_PARENT_ID === item.CHILD_ID && item.COE_ROADMAP_TYPE === 'Program'
        );
        
        // Build parent-child lookup for isDrillable logic
        const parentIdSet = new Set(filteredData.map(item => item.COE_ROADMAP_PARENT_ID).filter(Boolean));
        
        for (const parentProgram of parentPrograms) {
            // Process parent program
            const parentData = {
                id: parentProgram.CHILD_ID,
                name: parentProgram.COE_ROADMAP_PARENT_NAME || parentProgram.CHILD_NAME,
                parentId: parentProgram.CHILD_ID,
                parentName: parentProgram.COE_ROADMAP_PARENT_NAME,
                startDate: parentProgram.COE_ROADMAP_START_DATE || '2024-01-01', // Default dates
                endDate: parentProgram.COE_ROADMAP_END_DATE || '2025-12-31',
                status: parentProgram.COE_ROADMAP_STATUS || 'Grey',
                isProgram: true,
                isDrillable: parentIdSet.has(parentProgram.CHILD_ID), // Has children if CHILD_ID is referenced as parent
                milestones: [] // TODO: Add milestone processing from investment data
            };
            
            processedData.push(parentData);
            
            // Find and process children (projects under this program)
            const children = filteredData.filter(item => 
                item.COE_ROADMAP_PARENT_ID === parentProgram.CHILD_ID && 
                item.CHILD_ID !== parentProgram.CHILD_ID
            );
            
            for (const child of children) {
                const childData = {
                    id: child.CHILD_ID,
                    name: child.CHILD_NAME,
                    parentId: parentProgram.CHILD_ID,
                    parentName: parentProgram.COE_ROADMAP_PARENT_NAME,
                    startDate: child.COE_ROADMAP_START_DATE || '2024-01-01', // Default dates
                    endDate: child.COE_ROADMAP_END_DATE || '2025-12-31',
                    status: child.COE_ROADMAP_STATUS || 'Grey',
                    isProgram: false,
                    isDrillable: parentIdSet.has(child.CHILD_ID), // Check if this child has its own children
                    milestones: [] // TODO: Add milestone processing from investment data
                };
                
                processedData.push(childData);
            }
        }
        
        console.log('✅ Successfully processed', processedData.length, 'program items from API');
        return processedData;
        
    } catch (error) {
        console.error('❌ Failed to load program data:', error);
        throw error;
    }
};

// Export the program function
export const processProgramData = processProgramDataFromAPI;

export const processSubProgramData = () => {
    console.warn('processSubProgramData not implemented yet - please use SubProgram view after migration');
    return [];
};

export const processRegionData = () => {
    console.warn('processRegionData not implemented yet - please use Region view after migration');
    return [];
};

export const getRegionFilterOptions = () => {
    console.warn('getRegionFilterOptions not implemented yet');
    return [];
};