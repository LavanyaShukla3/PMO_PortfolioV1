import React from 'react';
import { format, addMonths, subMonths } from 'date-fns';

const TimelineAxis = ({ startDate = new Date() }) => {
    const generateMonths = () => {
        const months = [];
        console.log('TimelineAxis startDate:', startDate);
        for (let i = 0; i <= 72; i++) {
            const currentMonth = addMonths(startDate, i);
            const xPosition = i * 100; // Each month is 100px wide
            months.push({
                date: currentMonth,
                label: format(currentMonth, 'MMM yyyy'),
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

    return (
        <div className="flex bg-white border-b border-gray-200">
            {/* Scrollable timeline */}
            <div
                className="flex overflow-x-auto"
                style={{
                    // Take full width of parent container
                    width: '100%',
                    // Set total scrollable width to show all 73 months (-36 to +36)
                    minWidth: `${100 * 73}px`
                }}
            >
                {months.map((month) => (
                    <div
                        key={month.label}
                        className={`
                            flex-shrink-0 w-[100px] p-2 
                            text-xs font-medium text-gray-600 
                            border-r border-gray-200
                        `}
                    >
                        {month.label}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default TimelineAxis;
