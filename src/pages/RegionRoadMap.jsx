import React, { useState, useEffect, useMemo, useRef } from 'react';
import { processRegionData, getRegionFilterOptions, debugSupplyChainData } from '../services/apiDataService';
import { parseDate, calculatePosition, getTimelineRange, groupMilestonesByMonth, getMonthlyLabelPosition, createVerticalMilestoneLabels } from '../utils/dateUtils';
import { differenceInDays } from 'date-fns';
import TimelineAxis from '../components/TimelineAxis';
import MilestoneMarker from '../components/MilestoneMarker';
import GanttBar from '../components/GanttBar';

// Zoom levels configuration
const ZOOM_LEVELS = {
    0.5: { // 50% - Maximum Zoom Out
        MONTH_WIDTH: 40,
        VISIBLE_MONTHS: 24,
        FONT_SIZE: '8px',
        LABEL_WIDTH: 160,
        BASE_BAR_HEIGHT: 4, // Reduced for more compact rows
        TOUCH_TARGET_SIZE: 16,
        MILESTONE_FONT_SIZE: '8px',
        PROJECT_SCALE: 2.0, // Show significantly more projects
        ROW_PADDING: 4 // Reduced padding between rows
    },
    0.75: { // 75% - Zoom Out
        MONTH_WIDTH: 60,
        VISIBLE_MONTHS: 18,
        FONT_SIZE: '10px',
        LABEL_WIDTH: 220,
        BASE_BAR_HEIGHT: 6, // Smaller bars for more projects
        TOUCH_TARGET_SIZE: 20,
        MILESTONE_FONT_SIZE: '9px',
        PROJECT_SCALE: 1.5, // Show more projects
        ROW_PADDING: 6
    },
    1.0: { // 100% - Default
        MONTH_WIDTH: 100,
        VISIBLE_MONTHS: 13,
        FONT_SIZE: '14px',
        LABEL_WIDTH: 320,
        BASE_BAR_HEIGHT: 10,
        TOUCH_TARGET_SIZE: 24,
        MILESTONE_FONT_SIZE: '10px', // Reduced from default
        PROJECT_SCALE: 1.0, // Normal project count
        ROW_PADDING: 8 // Standard padding
    },
    1.25: { // 125% - Zoom In
        MONTH_WIDTH: 125,
        VISIBLE_MONTHS: 10,
        FONT_SIZE: '16px',
        LABEL_WIDTH: 400,
        BASE_BAR_HEIGHT: 14, // Larger bars for fewer projects
        TOUCH_TARGET_SIZE: 30,
        MILESTONE_FONT_SIZE: '12px',
        PROJECT_SCALE: 0.7, // Show fewer projects
        ROW_PADDING: 12 // More padding for larger rows
    },
    1.5: { // 150% - Maximum Zoom In
        MONTH_WIDTH: 150,
        VISIBLE_MONTHS: 8,
        FONT_SIZE: '18px',
        LABEL_WIDTH: 480,
        BASE_BAR_HEIGHT: 18, // Much larger bars
        TOUCH_TARGET_SIZE: 36,
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

    // Apply mobile adjustments if needed (match PortfolioGanttChart)
    const mobileAdjustment = isMobile ? 0.8 : 1.0;

    return {
        MONTH_WIDTH: Math.round(zoomConfig.MONTH_WIDTH * mobileAdjustment),
        TOTAL_MONTHS: 73,
        LABEL_WIDTH: Math.round(zoomConfig.LABEL_WIDTH * mobileAdjustment),
        BASE_BAR_HEIGHT: Math.round(zoomConfig.BASE_BAR_HEIGHT * mobileAdjustment),
        VISIBLE_MONTHS: isMobile ? Math.max(6, Math.round(zoomConfig.VISIBLE_MONTHS * 0.6)) : zoomConfig.VISIBLE_MONTHS,
        TOUCH_TARGET_SIZE: Math.max(isMobile ? 44 : 16, Math.round(zoomConfig.TOUCH_TARGET_SIZE * mobileAdjustment)),
        FONT_SIZE: zoomConfig.FONT_SIZE,
        MILESTONE_FONT_SIZE: zoomConfig.MILESTONE_FONT_SIZE,
        PROJECT_SCALE: zoomConfig.PROJECT_SCALE,
        ROW_PADDING: Math.round(zoomConfig.ROW_PADDING * mobileAdjustment),
        ZOOM_LEVEL: zoomLevel
    };
};

// Milestone constants (copied from PortfolioGanttChart)
const DAYS_THRESHOLD = 16; // Threshold for considering milestones as overlapping
const MAX_LABEL_LENGTH = 5; // Maximum length before truncation

// Milestone label spacing constants (match PortfolioGanttChart)
const LINE_HEIGHT = 12;
const LABEL_PADDING = 15; // Padding for labels
const ABOVE_LABEL_OFFSET = 15; // Space needed above the bar for labels (decreased from default)
const BELOW_LABEL_OFFSET = 20; // Space needed below the bar for labels (increased from default)

// Helper function for truncating labels (copied from PortfolioGanttChart)
const truncateLabel = (label, hasAdjacentMilestones) => {
    // Only truncate if there are adjacent milestones and length exceeds max
    if (!hasAdjacentMilestones || label.length <= MAX_LABEL_LENGTH) return label;
    return label.substring(0, MAX_LABEL_LENGTH) + '...';
};

const RegionRoadMap = () => {
    // ALL HOOKS MUST BE DECLARED AT THE TOP LEVEL
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
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [processedData, setProcessedData] = useState([]);

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
        const loadData = async () => {
            try {
                setLoading(true);
                setError(null);
                
                // DEBUG: Analyze Supply Chain data first
                console.log('🔍 Starting Supply Chain debug analysis...');
                await debugSupplyChainData();
                
                const options = await getRegionFilterOptions();
                setFilterOptions(options);
                setAvailableMarkets(options.markets);

                // Also load initial data with default filters
                console.log('Loading initial region data with default filters:', filters);
                const initialData = await processRegionData(filters);
                setProcessedData(initialData);
                console.log('Initial data loaded:', initialData.length, 'projects');

            } catch (err) {
                console.error('Failed to load region filter options or initial data:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, []); // Only run once on mount

    // Handle initial scroll position after data loads and responsive constants are set
    useEffect(() => {
        if (!loading && timelineScrollRef.current && responsiveConstants.MONTH_WIDTH) {
            // Calculate scroll position to show June 2025 (current month - 2)
            const monthsFromStart = 36; // MONTHS_BEFORE from dateUtils.js
            const scrollPosition = (monthsFromStart - 2) * responsiveConstants.MONTH_WIDTH; // June 2025 is month 34
            timelineScrollRef.current.scrollLeft = scrollPosition;
            // Sync gantt scroll position
            if (ganttScrollRef.current) {
                ganttScrollRef.current.scrollLeft = scrollPosition;
            }
        }
    }, [loading, responsiveConstants.MONTH_WIDTH]);

    // Update available markets when region changes
    useEffect(() => {
        const updateMarkets = async () => {
            if (filters.region === 'All') {
                setAvailableMarkets(filterOptions.markets);
            } else {
                try {
                    // Filter markets based on selected region
                    const regionData = await processRegionData({ region: filters.region });
                    const regionSpecificMarkets = filterOptions.markets.filter(market => {
                        return regionData.some(project => project.market === market);
                    });
                    setAvailableMarkets(regionSpecificMarkets);

                    // Reset market filter if current selection is not available
                    if (filters.market !== 'All' && !regionSpecificMarkets.includes(filters.market)) {
                        setFilters(prev => ({ ...prev, market: 'All' }));
                    }
                } catch (err) {
                    console.error('Failed to filter markets by region:', err);
                    setAvailableMarkets(filterOptions.markets);
                }
            }
        };

        if (filterOptions.markets.length > 0) {
            updateMarkets();
        }
    }, [filters.region, filterOptions.markets]);

    // Load and process region data when filters change (but not on initial load)
    useEffect(() => {
        const loadRegionData = async () => {
            // Skip if this is the initial load (handled in the mount effect above)
            if (loading) return;
            
            try {
                console.log('Loading region data with filters:', filters);
                const data = await processRegionData(filters);
                setProcessedData(data);
                console.log('Filtered data loaded:', data.length, 'projects');
            } catch (err) {
                console.error('Failed to process region data:', err);
                setError(err.message);
            }
        };

        // Only load data when filters change after initial mount
        if (!loading && filterOptions.regions.length > 0) {
            loadRegionData();
        }
    }, [filters]); // Remove loading and error dependencies to avoid race conditions

    // Update responsive constants when zoom level changes
    useEffect(() => {
        setResponsiveConstants(getResponsiveConstants(zoomLevel));
    }, [zoomLevel]);

    // Use the standard 73-month timeline
    const { startDate, endDate } = getTimelineRange();
    const totalWidth = responsiveConstants.MONTH_WIDTH * responsiveConstants.TOTAL_MONTHS;

    // Check if a project has any overlap with the timeline range
    const isProjectWithinTimelineRange = (project) => {
        const projectStartDate = parseDate(project.startDate);
        const projectEndDate = parseDate(project.endDate);
        
        if (!projectStartDate || !projectEndDate) {
            console.log('Project has invalid dates:', project.name, project.startDate, project.endDate);
            return false;
        }

        // Project overlaps if it starts before timeline ends AND ends after timeline starts
        const isWithinRange = projectStartDate <= endDate && projectEndDate >= startDate;
        
        if (!isWithinRange) {
            console.log('Project outside timeline:', project.name, 'Project:', projectStartDate, '-', projectEndDate, 'Timeline:', startDate, '-', endDate);
        }
        
        return isWithinRange;
    };

    // Filter projects to only include those within the timeline range
    const timelineFilteredData = useMemo(() => {
        console.log('Timeline filtering - Input data:', processedData.length, 'projects');
        console.log('Timeline range:', startDate, 'to', endDate);
        
        const filtered = processedData.filter(project => isProjectWithinTimelineRange(project));
        console.log('Timeline filtering - Output data:', filtered.length, 'projects');
        
        return filtered;
    }, [processedData, startDate, endDate]);

    // ALL CONDITIONAL LOGIC AND EARLY RETURNS MUST COME AFTER ALL HOOKS

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

    // Update responsive constants when zoom level changes
    useEffect(() => {
        setResponsiveConstants(getResponsiveConstants(zoomLevel));
    }, [zoomLevel]);

    // Loading state
    if (loading) {
        return (
            <div className="container mx-auto p-4">
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
                    <span className="ml-4 text-lg text-gray-600">Loading region data...</span>
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="container mx-auto p-4">
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                    <h3 className="text-lg font-semibold text-red-800 mb-2">Failed to Load Region Data</h3>
                    <p className="text-red-600 mb-4">{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

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
        console.log(`🔄 Filter change: ${filterType} = ${value}`);
        setFilters(prev => {
            const newFilters = {
                ...prev,
                [filterType]: value
            };
            console.log('🔄 New filters state:', newFilters);
            return newFilters;
        });
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

    // Apply project scaling based on zoom level
    const getScaledFilteredData = () => {
        const projectScale = responsiveConstants.PROJECT_SCALE;
        if (projectScale >= 1.0) {
            // Zooming out - show more projects (no change needed, show all)
            return timelineFilteredData;
        } else {
            // Zooming in - show fewer projects
            const targetCount = Math.max(1, Math.round(timelineFilteredData.length * projectScale));
            return timelineFilteredData.slice(0, targetCount);
        }
    };

    const calculateRowHeight = (projectName = '') => {
        // Responsive row height calculation
        const baseHeight = responsiveConstants.BASE_BAR_HEIGHT || 10;
        const textLines = Math.ceil(projectName.length / 30); // Approximate chars per line
        const nameHeight = baseHeight + ((textLines - 1) * Math.round(12 * (responsiveConstants.ZOOM_LEVEL || 1.0)));
        const basePadding = responsiveConstants.ROW_PADDING || 8;
        const extraPadding = responsiveConstants.TOUCH_TARGET_SIZE > 24 ? Math.round(basePadding * 1.5) : basePadding;
        return nameHeight + extraPadding;
    };

    const rowHeight = calculateRowHeight();

    // Display3: Monthly grouped milestone processing function
    // Updated: Now processes only SG3 milestones (filtered in dataService.js)
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

    return (
        <div className="region-roadmap">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-800 mb-4">Region Roadmap</h1>

                {/* Filters and Legend */}
                <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4 mb-4">
                    {/* Filters */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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

                    {/* Milestone Legend - Beside Filters */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 xl:min-w-max">
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

            {/* Gantt Chart */}
            {timelineFilteredData.length === 0 ? (
                <div className="flex-1 flex flex-col">
                    {/* Show Timeline Axis even when no data */}
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
                                    {/* Zoom Controls */}
                                    <div className="flex items-center space-x-1 ml-2">
                                        <button
                                            onClick={handleZoomOut}
                                            disabled={zoomLevel <= 0.5}
                                            className="w-8 h-6 flex items-center justify-center bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-300 rounded text-xs font-bold transition-colors"
                                            title="Zoom Out"
                                        >
                                            −
                                        </button>
                                        <span className="text-xs text-gray-600 text-center font-medium min-w-[35px]">
                                            {Math.round(zoomLevel * 100)}%
                                        </span>
                                        <button
                                            onClick={handleZoomIn}
                                            disabled={zoomLevel >= 1.5}
                                            className="w-8 h-6 flex items-center justify-center bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-300 rounded text-xs font-bold transition-colors"
                                            title="Zoom In"
                                        >
                                            +
                                        </button>
                                        <button
                                            onClick={handleZoomReset}
                                            className="text-xs px-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                                            title="Reset to 100%"
                                        >
                                            ↺
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
                    
                    {/* No Data Message */}
                    <div className="text-center py-8 text-gray-500">
                        <div className="mb-2">No projects match the current filters or fall within the timeline range</div>
                        <div className="text-sm text-gray-400">
                            Processed Data: {processedData.length} projects | 
                            Timeline: {startDate?.toLocaleDateString()} - {endDate?.toLocaleDateString()} |
                            Filters: {JSON.stringify(filters)}
                        </div>
                    </div>
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
                                    {/* Zoom Controls */}
                                    <div className="flex items-center space-x-1 ml-2">
                                        <button
                                            onClick={handleZoomOut}
                                            disabled={zoomLevel <= 0.5}
                                            className="w-8 h-6 flex items-center justify-center bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-300 rounded text-xs font-bold transition-colors"
                                            title="Zoom Out"
                                        >
                                            −
                                        </button>
                                        <span className="text-xs text-gray-600 text-center font-medium min-w-[35px]">
                                            {Math.round(zoomLevel * 100)}%
                                        </span>
                                        <button
                                            onClick={handleZoomIn}
                                            disabled={zoomLevel >= 1.5}
                                            className="w-8 h-6 flex items-center justify-center bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-300 rounded text-xs font-bold transition-colors"
                                            title="Zoom In"
                                        >
                                            +
                                        </button>
                                        <button
                                            onClick={handleZoomReset}
                                            className="text-xs px-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                                            title="Reset to 100%"
                                        >
                                            ↺
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
                                minWidth: responsiveConstants.LABEL_WIDTH,
                                width: 'auto',
                                position: 'sticky',
                                left: 0,
                                zIndex: 10,
                                height: '100%',
                            }}
                            onScroll={handleLeftPanelScroll}
                        >
                                                <div style={{ position: 'relative', height: getScaledFilteredData().reduce((total, project) => {
                        const projectRowHeight = calculateRowHeight(project.name);
                        return total + projectRowHeight + (responsiveConstants.ROW_PADDING || 8);
                    }, 0) }}>
                        {getScaledFilteredData().map((project, index) => {
                            const projectRowHeight = calculateRowHeight(project.name);
                            const yOffset = getScaledFilteredData().slice(0, index).reduce((total, p) => {
                                const pRowHeight = calculateRowHeight(p.name);
                                return total + pRowHeight + (responsiveConstants.ROW_PADDING || 8);
                            }, 0);
                                    return (
                                        <div
                                            key={project.id}
                                            className="absolute flex flex-col justify-center border-b border-gray-100 bg-gray-50/30 hover:bg-gray-100/50 transition-colors"
                                            style={{
                                                top: yOffset,
                                                height: projectRowHeight,
                                                paddingLeft: responsiveConstants.TOUCH_TARGET_SIZE > 24 ? '12px' : '8px',
                                                fontSize: responsiveConstants.FONT_SIZE,
                                                width: '100%',
                                                minHeight: responsiveConstants.TOUCH_TARGET_SIZE,
                                                cursor: 'default'
                                            }}
                                        >
                                            <div className="flex items-center justify-between w-full">
                                                                                            <div className="flex flex-col justify-center">
                                                <span className="font-medium text-gray-800 pr-2" title={project.name}>
                                                    {project.name}
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
                                    height={getScaledFilteredData().reduce((total, project) => {
                                        const projectRowHeight = calculateRowHeight(project.name);
                                        return total + projectRowHeight + (responsiveConstants.ROW_PADDING || 8);
                                    }, 0)}
                                    style={{ height: getScaledFilteredData().reduce((total, project) => {
                                        const projectRowHeight = calculateRowHeight(project.name);
                                        return total + projectRowHeight + (responsiveConstants.ROW_PADDING || 8);
                                    }, 0) }}
                                >
                                    {/* iv. Simple line-based swimlanes for RegionGanttChart */}
                                    {/* Vertical month separator lines - responsive to zoom */}
                                    {Array.from({ length: Math.ceil(totalWidth / responsiveConstants.MONTH_WIDTH) }, (_, i) => (
                                        <line
                                            key={`month-line-${i}`}
                                            x1={i * responsiveConstants.MONTH_WIDTH}
                                            y1="0"
                                            x2={i * responsiveConstants.MONTH_WIDTH}
                                            y2={getScaledFilteredData().reduce((total, project) => {
                                                const projectRowHeight = calculateRowHeight(project.name);
                                                return total + projectRowHeight + (responsiveConstants.ROW_PADDING || 8);
                                            }, 0)}
                                            stroke="rgba(0,0,0,0.1)"
                                            strokeWidth="1"
                                        />
                                    ))}
                                    {getScaledFilteredData().map((project, index) => {
                                        const projectRowHeight = calculateRowHeight(project.name);
                                        const yOffset = getScaledFilteredData().slice(0, index).reduce((total, p) => {
                                            const pRowHeight = calculateRowHeight(p.name);
                                            return total + pRowHeight + (responsiveConstants.ROW_PADDING || 8);
                                        }, 0);

                                        const milestones = processMilestonesWithPosition(project.milestones || [], startDate, responsiveConstants.MONTH_WIDTH);

                                        return (
                                            <g key={`project-${project.id}`} className="project-group">
                                                {/* Project bars - simplified single bar per project */}
                                                {(() => {
                                                    const projectStartDate = parseDate(project.startDate, `${project.name} - Project Start`);
                                                    const projectEndDate = parseDate(project.endDate, `${project.name} - Project End`);
                                                    if (!projectStartDate || !projectEndDate) return null;

                                                    // Skip projects that don't overlap with timeline range
                                                    if (projectStartDate > endDate || projectEndDate < startDate) {
                                                        return null;
                                                    }

                                                    // Calculate pixel positions for GanttBar
                                                    const startX = calculatePosition(projectStartDate, startDate, responsiveConstants.MONTH_WIDTH);
                                                    const endX = calculatePosition(projectEndDate, startDate, responsiveConstants.MONTH_WIDTH);
                                                    const width = Math.max(endX - startX, 2); // Minimum 2px width
                                                    const yPos = yOffset + (projectRowHeight - responsiveConstants.TOUCH_TARGET_SIZE) / 2;

                                                    return (
                                                        <GanttBar
                                                            key={`${project.id}-bar`}
                                                            data={project}
                                                            y={yPos}
                                                            startX={startX}
                                                            width={width}
                                                            height={responsiveConstants.TOUCH_TARGET_SIZE}
                                                            color="#9ca3af"
                                                            label={project.name}
                                                            status={project.status}
                                                        />
                                                    );
                                                })()}

                                                {/* Milestones */}
                                                {milestones.map((milestone, milestoneIndex) => (
                                                    <MilestoneMarker
                                                        key={`${project.id}-milestone-${milestoneIndex}`}
                                                        x={milestone.x}
                                                        y={yOffset + (projectRowHeight - responsiveConstants.TOUCH_TARGET_SIZE) / 2 + (responsiveConstants.TOUCH_TARGET_SIZE / 2)}
                                                        complete={milestone.status === 'Complete'}
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
            )}
        </div>
    );
};

export default RegionRoadMap;