import portfolioData from './portfolioData.json';
import investmentData from './investmentData.json';
import programData from './ProgramData.json';
import subProgramData from './SubProgramData.json';

/**
 * Processes roadmap data (portfolio or program) with investment data
 * @param {Array} sourceData - The source data array (portfolio or program data)
 * @returns {Array} Processed data ready for the Gantt chart
 */
const processRoadmapData = (sourceData) => {
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

                const milestones = investmentData
                    .filter(inv =>
                        inv.INV_EXT_ID === item.CHILD_ID &&
                        inv.TASK_NAME?.toLowerCase().includes('sg3')
                    )
                    .map(milestone => ({
                        date: milestone.TASK_START,
                        status: milestone.MILESTONE_STATUS,
                        label: item.CHILD_NAME,
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
                // First, sort by parent name to group programs together
                if (a.parentName !== b.parentName) {
                    return a.parentName.localeCompare(b.parentName);
                }
                // Within the same program, put the program itself first
                if (a.isProgram && !b.isProgram) return -1;
                if (!a.isProgram && b.isProgram) return 1;
                // Finally, sort by sortOrder
                return a.sortOrder - b.sortOrder;
            });
    } catch (error) {
        console.error('Error processing roadmap data:', error);
        return [];
    }
};




/**
 * Maps portfolio data with investment data and processes it for the Gantt chart
 * @returns {Array} Processed data ready for the Gantt chart
 */
export const processPortfolioData = () => processRoadmapData(portfolioData);
export const processProgramData = () => processRoadmapData(programData);

/**
 * Processes sub-program data with investment data for Gantt chart
 * @returns {Array} Processed sub-program data ready for the Gantt chart
 */
