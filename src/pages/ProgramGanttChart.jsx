import React, { useState, useEffect, useRef } from 'react';
import TimelineAxis from '../components/TimelineAxis';
import MilestoneMarker from '../components/MilestoneMarker';
import { getTimelineRange, parseDate, calculatePosition } from '../utils/dateUtils';
import { processProgramData } from '../services/dataService';
import { differenceInDays } from 'date-fns';
import programData from '../services/ProgramData.json';

// Zoom levels configuration
const ZOOM_LEVELS = {
    0.5: { // 50% - Maximum Zoom Out
        MONTH_WIDTH: 40,
        VISIBLE_MONTHS: 24,
        FONT_SIZE: '8px',
        LABEL_WIDTH: 100,
        BASE_BAR_HEIGHT: 20,
        PROGRAM_BAR_HEIGHT: 22,
        TOUCH_TARGET_SIZE: 16,
        MILESTONE_LABEL_HEIGHT: 10
    },
    0.75: { // 75% - Zoom Out
        MONTH_WIDTH: 60,
        VISIBLE_MONTHS: 18,
        FONT_SIZE: '10px',
        LABEL_WIDTH: 140,
        BASE_BAR_HEIGHT: 26,
        PROGRAM_BAR_HEIGHT: 28,
        TOUCH_TARGET_SIZE: 20,
        MILESTONE_LABEL_HEIGHT: 14
    },
    1.0: { // 100% - Default
        MONTH_WIDTH: 100,
        VISIBLE_MONTHS: 13,
        FONT_SIZE: '14px',
        LABEL_WIDTH: 220,
        BASE_BAR_HEIGHT: 32,
        PROGRAM_BAR_HEIGHT: 34,
        TOUCH_TARGET_SIZE: 24,
        MILESTONE_LABEL_HEIGHT: 16
    },
    1.25: { // 125% - Zoom In
        MONTH_WIDTH: 125,
        VISIBLE_MONTHS: 10,
        FONT_SIZE: '16px',
        LABEL_WIDTH: 275,
        BASE_BAR_HEIGHT: 40,
        PROGRAM_BAR_HEIGHT: 42,
        TOUCH_TARGET_SIZE: 30,
        MILESTONE_LABEL_HEIGHT: 20
    },
    1.5: { // 150% - Maximum Zoom In
        MONTH_WIDTH: 150,
        VISIBLE_MONTHS: 8,
        FONT_SIZE: '18px',
        LABEL_WIDTH: 330,
        BASE_BAR_HEIGHT: 48,
        PROGRAM_BAR_HEIGHT: 50,
        TOUCH_TARGET_SIZE: 36,
        MILESTONE_LABEL_HEIGHT: 24
    }
};

// Responsive constants with zoom support
const getResponsiveConstants = (zoomLevel = 1.0) => {
    const screenWidth = window.innerWidth;
    const isMobile = screenWidth < 768;
    const isTablet = screenWidth >= 768 && screenWidth < 1024;

    // Get base zoom configuration
    const zoomConfig = ZOOM_LEVELS[zoomLevel] || ZOOM_LEVELS[1.0];

    // Apply mobile adjustments if needed
    const mobileAdjustment = isMobile ? 0.8 : 1.0;

    return {
        MONTH_WIDTH: Math.round(zoomConfig.MONTH_WIDTH * mobileAdjustment),
        TOTAL_MONTHS: 73,
        LABEL_WIDTH: Math.round(zoomConfig.LABEL_WIDTH * mobileAdjustment),
        BASE_BAR_HEIGHT: Math.round(zoomConfig.BASE_BAR_HEIGHT * mobileAdjustment),
        PROGRAM_BAR_HEIGHT: Math.round(zoomConfig.PROGRAM_BAR_HEIGHT * mobileAdjustment),
        MILESTONE_LABEL_HEIGHT: Math.round(zoomConfig.MILESTONE_LABEL_HEIGHT * mobileAdjustment),
        VISIBLE_MONTHS: isMobile ? Math.max(6, Math.round(zoomConfig.VISIBLE_MONTHS * 0.6)) : zoomConfig.VISIBLE_MONTHS,
        TOUCH_TARGET_SIZE: Math.max(isMobile ? 44 : 16, Math.round(zoomConfig.TOUCH_TARGET_SIZE * mobileAdjustment)),
        FONT_SIZE: zoomConfig.FONT_SIZE,
        ZOOM_LEVEL: zoomLevel
    };
};

