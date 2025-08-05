import React, { useState, useEffect, useRef } from 'react';
import TimelineAxis from '../components/TimelineAxis';
import MilestoneMarker from '../components/MilestoneMarker';
import { getTimelineRange, parseDate, calculatePosition } from '../utils/dateUtils';
import { processPortfolioData } from '../services/dataService';
import { differenceInDays } from 'date-fns';

// Responsive constants - will be calculated dynamically
const getResponsiveConstants = () => {
    const screenWidth = window.innerWidth;
    const isMobile = screenWidth < 768;
    const isTablet = screenWidth >= 768 && screenWidth < 1024;
    const isDesktop = screenWidth >= 1024;

    return {
        MONTH_WIDTH: isMobile ? Math.max(60, screenWidth * 0.08) : isTablet ? 80 : 100,
        TOTAL_MONTHS: 73,
        LABEL_WIDTH: isMobile ? Math.min(170, screenWidth * 0.32) : isTablet ? 200 : 220, // Increased spacing
        BASE_BAR_HEIGHT: isMobile ? 8 : 10,
        MILESTONE_LABEL_HEIGHT: isMobile ? 16 : 20,
        VISIBLE_MONTHS: isMobile ? 6 : isTablet ? 9 : 13,
        TOUCH_TARGET_SIZE: isMobile ? 44 : 24, // Minimum 44px for touch targets
        FONT_SIZE: isMobile ? '12px' : '14px'
    };
};

const DAYS_THRESHOLD = 16; // Threshold for considering milestones as overlapping
const MAX_LABEL_LENGTH = 5; // Maximum length before truncation

const statusColors = {
    'Red': '#ef4444',    // Tailwind red-500
    'Amber': '#f59e0b',  // Tailwind amber-500
    'Green': '#10b981',  // Tailwind emerald-500
    'Grey': '#9ca3af',   // Tailwind gray-400
    'Yellow': '#E5DE00'
};

const truncateLabel = (label, hasAdjacentMilestones) => {
    // Only truncate if there are adjacent milestones and length exceeds max
    if (!hasAdjacentMilestones || label.length <= MAX_LABEL_LENGTH) return label;
    return label.substring(0, MAX_LABEL_LENGTH) + '...';
};

