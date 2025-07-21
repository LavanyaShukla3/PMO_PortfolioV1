import portfolioData from './portfolioData.json';
import investmentData from './investmentData.json';
import programData from './ProgramData.json';

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
                    parentName: item.COE_ROADMAP_PARENT_NAME,
                    startDate: investment.TASK_START,
                    endDate: investment.TASK_FINISH,
                    status: investment.INV_OVERALL_STATUS,
                    sortOrder: investment.SortOrder || 0,
                    milestones
                };
            })
            .filter(Boolean)
            .sort((a, b) => a.sortOrder - b.sortOrder);
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
