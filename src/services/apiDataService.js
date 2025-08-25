// Legacy service file - functions moved to utils folder
// This file is kept for backward compatibility with other components

import { processPortfolioDataFromAPI } from '../utils/portfolioDataUtils';

// Export the new portfolio function for compatibility
export const processPortfolioData = processPortfolioDataFromAPI;

// Placeholder functions for other components that haven't been migrated yet
export const processProgramData = () => {
    console.warn('processProgramData not implemented yet - please use Program view after migration');
    return [];
};

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