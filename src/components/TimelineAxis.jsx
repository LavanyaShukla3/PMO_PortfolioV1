import React from 'react';
import { format, addMonths, subMonths } from 'date-fns';

const TimelineAxis = ({ startDate = new Date() }) => {
    const generateMonths = () => {
        const months = [];
        for (let i = 0; i <= 72; i++) {
            const currentMonth = addMonths(startDate, i);
            months.push({
                date: currentMonth,
                label: format(currentMonth, 'MMM yyyy')
            });
        }
        return months;
    };
    

    const months = generateMonths();

    return (
        <div className="flex sticky top-0 z-10 bg-white border-b border-gray-200">
            {/* Scrollable timeline */}
            <div 
                className="flex overflow-x-auto"
                style={{
                    // Set initial viewport width to show 13 months (current-1 to current+12)
                    width: `${100 * 13}px`,
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
