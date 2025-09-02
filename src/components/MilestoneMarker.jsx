import React from 'react';
import { parseDate } from '../utils/dateUtils';

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
    showLabel = true, // Display2: Control whether to show label
    fontSize = '14px', // Responsive font size
    isMobile = false, // Mobile flag for responsive behavior
    zoomLevel = 1.0, // New prop for zoom-based scaling
    // Display3: New props for monthly grouped labels
    isMonthlyGrouped = false, // Whether this uses Display3 monthly grouping
    monthlyLabels = [], // Array of monthly label lines (legacy - for backward compatibility)
    horizontalLabel = '', // Single horizontal comma-separated label for Display3
    verticalLabels = [], // Array of vertical labels for Display3 A/B testing
    monthKey = '', // Month key for this milestone
    // NEW PROPS for the fixes
    shouldRenderShape = true, // Whether to render the diamond shape (only first in month)
    allMilestonesInProject = [], // All milestones in the project for ±4 months check
    currentMilestoneDate = null, // Current milestone date for proximity check
}) => {
    // Zoom-responsive sizing - FIXED: Consistent size regardless of isSG3 flag
    const zoomScale = Math.max(0.5, Math.min(1.5, zoomLevel)); // Clamp zoom between 0.5 and 1.5
    const baseSize = isMobile ? 12 : 10;
    const zoomedBaseSize = Math.round(baseSize * zoomScale);
    
    // ISSUE FIX: All milestones same size - remove isSG3 size variation
    const size = zoomedBaseSize; // Always use base size, no multiplication for SG3
    
    const yOffset = 0; // Position milestone on the Gantt bar instead of above it
    const isComplete = complete === 'Completed';
    
    // ISSUE FIX: Calculate precise vertical centering
    // The y prop passed should be the center of the bar, so we need to offset by half the milestone size
    const verticalCenterOffset = -size / 2;

    // IMPROVED: Smart label truncation logic with intelligent cluster-based stretching
    const truncateLabel = (labelText) => {
        if (!labelText || typeof labelText !== 'string') return labelText;
        
        const monthWidth = 100; // Default month width
        
        // If no milestone data available, use conservative 2-month width
        if (!currentMilestoneDate || !allMilestonesInProject?.length) {
            const conservativeCharLimit = Math.floor((2 * monthWidth) / 8);
            if (labelText.length <= conservativeCharLimit) return labelText;
            return labelText.substring(0, conservativeCharLimit - 3) + '...';
        }
        
        // Parse and sort all milestones by date
        const currentDate = new Date(currentMilestoneDate);
        const validMilestones = allMilestonesInProject
            .filter(m => m.date && m.date !== currentMilestoneDate)
            .map(m => {
                const parsed = parseDate ? parseDate(m.date) : new Date(m.date);
                return { ...m, parsedDate: parsed };
            })
            .filter(m => m.parsedDate && !isNaN(m.parsedDate.getTime()))
            .sort((a, b) => a.parsedDate - b.parsedDate);
        
        if (validMilestones.length === 0) {
            // No other milestones - use maximum width (4 months)
            const maxCharLimit = Math.floor((4 * monthWidth) / 8);
            return labelText.length <= maxCharLimit ? labelText : labelText.substring(0, maxCharLimit - 3) + '...';
        }
        
        // Find the milestone cluster bounds (earliest to latest milestone in project)
        const earliestMilestone = validMilestones[0].parsedDate;
        const latestMilestone = validMilestones[validMilestones.length - 1].parsedDate;
        
        // Calculate cluster span in months
        const clusterSpanMs = latestMilestone - earliestMilestone;
        const clusterSpanMonths = clusterSpanMs / (1000 * 60 * 60 * 24 * 30.44);
        
        // Determine available width based on cluster analysis
        let availableWidth;
        
        if (clusterSpanMonths <= 6) {
            // Small cluster - labels can extend across the full cluster width
            availableWidth = Math.max(2, clusterSpanMonths) * monthWidth;
        } else {
            // Large cluster - find local constraints around current milestone
            const sixMonthsBefore = new Date(currentDate);
            sixMonthsBefore.setMonth(currentDate.getMonth() - 6);
            const sixMonthsAfter = new Date(currentDate);
            sixMonthsAfter.setMonth(currentDate.getMonth() + 6);
            
            // Find nearest milestones within ±6 months
            const nearbyMilestones = validMilestones.filter(m => 
                m.parsedDate >= sixMonthsBefore && m.parsedDate <= sixMonthsAfter
            );
            
            if (nearbyMilestones.length > 0) {
                const localEarliest = nearbyMilestones[0].parsedDate;
                const localLatest = nearbyMilestones[nearbyMilestones.length - 1].parsedDate;
                const localSpanMs = localLatest - localEarliest;
                const localSpanMonths = Math.max(2, localSpanMs / (1000 * 60 * 60 * 24 * 30.44));
                
                // Use local span, but cap at 6 months maximum
                availableWidth = Math.min(localSpanMonths, 6) * monthWidth;
            } else {
                // No nearby milestones - use generous 4 months
                availableWidth = 4 * monthWidth;
            }
        }
        
        // Calculate character limit and apply truncation
        const charLimit = Math.floor(availableWidth / 8); // ~8 pixels per character
        
        if (labelText.length <= charLimit) {
            return labelText;
        }
        
        // Apply smart truncation with minimum readable length
        const minChars = 10; // Minimum readable characters
        const effectiveLimit = Math.max(minChars, charLimit - 3);
        return labelText.substring(0, effectiveLimit) + '...';
    };

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
    const lineHeight = isMobile ? 14 : 11; // Increased line height for better spacing
    const totalTextHeight = wrappedLines.length * lineHeight;


    return (
        <g className="milestone-marker">
            <title>{label}</title>

            {/* Diamond shape - Only render if shouldRenderShape is true (one per month) */}
            {shouldRenderShape && (
                <rect 
                    x={x} 
                    y={y + yOffset + verticalCenterOffset} 
                    width={size} 
                    height={size} 
                    transform={`rotate(45, ${x + size / 2}, ${y + yOffset + verticalCenterOffset + size / 2})`}
                    fill={isGrouped ? 'black' : (isComplete ? '#005CB9' : 'white')}
                    stroke={isGrouped ? 'white' : '#005CB9'}
                    strokeWidth={2}
                    className="cursor-pointer transition-colors duration-150"
                />
            )}

            {/* Label rendering - Display3: Monthly grouped labels or Display2: Legacy logic */}
            {showLabel && (isMonthlyGrouped ? (
                // Display3: A/B Testing - Horizontal vs Vertical layouts
                <>
                    {/* Horizontal Layout: Single comma-separated label */}
                    {horizontalLabel && (
                        <text
                            key={`${monthKey}-horizontal`}
                            x={x + size / 2}
                            y={labelPosition === 'below'
                                ? y + yOffset + verticalCenterOffset + size + (isMobile ? 18 : 14) // Below marker
                                : y + yOffset + verticalCenterOffset - (isMobile ? 25 : 20)} // Above marker
                            textAnchor="middle"
                            className="text-l fill-gray-600"
                            style={{
                                fontSize: fontSize,
                                fontFamily: 'system-ui, -apple-system, sans-serif',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            {truncateLabel(horizontalLabel)}
                        </text>
                    )}

                    {/* Vertical Layout: Stacked individual labels */}
                    {verticalLabels.map((labelLine, index) => (
                        <text
                            key={`${monthKey}-vertical-${index}`}
                            x={x + size / 2}
                            y={labelPosition === 'below'
                                ? y + yOffset + verticalCenterOffset + size + (isMobile ? 18 : 14) + (index * lineHeight) // Below marker, stacked down
                                : y + yOffset + verticalCenterOffset - (isMobile ? 25 : 20) - ((verticalLabels.length - 1 - index) * lineHeight)} // Above marker, stacked up
                            textAnchor="middle"
                            className="text-l fill-gray-600"
                            style={{
                                fontSize: fontSize,
                                fontFamily: 'system-ui, -apple-system, sans-serif',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            {truncateLabel(labelLine)}
                        </text>
                    ))}
                </>
            ) : (
                // Display2: Legacy logic for backward compatibility
                isGrouped ? (
                    // Stacked milestone labels with commas - Display2: Only if showLabel is true
                    groupLabels.map((label, index) => (
                        <text
                            key={index}
                            x={x + size / 2}
                            y={y + yOffset + verticalCenterOffset + size + (isMobile ? 18 : 14) + (index * lineHeight)} // Increased space below marker for grouped labels (match PortfolioGanttChart)
                            textAnchor="middle"
                            className="text-l fill-gray-600"
                            style={{
                                fontSize: fontSize,
                                fontFamily: 'system-ui, -apple-system, sans-serif',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            {truncateLabel(label) + (index < groupLabels.length - 1 ? ',' : '')}
                        </text>
                    ))
                ) : (
                    // Individual milestone label - Display2: Only show if showLabel is true
                    fullLabel && (
                        <text
                            x={x + size / 2}
                            y={labelPosition === 'below'
                                ? y + yOffset + verticalCenterOffset + size + (isMobile ? 14 : 10)   // Increased space below marker (match PortfolioGanttChart BELOW_LABEL_OFFSET=20)
                                : y + yOffset + verticalCenterOffset - (isMobile ? 20 : 17)}         // Decreased space above marker (match PortfolioGanttChart ABOVE_LABEL_OFFSET=15)
                            textAnchor="middle"
                            className="text-l fill-gray-600"
                            style={{
                                fontSize: fontSize,
                                fontFamily: 'system-ui, -apple-system, sans-serif',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            {truncateLabel(fullLabel)}
                        </text>
                    )
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
