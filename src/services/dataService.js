import portfolioData from './portfolioData.json';
import investmentData from './investmentData.json';

/**
 * Maps portfolio data with investment data and processes it for the Gantt chart
 * @returns {Array} Processed data ready for the Gantt chart
 */
export const processPortfolioData = () => {
    try {
        console.log('Processing portfolio data...');
        console.log('Portfolio data count:', portfolioData?.length);
        console.log('Investment data count:', investmentData?.length);

        const processedData = portfolioData
            .map(portfolio => {
                // Find matching investment data
                const investment = investmentData.find(inv => 
                    inv.INV_EXT_ID === portfolio.CHILD_ID
                );

                if (!investment) {
                    console.log(`No investment found for CHILD_ID: ${portfolio.CHILD_ID}`);
                    return null;
                }

                // Get all SG3 milestones for this project
                const milestones = investmentData
                    .filter(inv => 
                        inv.INV_EXT_ID === portfolio.CHILD_ID && 
                        (inv.TASK_NAME?.toLowerCase().includes('sg3') || 
                         inv.TASK_NAME?.toLowerCase().includes('go-live'))
                    )
                    .map(milestone => ({
                        date: milestone.TASK_START,
                        status: milestone.MILESTONE_STATUS,
                        label: `${portfolio.CHILD_NAME}`,
                        isSG3: true
                    }));

                return {
                    id: portfolio.CHILD_ID,
                    name: investment.INVESTMENT_NAME || portfolio.CHILD_NAME,
                    parentName: portfolio.COE_ROADMAP_PARENT_NAME, 
                    startDate: investment.TASK_START,
                    endDate: investment.TASK_FINISH,
                    status: investment.INV_OVERALL_STATUS,
                    sortOrder: investment.SortOrder || 0,
                    milestones
                };
            })
            .filter(Boolean) // Remove null entries
            .sort((a, b) => a.sortOrder - b.sortOrder);

        console.log('Processed data count:', processedData.length);
        return processedData;
    } catch (error) {
        console.error('Error processing portfolio data:', error);
        return [];
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