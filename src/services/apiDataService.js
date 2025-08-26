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
        const result = await response.json();
        
        if (result.status !== 'success') {
            throw new Error(result.message || 'Failed to fetch unified roadmap data');
        }
        
        // Extract both hierarchy and investment data from structured response
        const hierarchyData = result.data.hierarchy;
        const investmentData = result.data.investment;
        console.log('📊 Raw hierarchy data loaded:', hierarchyData.length, 'records');
        console.log('📊 Raw investment data loaded:', investmentData.length, 'records');

        // Filter hierarchy for Program and SubProgram data
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
            // Find investment data for this program
            const investment = investmentData.find(inv => 
                inv.INV_EXT_ID === parentProgram.CHILD_ID && inv.ROADMAP_ELEMENT === 'Investment'
            );
            
            // Find milestones for this program
            const milestones = investmentData
                .filter(inv => 
                    inv.INV_EXT_ID === parentProgram.CHILD_ID && 
                    inv.ROADMAP_ELEMENT && 
                    inv.ROADMAP_ELEMENT.includes('Milestones')
                )
                .map(milestone => ({
                    date: milestone.TASK_START,
                    status: milestone.MILESTONE_STATUS,
                    label: milestone.TASK_NAME,
                    isSG3: milestone.ROADMAP_ELEMENT.includes('SG3') || milestone.TASK_NAME.includes('SG3')
                }));

            // Process parent program
            const parentData = {
                id: parentProgram.CHILD_ID,
                name: investment ? investment.INVESTMENT_NAME : (parentProgram.COE_ROADMAP_PARENT_NAME || parentProgram.CHILD_NAME),
                parentId: parentProgram.CHILD_ID,
                parentName: parentProgram.COE_ROADMAP_PARENT_NAME,
                startDate: investment ? investment.TASK_START : parentProgram.COE_ROADMAP_START_DATE,
                endDate: investment ? investment.TASK_FINISH : parentProgram.COE_ROADMAP_END_DATE,
                status: investment ? investment.INV_OVERALL_STATUS : parentProgram.COE_ROADMAP_STATUS,
                sortOrder: investment ? investment.SortOrder || 0 : 0,
                isProgram: true,
                isDrillable: parentIdSet.has(parentProgram.CHILD_ID), // Has children if CHILD_ID is referenced as parent
                milestones
            };
            
            processedData.push(parentData);
            
            // Find and process children (projects under this program)
            const children = filteredData.filter(item => 
                item.COE_ROADMAP_PARENT_ID === parentProgram.CHILD_ID && 
                item.CHILD_ID !== parentProgram.CHILD_ID
            );
            
            for (const child of children) {
                // Find investment data for this child project
                const childInvestment = investmentData.find(inv => 
                    inv.INV_EXT_ID === child.CHILD_ID && inv.ROADMAP_ELEMENT === 'Investment'
                );
                
                // Find milestones for this child project
                const childMilestones = investmentData
                    .filter(inv => 
                        inv.INV_EXT_ID === child.CHILD_ID && 
                        inv.ROADMAP_ELEMENT && 
                        inv.ROADMAP_ELEMENT.includes('Milestones')
                    )
                    .map(milestone => ({
                        date: milestone.TASK_START,
                        status: milestone.MILESTONE_STATUS,
                        label: milestone.TASK_NAME,
                        isSG3: milestone.ROADMAP_ELEMENT.includes('SG3') || milestone.TASK_NAME.includes('SG3')
                    }));

                const childData = {
                    id: child.CHILD_ID,
                    name: childInvestment ? childInvestment.INVESTMENT_NAME : child.CHILD_NAME,
                    parentId: parentProgram.CHILD_ID,
                    parentName: parentProgram.COE_ROADMAP_PARENT_NAME,
                    startDate: childInvestment ? childInvestment.TASK_START : child.COE_ROADMAP_START_DATE,
                    endDate: childInvestment ? childInvestment.TASK_FINISH : child.COE_ROADMAP_END_DATE,
                    status: childInvestment ? childInvestment.INV_OVERALL_STATUS : child.COE_ROADMAP_STATUS,
                    sortOrder: childInvestment ? childInvestment.SortOrder || 0 : 0,
                    isProgram: false,
                    isDrillable: parentIdSet.has(child.CHILD_ID), // Check if this child has its own children
                    milestones: childMilestones
                };
                
                processedData.push(childData);
            }
        }
        
        // Sort to ensure proper hierarchy: Programs first, then their children
        const sortedData = processedData.sort((a, b) => {
            // First, group by parent program
            if (a.isProgram && b.isProgram) {
                // Both are programs, sort by sortOrder then name
                const sortOrderA = a.sortOrder || 0;
                const sortOrderB = b.sortOrder || 0;
                if (sortOrderA !== sortOrderB) {
                    return sortOrderA - sortOrderB;
                }
                return a.name.localeCompare(b.name);
            }
            
            // If one is a program and other is not, check if they're related
            if (a.isProgram && !b.isProgram) {
                // If b is a child of a, then a should come first
                if (b.parentId === a.id) {
                    return -1; // a (program) comes before b (child)
                }
                // Otherwise sort by sortOrder/name
                return (a.sortOrder || 0) - (b.sortOrder || 0) || a.name.localeCompare(b.name);
            }
            
            if (!a.isProgram && b.isProgram) {
                // If a is a child of b, then b should come first
                if (a.parentId === b.id) {
                    return 1; // b (program) comes before a (child)
                }
                // Otherwise sort by sortOrder/name
                return (a.sortOrder || 0) - (b.sortOrder || 0) || a.name.localeCompare(b.name);
            }
            
            // Both are children - group them by their parent program
            if (a.parentId !== b.parentId) {
                // Different parents - sort by parent program order
                return a.parentId.localeCompare(b.parentId);
            }
            
            // Same parent - sort by sortOrder then name
            const sortOrderA = a.sortOrder || 0;
            const sortOrderB = b.sortOrder || 0;
            if (sortOrderA !== sortOrderB) {
                return sortOrderA - sortOrderB;
            }
            return a.name.localeCompare(b.name);
        });
        
        console.log('✅ Successfully processed', sortedData.length, 'program items from API');
        console.log('🔍 First few items after sorting:', sortedData.slice(0, 5).map(item => ({
            name: item.name,
            isProgram: item.isProgram,
            parentId: item.parentId
        })));
        return sortedData;
        
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