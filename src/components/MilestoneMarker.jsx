// import React from 'react';

// const MilestoneMarker = ({ 
//     x, 
//     y,
//     complete,   // This is your MILESTONE_STATUS
//     label,
//     isSG3 = false
// }) => {
//     const size = isSG3 ? 16 : 12;
//     const yOffset = isSG3 ? -8 : -6;

//     const isComplete = complete === 'Completed';


//     return (
//         <g className="milestone-marker">
//             <title>{label}</title>

//             {/* Diamond shape */}
//             <rect 
//                 x={x} 
//                 y={y + yOffset} 
//                 width={size} 
//                 height={size} 
//                 transform={`rotate(45, ${x + size / 2}, ${y + size / 2})`}
//                 fill={isComplete ? '#005CB9' : 'white'}
//                 stroke="#005CB9"
//                 strokeWidth={2}
//                 className="cursor-pointer transition-colors duration-150"
//             />

//             {/* Label below diamond (single line, centered) */}
//             <text
//                 x={x + size / 2}
//                 y={y + size + 12}
//                 textAnchor="middle"
//                 className="text-xs fill-gray-600"
//                 style={{
//                     fontSize: '10px',
//                     fontFamily: 'system-ui, -apple-system, sans-serif',
//                     whiteSpace: 'nowrap'
//                 }}
//             >
//                 {label}
//             </text>
//         </g>
//     );
// };

// export default MilestoneMarker;
// 

import React from 'react';

const MilestoneMarker = ({ 
    x, 
    y,
    yOffset = 0,
    complete, 
    label,
    isSG3 = false
}) => {
    const size = isSG3 ? 16 : 12;
    const baseYOffset = isSG3 ? -8 : -6;
    
    // Calculate final y position including stagger offset
    const finalY = y + baseYOffset + yOffset;
    
    // Split label into lines for text wrapping
    const maxLineLength = 20;
    const words = label.split(' ');
    let lines = [];
    let currentLine = '';
    
    words.forEach(word => {
        if ((currentLine + ' ' + word).length <= maxLineLength) {
            currentLine = currentLine ? `${currentLine} ${word}` : word;
        } else {
            lines.push(currentLine);
            currentLine = word;
        }
    });
    if (currentLine) {
        lines.push(currentLine);
    }

    return (
        <g className="milestone-marker">
            <title>{label}</title>
            
            {/* Diamond shape */}
            <rect 
                x={x} 
                y={finalY} 
                width={size} 
                height={size} 
                transform={`rotate(45, ${x + size/2}, ${finalY + size/2})`}
                fill={complete === 'Complete' ? '#005CB9' : 'white'} 
                stroke={'#005CB9'}
                strokeWidth={2}
                className="cursor-pointer transition-colors duration-150"
            />
            
            {/* Label below diamond */}
            <g transform={`translate(${x - size}, ${finalY + size + 12})`}>
                {lines.map((line, index) => (
                    <text
                        key={index}
                        x={size} // Center text relative to diamond
                        y={index * 12} // Line spacing
                        textAnchor="middle"
                        className="text-xs fill-gray-600"
                        style={{ 
                            fontSize: '10px',
                            fontFamily: 'system-ui, -apple-system, sans-serif'
                        }}
                    >
                        {line}
                    </text>
                ))}
            </g>
        </g>
    );
};

export default MilestoneMarker;