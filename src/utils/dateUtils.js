import { parse, differenceInDays, addMonths, subMonths, startOfMonth, getMonth, getYear } from 'date-fns';

// A/B Testing Configuration: Switch between 'horizontal' and 'vertical' milestone layouts
export const MILESTONE_LAYOUT_TYPE = 'vertical'; // Change to 'horizontal' for comma-separated layout

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
 * @param {string} context - Optional context for debugging (e.g., project name)
 * @returns {Date|null} Parsed date or null if invalid
 */

export const parseDate = (dateString, context = '') => {
    if (!dateString) return null;
    try {
        if (dateString.includes('-')) {
            const parsedDate = parse(dateString, 'dd-MMM-yy', new Date());
            console.log('Parsing date:', dateString, '→', parsedDate, context ? `[${context}]` : '');
            return parsedDate;
        } else if (dateString.includes('/')) {
            const parsedDate = parse(dateString, 'MM/dd/yyyy', new Date());
            console.log('Parsing date:', dateString, '→', parsedDate, context ? `[${context}]` : '');
            return parsedDate;
        }
        return null;
    } catch (error) {
        console.error('Error parsing date:', dateString, error, context ? `[${context}]` : '');
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
 * @param {number} monthWidth - Width per month in pixels (default: 100)
 * @returns {number} X-position in pixels
 */
export const calculatePosition = (date, startDate, monthWidth = MONTH_WIDTH) => {

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
        monthWidth,
        position: Math.max(0, (days / 30.44) * monthWidth)
    });

    return Math.max(0, (days / 30.44) * monthWidth);
};

/**
 * Display3: Groups milestones by month for monthly grouped milestone labels
 * @param {Array} milestones - Array of milestone objects with date property
 * @returns {Object} Object with month keys (YYYY-MM format) and milestone arrays as values
 */
export const groupMilestonesByMonth = (milestones) => {
    if (!milestones?.length) return {};

    const groups = {};

    milestones.forEach(milestone => {
        const date = parseDate(milestone.date);
        if (!date) return;

        const monthKey = `${getYear(date)}-${String(getMonth(date) + 1).padStart(2, '0')}`;

        if (!groups[monthKey]) {
            groups[monthKey] = [];
        }

        groups[monthKey].push({
            ...milestone,
            parsedDate: date,
            day: date.getDate()
        });
    });

    // Sort milestones within each month by day (ascending order)
    Object.keys(groups).forEach(monthKey => {
        groups[monthKey].sort((a, b) => a.day - b.day);
    });

    return groups;
};

/**
 * Display3: Creates horizontal comma-separated milestone labels for a month
 * @param {Array} monthMilestones - Array of milestones for a specific month
 * @param {number} maxWidth - Maximum width in pixels (2 months width)
 * @param {string} fontSize - Font size for width calculation
 * @returns {string} Comma-separated horizontal label string
 */
export const createHorizontalMilestoneLabel = (monthMilestones, maxWidth, fontSize = '14px') => {
    if (!monthMilestones?.length) return '';

    // Create individual milestone labels in format "4th: Spain"
    const milestoneLabels = monthMilestones.map(milestone =>
        `${milestone.day}${getOrdinalSuffix(milestone.day)}: ${milestone.label}`
    );

    // Join with commas and spaces
    const combinedLabel = milestoneLabels.join(', ');

    // Truncate if exceeds max width
    return truncateTextToWidth(combinedLabel, maxWidth, fontSize);
};

/**
 * Display3: Creates vertical stacked milestone labels for a month (A/B Testing Variation)
 * @param {Array} monthMilestones - Array of milestones for a specific month
 * @param {number} maxWidth - Maximum width in pixels (2 months width)
 * @param {string} fontSize - Font size for width calculation
 * @returns {Array} Array of individual milestone label strings for vertical stacking
 */
export const createVerticalMilestoneLabels = (monthMilestones, maxWidth, fontSize = '14px') => {
    if (!monthMilestones?.length) return [];

    // Create individual milestone labels in format "4th: Spain"
    return monthMilestones.map(milestone => {
        const label = `${milestone.day}${getOrdinalSuffix(milestone.day)}: ${milestone.label}`;
        // Truncate each individual label if it exceeds max width
        return truncateTextToWidth(label, maxWidth, fontSize);
    });
};

/**
 * Helper function to get ordinal suffix (1st, 2nd, 3rd, 4th, etc.)
 * @param {number} day - Day of the month
 * @returns {string} Ordinal suffix
 */
const getOrdinalSuffix = (day) => {
    if (day >= 11 && day <= 13) {
        return 'th';
    }
    switch (day % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
    }
};

/**
 * Display3: Determines label position based on month index (odd = above, even = below)
 * @param {string} monthKey - Month key in YYYY-MM format
 * @returns {string} 'above' or 'below'
 */
export const getMonthlyLabelPosition = (monthKey) => {
    const [year, month] = monthKey.split('-').map(Number);
    const monthIndex = month; // 1-based month number
    return monthIndex % 2 === 1 ? 'above' : 'below'; // Odd months above, even months below
};

/**
 * Display3: Calculates approximate text width for truncation
 * @param {string} text - Text to measure
 * @param {string} fontSize - Font size (e.g., '14px')
 * @returns {number} Approximate width in pixels
 */
export const calculateTextWidth = (text, fontSize = '14px') => {
    // Approximate character width based on font size
    const baseFontSize = parseInt(fontSize);
    const avgCharWidth = baseFontSize * 0.6; // Rough approximation for system fonts
    return text.length * avgCharWidth;
};

/**
 * Display3: Truncates text to fit within specified width
 * @param {string} text - Text to truncate
 * @param {number} maxWidth - Maximum width in pixels
 * @param {string} fontSize - Font size for width calculation
 * @returns {string} Truncated text with ellipsis if needed
 */
export const truncateTextToWidth = (text, maxWidth, fontSize = '14px') => {
    if (!text) return '';

    const fullWidth = calculateTextWidth(text, fontSize);
    if (fullWidth <= maxWidth) return text;

    const ellipsisWidth = calculateTextWidth('…', fontSize);
    const availableWidth = maxWidth - ellipsisWidth;

    if (availableWidth <= 0) return '…';

    const avgCharWidth = calculateTextWidth('a', fontSize);
    const maxChars = Math.floor(availableWidth / avgCharWidth);

    return text.substring(0, Math.max(1, maxChars)) + '…';
};
