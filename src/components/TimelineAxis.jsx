import React from 'react';
import { format, addMonths, subMonths } from 'date-fns';

const TimelineAxis = ({
    startDate = new Date(),
    monthWidth = 100,
    fontSize = '14px'
}) => {
    const generateMonths = () => {
        const months = [];
        for (let i = 0; i <= 72; i++) {
            const currentMonth = addMonths(startDate, i);
            const xPosition = i * monthWidth; // Responsive month width
            months.push({
                date: currentMonth,
                label: format(currentMonth, 'MMM yyyy'),
                shortLabel: format(currentMonth, 'MMM yy'), // Short label with abbreviated year
                xPosition: xPosition
            });


        }
        
        return months;
    };
    

    const months = generateMonths();

    // Determine label format based on available space
    const useShortFormat = monthWidth < 80;  // Use abbreviated year format when space is limited
    const useFullFormat = monthWidth >= 120; // Use full year format when there's plenty of space

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
                            {useShortFormat ? month.shortLabel : month.label}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default TimelineAxis;
