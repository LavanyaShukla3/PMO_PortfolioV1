// Legacy service file - functions moved to utils folder
// This file is kept for backward compatibility with other components

import { processPortfolioDataFromAPI } from '../utils/portfolioDataUtils';

// API configuration
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://your-production-domain.com' 
  : 'http://localhost:5000';

// Export the new portfolio function for compatibility
export const processPortfolioData = processPortfolioDataFromAPI;

// API function to fetch unified backend data and process for program view
const processProgramDataFromAPI = async (selectedPortfolioId = null) => {
    try {
        console.log('🚀 Loading program data from backend API...');
        
        // Fetch unified dataset from backend
        const response = await fetch(`${API_BASE_URL}/api/data`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        
        if (result.status !== 'success') {
            throw new Error(result.message || 'Failed to fetch unified roadmap data');
        }
        
        // Extract hierarchy data (programs/projects data)
        const hierarchyData = result.data.hierarchy;
        console.log('📊 Raw hierarchy data loaded:', hierarchyData.length, 'records');
        
        // Filter to get only Program type data
        const programTypeData = hierarchyData.filter(item => 
            item.COE_ROADMAP_TYPE === 'Program' || item.COE_ROADMAP_TYPE === 'Sub-Program'
        );
        console.log('🎯 Program/Sub-Program records:', programTypeData.length, 'records');
        
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
        
        console.log('👥 Found parent programs:', parentPrograms.length);
        
        // For each parent program, find its children
        parentPrograms.forEach(parentProgram => {
            // Add parent program
            const processedParent = {
                id: parentProgram.CHILD_ID,
                name: parentProgram.COE_ROADMAP_NAME,
                status: parentProgram.COE_ROADMAP_OVERALL_STATUS || 'Grey',
                type: parentProgram.COE_ROADMAP_TYPE,
                isProgram: true,
                parentId: null,
                sortOrder: parentProgram.PROGRAM_SORT_ORDER || 0
            };
            processedData.push(processedParent);
            
            // Find child programs/sub-programs
            const childPrograms = filteredData.filter(item => 
                item.COE_ROADMAP_PARENT_ID === parentProgram.CHILD_ID && 
                item.COE_ROADMAP_PARENT_ID !== item.CHILD_ID
            );
            
            childPrograms.forEach(child => {
                processedData.push({
                    id: child.CHILD_ID,
                    name: child.COE_ROADMAP_NAME,
                    status: child.COE_ROADMAP_OVERALL_STATUS || 'Grey',
                    type: child.COE_ROADMAP_TYPE,
                    isProgram: false,
                    parentId: parentProgram.CHILD_ID,
                    sortOrder: child.PROGRAM_SORT_ORDER || 0
                });
            });
        });
        
        // Sort data: Programs first (by sortOrder/name), then their children
        const sortedData = processedData.sort((a, b) => {
            // If one is a program and the other is not
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
                const parentA = processedData.find(p => p.id === a.parentId);
                const parentB = processedData.find(p => p.id === b.parentId);
                if (parentA && parentB) {
                    return (parentA.sortOrder || 0) - (parentB.sortOrder || 0) || parentA.name.localeCompare(parentB.name);
                }
            }
            
            // Same parent or both are programs - sort by sortOrder/name
            return (a.sortOrder || 0) - (b.sortOrder || 0) || a.name.localeCompare(b.name);
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

// API function to fetch unified backend data and process for sub-program view
const processSubProgramDataFromAPI = async (selectedProgramId = null) => {
    try {
        console.log('🚀 Loading sub-program data from backend API...');
        
        // Fetch unified dataset from backend
        const response = await fetch(`${API_BASE_URL}/api/data`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        
        if (result.status !== 'success') {
            throw new Error(result.message || 'Failed to fetch unified roadmap data');
        }
        
        // Extract hierarchy data
        const hierarchyData = result.data.hierarchy;
        console.log('📊 Raw hierarchy data loaded:', hierarchyData.length, 'records');
        
        // Filter for projects under the selected program
        let filteredData = [];
        
        if (selectedProgramId) {
            console.log('🔍 Filtering for program ID:', selectedProgramId);
            
            // Find direct children of the selected program (Sub-Programs and Projects)
            filteredData = hierarchyData.filter(item => 
                item.COE_ROADMAP_PARENT_ID === selectedProgramId &&
                item.COE_ROADMAP_PARENT_ID !== item.CHILD_ID && // Exclude self-referencing entries
                (item.COE_ROADMAP_TYPE === 'Sub-Program' || item.COE_ROADMAP_TYPE === 'Project')
            );
            
            console.log('📋 Found direct children:', filteredData.length, 'records');
            
            // For Sub-Programs, also find their child projects
            const subPrograms = filteredData.filter(item => item.COE_ROADMAP_TYPE === 'Sub-Program');
            subPrograms.forEach(subProgram => {
                const subProgramProjects = hierarchyData.filter(item =>
                    item.COE_ROADMAP_PARENT_ID === subProgram.CHILD_ID &&
                    item.COE_ROADMAP_PARENT_ID !== item.CHILD_ID &&
                    item.COE_ROADMAP_TYPE === 'Project'
                );
                filteredData.push(...subProgramProjects);
            });
        } else {
            // If no program selected, show all Sub-Programs and Projects
            filteredData = hierarchyData.filter(item => 
                item.COE_ROADMAP_TYPE === 'Sub-Program' || item.COE_ROADMAP_TYPE === 'Project'
            );
        }
        
        console.log('🎯 Total filtered records:', filteredData.length);
        
        // Process the data into display format
        const processedData = filteredData.map(item => ({
            id: item.CHILD_ID,
            name: item.COE_ROADMAP_NAME,
            status: item.COE_ROADMAP_OVERALL_STATUS || 'Grey',
            type: item.COE_ROADMAP_TYPE,
            parentId: item.COE_ROADMAP_PARENT_ID,
            isSubProgram: item.COE_ROADMAP_TYPE === 'Sub-Program',
            sortOrder: item.PROGRAM_SORT_ORDER || 0
        }));
        
        // Sort by type (Sub-Programs first) then by name
        const sortedData = processedData.sort((a, b) => {
            if (a.isSubProgram && !b.isSubProgram) return -1;
            if (!a.isSubProgram && b.isSubProgram) return 1;
            return (a.sortOrder || 0) - (b.sortOrder || 0) || a.name.localeCompare(b.name);
        });
        
        console.log('✅ Successfully processed', sortedData.length, 'sub-program items from API');
        return sortedData;
        
    } catch (error) {
        console.error('❌ Failed to load sub-program data:', error);
        throw error;
    }
};

// Region data processing function
export const processRegionData = async (filters = {}) => {
    try {
        console.log('🌍 Loading region data from backend API with filters:', filters);
        
        // Fetch unified dataset from backend
        const response = await fetch(`${API_BASE_URL}/api/data`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        
        if (result.status !== 'success') {
            throw new Error(result.message || 'Failed to fetch unified roadmap data');
        }
        
        // Extract investment data
        const investmentData = result.data.investment;
        console.log('📊 Raw investment data loaded:', investmentData.length, 'records');
        
        // Filter for Investment-level records only (not phases or milestones)
        const investmentRecords = investmentData.filter(item => 
            item.ROADMAP_ELEMENT === 'Investment'
        );
        console.log('🎯 Filtered investment records:', investmentRecords.length, 'records');
        
        // Group by investment to get project data with phases
        const projectsMap = new Map();
        
        // First pass: Create project entries from Investment records
        investmentRecords.forEach(investment => {
            const projectId = investment.INV_EXT_ID;
            
            // Extract region from market (e.g., "APAC/China" -> "APAC")
            const market = investment.INV_MARKET || '';
            const region = market.includes('/') ? market.split('/')[0] : market;
            
            projectsMap.set(projectId, {
                id: projectId,
                name: investment.INVESTMENT_NAME,
                startDate: investment.TASK_START,
                endDate: investment.TASK_FINISH,
                status: investment.INV_OVERALL_STATUS || 'Grey',
                tier: investment.INV_TIER || '',
                function: investment.INV_FUNCTION || '',
                market: market,
                region: region,
                isUnphased: true, // Default to unphased, will be updated if phases found
                phases: []
            });
        });
        
        // Second pass: Add phase data
        const phaseRecords = investmentData.filter(item => 
            item.ROADMAP_ELEMENT === 'Phases' && 
            item.TASK_NAME !== 'Unphased'
        );
        
        phaseRecords.forEach(phase => {
            const projectId = phase.INV_EXT_ID;
            const project = projectsMap.get(projectId);
            
            if (project) {
                project.phases.push({
                    name: phase.TASK_NAME,
                    startDate: phase.TASK_START,
                    endDate: phase.TASK_FINISH
                });
                project.isUnphased = false; // Has phases
            }
        });
        
        // Convert to array and apply filters
        let projects = Array.from(projectsMap.values());
        
        // Apply filters
        if (filters.region) {
            projects = projects.filter(p => p.region === filters.region);
        }
        if (filters.market) {
            projects = projects.filter(p => p.market === filters.market);
        }
        if (filters.function) {
            projects = projects.filter(p => p.function === filters.function);
        }
        if (filters.tier) {
            projects = projects.filter(p => p.tier === filters.tier);
        }
        
        console.log('✅ Successfully processed', projects.length, 'region projects from API');
        return projects;
        
    } catch (error) {
        console.error('❌ Failed to load region data:', error);
        throw error;
    }
};

// Function to get filter options for RegionRoadMap
export const getRegionFilterOptions = async () => {
    try {
        console.log('🔍 Loading region filter options from backend API...');
        
        // Fetch unified dataset from backend
        const response = await fetch(`${API_BASE_URL}/api/data`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        
        if (result.status !== 'success') {
            throw new Error(result.message || 'Failed to fetch unified roadmap data');
        }
        
        // Extract investment data
        const investmentData = result.data.investment;
        
        // Filter for Investment-level records only
        const investmentRecords = investmentData.filter(item => 
            item.ROADMAP_ELEMENT === 'Investment'
        );
        
        // Extract unique values for filters
        const regions = new Set();
        const markets = new Set();
        const functions = new Set();
        const tiers = new Set();
        
        investmentRecords.forEach(investment => {
            // Extract region from market (e.g., "APAC/China" -> "APAC")
            const market = investment.INV_MARKET || '';
            const region = market.includes('/') ? market.split('/')[0] : market;
            
            if (region) regions.add(region);
            if (market) markets.add(market);
            if (investment.INV_FUNCTION) functions.add(investment.INV_FUNCTION);
            if (investment.INV_TIER) tiers.add(investment.INV_TIER);
        });
        
        const filterOptions = {
            regions: Array.from(regions).sort(),
            markets: Array.from(markets).sort(),
            functions: Array.from(functions).sort(),
            tiers: Array.from(tiers).sort()
        };
        
        console.log('✅ Filter options loaded:', filterOptions);
        
        return filterOptions;
        
    } catch (error) {
        console.error('❌ Failed to load region filter options:', error);
        throw error;
    }
};

// Export all functions
export const processProgramData = processProgramDataFromAPI;
export const processSubProgramData = processSubProgramDataFromAPI;
