/**
 * API Data Service for PMO Portfolio
 * Handles all data fetching from the Flask backend
 */

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

/**
 * Generic API call function with error handling
 */
const apiCall = async (endpoint, options = {}) => {
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
            ...options,
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.status === 'error') {
            throw new Error(data.message || 'API returned error status');
        }

        return data;
    } catch (error) {
        console.error(`API call failed for ${endpoint}:`, error);
        throw error;
    }
};

/**
 * Fetch all data (hierarchy + investment) from separate endpoints
 */
export const fetchAllData = async () => {
    const [hierarchyResponse, investmentResponse] = await Promise.all([
        apiCall('/api/hierarchy_data'),
        apiCall('/api/investment_data')
    ]);
    
    return {
        hierarchyData: hierarchyResponse.data,
        investmentData: investmentResponse.data,
        mode: hierarchyResponse.mode
    };
};

/**
 * Fetch only hierarchy data
 */
export const fetchHierarchyData = async () => {
    const response = await apiCall('/api/hierarchy_data');
    return {
        data: response.data,
        mode: response.mode
    };
};

/**
 * Fetch only investment data
 */
export const fetchInvestmentData = async () => {
    const response = await apiCall('/api/investment_data');
    return {
        data: response.data,
        mode: response.mode
    };
};

/**
 * Test backend connection
 */
export const testConnection = async () => {
    const response = await apiCall('/api/test-connection');
    return response;
};

/**
 * Get API health status
 */
export const getHealthStatus = async () => {
    const response = await apiCall('/api/health');
    return response;
};

/**
 * Filter hierarchy data by type (Portfolio, Program, etc.)
 */
export const filterHierarchyByType = (hierarchyData, type) => {
    if (!hierarchyData || !Array.isArray(hierarchyData)) {
        return [];
    }
    return hierarchyData.filter(item => item.COE_ROADMAP_TYPE === type);
};

/**
 * Get portfolio data from hierarchy
 */
export const getPortfolioData = (hierarchyData) => {
    return filterHierarchyByType(hierarchyData, 'Portfolio');
};

/**
 * Get program data from hierarchy
 */
export const getProgramData = (hierarchyData) => {
    return filterHierarchyByType(hierarchyData, 'Program');
};

/**
 * Get sub-program data from hierarchy
 */
export const getSubProgramData = (hierarchyData) => {
    return filterHierarchyByType(hierarchyData, 'SubProgram');
};

/**
 * Process roadmap data (same logic as your existing dataService.js)
 */
const processRoadmapData = (sourceData, investmentData) => {
    if (!sourceData || !investmentData) {
        return [];
    }

    try {
        return sourceData
            .map(item => {
                const investment = investmentData.find(inv =>
                    inv.INV_EXT_ID === item.CHILD_ID &&
                    inv.ROADMAP_ELEMENT === "Investment"
                );

                if (!investment) {
                    console.log(`No investment record for CHILD_ID: ${item.CHILD_ID}`);
                    return null;
                }

                // Filter for SG3 milestones only
                const milestones = investmentData
                    .filter(inv =>
                        inv.INV_EXT_ID === item.CHILD_ID &&
                        (inv.ROADMAP_ELEMENT === "Milestones - Deployment" ||
                         inv.ROADMAP_ELEMENT === "Milestones - Other") &&
                        inv.TASK_NAME?.toLowerCase().includes('sg3')
                    )
                    .map(milestone => ({
                        date: milestone.TASK_START,
                        status: milestone.MILESTONE_STATUS,
                        label: milestone.TASK_NAME,
                        isSG3: true
                    }));

                return {
                    id: item.CHILD_ID,
                    name: investment.INVESTMENT_NAME || item.CHILD_NAME,
                    parentId: item.COE_ROADMAP_PARENT_ID,
                    parentName: item.COE_ROADMAP_PARENT_NAME,
                    isProgram: item.COE_ROADMAP_PARENT_ID === item.CHILD_ID,
                    isDrillable: item.If_parent_exist === 1,
                    startDate: investment.TASK_START,
                    endDate: investment.TASK_FINISH,
                    status: investment.INV_OVERALL_STATUS,
                    sortOrder: investment.SortOrder || 0,
                    milestones
                };
            })
            .filter(Boolean)
            .sort((a, b) => {
                if (a.parentName !== b.parentName) {
                    return a.parentName.localeCompare(b.parentName);
                }
                if (a.isProgram && !b.isProgram) return -1;
                if (!a.isProgram && b.isProgram) return 1;
                return a.sortOrder - b.sortOrder;
            });
    } catch (error) {
        console.error('Error processing roadmap data:', error);
        return [];
    }
};

