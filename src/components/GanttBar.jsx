import React from 'react';
import MilestoneMarker from './MilestoneMarker';

// Helper function to calculate bar height (copied from PortfolioGanttChart)
const calculateBarHeight = (project) => {
    const textLines = Math.ceil(project.name.length / 30);
    const hasMilestones = project.milestones && project.milestones.length > 0;
    return 30 + ((textLines - 1) * 12) + (hasMilestones ? 20 : 0); // Using the same constants as parent
};

const statusColors = {
    'Red': '#ef4444',    // Tailwind red-500
    'Amber': '#f59e0b',  // Tailwind amber-500
    'Green': '#10b981',  // Tailwind emerald-500
    'Grey': '#9ca3af',    // Tailwind gray-400
    'Yellow': '#E5DE00'
};

// const GanttBar = ({ 
//     data,
//     y,
//     height,
//     startX,
//     width,
//     label,
//     status,
//     onBarClick
// }) => {
//     const barColor = statusColors[status] || statusColors.Grey;

    
//     return (
//         <g className="gantt-bar">
//             {/* Project label with ellipsis */}
//             <text
//                 x={10}
//                 y={y + height/2 + 5} // Vertically centered
//                 className="text-sm fill-gray-700"
//                 style={{ 
//                     fontSize: '12px',
//                     fontFamily: 'system-ui, -apple-system, sans-serif'
//                 }}
//             >
//                 {label.length > 30 ? `${label.substring(0, 27)}...` : label}
//                 <title>{label}</title>
//             </text>
            
//             {/* Main bar */}
//             <rect
//                 x={startX}
//                 y={y}
//                 width={Math.max(width, 2)} // Minimum width of 2px
//                 height={height}
//                 rx={4}
//                 fill={barColor}
//                 className="cursor-pointer transition-opacity duration-150 hover:opacity-90"
//                 onClick={() => onBarClick?.(data)}
//             >
//                 <title>{label}</title>
//             </rect>
//         </g>
//     );
// };

// export default GanttBar;
const GanttBar = ({ 
    data,
    y,
    width,
    startX,
    label,
    status,
    milestones = [],
    onBarClick
}) => {
    const barColor = statusColors[status] || statusColors.Grey;
    
    // Text wrapping for long labels
    const wrapText = (text, maxWidth = 180) => { // 180px max width for label
        const words = text.split(' ');
        let lines = [];
        let currentLine = '';
        
        words.forEach(word => {
            // Approximate width calculation (you might need to adjust the multiplier)
            const wouldBeLineWidth = (currentLine + ' ' + word).length * 6;
            
            if (wouldBeLineWidth <= maxWidth) {
                currentLine = currentLine ? `${currentLine} ${word}` : word;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        });
        if (currentLine) {
            lines.push(currentLine);
        }
        return lines;
    };

    const labelLines = wrapText(label);
    const lineHeight = 16; // pixels between lines
    
    return (
        <g className="gantt-bar">
            
            {/* Main bar */}
            <rect
                x={startX}
                y={y + (calculateBarHeight(data) - 24) / 2} // Center the bar vertically in its space
                width={Math.max(width, 2)} // Minimum width of 2px
                height={24}
                rx={4}
                fill={barColor}
                className="cursor-pointer transition-opacity duration-150 hover:opacity-90"
                onClick={() => onBarClick?.(data)}
            >
                <title>{label}</title>
            </rect>
            
            {/* Milestones */}
            {milestones?.map((milestone, index) => (
                <MilestoneMarker
                    key={`${data.id}-milestone-${index}`}
                    x={milestone.x}
                    y={y + (calculateBarHeight(data) - 24) / 2 + 12} // Center with the bar
                    complete={milestone.status}
                    label={milestone.label}
                    isSG3={milestone.isSG3}
                    labelPosition={milestone.labelPosition}
                    shouldWrapText={milestone.shouldWrapText}
                    isGrouped={milestone.isGrouped}
                    groupLabels={milestone.groupLabels}
                    truncatedLabel={milestone.truncatedLabel}
                    hasAdjacentMilestones={milestone.hasAdjacentMilestones}
                />
            ))}
        </g>
    );
};
export default GanttBar;