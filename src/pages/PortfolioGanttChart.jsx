import React, { useState, useEffect, useRef } from 'react';
import TimelineAxis from '../components/TimelineAxis';
import MilestoneMarker from '../components/MilestoneMarker';
import { getTimelineRange, parseDate, calculatePosition, groupMilestonesByMonth, getMonthlyLabelPosition, createHorizontalMilestoneLabel, createVerticalMilestoneLabels, MILESTONE_LAYOUT_TYPE } from '../utils/dateUtils';
import { processPortfolioData } from '../services/dataService';
import { differenceInDays } from 'date-fns';

// Zoom levels configuration
const ZOOM_LEVELS = {
    0.5: { // 50% - Maximum Zoom Out
        MONTH_WIDTH: 40,
        VISIBLE_MONTHS: 24,
        FONT_SIZE: '8px',
        LABEL_WIDTH: 100,
        BASE_BAR_HEIGHT: 4, // Reduced for more compact rows
        TOUCH_TARGET_SIZE: 16,
        MILESTONE_LABEL_HEIGHT: 8,
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
        TOUCH_TARGET_SIZE: 20,
        MILESTONE_LABEL_HEIGHT: 12,
        MILESTONE_FONT_SIZE: '9px',
        PROJECT_SCALE: 1.5, // Show more projects
        ROW_PADDING: 6
    },
    1.0: { // 100% - Default
        MONTH_WIDTH: 100,
        VISIBLE_MONTHS: 13,
        FONT_SIZE: '14px',
        LABEL_WIDTH: 220,
        BASE_BAR_HEIGHT: 10,
        TOUCH_TARGET_SIZE: 24,
        MILESTONE_LABEL_HEIGHT: 20,
        MILESTONE_FONT_SIZE: '10px', // Reduced from default
        PROJECT_SCALE: 1.0, // Normal project count
        ROW_PADDING: 8 // Standard padding
    },
    1.25: { // 125% - Zoom In
        MONTH_WIDTH: 125,
        VISIBLE_MONTHS: 10,
        FONT_SIZE: '16px',
        LABEL_WIDTH: 275,
        BASE_BAR_HEIGHT: 14, // Larger bars for fewer projects
        TOUCH_TARGET_SIZE: 30,
        MILESTONE_LABEL_HEIGHT: 28,
        MILESTONE_FONT_SIZE: '12px',
        PROJECT_SCALE: 0.7, // Show fewer projects
        ROW_PADDING: 12 // More padding for larger rows
    },
    1.5: { // 150% - Maximum Zoom In
        MONTH_WIDTH: 150,
        VISIBLE_MONTHS: 8,
        FONT_SIZE: '18px',
        LABEL_WIDTH: 330,
        BASE_BAR_HEIGHT: 18, // Much larger bars
        TOUCH_TARGET_SIZE: 36,
        MILESTONE_LABEL_HEIGHT: 32,
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

    // Display3: Group milestones by month
    const monthlyGroups = groupMilestonesByMonth(milestones);
    const twoMonthWidth = monthWidth * 2; // Maximum width for label blocks

    const processedMilestones = [];

    // Process each monthly group
    Object.entries(monthlyGroups).forEach(([monthKey, monthMilestones]) => {
        // Determine label position for this month (odd = above, even = below)
        const labelPosition = getMonthlyLabelPosition(monthKey);

        // A/B Testing: Create labels based on layout type
        const horizontalLabel = MILESTONE_LAYOUT_TYPE === 'horizontal'
            ? createHorizontalMilestoneLabel(monthMilestones, twoMonthWidth, '14px')
            : '';
        const verticalLabels = MILESTONE_LAYOUT_TYPE === 'vertical'
            ? createVerticalMilestoneLabels(monthMilestones, twoMonthWidth, '14px')
            : [];

        // Process each milestone in the month
        monthMilestones.forEach((milestone, index) => {
            const milestoneDate = parseDate(milestone.date);
            const x = calculatePosition(milestoneDate, startDate, monthWidth);

            processedMilestones.push({
                ...milestone,
                x,
                date: milestoneDate,
                isGrouped: monthMilestones.length > 1,
                isMonthlyGrouped: true, // New flag for Display3
                monthKey,
                labelPosition,
                horizontalLabel, // Single horizontal label for the month
                verticalLabels, // Array of vertical labels for the month
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

const PortfolioGanttChart = ({ onDrillToProgram }) => {
    const [processedData, setProcessedData] = useState([]);
    const [filteredData, setFilteredData] = useState([]);
    const [selectedParent, setSelectedParent] = useState('All');
    const [zoomLevel, setZoomLevel] = useState(1.0);
    const [responsiveConstants, setResponsiveConstants] = useState(getResponsiveConstants(1.0));

    const timelineScrollRef = useRef(null);
    const ganttScrollRef = useRef(null);
    const leftPanelScrollRef = useRef(null);

    const { startDate } = getTimelineRange();
    const totalWidth = responsiveConstants.MONTH_WIDTH * responsiveConstants.TOTAL_MONTHS;

    // Handle window resize and zoom changes
    useEffect(() => {
        const handleResize = () => {
            setResponsiveConstants(getResponsiveConstants(zoomLevel));
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [zoomLevel]);

    // Update responsive constants when zoom level changes
    useEffect(() => {
        setResponsiveConstants(getResponsiveConstants(zoomLevel));
    }, [zoomLevel]);

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

    const calculateMilestoneLabelHeight = (milestones, monthWidth = 100) => {
        if (!milestones?.length) return 0;

        // Process milestones to get their positions and grouping info
        const processedMilestones = processMilestonesWithPosition(milestones, startDate, monthWidth);

        let maxAboveHeight = 0;
        let maxBelowHeight = 0;
        const LINE_HEIGHT = 12;
        const LABEL_PADDING = 15; // Padding for labels
        const ABOVE_LABEL_OFFSET = 25; // Space needed above the bar for labels (increased for Display3)
        const BELOW_LABEL_OFFSET = 20; // Space needed below the bar for labels

        processedMilestones.forEach(milestone => {
            if (milestone.isMonthlyGrouped) {
                // Display3: Monthly grouped milestones - height depends on layout type
                let labelHeight;
                if (milestone.horizontalLabel) {
                    // Horizontal layout: single line
                    labelHeight = LINE_HEIGHT;
                } else if (milestone.verticalLabels?.length) {
                    // Vertical layout: multiple lines
                    labelHeight = milestone.verticalLabels.length * LINE_HEIGHT;
                } else {
                    labelHeight = LINE_HEIGHT; // Fallback
                }

                if (milestone.labelPosition === 'above') {
                    maxAboveHeight = Math.max(maxAboveHeight, labelHeight + ABOVE_LABEL_OFFSET);
                } else {
                    maxBelowHeight = Math.max(maxBelowHeight, labelHeight + BELOW_LABEL_OFFSET);
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

        // Return total height needed for milestone labels
        return maxAboveHeight + maxBelowHeight;
    };

    const calculateBarHeight = (project) => {
        // Calculate height needed for project name wrapping (responsive)
        const maxCharsPerLine = responsiveConstants.LABEL_WIDTH / 8; // Approximate chars per line
        const textLines = Math.ceil(project.name.length / maxCharsPerLine);
        const nameHeight = responsiveConstants.BASE_BAR_HEIGHT + ((textLines - 1) * Math.round(12 * (responsiveConstants.ZOOM_LEVEL || 1.0)));

        // Calculate height needed for milestone labels (responsive)
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

    return (
        <div className="w-full flex flex-col">
            {/* Responsive Header */}
            <div className="flex-shrink-0 p-2 sm:p-4">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    {/* Portfolio Selector */}
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

                    {/* Milestone Legend - Beside Portfolio */}
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
                            className="flex items-center justify-between px-2 font-semibold text-gray-700"
                            style={{
                                height: responsiveConstants.TOUCH_TARGET_SIZE,
                                fontSize: responsiveConstants.FONT_SIZE
                            }}
                        >
                            <span className="truncate">Portfolios</span>
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
            <div className="relative flex w-full" style={{ minHeight: Math.max(400, getTotalHeight()) }}>
                {/* Sticky Portfolio Names - Synchronized Scrolling */}
                <div
                    ref={leftPanelScrollRef}
                    className="flex-shrink-0 bg-white border-r border-gray-200 overflow-y-auto overflow-x-auto"
                    style={{
                        minWidth: responsiveConstants.LABEL_WIDTH,
                        width: 'auto',
                        position: 'sticky',
                        left: 0,
                        zIndex: 10,
                        height: '100%',
                    }}
                    onScroll={handleLeftPanelScroll}
                >
                    <div style={{ position: 'relative', height: getTotalHeight() }}>
                        {getScaledFilteredData().map((project, index) => {
                            const scaledData = getScaledFilteredData();
                            const rowSpacing = responsiveConstants.ROW_PADDING || 8;
                            const topMargin = Math.round(10 * (responsiveConstants.ZOOM_LEVEL || 1.0));
                            const yOffset = scaledData
                                .slice(0, index)
                                .reduce((total, p) => total + calculateBarHeight(p) + rowSpacing, topMargin);
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
                                        <div className="flex flex-col justify-center">
                                            <span className="font-medium text-gray-800 pr-2" title={project.name}>
                                                {project.name}
                                            </span>
                                        </div>
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
                    className="flex-1 overflow-x-auto"
                    style={{
                        width: `${responsiveConstants.MONTH_WIDTH * responsiveConstants.VISIBLE_MONTHS}px`,
                        maxWidth: `calc(100vw - ${responsiveConstants.LABEL_WIDTH}px)`
                    }}
                    onScroll={handleGanttScroll}
                >
                    <div className="relative" style={{ width: totalWidth }}>
                        <svg
                            width={totalWidth}
                            style={{
                                height: Math.max(400, getTotalHeight()),
                                touchAction: 'pan-x pan-y' // Enable smooth touch scrolling
                            }}
                            className="block"
                        >
                            {getScaledFilteredData().map((project, index) => {
                                // Calculate cumulative Y offset including all previous projects' full heights
                                const scaledData = getScaledFilteredData();
                                const rowSpacing = responsiveConstants.ROW_PADDING || 8;
                                const topMargin = Math.round(10 * (responsiveConstants.ZOOM_LEVEL || 1.0));
                                const yOffset = scaledData
                                    .slice(0, index)
                                    .reduce((total, p) => total + calculateBarHeight(p) + rowSpacing, topMargin);

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
                                            height={responsiveConstants.TOUCH_TARGET_SIZE}
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

export default PortfolioGanttChart;

