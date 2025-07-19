import React from 'react';
import { format, addMonths, subMonths } from 'date-fns';

const TimelineAxis = ({ startDate = new Date() }) => {
    // Generate array of 37 months (1 prior + current + 35 future)
    const generateMonths = () => {
        const months = [];
        const oneMonthPrior = subMonths(startDate, 1);
        
        for (let i = 0; i < 37; i++) {
            const currentMonth = addMonths(oneMonthPrior, i);
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
            {/* Fixed width column for project labels */}
            <div className="min-w-[200px] flex-shrink-0 bg-white border-r border-gray-200 p-2">
                <span className="text-sm font-semibold text-gray-700">Projects</span>
            </div>
            
            {/* Scrollable months */}
            <div className="flex">
                {months.map((month, index) => (
                    <div
                        key={month.label}
                        className={`
                            flex-shrink-0 w-[100px] p-2 
                            text-xs font-medium text-gray-600 
                            border-r border-gray-200
                            ${index === 0 ? 'bg-gray-50' : ''}
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