const processMilestonesWithPosition = (milestones, startDate, monthWidth = 100) => {
    if (!milestones?.length) return [];

    // Sort milestones by date
    const sortedMilestones = [...milestones].sort((a, b) => {
        const dateA = parseDate(a.date);
        const dateB = parseDate(b.date);
        return dateA - dateB;
    });

    // Display2: Find the next upcoming milestone (by due date, ascending)
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0); // Set to start of day for comparison
    const nextUpcomingMilestone = sortedMilestones.find(milestone => {
        const milestoneDate = parseDate(milestone.date);
        milestoneDate.setHours(0, 0, 0, 0); // Set to start of day for comparison
        return milestoneDate >= currentDate;
    }) || sortedMilestones[sortedMilestones.length - 1]; // Fallback to last milestone if all are past

    // First pass: calculate x positions and group by date
    const milestonesWithX = [];
    const sameDateGroups = new Map(); // Map of date string to array of milestones

    sortedMilestones.forEach(milestone => {
        const milestoneDate = parseDate(milestone.date);
        const x = calculatePosition(milestoneDate, startDate, monthWidth);
        const dateStr = milestoneDate.toISOString();
        
        const milestoneWithX = { ...milestone, x, date: milestoneDate };
        milestonesWithX.push(milestoneWithX);

        // Group milestones by exact date
        if (!sameDateGroups.has(dateStr)) {
            sameDateGroups.set(dateStr, []);
        }
        sameDateGroups.get(dateStr).push(milestoneWithX);
    });

    // Second pass: process groups and determine positioning
    let lastPosition = 'below';
    
    return milestonesWithX.map((milestone, index) => {
        const dateStr = milestone.date.toISOString();
        const sameDateMilestones = sameDateGroups.get(dateStr);
        const isPartOfGroup = sameDateMilestones.length > 1;

        // Check for adjacent milestones (within 5 days)
        const prevMilestone = index > 0 ? milestonesWithX[index - 1] : null;
        const nextMilestone = index < milestonesWithX.length - 1 ? milestonesWithX[index + 1] : null;
        
        const distToPrev = prevMilestone ? Math.abs(differenceInDays(milestone.date, prevMilestone.date)) : Infinity;
        const distToNext = nextMilestone ? Math.abs(differenceInDays(milestone.date, nextMilestone.date)) : Infinity;
        
        const hasAdjacentMilestones = distToPrev <= DAYS_THRESHOLD || distToNext <= DAYS_THRESHOLD;

        // Display2: Determine if this milestone should show a label
        const milestoneDate = new Date(milestone.date);
        milestoneDate.setHours(0, 0, 0, 0);
        const nextUpcomingDate = parseDate(nextUpcomingMilestone.date);
        nextUpcomingDate.setHours(0, 0, 0, 0);
        const shouldShowLabel = milestoneDate.getTime() === nextUpcomingDate.getTime();

        // Handle same-date groups
        if (isPartOfGroup) {
            // Display2: Only show labels if this group contains the next upcoming milestone
            const groupLabels = shouldShowLabel
                ? sameDateMilestones.map(m => m.label) // Show all labels in the upcoming group, no truncation
                : []; // Empty array = no labels shown

            return {
                ...milestone,
                isGrouped: true,
                groupLabels,
                labelPosition: 'below',
                shouldWrapText: false,
                hasAdjacentMilestones,
                showLabel: shouldShowLabel
            };
        }

        // Handle individual milestones
        // Determine label position based on proximity to previous milestone
        let labelPosition = 'below';
        if (prevMilestone && distToPrev <= DAYS_THRESHOLD) {
            labelPosition = lastPosition === 'below' ? 'above' : 'below';
        }

        lastPosition = labelPosition;

        return {
            ...milestone,
            isGrouped: false,
            labelPosition,
            shouldWrapText: false,
            fullLabel: shouldShowLabel ? milestone.label : '', // Display2: Only show label for next upcoming
            hasAdjacentMilestones,
            showLabel: shouldShowLabel
        };
    });
  };