/**
 * Process portfolio data with API data
 */
export const processPortfolioData = async () => {
    const { hierarchyData, investmentData } = await fetchAllData();
    const portfolioHierarchy = getPortfolioData(hierarchyData);
    return processRoadmapData(portfolioHierarchy, investmentData);
};

/**
 * Process program data with API data
 */
export const processProgramData = async () => {
    const { hierarchyData, investmentData } = await fetchAllData();
    const programHierarchy = getProgramData(hierarchyData);
    
    // Add sub-program drill-through capability check
    const subProgramHierarchy = getSubProgramData(hierarchyData);
    
    return programHierarchy
        .map(item => {
            const investment = investmentData.find(inv =>
                inv.INV_EXT_ID === item.CHILD_ID &&
                inv.ROADMAP_ELEMENT === "Investment"
            );

            if (!investment) {
                return null;
            }

            const milestones = investmentData
                .filter(inv =>
                    inv.INV_EXT_ID === item.CHILD_ID &&
                    (inv.ROADMAP_ELEMENT === "Milestones - Deployment" ||
                     inv.ROADMAP_ELEMENT === "Milestones - Other") &&
                    inv.TASK_NAME?.toLowerCase().includes('sg3')
                )
                .map(milestone => ({
                    date: milestone.TASK_START,
                    status: milestone.MILESTONE_STATUS,
                    label: milestone.TASK_NAME,
                    isSG3: true
                }));

            // Check if this program has corresponding SubProgram records
            const hasSubPrograms = subProgramHierarchy.some(subItem =>
                subItem.COE_ROADMAP_PARENT_ID === item.CHILD_ID
            );

            return {
                id: item.CHILD_ID,
                name: investment.INVESTMENT_NAME || item.CHILD_NAME,
                parentId: item.COE_ROADMAP_PARENT_ID,
                parentName: item.COE_ROADMAP_PARENT_NAME,
                isProgram: item.COE_ROADMAP_PARENT_ID === item.CHILD_ID,
                isDrillable: hasSubPrograms,
                startDate: investment.TASK_START,
                endDate: investment.TASK_FINISH,
                status: investment.INV_OVERALL_STATUS,
                sortOrder: investment.SortOrder || 0,
                milestones
            };
        })
        .filter(Boolean)
        .sort((a, b) => {
            if (a.parentName !== b.parentName) {
                return a.parentName.localeCompare(b.parentName);
            }
            if (a.isProgram && !b.isProgram) return -1;
            if (!a.isProgram && b.isProgram) return 1;
            return (a.sortOrder || 0) - (b.sortOrder || 0);
        });
};

/**
 * Process sub-program data with API data
 */
