import React from 'react';

const MilestoneMarker = ({
    x,
    y,
    complete,   // This is your MILESTONE_STATUS
    label,
    isSG3 = false,
    labelPosition = 'below', // New prop for label position
    shouldWrapText = false, // Whether to wrap text based on proximity
    isGrouped = false, // Whether this is part of a same-date group
    groupLabels = [], // Array of labels for same-date groups
    fullLabel = '', // Display2: Full label for next upcoming milestone only
    hasAdjacentMilestones = false, // Whether there are milestones within threshold
    showLabel = true // Display2: Control whether to show label
}) => {
    const size = isSG3 ? 14 : 10; // Reduced sizes
    const yOffset = isSG3 ? -7 : -5; // Adjusted offsets
    const isComplete = complete === 'Completed';

    // Text wrapping logic
    const wrapText = (text, shouldWrap) => {
        if (!shouldWrap) return [text];
        
        const words = text.split(' ');
        if (words.length <= 1) return [text];
        
        // For 2 words, split into 2 lines
        if (words.length === 2) return words;
        
        // For 3 or more words, one word per line
        return words;
    };

    const wrappedLines = wrapText(label, shouldWrapText);
    const lineHeight = 9; // Reduced height between lines
    const totalTextHeight = wrappedLines.length * lineHeight;


    return (
        <g className="milestone-marker">
            <title>{label}</title>

            {/* Diamond shape */}
            <rect 
                x={x} 
                y={y + yOffset} 
                width={size} 
                height={size} 
                transform={`rotate(45, ${x + size / 2}, ${y + size / 2})`}
                fill={isGrouped ? 'black' : (isComplete ? '#005CB9' : 'white')}
                stroke={isGrouped ? 'white' : '#005CB9'}
                strokeWidth={2}
                className="cursor-pointer transition-colors duration-150"
            />

            {/* Label rendering based on type - Display2: Only show labels for next upcoming milestone */}
            {showLabel && (isGrouped ? (
                // Stacked milestone labels with commas - Display2: Only if showLabel is true
                groupLabels.map((label, index) => (
                    <text
                        key={index}
                        x={x + size / 2}
                        y={y + size + 12 + (index * lineHeight)} // Increased spacing from 8 to 12
                        textAnchor="middle"
                        className="text-l fill-gray-600"
                        style={{
                            fontSize: '9px', // Reduced font size
                            fontFamily: 'system-ui, -apple-system, sans-serif',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        {label + (index < groupLabels.length - 1 ? ',' : '')}
                    </text>
                ))
            ) : (
                // Individual milestone label - Display2: Only show if showLabel is true
                fullLabel && (
                    <text
                        x={x + size / 2}
                        y={labelPosition === 'below'
                            ? y + size + 8    // 8px below the diamond
                            : y - 15}         // 15px above the diamond
                        textAnchor="middle"
                        className="text-l fill-gray-600"
                        style={{
                            fontSize: '9px',
                            fontFamily: 'system-ui, -apple-system, sans-serif',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        {fullLabel}
                    </text>
                )
            ))}
        </g>
    );
};

export default MilestoneMarker;


// import React from 'react';

// const MilestoneMarker = ({ 
//     x, 
//     y,
//     yOffset = 0,
//     complete, 
//     label,
//     isSG3 = false
// }) => {
//     const size = isSG3 ? 16 : 12;
//     const baseYOffset = isSG3 ? -8 : -6;
    
//     // Calculate final y position including stagger offset
//     const finalY = y + baseYOffset + yOffset;
    
//     // Split label into lines for text wrapping
//     const maxLineLength = 20;
//     const words = label.split(' ');
//     let lines = [];
//     let currentLine = '';
    
//     words.forEach(word => {
//         if ((currentLine + ' ' + word).length <= maxLineLength) {
//             currentLine = currentLine ? `${currentLine} ${word}` : word;
//         } else {
//             lines.push(currentLine);
//             currentLine = word;
//         }
//     });
//     if (currentLine) {
//         lines.push(currentLine);
//     }

//     return (
//         <g className="milestone-marker">
//             <title>{label}</title>
            
//             {/* Diamond shape */}
//             <rect 
//                 x={x} 
//                 y={finalY} 
//                 width={size} 
//                 height={size} 
//                 transform={`rotate(45, ${x + size/2}, ${finalY + size/2})`}
//                 fill={complete === 'Complete' ? '#005CB9' : 'white'} 
//                 stroke={'#005CB9'}
//                 strokeWidth={2}
//                 className="cursor-pointer transition-colors duration-150"
//             />
            
//             {/* Label below diamond */}
//             <g transform={`translate(${x - size}, ${finalY + size + 12})`}>
//                 {lines.map((line, index) => (
//                     <text
//                         key={index}
//                         x={size} // Center text relative to diamond
//                         y={index * 12} // Line spacing
//                         textAnchor="middle"
//                         className="text-xs fill-gray-600"
//                         style={{ 
//                             fontSize: '10px',
//                             fontFamily: 'system-ui, -apple-system, sans-serif'
//                         }}
//                     >
//                         {line}
//                     </text>
//                 ))}
//             </g>
//         </g>
//     );
// };

// export default MilestoneMarker;