const PortfolioGanttChart = ({ onDrillToProgram }) => {
    const [processedData, setProcessedData] = useState([]);
    const [filteredData, setFilteredData] = useState([]);
    const [selectedParent, setSelectedParent] = useState('All');
    const [responsiveConstants, setResponsiveConstants] = useState(getResponsiveConstants());

    const timelineScrollRef = useRef(null);
    const ganttScrollRef = useRef(null);
    const leftPanelScrollRef = useRef(null);

    const { startDate } = getTimelineRange();
    const totalWidth = responsiveConstants.MONTH_WIDTH * responsiveConstants.TOTAL_MONTHS;

    // Handle window resize for responsive behavior
    useEffect(() => {
        const handleResize = () => {
            setResponsiveConstants(getResponsiveConstants());
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const data = processPortfolioData();
        setProcessedData(data);
        setFilteredData(data);

        // Initial scroll to show June 2025 to June 2026 (responsive months)
        if (timelineScrollRef.current) {
            // Calculate scroll position to show June 2025 (current month - 2)
            const monthsFromStart = 36; // MONTHS_BEFORE from dateUtils.js (July 2025 is month 36)
            const scrollPosition = (monthsFromStart - 2) * responsiveConstants.MONTH_WIDTH; // June 2025 is month 34

            // Debug actual widths
            console.log('🔍 Setting scroll position:', scrollPosition, 'to show June 2025 (month 34)');
            console.log('🔍 Timeline container width:', timelineScrollRef.current.offsetWidth);
            console.log('🔍 Timeline container style width:', timelineScrollRef.current.style.width);
            console.log('🔍 Expected width for visible months:', responsiveConstants.MONTH_WIDTH * responsiveConstants.VISIBLE_MONTHS, 'px');
            console.log('🔍 Screen width:', window.innerWidth);
            console.log('🔍 Responsive constants:', responsiveConstants);

            timelineScrollRef.current.scrollLeft = scrollPosition;
            // Sync gantt scroll position
            if (ganttScrollRef.current) {
                ganttScrollRef.current.scrollLeft = scrollPosition;
            }
        }
    }, []);

    // Scroll synchronization handlers
    const handleTimelineScroll = (e) => {
        const scrollLeft = e.target.scrollLeft;
        if (ganttScrollRef.current && ganttScrollRef.current.scrollLeft !== scrollLeft) {
            ganttScrollRef.current.scrollLeft = scrollLeft;
        }
    };

    const handleGanttScroll = (e) => {
        const scrollLeft = e.target.scrollLeft;
        const scrollTop = e.target.scrollTop;
        if (timelineScrollRef.current && timelineScrollRef.current.scrollLeft !== scrollLeft) {
            timelineScrollRef.current.scrollLeft = scrollLeft;
        }
        // Synchronize vertical scroll with left panel
        if (leftPanelScrollRef.current && leftPanelScrollRef.current.scrollTop !== scrollTop) {
            leftPanelScrollRef.current.scrollTop = scrollTop;
        }
    };

    const handleLeftPanelScroll = (e) => {
        const scrollTop = e.target.scrollTop;
        // Synchronize vertical scroll with gantt chart
        if (ganttScrollRef.current && ganttScrollRef.current.scrollTop !== scrollTop) {
            ganttScrollRef.current.scrollTop = scrollTop;
        }
    };

    const parentNames = ['All', ...Array.from(new Set(processedData.map(item => item.parentName)))];

    const handleParentChange = (e) => {
        const value = e.target.value;
        setSelectedParent(value);

        if (value === 'All') {
            setFilteredData(processedData);
        } else {
            setFilteredData(processedData.filter(item => item.parentName === value));
        }
    };

    const calculateMilestoneLabelHeight = (milestones, monthWidth = 100) => {
        if (!milestones?.length) return 0;

        // Process milestones to get their positions and grouping info
        const processedMilestones = processMilestonesWithPosition(milestones, startDate, monthWidth);
        
        let maxAboveHeight = 0;
        let maxBelowHeight = 0;
        const LINE_HEIGHT = 12;
        const LABEL_PADDING = 15; // Padding for labels
        const ABOVE_LABEL_OFFSET = 15; // Space needed above the bar for labels
        const BELOW_LABEL_OFFSET = 20; // Space needed below the bar for labels

        processedMilestones.forEach(milestone => {
            if (milestone.isGrouped) {
                // For grouped milestones, calculate stacked height
                const groupHeight = milestone.groupLabels.length * LINE_HEIGHT;
                maxBelowHeight = Math.max(maxBelowHeight, groupHeight + LABEL_PADDING);
            } else {
                // For individual milestones
                if (milestone.labelPosition === 'above') {
                    maxAboveHeight = Math.max(maxAboveHeight, ABOVE_LABEL_OFFSET);
                } else {
                    maxBelowHeight = Math.max(maxBelowHeight, BELOW_LABEL_OFFSET);
                }
            }
        });

        // Return total height needed for milestone labels
        return maxAboveHeight + maxBelowHeight;
    };

    const calculateBarHeight = (project) => {
        // Calculate height needed for project name wrapping (responsive)
        const maxCharsPerLine = responsiveConstants.LABEL_WIDTH / 8; // Approximate chars per line
        const textLines = Math.ceil(project.name.length / maxCharsPerLine);
        const nameHeight = responsiveConstants.BASE_BAR_HEIGHT + ((textLines - 1) * 12);

        // Calculate height needed for milestone labels
        const milestoneLabelHeight = calculateMilestoneLabelHeight(project.milestones, responsiveConstants.MONTH_WIDTH);

        // Return total height needed: name height + milestone label height + padding (responsive)
        const padding = responsiveConstants.TOUCH_TARGET_SIZE > 24 ? 20 : 16;
        return nameHeight + milestoneLabelHeight + padding;
    };

    const getTotalHeight = () => {
        return filteredData.reduce((total, project) => {
            const barHeight = calculateBarHeight(project);
            return total + barHeight + 8;
        }, 40);
    };

    return (
        <div className="w-full h-screen flex flex-col">
            {/* Responsive Header */}
            <div className="flex-shrink-0 p-2 sm:p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                    <label className="font-medium text-sm sm:text-base">Select Portfolio:</label>
                    <select
                        value={selectedParent}
                        onChange={handleParentChange}
                        className="border border-gray-300 rounded px-2 py-1 sm:px-3 sm:py-1 bg-white text-sm sm:text-base"
                        style={{ minHeight: responsiveConstants.TOUCH_TARGET_SIZE }}
                    >
                        {parentNames.map((name) => (
                            <option key={name} value={name}>
                                {name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Fixed Header Area - Timeline Axis */}
            <div className="flex-shrink-0 sticky top-0 z-20 bg-white border-b border-gray-200">
                <div className="relative flex w-full">
                    {/* Sticky Portfolio Names Header */}
                    <div
                        className="flex-shrink-0 bg-white border-r border-gray-200"
                        style={{
                            width: responsiveConstants.LABEL_WIDTH,
                            position: 'sticky',
                            left: 0,
                            zIndex: 30,
                        }}
                    >
                        <div
                            className="flex items-center px-2 font-semibold text-gray-700"
                            style={{
                                height: responsiveConstants.TOUCH_TARGET_SIZE,
                                fontSize: responsiveConstants.FONT_SIZE
                            }}
                        >
                            Portfolios
                        </div>
                    </div>

                    {/* Timeline Axis */}
                    <div
                        ref={timelineScrollRef}
                        className="flex-1 overflow-x-auto"
                        style={{
                            width: `${responsiveConstants.MONTH_WIDTH * responsiveConstants.VISIBLE_MONTHS}px`,
                            maxWidth: `calc(100vw - ${responsiveConstants.LABEL_WIDTH}px)`
                        }}
                        onScroll={handleTimelineScroll}
                    >
                        <TimelineAxis
                            startDate={startDate}
                            monthWidth={responsiveConstants.MONTH_WIDTH}
                            fontSize={responsiveConstants.FONT_SIZE}
                        />
                    </div>
                </div>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 relative flex w-full overflow-hidden">
                {/* Sticky Portfolio Names - Synchronized Scrolling */}
                <div
                    ref={leftPanelScrollRef}
                    className="flex-shrink-0 bg-white border-r border-gray-200 overflow-y-auto"
                    style={{
                        width: responsiveConstants.LABEL_WIDTH,
                        position: 'sticky',
                        left: 0,
                        zIndex: 10,
                        height: '100%',
                    }}
                    onScroll={handleLeftPanelScroll}
                >
                    <div style={{ position: 'relative', height: getTotalHeight() }}>
                        {filteredData.map((project, index) => {
                            const yOffset = filteredData
                                .slice(0, index)
                                .reduce((total, p) => total + calculateBarHeight(p) + 8, 10);
                            return (
                                <div
                                    key={project.id}
                                    className="absolute flex items-center border-b border-gray-100 bg-gray-50/30 hover:bg-gray-100/50 transition-colors"
                                    style={{
                                        top: yOffset,
                                        height: calculateBarHeight(project),
                                        paddingLeft: responsiveConstants.TOUCH_TARGET_SIZE > 24 ? '12px' : '8px',
                                        fontSize: responsiveConstants.FONT_SIZE,
                                        width: '100%',
                                        cursor: project.isDrillable ? 'pointer' : 'default',
                                        minHeight: responsiveConstants.TOUCH_TARGET_SIZE
                                    }}
                                    onClick={() => {
                                        if (project.isDrillable && onDrillToProgram) {
                                            onDrillToProgram(project.id, project.name);
                                        } else {
                                            console.log('Box height:', calculateBarHeight(project));
                                        }
                                    }}
                                >
                                    <div className="flex items-center justify-between w-full">
                                        <span className="truncate pr-2" title={project.name}>
                                            {project.name}
                                        </span>
                                        {project.isDrillable && (
                                            <span className="text-xs text-gray-500 ml-2 flex-shrink-0">↗️</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Scrollable Timeline Content */}
                <div
                    ref={ganttScrollRef}
                    className="flex-1 overflow-x-auto overflow-y-auto"
                    style={{
                        width: `${responsiveConstants.MONTH_WIDTH * responsiveConstants.VISIBLE_MONTHS}px`,
                        maxWidth: `calc(100vw - ${responsiveConstants.LABEL_WIDTH}px)`
                    }}
                    onScroll={handleGanttScroll}
                >
                    <div className="relative" style={{ width: totalWidth, minHeight: '100%' }}>
                        <svg
                            width={totalWidth}
                            height={Math.max(400, getTotalHeight())}
                            className="block"
                            style={{
                                minHeight: getTotalHeight(),
                                touchAction: 'pan-x pan-y' // Enable smooth touch scrolling
                            }}
                        >
                            {filteredData.map((project, index) => {
                                // Calculate cumulative Y offset including all previous projects' full heights
                                const yOffset = filteredData
                                    .slice(0, index)
                                    .reduce((total, p) => total + calculateBarHeight(p) + 8, 10);

                                const projectStartDate = parseDate(project.startDate);
                                const projectEndDate = parseDate(project.endDate);
                                const startX = calculatePosition(projectStartDate, startDate, responsiveConstants.MONTH_WIDTH);
                                const endX = calculatePosition(projectEndDate, startDate, responsiveConstants.MONTH_WIDTH);
                                const width = endX - startX;

                                // Calculate the project's total height and center point
                                const totalHeight = calculateBarHeight(project);
                                const centerY = yOffset + totalHeight / 2;

                                // Process milestones with position information
                                const milestones = processMilestonesWithPosition(project.milestones, startDate, responsiveConstants.MONTH_WIDTH);

                                return (
                                    <g key={`project-${project.id}`} className="project-group">
                                        {/* Render bar - responsive height */}
                                        <rect
                                            key={`bar-${project.id}`}
                                            x={startX}
                                            y={yOffset + (totalHeight - responsiveConstants.TOUCH_TARGET_SIZE) / 2}
                                            width={Math.max(width, 2)}
                                            height={Math.min(responsiveConstants.TOUCH_TARGET_SIZE, 24)}
                                            rx={4}
                                            fill={project.status ? statusColors[project.status] : statusColors.Grey}
                                            className={`transition-opacity duration-150 hover:opacity-90 ${
                                                project.isDrillable ? 'cursor-pointer' : 'cursor-default'
                                            }`}
                                            style={{
                                                minHeight: responsiveConstants.TOUCH_TARGET_SIZE > 24 ? '32px' : '24px'
                                            }}
                                            onClick={() => {
                                                if (project.isDrillable && onDrillToProgram) {
                                                    onDrillToProgram(project.id, project.name);
                                                } else {
                                                    console.log('Portfolio clicked:', project.id);
                                                }
                                            }}
                                        />

                                        {/* Render milestones - responsive positioning */}
                                        {milestones.map((milestone, mIndex) => (
                                            <MilestoneMarker
                                                key={`${project.id}-milestone-${mIndex}`}
                                                x={milestone.x}
                                                y={yOffset + (totalHeight - responsiveConstants.TOUCH_TARGET_SIZE) / 2 + (responsiveConstants.TOUCH_TARGET_SIZE / 2)}
                                                complete={milestone.status}
                                                label={milestone.label}
                                                isSG3={milestone.isSG3}
                                                labelPosition={milestone.labelPosition}
                                                shouldWrapText={milestone.shouldWrapText}
                                                isGrouped={milestone.isGrouped}
                                                groupLabels={milestone.groupLabels}
                                                fullLabel={milestone.fullLabel}
                                                hasAdjacentMilestones={milestone.hasAdjacentMilestones}
                                                showLabel={milestone.showLabel}
                                                fontSize={responsiveConstants.FONT_SIZE}
                                                isMobile={responsiveConstants.TOUCH_TARGET_SIZE > 24}
                                            />
                                        ))}
                                    </g>
                                );
                            })}
                        </svg>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PortfolioGanttChart;