export const processSubProgramData = async () => {
    const { hierarchyData, investmentData } = await fetchAllData();
    const subProgramHierarchy = getSubProgramData(hierarchyData);
    
    const processedData = [];
    const uniqueParentIds = [...new Set(subProgramHierarchy.map(item => item.COE_ROADMAP_PARENT_ID))];
    
    uniqueParentIds.forEach(parentId => {
        const parentItems = subProgramHierarchy.filter(item => item.COE_ROADMAP_PARENT_ID === parentId);
        const subProgramItem = parentItems.find(item => item.CHILD_ID === item.COE_ROADMAP_PARENT_ID);
        
        if (subProgramItem) {
            const subProgramInvestment = investmentData.find(inv => inv.INV_EXT_ID === subProgramItem.CHILD_ID);
            
            if (subProgramInvestment) {
                const subProgramMilestones = investmentData
                    .filter(inv =>
                        inv.INV_EXT_ID === subProgramItem.CHILD_ID &&
                        (inv.ROADMAP_ELEMENT === "Milestones - Deployment" || 
                         inv.ROADMAP_ELEMENT === "Milestones - Other") &&
                        inv.TASK_NAME?.toLowerCase().includes('sg3')
                    )
                    .map(milestone => ({
                        date: milestone.TASK_START,
                        status: milestone.MILESTONE_STATUS,
                        label: milestone.TASK_NAME,
                        isSG3: true
                    }));

                processedData.push({
                    id: subProgramItem.CHILD_ID,
                    name: subProgramInvestment.INVESTMENT_NAME || subProgramItem.CHILD_NAME,
                    parentId: subProgramItem.COE_ROADMAP_PARENT_ID,
                    parentName: subProgramItem.COE_ROADMAP_PARENT_NAME,
                    isSubProgram: true,
                    isChild: false,
                    startDate: subProgramInvestment.TASK_START,
                    endDate: subProgramInvestment.TASK_FINISH,
                    status: subProgramInvestment.INV_OVERALL_STATUS,
                    milestones: subProgramMilestones
                });
            }
            
            // Process child projects
            const childItems = parentItems.filter(item => item.CHILD_ID !== item.COE_ROADMAP_PARENT_ID);
            
            childItems.forEach(childItem => {
                const childInvestment = investmentData.find(inv => inv.INV_EXT_ID === childItem.CHILD_ID);
                
                if (childInvestment) {
                    const childMilestones = investmentData
                        .filter(inv =>
                            inv.INV_EXT_ID === childItem.CHILD_ID &&
                            (inv.ROADMAP_ELEMENT === "Milestones - Deployment" || 
                             inv.ROADMAP_ELEMENT === "Milestones - Other") &&
                            inv.TASK_NAME?.toLowerCase().includes('sg3')
                        )
                        .map(milestone => ({
                            date: milestone.TASK_START,
                            status: milestone.MILESTONE_STATUS,
                            label: milestone.TASK_NAME,
                            isSG3: true
                        }));

                    processedData.push({
                        id: childItem.CHILD_ID,
                        name: childInvestment.INVESTMENT_NAME || childItem.CHILD_NAME,
                        parentId: childItem.COE_ROADMAP_PARENT_ID,
                        parentName: childItem.COE_ROADMAP_PARENT_NAME,
                        isSubProgram: false,
                        isChild: true,
                        startDate: childInvestment.TASK_START,
                        endDate: childInvestment.TASK_FINISH,
                        status: childInvestment.INV_OVERALL_STATUS,
                        milestones: childMilestones
                    });
                }
            });
        }
    });
    
    return processedData
        .filter(Boolean)
        .sort((a, b) => {
            if (a.parentName !== b.parentName) {
                return a.parentName.localeCompare(b.parentName);
            }
            if (a.isSubProgram && !b.isSubProgram) return -1;
            if (!a.isSubProgram && b.isSubProgram) return 1;
            return a.name.localeCompare(b.name);
        });
};

/**
 * Process region data with API data and filters
 */
