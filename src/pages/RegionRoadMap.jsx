import React, { useState, useEffect, useMemo, useRef } from 'react';
import { processRegionData, getRegionFilterOptions } from '../services/dataService';
import { parseDate, calculatePosition, getTimelineRange } from '../utils/dateUtils';
import { differenceInDays } from 'date-fns';
import TimelineAxis from '../components/TimelineAxis';
import MilestoneMarker from '../components/MilestoneMarker';

// Zoom levels configuration
const ZOOM_LEVELS = {
    0.5: { // 50% - Maximum Zoom Out
        MONTH_WIDTH: 40,
        VISIBLE_MONTHS: 24,
        FONT_SIZE: '8px',
        LABEL_WIDTH: 160,
        TOUCH_TARGET_SIZE: 16
    },
    0.75: { // 75% - Zoom Out
        MONTH_WIDTH: 60,
        VISIBLE_MONTHS: 18,
        FONT_SIZE: '10px',
        LABEL_WIDTH: 220,
        TOUCH_TARGET_SIZE: 20
    },
    1.0: { // 100% - Default
        MONTH_WIDTH: 100,
        VISIBLE_MONTHS: 13,
        FONT_SIZE: '14px',
        LABEL_WIDTH: 320,
        TOUCH_TARGET_SIZE: 24
    },
    1.25: { // 125% - Zoom In
        MONTH_WIDTH: 125,
        VISIBLE_MONTHS: 10,
        FONT_SIZE: '16px',
        LABEL_WIDTH: 400,
        TOUCH_TARGET_SIZE: 30
    },
    1.5: { // 150% - Maximum Zoom In
        MONTH_WIDTH: 150,
        VISIBLE_MONTHS: 8,
        FONT_SIZE: '18px',
        LABEL_WIDTH: 480,
        TOUCH_TARGET_SIZE: 36
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
    const mobileAdjustment = isMobile ? 0.7 : 1.0;

    return {
        MONTH_WIDTH: Math.round(zoomConfig.MONTH_WIDTH * mobileAdjustment),
        TOTAL_MONTHS: 73,
        LABEL_WIDTH: Math.round(zoomConfig.LABEL_WIDTH * mobileAdjustment),
        VISIBLE_MONTHS: isMobile ? Math.max(6, Math.round(zoomConfig.VISIBLE_MONTHS * 0.6)) : zoomConfig.VISIBLE_MONTHS,
        TOUCH_TARGET_SIZE: Math.max(isMobile ? 44 : 16, Math.round(zoomConfig.TOUCH_TARGET_SIZE * mobileAdjustment)),
        FONT_SIZE: zoomConfig.FONT_SIZE,
        ZOOM_LEVEL: zoomLevel
    };
};

// Milestone constants (copied from PortfolioGanttChart)
const DAYS_THRESHOLD = 16; // Threshold for considering milestones as overlapping
const MAX_LABEL_LENGTH = 5; // Maximum length before truncation

// Helper function for truncating labels (copied from PortfolioGanttChart)
const truncateLabel = (label, hasAdjacentMilestones) => {
    // Only truncate if there are adjacent milestones and length exceeds max
    if (!hasAdjacentMilestones || label.length <= MAX_LABEL_LENGTH) return label;
    return label.substring(0, MAX_LABEL_LENGTH) + '...';
};

const RegionRoadMap = () => {
    const [filters, setFilters] = useState({
        region: 'All',
        market: 'All',
        function: 'All',
        tier: 'All'
    });

    const [filterOptions, setFilterOptions] = useState({
        regions: [],
        markets: [],
        functions: [],
        tiers: []
    });

    const [availableMarkets, setAvailableMarkets] = useState([]);
    const [zoomLevel, setZoomLevel] = useState(1.0);
    const [responsiveConstants, setResponsiveConstants] = useState(getResponsiveConstants(1.0));

    const timelineScrollRef = useRef(null);
    const ganttScrollRef = useRef(null);
    const leftPanelScrollRef = useRef(null);

    // Handle window resize for responsive behavior
    useEffect(() => {
        const handleResize = () => {
            setResponsiveConstants(getResponsiveConstants());
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Load filter options on component mount
    useEffect(() => {
        const options = getRegionFilterOptions();
        setFilterOptions(options);
        setAvailableMarkets(options.markets);

        // Initial scroll to show June 2025 to June 2026 (responsive months)
        if (timelineScrollRef.current) {
            // Calculate scroll position to show June 2025 (current month - 2)
            const monthsFromStart = 36; // MONTHS_BEFORE from dateUtils.js
            const scrollPosition = (monthsFromStart - 2) * responsiveConstants.MONTH_WIDTH; // June 2025 is month 34
            timelineScrollRef.current.scrollLeft = scrollPosition;
            // Sync gantt scroll position
            if (ganttScrollRef.current) {
                ganttScrollRef.current.scrollLeft = scrollPosition;
            }
        }
    }, []);

    // Update available markets when region changes
    useEffect(() => {
        if (filters.region === 'All') {
            setAvailableMarkets(filterOptions.markets);
        } else {
            // Filter markets based on selected region
            const regionSpecificMarkets = filterOptions.markets.filter(market => {
                // Check if this market belongs to the selected region
                const regionData = processRegionData({ region: filters.region });
                return regionData.some(project => project.market === market);
            });
            setAvailableMarkets(regionSpecificMarkets);

            // Reset market filter if current selection is not available
            if (filters.market !== 'All' && !regionSpecificMarkets.includes(filters.market)) {
                setFilters(prev => ({ ...prev, market: 'All' }));
            }
        }
    }, [filters.region, filterOptions.markets]);

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

    // Process data based on current filters
    const processedData = useMemo(() => {
        return processRegionData(filters);
    }, [filters]);

    // Use the standard 73-month timeline
    const { startDate, endDate } = getTimelineRange();
    const totalWidth = responsiveConstants.MONTH_WIDTH * responsiveConstants.TOTAL_MONTHS;

    // Phase colors mapping
    const phaseColors = {
        'Initiate': '#c1e5f5',
        'Evaluate': '#f6c6ad',
        'Develop': '#84e291',
        'Deploy': '#e59edd',
        'Sustain': '#156082',
        'Close': '#006400'
    };



    const handleFilterChange = (filterType, value) => {
        setFilters(prev => ({
            ...prev,
            [filterType]: value
        }));
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

    const rowHeight = 60;

    // Check if a project has any overlap with the timeline range
    const isProjectWithinTimelineRange = (project) => {
        // Check unphased projects
        if (project.isUnphased) {
            const projectStartDate = parseDate(project.startDate);
            const projectEndDate = parseDate(project.endDate);
            if (!projectStartDate || !projectEndDate) return false;

            // Project overlaps if it starts before timeline ends AND ends after timeline starts
            return projectStartDate <= endDate && projectEndDate >= startDate;
        }

        // Check phased projects - any phase within range means project should be shown
        if (project.phases && project.phases.length > 0) {
            return project.phases.some(phase => {
                const phaseStartDate = parseDate(phase.startDate);
                const phaseEndDate = parseDate(phase.endDate);
                if (!phaseStartDate || !phaseEndDate) return false;

                // Phase overlaps if it starts before timeline ends AND ends after timeline starts
                return phaseStartDate <= endDate && phaseEndDate >= startDate;
            });
        }

        return false;
    };

    // Filter projects to only include those within the timeline range
    const timelineFilteredData = useMemo(() => {
        return processedData.filter(project => isProjectWithinTimelineRange(project));
    }, [processedData, startDate, endDate]);

    // Milestone processing function (copied from PortfolioGanttChart)
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
            const x = calculatePosition(milestoneDate, startDate, responsiveConstants.MONTH_WIDTH);
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

    return (
        <div className="region-roadmap">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-800 mb-4">Region Roadmap</h1>

                {/* Filters */}
                <div className="grid grid-cols-4 gap-4 mb-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Region</label>
                        <select
                            value={filters.region}
                            onChange={(e) => handleFilterChange('region', e.target.value)}
                            className="w-full border border-gray-300 rounded px-3 py-2 bg-white"
                        >
                            <option value="All">All Regions</option>
                            {filterOptions.regions.map(region => (
                                <option key={region} value={region}>{region}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Market</label>
                        <select
                            value={filters.market}
                            onChange={(e) => handleFilterChange('market', e.target.value)}
                            className="w-full border border-gray-300 rounded px-3 py-2 bg-white"
                        >
                            <option value="All">All Markets</option>
                            {availableMarkets.map(market => (
                                <option key={market} value={market}>{market}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Function</label>
                        <select
                            value={filters.function}
                            onChange={(e) => handleFilterChange('function', e.target.value)}
                            className="w-full border border-gray-300 rounded px-3 py-2 bg-white"
                        >
                            <option value="All">All Functions</option>
                            {filterOptions.functions.map(func => (
                                <option key={func} value={func}>{func}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tier</label>
                        <select
                            value={filters.tier}
                            onChange={(e) => handleFilterChange('tier', e.target.value)}
                            className="w-full border border-gray-300 rounded px-3 py-2 bg-white"
                        >
                            <option value="All">All Tiers</option>
                            {filterOptions.tiers.map(tier => (
                                <option key={tier} value={tier}>Tier {tier}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Gantt Chart */}
            {timelineFilteredData.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                    No projects match the current filters or fall within the timeline range
                </div>
            ) : (
                <div className="flex-1 flex flex-col">
                    {/* Fixed Header Area - Timeline Axis */}
                    <div className="sticky top-0 z-20 bg-white border-b border-gray-200">
                        <div className="relative flex w-full">
                            {/* Sticky Project Names Header */}
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
                                    <span className="truncate">Region Projects</span>
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
                                                ${responsiveConstants.LABEL_WIDTH < 200 ? 'hidden' : 'block'}
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
                    <div className="relative flex w-full">
                        {/* Sticky Project Names - Synchronized Scrolling */}
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
                            <div style={{ position: 'relative', height: timelineFilteredData.length * (rowHeight + 8) }}>
                                {timelineFilteredData.map((project, index) => {
                                    const yOffset = index * (rowHeight + 8);
                                    return (
                                        <div
                                            key={project.id}
                                            className="absolute flex flex-col justify-center border-b border-gray-100 bg-gray-50/30 hover:bg-gray-100/50 transition-colors"
                                            style={{
                                                top: yOffset,
                                                height: rowHeight,
                                                paddingLeft: responsiveConstants.TOUCH_TARGET_SIZE > 24 ? '12px' : '8px',
                                                fontSize: responsiveConstants.FONT_SIZE,
                                                width: '100%',
                                                minHeight: responsiveConstants.TOUCH_TARGET_SIZE,
                                                cursor: 'default'
                                            }}
                                        >
                                            <div className="flex items-center justify-between w-full">
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-gray-800 truncate pr-2" title={project.name}>
                                                        {project.name}
                                                    </span>
                                                    <span className="text-xs text-gray-500 mt-1">
                                                        {project.region}{project.market ? `/${project.market}` : ''} • {project.function} • Tier {project.tier}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Right Panel - Timeline Content */}
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
                                    height={timelineFilteredData.length * (rowHeight + 8)}
                                    style={{ height: timelineFilteredData.length * (rowHeight + 8) }}
                                >
                                    {timelineFilteredData.map((project, index) => {
                                        const yOffset = index * (rowHeight + 8);

                                        const milestones = processMilestonesWithPosition(project.milestones || [], startDate, responsiveConstants.MONTH_WIDTH);

                                        return (
                                            <g key={`project-${project.id}`} className="project-group">
                                                {/* Project bars and phases */}
                                                {project.isUnphased ? (
                                                    // Single unphased bar (only render if within timeline range)
                                                    (() => {
                                                        const projectStartDate = parseDate(project.startDate, `${project.name} - Project Start`);
                                                        const projectEndDate = parseDate(project.endDate, `${project.name} - Project End`);
                                                        if (!projectStartDate || !projectEndDate) return null;

                                                        // Skip projects that don't overlap with timeline range
                                                        if (projectStartDate > endDate || projectEndDate < startDate) {
                                                            return null;
                                                        }

                                                        const startX = calculatePosition(projectStartDate, startDate, responsiveConstants.MONTH_WIDTH);
                                                        const endX = calculatePosition(projectEndDate, startDate, responsiveConstants.MONTH_WIDTH);
                                                        const width = Math.max(endX - startX, 2);

                                                        return (
                                                            <rect
                                                                x={startX}
                                                                y={yOffset + (rowHeight - 24) / 2}
                                                                width={width}
                                                                height={24}
                                                                rx={4}
                                                                fill="#9ca3af"
                                                                className="transition-opacity duration-150 hover:opacity-90"
                                                            />
                                                        );
                                                    })()
                                                ) : (
                                                    // Multiple phase bars (only render phases within timeline range)
                                                    project.phases?.map((phase, phaseIndex) => {
                                                        const phaseStartDate = parseDate(phase.startDate, `${project.name} - ${phase.name} Start`);
                                                        const phaseEndDate = parseDate(phase.endDate, `${project.name} - ${phase.name} End`);
                                                        if (!phaseStartDate || !phaseEndDate) return null;

                                                        // Skip phases that don't overlap with timeline range
                                                        if (phaseStartDate > endDate || phaseEndDate < startDate) {
                                                            return null;
                                                        }

                                                        const startX = calculatePosition(phaseStartDate, startDate, responsiveConstants.MONTH_WIDTH);
                                                        const endX = calculatePosition(phaseEndDate, startDate, responsiveConstants.MONTH_WIDTH);
                                                        const width = Math.max(endX - startX, 2);

                                                        return (
                                                            <rect
                                                                key={`${project.id}-${phase.name}`}
                                                                x={startX}
                                                                y={yOffset + (rowHeight - 24) / 2}
                                                                width={width}
                                                                height={24}
                                                                rx={4}
                                                                fill={phaseColors[phase.name] || '#9ca3af'}
                                                                className="transition-opacity duration-150 hover:opacity-90"
                                                            />
                                                        );
                                                    }).filter(Boolean)
                                                )}

                                                {/* Milestones */}
                                                {milestones.map((milestone, milestoneIndex) => (
                                                    <MilestoneMarker
                                                        key={`${project.id}-milestone-${milestoneIndex}`}
                                                        x={milestone.x}
                                                        y={yOffset + (rowHeight - responsiveConstants.TOUCH_TARGET_SIZE) / 2 + (responsiveConstants.TOUCH_TARGET_SIZE / 2)}
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
            )}
        </div>
    );
};

export default RegionRoadMap;