const DAYS_THRESHOLD = 16;
const MAX_LABEL_LENGTH = 5;

const statusColors = {
    'Red': '#ef4444',    // Tailwind red-500
    'Amber': '#f59e0b',  // Tailwind amber-500
    'Green': '#10b981',  // Tailwind emerald-500
    'Grey': '#9ca3af',   // Tailwind gray-400
    'Yellow': '#E5DE00'
};

// Reuse the same milestone processing logic from PortfolioGanttChart
const processMilestonesWithPosition = (milestones, startDate, monthWidth = 100) => {
    if (!milestones?.length) return [];

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

    const milestonesWithX = [];
    const sameDateGroups = new Map();

    sortedMilestones.forEach(milestone => {
        const milestoneDate = parseDate(milestone.date);
        const x = calculatePosition(milestoneDate, startDate, monthWidth);
        const dateStr = milestoneDate.toISOString();
        
        const milestoneWithX = { ...milestone, x, date: milestoneDate };
        milestonesWithX.push(milestoneWithX);

        if (!sameDateGroups.has(dateStr)) {
            sameDateGroups.set(dateStr, []);
        }
        sameDateGroups.get(dateStr).push(milestoneWithX);
    });

    let lastPosition = 'below';
    
    return milestonesWithX.map((milestone, index) => {
        const dateStr = milestone.date.toISOString();
        const sameDateMilestones = sameDateGroups.get(dateStr);
        const isPartOfGroup = sameDateMilestones.length > 1;

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

const ProgramGanttChart = ({ selectedProjectId, selectedProjectName, onBackToPortfolio }) => {
    const [processedData, setProcessedData] = useState([]);
    const [filteredData, setFilteredData] = useState([]);
    const [selectedProgram, setSelectedProgram] = useState('');
    const [zoomLevel, setZoomLevel] = useState(1.0);
    const [responsiveConstants, setResponsiveConstants] = useState(getResponsiveConstants(1.0));

    const timelineScrollRef = useRef(null);
    const ganttScrollRef = useRef(null);
    const leftPanelScrollRef = useRef(null);

    const { startDate } = getTimelineRange();
    const totalWidth = responsiveConstants.MONTH_WIDTH * responsiveConstants.TOTAL_MONTHS;

    // Get unique program names and set default selection
    const programNames = Array.from(new Set(programData
        .filter(item => item.COE_ROADMAP_PARENT_ID === item.CHILD_ID)
        .map(item => item.COE_ROADMAP_PARENT_NAME)
    ));

    // Handle window resize for responsive behavior
    useEffect(() => {
        const handleResize = () => {
            setResponsiveConstants(getResponsiveConstants());
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const data = processProgramData();
        setProcessedData(data);

        // Set default program (first in the list)
        if (programNames.length > 0 && !selectedProgram) {
            setSelectedProgram(programNames[0]);
        }
    }, []);

    useEffect(() => {
        if (selectedProgram) {
            // Get the program and its children
            const programData = processedData.filter(item => 
                item.parentName === selectedProgram
            );
            setFilteredData(programData); // Data is already sorted in dataService
        }
    }, [selectedProgram, processedData]);

    // Auto-select program when a project is drilled down to
    useEffect(() => {
        if (selectedProjectId && processedData.length > 0) {
            const project = processedData.find(item => item.id === selectedProjectId);
            if (project) {
                setSelectedProgram(project.parentName);
            }
        }
    }, [selectedProjectId, processedData]);

    useEffect(() => {
        // Initial scroll to show June 2025 to June 2026 (responsive months)
        if (timelineScrollRef.current) {
            const monthsFromStart = 36;
            const scrollPosition = (monthsFromStart - 2) * responsiveConstants.MONTH_WIDTH; // June 2025 is month 34
            timelineScrollRef.current.scrollLeft = scrollPosition;
            // Sync gantt scroll position
            if (ganttScrollRef.current) {
                ganttScrollRef.current.scrollLeft = scrollPosition;
            }
        }
    }, [responsiveConstants.MONTH_WIDTH]);

    const handleProgramChange = (e) => {
        setSelectedProgram(e.target.value);
    };

    // Zoom handlers
    const handleZoomIn = () => {
        const zoomLevels = Object.keys(ZOOM_LEVELS).map(Number).sort((a, b) => a - b);
        const currentIndex = zoomLevels.indexOf(zoomLevel);
        if (currentIndex < zoomLevels.length - 1) {
            setZoomLevel(zoomLevels[currentIndex + 1]);
        }
    };

    const handleZoomOut = () => {
        const zoomLevels = Object.keys(ZOOM_LEVELS).map(Number).sort((a, b) => a - b);
        const currentIndex = zoomLevels.indexOf(zoomLevel);
        if (currentIndex > 0) {
            setZoomLevel(zoomLevels[currentIndex - 1]);
        }
    };

    const handleZoomReset = () => {
        setZoomLevel(1.0);
    };

    // Update responsive constants when zoom level changes
    useEffect(() => {
        setResponsiveConstants(getResponsiveConstants(zoomLevel));
    }, [zoomLevel]);

    // Scroll synchronization functions
    const handleTimelineScroll = (e) => {
        const scrollLeft = e.target.scrollLeft;
        if (ganttScrollRef.current) {
            ganttScrollRef.current.scrollLeft = scrollLeft;
        }
    };

    const handleGanttScroll = (e) => {
        const scrollLeft = e.target.scrollLeft;
        const scrollTop = e.target.scrollTop;
        if (timelineScrollRef.current) {
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

    const calculateMilestoneLabelHeight = (milestones, monthWidth = 100) => {
        if (!milestones?.length) return 0;

        const processedMilestones = processMilestonesWithPosition(milestones, startDate, monthWidth);
        
        let maxAboveHeight = 0;
        let maxBelowHeight = 0;
        const LINE_HEIGHT = 10; // Reduced from 12
        const LABEL_PADDING = 10; // Reduced from 15
        const ABOVE_LABEL_OFFSET = 12; // Reduced from 15
        const BELOW_LABEL_OFFSET = 14; // Reduced from 20

        processedMilestones.forEach(milestone => {
            if (milestone.isGrouped) {
                const groupHeight = milestone.groupLabels.length * LINE_HEIGHT;
                maxBelowHeight = Math.max(maxBelowHeight, groupHeight + LABEL_PADDING);
            } else {
                if (milestone.labelPosition === 'above') {
                    maxAboveHeight = Math.max(maxAboveHeight, ABOVE_LABEL_OFFSET);
                } else {
                    maxBelowHeight = Math.max(maxBelowHeight, BELOW_LABEL_OFFSET);
                }
            }
        });

        return maxAboveHeight + maxBelowHeight;
    };

    const calculateBarHeight = (project) => {
        const isProgram = project.isProgram;
        const baseHeight = isProgram ? responsiveConstants.PROGRAM_BAR_HEIGHT : responsiveConstants.BASE_BAR_HEIGHT;
        const maxCharsPerLine = responsiveConstants.LABEL_WIDTH / 8; // Responsive chars per line
        const textLines = Math.ceil(project.name.length / maxCharsPerLine);
        const nameHeight = baseHeight + ((textLines - 1) * 10);
        const milestoneLabelHeight = calculateMilestoneLabelHeight(project.milestones, responsiveConstants.MONTH_WIDTH);
        const padding = responsiveConstants.TOUCH_TARGET_SIZE > 24 ? 12 : 8;
        return nameHeight + milestoneLabelHeight + padding;
    };

    const getTotalHeight = () => {
        return filteredData.reduce((total, project) => {
            const barHeight = calculateBarHeight(project);
            return total + barHeight + 4; // Reduced spacing between bars from 8 to 4
        }, 20); // Reduced initial offset from 40 to 20
    };

    const isParentProgram = (project) => {
        return project.id === project.parentId;
    };

    return (
        <div className="w-full">
            {/* Breadcrumb Navigation */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                    {onBackToPortfolio && (
                        <button
                            onClick={onBackToPortfolio}
                            className="flex items-center gap-1 text-blue-600 hover:text-blue-800 transition-colors"
                        >
                            ← Back to Portfolio
                        </button>
                    )}
                    {selectedProjectName && (
                        <span className="text-gray-400">/</span>
                    )}
                    {selectedProjectName && (
                        <span className="font-medium">{selectedProjectName}</span>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-4 mb-4">
                <label className="font-medium">Select Program:</label>
                <select
                    value={selectedProgram}
                    onChange={handleProgramChange}
                    className="border border-gray-300 rounded px-3 py-1 bg-white"
                >
                    {programNames.map((name) => (
                        <option key={name} value={name}>
                            {name}
                        </option>
                    ))}
                </select>
            </div>

            {/* Fixed Header Area - Scrollable Timeline */}
            <div className="sticky top-0 z-20 bg-white border-b border-gray-200">
                <div className="relative flex w-full">
                    {/* Sticky Program Names Header */}
                    <div
                        style={{
                            width: responsiveConstants.LABEL_WIDTH,
                            position: 'sticky',
                            left: 0,
                            zIndex: 30,
                            background: 'white',
                            borderRight: '1px solid #e5e7eb',
                        }}
                    >
                        <div
                            className="flex items-center justify-between px-2 font-semibold text-gray-700"
                            style={{
                                height: responsiveConstants.TOUCH_TARGET_SIZE,
                                fontSize: responsiveConstants.FONT_SIZE
                            }}
                        >
                            <span className="truncate">Programs</span>
                            {/* Responsive Zoom Controls */}
                            <div className="flex items-center space-x-1 ml-2">
                                <button
                                    onClick={handleZoomOut}
                                    disabled={zoomLevel <= 0.5}
                                    className={`
                                        ${responsiveConstants.TOUCH_TARGET_SIZE > 24 ? 'w-10 h-8' : 'w-8 h-6'}
                                        flex items-center justify-center bg-gray-100 hover:bg-gray-200
                                        disabled:bg-gray-50 disabled:text-gray-300 rounded
                                        ${responsiveConstants.TOUCH_TARGET_SIZE > 24 ? 'text-sm' : 'text-xs'}
                                        font-bold transition-colors
                                    `}
                                    title="Zoom Out (Show More Months)"
                                >
                                    −
                                </button>
                                <span
                                    className={`
                                        ${responsiveConstants.TOUCH_TARGET_SIZE > 24 ? 'text-sm min-w-[45px]' : 'text-xs min-w-[35px]'}
                                        text-gray-600 text-center font-medium
                                    `}
                                >
                                    {Math.round(zoomLevel * 100)}%
                                </span>
                                <button
                                    onClick={handleZoomIn}
                                    disabled={zoomLevel >= 1.5}
                                    className={`
                                        ${responsiveConstants.TOUCH_TARGET_SIZE > 24 ? 'w-10 h-8' : 'w-8 h-6'}
                                        flex items-center justify-center bg-gray-100 hover:bg-gray-200
                                        disabled:bg-gray-50 disabled:text-gray-300 rounded
                                        ${responsiveConstants.TOUCH_TARGET_SIZE > 24 ? 'text-sm' : 'text-xs'}
                                        font-bold transition-colors
                                    `}
                                    title="Zoom In (Show Fewer Months)"
                                >
                                    +
                                </button>
                                {/* Reset button - hidden on very small screens */}
                                <button
                                    onClick={handleZoomReset}
                                    className={`
                                        ${responsiveConstants.TOUCH_TARGET_SIZE > 24 ? 'text-sm px-2 py-1' : 'text-xs px-1'}
                                        text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors
                                        ${responsiveConstants.LABEL_WIDTH < 150 ? 'hidden' : 'block'}
                                    `}
                                    title="Reset to 100%"
                                >
                                    {responsiveConstants.TOUCH_TARGET_SIZE > 24 ? 'Reset' : '↺'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Scrollable Timeline Axis */}
                    <div
                        ref={timelineScrollRef}
                        className="overflow-x-auto"
                        style={{ width: `${100 * 13}px` }}
                        onScroll={handleTimelineScroll}
                    >
                        <TimelineAxis startDate={startDate} />
                    </div>
                </div>
            </div>

            {/* Single Synchronized Scroll Container */}
            <div className="relative flex w-full">
                {/* Sticky Program Names - Synchronized Scrolling */}
                <div
                    ref={leftPanelScrollRef}
                    className="overflow-y-auto"
                    style={{
                        width: responsiveConstants.LABEL_WIDTH,
                        position: 'sticky',
                        left: 0,
                        zIndex: 10,
                        background: 'white',
                        borderRight: '1px solid #e5e7eb',
                        height: '100%',
                    }}
                    onScroll={handleLeftPanelScroll}
                >
                    <div style={{ position: 'relative', height: getTotalHeight() }}>
                        {filteredData.map((project, index) => {
                            const yOffset = filteredData
                                .slice(0, index)
                                .reduce((total, p) => total + calculateBarHeight(p) + 4, 6); // Reduced spacing and initial offset

                            const isProgram = project.isProgram;
                            
                            return (
                                <div
                                    key={project.id}
                                    style={{
                                        position: 'absolute',
                                        top: yOffset,
                                        height: calculateBarHeight(project),
                                        display: 'flex',
                                        alignItems: 'center',
                                        paddingLeft: '8px',
                                        fontSize: '14px',
                                        borderBottom: '1px solid #f3f4f6',
                                        width: '100%',
                                        background: isProgram ? '#f0f9ff' : 'transparent',
                                        outline: '1px solid rgba(0, 0, 0, 0.08)',
                                        fontWeight: isProgram ? 600 : 'normal',
                                        textTransform: isProgram ? 'uppercase' : 'none'
                                    }}
                                >
                                    {isProgram ? '📌 ' : ''}{project.name}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Synchronized Scroll Container */}
                <div
                    ref={ganttScrollRef}
                    className="flex-1 overflow-x-auto"
                    style={{
                        width: `${responsiveConstants.MONTH_WIDTH * responsiveConstants.VISIBLE_MONTHS}px`,
                        maxWidth: `calc(100vw - ${responsiveConstants.LABEL_WIDTH}px)`
                    }}
                    onScroll={handleGanttScroll}
                >
                    <div className="relative" style={{ width: totalWidth }}>
                        {/* Gantt Bars */}
                        <svg
                            width={totalWidth}
                            style={{ height: Math.max(400, getTotalHeight()) }}
                        >
                            {filteredData.map((project, index) => {
                                const yOffset = filteredData
                                    .slice(0, index)
                                    .reduce((total, p) => total + calculateBarHeight(p) + 4, 6); // Reduced spacing and initial offset

                                const projectStartDate = parseDate(project.startDate);
                                const projectEndDate = parseDate(project.endDate);
                                const startX = calculatePosition(projectStartDate, startDate);
                                const endX = calculatePosition(projectEndDate, startDate);
                                const width = endX - startX;

                                const totalHeight = calculateBarHeight(project);

                                const milestones = processMilestonesWithPosition(project.milestones, startDate);

                                const isProgram = project.isProgram;
                                const barHeight = isProgram ?
                                    Math.min(responsiveConstants.TOUCH_TARGET_SIZE, 24) :
                                    Math.min(responsiveConstants.TOUCH_TARGET_SIZE - 6, 18);

                                return (
                                    <g key={`project-${project.id}`} className="project-group">
                                        {/* Background highlight for program row */}
                                        {isProgram && (
                                            <rect
                                                x={0}
                                                y={yOffset}
                                                width={totalWidth}
                                                height={totalHeight}
                                                fill="#f0f9ff"
                                                opacity={0.5}
                                            />
                                        )}

                                        {/* Highlight for drilled-down project */}
                                        {selectedProjectId && project.id === selectedProjectId && (
                                            <rect
                                                x={0}
                                                y={yOffset}
                                                width={totalWidth}
                                                height={totalHeight}
                                                fill="#fef3c7"
                                                opacity={0.3}
                                            />
                                        )}

                                        {/* Program label above bar - responsive */}
                                        {isProgram && (
                                            <text
                                                x={startX + width / 2}
                                                y={yOffset + (totalHeight - barHeight) / 2 - 5}
                                                textAnchor="middle"
                                                className="text-xs font-semibold tracking-wider fill-gray-600"
                                                style={{ fontSize: responsiveConstants.FONT_SIZE === '12px' ? '9px' : '10px' }}
                                            >
                                                PROGRAM
                                            </text>
                                        )}

                                        {/* Render bar */}
                                        <rect
                                            key={`bar-${project.id}`}
                                            x={startX}
                                            y={yOffset + (totalHeight - barHeight) / 2}
                                            width={Math.max(width, 2)}
                                            height={barHeight}
                                            rx={4}
                                            fill={project.status ? statusColors[project.status] : statusColors.Grey}
                                            className="cursor-pointer transition-opacity duration-150 hover:opacity-90"
                                            onClick={() => console.log('Project clicked:', project.id)}
                                        />

                                        {/* Render milestones */}
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
                                                showLabel={milestone.showLabel}
                                                hasAdjacentMilestones={milestone.hasAdjacentMilestones}
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

export default ProgramGanttChart;