export const processSubProgramData = () => {
    try {
        const processedData = [];
        
        // Get unique sub-program parent IDs
        const uniqueParentIds = [...new Set(subProgramData.map(item => item.COE_ROADMAP_PARENT_ID))];
        
        uniqueParentIds.forEach(parentId => {
            const parentItems = subProgramData.filter(item => item.COE_ROADMAP_PARENT_ID === parentId);
            
            // Find the sub-program itself (where CHILD_ID === COE_ROADMAP_PARENT_ID)
            const subProgramItem = parentItems.find(item => item.CHILD_ID === item.COE_ROADMAP_PARENT_ID);
            
            if (subProgramItem) {
                // Process the sub-program itself
                const subProgramInvestment = investmentData.find(inv => inv.INV_EXT_ID === subProgramItem.CHILD_ID);
                
                if (subProgramInvestment) {
                    const subProgramMilestones = investmentData
                        .filter(inv => 
                            inv.INV_EXT_ID === subProgramItem.CHILD_ID &&
                            (inv.ROADMAP_ELEMENT === "Milestones - Deployment" || inv.ROADMAP_ELEMENT === "Milestones - Other")
                        )
                        .map(milestone => ({
                            date: milestone.TASK_START,
                            status: milestone.MILESTONE_STATUS,
                            label: milestone.TASK_NAME,
                            isSG3: false
                        }));

                    processedData.push({
                        id: subProgramItem.CHILD_ID,
                        name: subProgramInvestment.INVESTMENT_NAME || subProgramItem.CHILD_NAME,
                        parentId: subProgramItem.COE_ROADMAP_PARENT_ID,
                        parentName: subProgramItem.COE_ROADMAP_PARENT_NAME,
                        isSubProgram: true, // This is the sub-program itself
                        isChild: false,
                        startDate: subProgramInvestment.TASK_START,
                        endDate: subProgramInvestment.TASK_FINISH,
                        status: subProgramInvestment.INV_OVERALL_STATUS,
                        milestones: subProgramMilestones
                    });
                }
                
                // Process child projects (where CHILD_ID !== COE_ROADMAP_PARENT_ID)
                const childItems = parentItems.filter(item => item.CHILD_ID !== item.COE_ROADMAP_PARENT_ID);
                
                childItems.forEach(childItem => {
                    const childInvestment = investmentData.find(inv => inv.INV_EXT_ID === childItem.CHILD_ID);
                    
                    if (childInvestment) {
                        const childMilestones = investmentData
                            .filter(inv => 
                                inv.INV_EXT_ID === childItem.CHILD_ID &&
                                (inv.ROADMAP_ELEMENT === "Milestones - Deployment" || inv.ROADMAP_ELEMENT === "Milestones - Other")
                            )
                            .map(milestone => ({
                                date: milestone.TASK_START,
                                status: milestone.MILESTONE_STATUS,
                                label: milestone.TASK_NAME,
                                isSG3: false
                            }));

                        processedData.push({
                            id: childItem.CHILD_ID,
                            name: childInvestment.INVESTMENT_NAME || childItem.CHILD_NAME,
                            parentId: childItem.COE_ROADMAP_PARENT_ID,
                            parentName: childItem.COE_ROADMAP_PARENT_NAME,
                            isSubProgram: false, // This is a child project
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
        
        // Sort the data to maintain hierarchy: sub-program first, then children
        return processedData
            .filter(Boolean)
            .sort((a, b) => {
                // First, sort by parent name to group sub-programs together
                if (a.parentName !== b.parentName) {
                    return a.parentName.localeCompare(b.parentName);
                }
                // Within the same sub-program, put the sub-program itself first
                if (a.isSubProgram && !b.isSubProgram) return -1;
                if (!a.isSubProgram && b.isSubProgram) return 1;
                // Finally, sort children by name
                return a.name.localeCompare(b.name);
            });
    } catch (error) {
        console.error('Error processing sub-program data:', error);
        return [];
    }
};



/**
 * Processes investment data for Region Roadmap
 * @param {Object} filters - Filter criteria {region, market, function, tier}
 * @returns {Array} Processed data ready for the Region Gantt chart
 */
export const processRegionData = (filters = {}) => {
    try {
        // Filter to only show projects
        const projectData = investmentData.filter(item =>
            item.CLRTY_INV_TYPE === "Project"
        );

        // Group by INV_EXT_ID to reconstruct complete project timelines
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

            // Find the main project record (either "Unphased" or "Phases")
            const mainRecord = projectItems.find(item =>
                item.ROADMAP_ELEMENT === "Phases" &&
                (item.TASK_NAME === "Unphased" || item.TASK_NAME === "Phases")
            );

            if (!mainRecord) return;

            // Parse INV_MARKET to extract region and market
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

            // Determine if project is phased or unphased
            const isUnphased = mainRecord.TASK_NAME === "Unphased";

            let phases = [];
            let projectStart = mainRecord.TASK_START;
            let projectEnd = mainRecord.TASK_FINISH;

            if (!isUnphased) {
                // Get all phase records for this project
                const phaseRecords = projectItems.filter(item =>
                    item.ROADMAP_ELEMENT === "Phases" &&
                    item.TASK_NAME !== "Phases" &&
                    ['Initiate', 'Evaluate', 'Develop', 'Deploy', 'Sustain', 'Close'].includes(item.TASK_NAME)
                );

                // Sort phases chronologically
                phases = phaseRecords
                    .sort((a, b) => new Date(a.TASK_START) - new Date(b.TASK_START))
                    .map(phase => ({
                        name: phase.TASK_NAME,
                        startDate: phase.TASK_START,
                        endDate: phase.TASK_FINISH
                    }));

                // Calculate overall project timeline from phases
                if (phases.length > 0) {
                    projectStart = phases[0].startDate;
                    projectEnd = phases[phases.length - 1].endDate;
                }
            }

            // Get milestones for this project
            const milestones = projectItems
                .filter(item =>
                    (item.ROADMAP_ELEMENT === "Milestones - Other" ||
                     item.ROADMAP_ELEMENT === "Milestones - Deployment") &&
                    item.TASK_START
                )
                .map(milestone => ({
                    date: milestone.TASK_START,
                    status: milestone.MILESTONE_STATUS || 'Pending',
                    label: milestone.TASK_NAME,
                    type: milestone.ROADMAP_ELEMENT
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
    } catch (error) {
        console.error('Error processing region data:', error);
        return [];
    }
};

/**
 * Gets unique filter options from investment data
 * @returns {Object} Filter options for dropdowns
 */
export const getRegionFilterOptions = () => {
    try {
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
            // Parse INV_MARKET
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
    } catch (error) {
        console.error('Error getting filter options:', error);
        return { regions: [], markets: [], functions: [], tiers: [] };
    }
};

/**
 * Validates the data structure of both input files
 * @returns {Object} Validation result
 */
export const validateData = () => {
    const errors = [];

    if (!portfolioData?.length) {
        errors.push('Portfolio data is empty');
    }

    if (!investmentData?.length) {
        errors.push('Investment data is empty');
    }

    const samplePortfolio = portfolioData?.[0];
    const sampleInvestment = investmentData?.[0];

    if (!samplePortfolio?.CHILD_ID) {
        errors.push('Portfolio data missing CHILD_ID');
    }

    if (!sampleInvestment?.INV_EXT_ID) {
        errors.push('Investment data missing INV_EXT_ID');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
};
