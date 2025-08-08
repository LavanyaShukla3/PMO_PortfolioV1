import React, { useState, useEffect, useRef } from 'react';
import TimelineAxis from '../components/TimelineAxis';
import MilestoneMarker from '../components/MilestoneMarker';
import { getTimelineRange, parseDate, calculatePosition, groupMilestonesByMonth, getMonthlyLabelPosition, createVerticalMilestoneLabels } from '../utils/dateUtils';
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
        BASE_BAR_HEIGHT: 4, // Reduced for more compact rows
        PROGRAM_BAR_HEIGHT: 6,
        TOUCH_TARGET_SIZE: 16,
        MILESTONE_LABEL_HEIGHT: 10,
        MILESTONE_FONT_SIZE: '8px',
        PROJECT_SCALE: 2.0, // Show significantly more projects
        ROW_PADDING: 4 // Reduced padding between rows
    },
    0.75: { // 75% - Zoom Out
        MONTH_WIDTH: 60,
        VISIBLE_MONTHS: 18,
        FONT_SIZE: '10px',
        LABEL_WIDTH: 140,
        BASE_BAR_HEIGHT: 6, // Smaller bars for more projects
        PROGRAM_BAR_HEIGHT: 8,
        TOUCH_TARGET_SIZE: 20,
        MILESTONE_LABEL_HEIGHT: 14,
        MILESTONE_FONT_SIZE: '9px',
        PROJECT_SCALE: 1.5, // Show more projects
        ROW_PADDING: 6
    },
    1.0: { // 100% - Default
        MONTH_WIDTH: 100,
        VISIBLE_MONTHS: 13,
        FONT_SIZE: '14px',
        LABEL_WIDTH: 220,
        BASE_BAR_HEIGHT: 32,
        PROGRAM_BAR_HEIGHT: 34,
        TOUCH_TARGET_SIZE: 24,
        MILESTONE_LABEL_HEIGHT: 16,
        MILESTONE_FONT_SIZE: '10px', // Reduced from default
        PROJECT_SCALE: 1.0, // Normal project count
        ROW_PADDING: 8 // Standard padding
    },
    1.25: { // 125% - Zoom In
        MONTH_WIDTH: 125,
        VISIBLE_MONTHS: 10,
        FONT_SIZE: '16px',
        LABEL_WIDTH: 275,
        BASE_BAR_HEIGHT: 40,
        PROGRAM_BAR_HEIGHT: 42,
        TOUCH_TARGET_SIZE: 30,
        MILESTONE_LABEL_HEIGHT: 20,
        MILESTONE_FONT_SIZE: '12px',
        PROJECT_SCALE: 0.7, // Show fewer projects
        ROW_PADDING: 12 // More padding for larger rows
    },
    1.5: { // 150% - Maximum Zoom In
        MONTH_WIDTH: 150,
        VISIBLE_MONTHS: 8,
        FONT_SIZE: '18px',
        LABEL_WIDTH: 330,
        BASE_BAR_HEIGHT: 48,
        PROGRAM_BAR_HEIGHT: 50,
        TOUCH_TARGET_SIZE: 36,
        MILESTONE_LABEL_HEIGHT: 24,
        MILESTONE_FONT_SIZE: '14px',
        PROJECT_SCALE: 0.5, // Show significantly fewer projects
        ROW_PADDING: 16 // Maximum padding for largest rows
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
        MILESTONE_FONT_SIZE: zoomConfig.MILESTONE_FONT_SIZE,
        PROJECT_SCALE: zoomConfig.PROJECT_SCALE,
        ROW_PADDING: Math.round(zoomConfig.ROW_PADDING * mobileAdjustment),
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

// Display3: Monthly grouped milestone processing logic
const processMilestonesWithPosition = (milestones, startDate, monthWidth = 100) => {
    if (!milestones?.length) return [];

    // Display3: Group milestones by month
    const monthlyGroups = groupMilestonesByMonth(milestones);
    const twoMonthWidth = monthWidth * 2; // Maximum width for label blocks

    const processedMilestones = [];

    // Process each monthly group
    Object.entries(monthlyGroups).forEach(([monthKey, monthMilestones]) => {
        // Determine label position for this month (odd = above, even = below)
        const labelPosition = getMonthlyLabelPosition(monthKey);

        // STRICT RULES: Only vertical stacking allowed, no horizontal layout
        // RULE 1: One milestone label per month with alternating positions
        // RULE 2: Multiple milestones stacked vertically with 2-month width limit
        const verticalLabels = createVerticalMilestoneLabels(monthMilestones, twoMonthWidth, '14px');
        const horizontalLabel = ''; // Disabled to enforce strict vertical stacking

        // Process each milestone in the month
        monthMilestones.forEach((milestone, index) => {
            const milestoneDate = parseDate(milestone.date);
            const x = calculatePosition(milestoneDate, startDate, monthWidth);

            // STRICT RULE FIX: Only the first milestone in each month shows the labels
            // This prevents duplicate label rendering for multiple milestones in same month
            const isFirstInMonth = index === 0;

            processedMilestones.push({
                ...milestone,
                x,
                date: milestoneDate,
                isGrouped: monthMilestones.length > 1,
                isMonthlyGrouped: true, // New flag for Display3
                monthKey,
                labelPosition,
                horizontalLabel: isFirstInMonth ? horizontalLabel : '', // Only first milestone shows horizontal label
                verticalLabels: isFirstInMonth ? verticalLabels : [], // Only first milestone shows vertical labels
                showLabel: true, // Display3: Always show labels
                shouldWrapText: false,
                hasAdjacentMilestones: false, // Not used in Display3
                fullLabel: milestone.label // Keep original label for tooltips
            });
        });
    });

    // Sort by date for consistent rendering order
    return processedMilestones.sort((a, b) => a.date - b.date);
};

const ProgramGanttChart = ({ selectedProjectId, selectedProjectName, onBackToPortfolio, onDrillToSubProgram }) => {
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

    // Apply project scaling based on zoom level
    const getScaledFilteredData = () => {
        const projectScale = responsiveConstants.PROJECT_SCALE;
        if (projectScale >= 1.0) {
            // Zooming out - show more projects (no change needed, show all)
            return filteredData;
        } else {
            // Zooming in - show fewer projects
            const targetCount = Math.max(1, Math.round(filteredData.length * projectScale));
            return filteredData.slice(0, targetCount);
        }
    };

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
            if (milestone.isMonthlyGrouped) {
                // Display3: Monthly grouped milestones (single horizontal line)
                const horizontalLabelHeight = LINE_HEIGHT; // Single line for horizontal label
                if (milestone.labelPosition === 'above') {
                    maxAboveHeight = Math.max(maxAboveHeight, horizontalLabelHeight + ABOVE_LABEL_OFFSET);
                } else {
                    maxBelowHeight = Math.max(maxBelowHeight, horizontalLabelHeight + BELOW_LABEL_OFFSET);
                }
            } else if (milestone.isGrouped) {
                // Display2: Legacy grouped milestones
                const groupHeight = milestone.groupLabels.length * LINE_HEIGHT;
                maxBelowHeight = Math.max(maxBelowHeight, groupHeight + LABEL_PADDING);
            } else {
                // Display2: Legacy individual milestones
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
        const maxCharsPerLine = responsiveConstants.LABEL_WIDTH / 8; // Approximate chars per line
        const textLines = Math.ceil(project.name.length / maxCharsPerLine);
        const nameHeight = baseHeight + ((textLines - 1) * Math.round(12 * (responsiveConstants.ZOOM_LEVEL || 1.0)));
        const milestoneLabelHeight = calculateMilestoneLabelHeight(project.milestones, responsiveConstants.MONTH_WIDTH);
        
        // Return total height needed: name height + milestone label height + responsive padding
        const basePadding = responsiveConstants.ROW_PADDING || 8;
        const extraPadding = responsiveConstants.TOUCH_TARGET_SIZE > 24 ? Math.round(basePadding * 1.5) : basePadding;
        return nameHeight + milestoneLabelHeight + extraPadding;
    };

    const getTotalHeight = () => {
        const scaledData = getScaledFilteredData();
        const rowSpacing = responsiveConstants.ROW_PADDING || 8;
        return scaledData.reduce((total, project) => {
            const barHeight = calculateBarHeight(project);
            return total + barHeight + rowSpacing;
        }, Math.round(40 * (responsiveConstants.ZOOM_LEVEL || 1.0))); // Responsive top margin
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

            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
                {/* Program Selector */}
                <div className="flex items-center gap-4">
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

                {/* Milestone Legend - Beside Program */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">Milestone Legend:</span>
                    <div className="flex flex-wrap gap-3 sm:gap-4">
                        {/* Incomplete Milestone */}
                        <div className="flex items-center gap-1.5">
                            <svg width="12" height="12" viewBox="0 0 16 16">
                                <path
                                    d="M8 2 L14 8 L8 14 L2 8 Z"
                                    fill="white"
                                    stroke="#3B82F6"
                                    strokeWidth="2"
                                />
                            </svg>
                            <span className="text-xs text-gray-600">Incomplete</span>
                        </div>

                        {/* Complete Milestone */}
                        <div className="flex items-center gap-1.5">
                            <svg width="12" height="12" viewBox="0 0 16 16">
                                <path
                                    d="M8 2 L14 8 L8 14 L2 8 Z"
                                    fill="#3B82F6"
                                    stroke="#3B82F6"
                                    strokeWidth="2"
                                />
                            </svg>
                            <span className="text-xs text-gray-600">Complete</span>
                        </div>

                        {/* Stacked Milestones */}
                        <div className="flex items-center gap-1.5">
                            <svg width="12" height="12" viewBox="0 0 16 16">
                                <path
                                    d="M8 2 L14 8 L8 14 L2 8 Z"
                                    fill="#1F2937"
                                    stroke="white"
                                    strokeWidth="2"
                                />
                            </svg>
                            <span className="text-xs text-gray-600">Multiple</span>
                        </div>
                    </div>
                </div>
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
                                    className="overflow-y-auto overflow-x-auto"
                                    style={{
                                        minWidth: responsiveConstants.LABEL_WIDTH,
                                        width: 'auto',
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
                        {getScaledFilteredData().map((project, index) => {
                            const scaledData = getScaledFilteredData();
                            const yOffset = scaledData
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
                                        fontSize: responsiveConstants.FONT_SIZE,
                                        borderBottom: '1px solid #f3f4f6',
                                        width: '100%',
                                        background: isProgram ? '#f0f9ff' : 'transparent',
                                        outline: '1px solid rgba(0, 0, 0, 0.08)',
                                        fontWeight: isProgram ? 600 : 'normal',
                                        textTransform: isProgram ? 'uppercase' : 'none',
                                        cursor: project.isDrillable ? 'pointer' : 'default' // Task 1: Drill-through cursor
                                    }}
                                    onClick={() => {
                                        // Task 1: Drill-through to SubProgram
                                        if (project.isDrillable && onDrillToSubProgram) {
                                            onDrillToSubProgram(project.id, project.name);
                                        } else {
                                            console.log('Program clicked:', project.id, 'isDrillable:', project.isDrillable);
                                        }
                                    }}
                                >
                                    <div className="flex items-center justify-between w-full">
                                        <div className="flex flex-col justify-center">
                                            <span className="font-medium text-gray-800 pr-2" title={project.name}>
                                                {isProgram ? '📌 ' : ''}{project.name}
                                            </span>
                                        </div>
                                        {/* Task 1: Drill-through indicator */}
                                        {project.isDrillable && (
                                            <span className="text-xs text-gray-500 ml-2 flex-shrink-0">↗️</span>
                                        )}
                                    </div>
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
                            {/* iii. Removed swimlanes from ProgramGanttChart as requested */}
                            {getScaledFilteredData().map((project, index) => {
                                const scaledData = getScaledFilteredData();
                                const yOffset = scaledData
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
                                const barHeight = responsiveConstants.TOUCH_TARGET_SIZE;

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

                                        {/* ii. Removed 'PROGRAM' label from first row as requested */}

                                        {/* Render bar */}
                                        <rect
                                            key={`bar-${project.id}`}
                                            x={startX}
                                            y={yOffset + (totalHeight - barHeight) / 2}
                                            width={Math.max(width, 2)}
                                            height={barHeight}
                                            rx={4}
                                            fill={project.status ? statusColors[project.status] : statusColors.Grey}
                                            className={`transition-opacity duration-150 hover:opacity-90 ${
                                                project.isDrillable ? 'cursor-pointer' : 'cursor-default'
                                            }`}
                                            onClick={() => {
                                                // Task 1: Drill-through to SubProgram from Gantt bar
                                                if (project.isDrillable && onDrillToSubProgram) {
                                                    onDrillToSubProgram(project.id, project.name);
                                                } else {
                                                    console.log('Program bar clicked:', project.id, 'isDrillable:', project.isDrillable);
                                                }
                                            }}
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
                                                fontSize={responsiveConstants.MILESTONE_FONT_SIZE}
                                                isMobile={responsiveConstants.TOUCH_TARGET_SIZE > 24}
                                                zoomLevel={responsiveConstants.ZOOM_LEVEL}
                                                // Display3: New props for monthly grouped labels
                                                isMonthlyGrouped={milestone.isMonthlyGrouped}
                                                monthlyLabels={milestone.monthlyLabels}
                                                horizontalLabel={milestone.horizontalLabel}
                                                verticalLabels={milestone.verticalLabels}
                                                monthKey={milestone.monthKey}
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