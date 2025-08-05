import React from 'react';
import { format, addMonths, subMonths } from 'date-fns';

const TimelineAxis = ({
    startDate = new Date(),
    monthWidth = 100,
    fontSize = '14px'
}) => {
    const generateMonths = () => {
        const months = [];
        console.log('TimelineAxis startDate:', startDate);
        for (let i = 0; i <= 72; i++) {
            const currentMonth = addMonths(startDate, i);
            const xPosition = i * monthWidth; // Responsive month width
            months.push({
                date: currentMonth,
                label: format(currentMonth, 'MMM yyyy'),
                shortLabel: format(currentMonth, 'MMM'), // Short label for mobile
                xPosition: xPosition
            });

            // Log key months for debugging viewport
            if (i >= 32 && i <= 50) {
                console.log(`Timeline: Month ${i} at x=${xPosition}px: ${format(currentMonth, 'MMM yyyy')}`);
            }

            // Log the expected viewport range (months 34-46 for June 2025 to June 2026)
            if (i === 34) {
                console.log(`🎯 VIEWPORT START: Month ${i} (${format(currentMonth, 'MMM yyyy')}) should be first visible month`);
            }
            if (i === 46) {
                console.log(`🎯 VIEWPORT END: Month ${i} (${format(currentMonth, 'MMM yyyy')}) should be last visible month`);
            }
        }
        console.log('Timeline generated 73 months total');
        return months;
    };
    

    const months = generateMonths();

    // Determine if we should show short labels (mobile)
    const isMobile = monthWidth < 80;

    return (
        <div className="flex bg-white border-b border-gray-200">
            {/* Scrollable timeline */}
            <div
                className="flex overflow-x-auto"
                style={{
                    // Take full width of parent container
                    width: '100%',
                    // Set total scrollable width to show all 73 months (-36 to +36)
                    minWidth: `${monthWidth * 73}px`
                }}
            >
                {months.map((month) => (
                    <div
                        key={month.label}
                        className="flex-shrink-0 p-1 sm:p-2 text-xs font-medium text-gray-600 border-r border-gray-200 flex items-center justify-center"
                        style={{
                            width: `${monthWidth}px`,
                            fontSize: fontSize,
                            minHeight: '44px' // Touch-friendly height
                        }}
                    >
                        <span className="text-center leading-tight">
                            {isMobile ? month.shortLabel : month.label}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default TimelineAxis;
