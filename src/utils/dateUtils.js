import { parse, differenceInDays, addMonths, subMonths, startOfMonth } from 'date-fns';

/**
 * Parses a date string from the investment data format
 * @param {string} dateString - Date in format "dd-MMM-yy" (e.g., "12-Aug-24")
 * @returns {Date|null} Parsed date or null if invalid
 */
export const parseDate = (dateString) => {
    if (!dateString) return null;
    
    try {
        // Handle both formats: "dd-MMM-yy" and "MM/dd/yyyy"
        if (dateString.includes('-')) {
            return parse(dateString, 'dd-MMM-yy', new Date());
        } else if (dateString.includes('/')) {
            return parse(dateString, 'MM/dd/yyyy', new Date());
        }
        return null;
    } catch (error) {
        console.error('Error parsing date:', dateString);
        return null;
    }
};

/**
 * Gets the start and end dates for the timeline
 * @returns {{startDate: Date, endDate: Date}} Timeline range
 */
export const getTimelineRange = () => {
    const today = new Date();
    const startDate = startOfMonth(subMonths(today, 1));
    const endDate = addMonths(startDate, 36);
    return { startDate, endDate };
};

/**
 * Calculates the x-position for a date on the timeline
 * @param {Date} date - The date to position
 * @param {Date} startDate - Timeline start date
 * @param {number} totalWidth - Total width available
 * @returns {number} X-position in pixels
 */
export const calculatePosition = (date, startDate, totalWidth) => {
    if (!date || !startDate) return 0;
    
    const days = differenceInDays(date, startDate);
    const totalDays = differenceInDays(addMonths(startDate, 36), startDate);
    return Math.max(0, Math.min(totalWidth, (days / totalDays) * totalWidth));
};