export const processRegionData = async (filters = {}) => {
    const { investmentData } = await fetchAllData();
    
    const projectData = investmentData.filter(item =>
        item.CLRTY_INV_TYPE === "Project"
    );

    const projectGroups = {};
    projectData.forEach(item => {
        if (!projectGroups[item.INV_EXT_ID]) {
            projectGroups[item.INV_EXT_ID] = [];
        }
        projectGroups[item.INV_EXT_ID].push(item);
    });

    const processedProjects = [];

    Object.keys(projectGroups).forEach(projectId => {
        const projectItems = projectGroups[projectId];
        const mainRecord = projectItems.find(item =>
            item.ROADMAP_ELEMENT === "Phases" &&
            (item.TASK_NAME === "Unphased" || item.TASK_NAME === "Phases")
        );

        if (!mainRecord) return;

        const parseMarket = (invMarket) => {
            if (!invMarket) return { region: '', market: '' };
            const parts = invMarket.split('/');
            return {
                region: parts[0] || '',
                market: parts[1] || ''
            };
        };

        const { region, market } = parseMarket(mainRecord.INV_MARKET);

        // Apply filters
        if (filters.region && filters.region !== 'All' && region !== filters.region) return;
        if (filters.market && filters.market !== 'All' && market !== filters.market) return;
        if (filters.function && filters.function !== 'All' && mainRecord.INV_FUNCTION !== filters.function) return;
        if (filters.tier && filters.tier !== 'All' && mainRecord.INV_TIER?.toString() !== filters.tier) return;

        const isUnphased = mainRecord.TASK_NAME === "Unphased";
        let phases = [];
        let projectStart = mainRecord.TASK_START;
        let projectEnd = mainRecord.TASK_FINISH;

        if (!isUnphased) {
            const phaseRecords = projectItems.filter(item =>
                item.ROADMAP_ELEMENT === "Phases" &&
                item.TASK_NAME !== "Phases" &&
                ['Initiate', 'Evaluate', 'Develop', 'Deploy', 'Sustain', 'Close'].includes(item.TASK_NAME)
            );

            phases = phaseRecords
                .sort((a, b) => new Date(a.TASK_START) - new Date(b.TASK_START))
                .map(phase => ({
                    name: phase.TASK_NAME,
                    startDate: phase.TASK_START,
                    endDate: phase.TASK_FINISH
                }));

            if (phases.length > 0) {
                projectStart = phases[0].startDate;
                projectEnd = phases[phases.length - 1].endDate;
            }
        }

        const milestones = projectItems
            .filter(item =>
                (item.ROADMAP_ELEMENT === "Milestones - Other" ||
                 item.ROADMAP_ELEMENT === "Milestones - Deployment") &&
                item.TASK_START &&
                item.TASK_NAME?.toLowerCase().includes('sg3')
            )
            .map(milestone => ({
                date: milestone.TASK_START,
                status: milestone.MILESTONE_STATUS || 'Pending',
                label: milestone.TASK_NAME,
                type: milestone.ROADMAP_ELEMENT,
                isSG3: true
            }))
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        processedProjects.push({
            id: projectId,
            name: mainRecord.INVESTMENT_NAME,
            region,
            market,
            function: mainRecord.INV_FUNCTION || '',
            tier: mainRecord.INV_TIER?.toString() || '',
            startDate: projectStart,
            endDate: projectEnd,
            status: mainRecord.INV_OVERALL_STATUS,
            isUnphased,
            phases,
            milestones
        });
    });

    return processedProjects.sort((a, b) => a.name.localeCompare(b.name));
};

/**
 * Get region filter options from API data
 */
export const getRegionFilterOptions = async () => {
    const { investmentData } = await fetchAllData();
    
    const projectData = investmentData.filter(item =>
        item.CLRTY_INV_TYPE === "Project" &&
        item.ROADMAP_ELEMENT === "Phases" &&
        (item.TASK_NAME === "Unphased" || item.TASK_NAME === "Phases")
    );

    const regions = new Set();
    const markets = new Set();
    const functions = new Set();
    const tiers = new Set();

    projectData.forEach(item => {
        if (item.INV_MARKET) {
            const parts = item.INV_MARKET.split('/');
            const region = parts[0];
            const market = parts[1];

            if (region) regions.add(region);
            if (market) markets.add(market);
        }

        if (item.INV_FUNCTION) functions.add(item.INV_FUNCTION);
        if (item.INV_TIER) tiers.add(item.INV_TIER.toString());
    });

    return {
        regions: Array.from(regions).sort(),
        markets: Array.from(markets).sort(),
        functions: Array.from(functions).sort(),
        tiers: Array.from(tiers).sort()
    };
};

/**
 * Validate API data structure
 */
export const validateApiData = async () => {
    try {
        const { hierarchyData, investmentData, mode } = await fetchAllData();
        
        const errors = [];

        if (!hierarchyData?.length) {
            errors.push('Hierarchy data is empty');
        }

        if (!investmentData?.length) {
            errors.push('Investment data is empty');
        }

        const sampleHierarchy = hierarchyData?.[0];
        const sampleInvestment = investmentData?.[0];

        if (!sampleHierarchy?.CHILD_ID) {
            errors.push('Hierarchy data missing CHILD_ID');
        }

        if (!sampleInvestment?.INV_EXT_ID) {
            errors.push('Investment data missing INV_EXT_ID');
        }

        return {
            isValid: errors.length === 0,
            errors,
            mode
        };
    } catch (error) {
        return {
            isValid: false,
            errors: [`API connection failed: ${error.message}`],
            mode: 'unknown'
        };
    }
};
