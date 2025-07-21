import { parse, differenceInDays, addMonths, subMonths, startOfMonth } from 'date-fns';

// Constants for timeline configuration
const MONTH_WIDTH = 100; // Width per month in pixels
const MONTHS_BEFORE = 36; // Show 36 months before current
const MONTHS_AFTER = 36;  // Show 36 months after current
const INITIAL_VIEWPORT_BEFORE = 1;  // Initial view: 1 month before
const INITIAL_VIEWPORT_AFTER = 12;  // Initial view: 12 months after
const TOTAL_MONTHS = MONTHS_BEFORE + MONTHS_AFTER + 1; // +1 for current month

/**
 * Parses a date string from the investment data format
 * @param {string} dateString - Date in format "dd-MMM-yy" (e.g., "12-Aug-24")
 * @returns {Date|null} Parsed date or null if invalid
 */
export const parseDate = (dateString) => {
    if (!dateString) return null;
    try {
        if (dateString.includes('-')) {
            const parsedDate = parse(dateString, 'dd-MMM-yy', new Date());
            console.log('Parsing date:', dateString, '→', parsedDate);
            return parsedDate;
        } else if (dateString.includes('/')) {
            const parsedDate = parse(dateString, 'MM/dd/yyyy', new Date());
            console.log('Parsing date:', dateString, '→', parsedDate);
            return parsedDate;
        }
        return null;
    } catch (error) {
        console.error('Error parsing date:', dateString, error);
        return null;
    }
};

/**
 * Gets the full scrollable timeline range
 * @returns {{startDate: Date, endDate: Date}} Timeline range
 */
export const getTimelineRange = () => {
    const today = new Date();
    const startDate = startOfMonth(subMonths(today, MONTHS_BEFORE));
    const endDate = startOfMonth(addMonths(today, MONTHS_AFTER));
    console.log('Timeline Range:', { startDate, endDate });
    return { startDate, endDate };
};

/**
 * Gets the initial viewport range
 * @returns {{startDate: Date, endDate: Date}} Viewport range
 */
export const getInitialViewportRange = () => {
    const today = new Date();
    const startDate = startOfMonth(subMonths(today, INITIAL_VIEWPORT_BEFORE));
    const endDate = startOfMonth(addMonths(today, INITIAL_VIEWPORT_AFTER));
    return { startDate, endDate };
};

/**
 * Calculates the x-position for a date on the timeline
 * @param {Date} date - The date to position
 * @param {Date} startDate - Timeline start date
 * @returns {number} X-position in pixels
 */
export const calculatePosition = (date, startDate) => {
    if (!date || !startDate) {
        console.warn('Missing date or startDate:', { date, startDate });
        return 0;
    }

    const days = differenceInDays(date, startDate);
    console.log('Position calculation:', {
        date,
        startDate,
        days,
        daysPerMonth: 30.44,
        monthsFromStart: days / 30.44,
        position: Math.max(0, (days / 30.44) * MONTH_WIDTH)
    });

    return Math.max(0, (days / 30.44) * MONTH_WIDTH);
};
