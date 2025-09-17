import React, { useState, useEffect, useMemo, useRef } from 'react';
import { fetchRegionData, getRegionFilterOptions } from '../services/progressiveApiService';
import { parseDate, calculatePosition, calculateMilestonePosition, getTimelineRange, groupMilestonesByMonth, getMonthlyLabelPosition, createVerticalMilestoneLabels, getInitialScrollPosition, truncateLabel } from '../utils/dateUtils';
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
        ROW_PADDING: 3 // Minimal padding for maximum compactness
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
        ROW_PADDING: 4 // Reduced padding
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
        ROW_PADDING: 6 // Compact but readable padding
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
        ROW_PADDING: 6 // Moderate padding for larger rows
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
        ROW_PADDING: 8 // Standard padding for largest rows
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

// Milestone label spacing constants (match PortfolioGanttChart)
const LINE_HEIGHT = 12;
const LABEL_PADDING = 1; // Minimal padding for labels
const ABOVE_LABEL_OFFSET = 1; // Minimal space above bar - very close to marker
const BELOW_LABEL_OFFSET = 1; // Minimal space below bar - very close to marker

// Note: truncateLabel and milestone constants are now imported from dateUtils.js

// Display3: Monthly grouped milestone processing logic
// Updated: Now processes only SG3 milestones (filtered in dataService.js)
const processMilestonesWithPosition = (milestones, startDate, monthWidth = 100, projectEndDate = null) => {
    if (!milestones?.length) return [];

    // Display3: Group milestones by month
    const monthlyGroups = groupMilestonesByMonth(milestones);
    const maxInitialWidth = monthWidth * 8; // Allow intelligent calculation up to 8 months
    

    const processedMilestones = [];

    // Process each monthly group
    Object.entries(monthlyGroups).forEach(([monthKey, monthMilestones]) => {
        // Determine label position for this month (odd = above, even = below)
        const labelPosition = getMonthlyLabelPosition(monthKey);

        // STRICT RULES: Only vertical stacking allowed, no horizontal layout
        // RULE 1: One milestone label per month with alternating positions
        // RULE 2: Multiple milestones stacked vertically with intelligent width calculation
        
        const verticalLabels = createVerticalMilestoneLabels(monthMilestones, maxInitialWidth, '14px', milestones, monthWidth);
        const horizontalLabel = ''; // Disabled to enforce strict vertical stacking


        // Process each milestone in the month
        monthMilestones.forEach((milestone, index) => {
            const milestoneDate = parseDate(milestone.date);
            // Use the new milestone positioning function that aligns with bar ends
            const x = calculateMilestonePosition(milestoneDate, startDate, monthWidth, projectEndDate);

            // STRICT RULE FIX: Only the first milestone in each month shows the labels AND the shape
            // This prevents duplicate label rendering AND duplicate shapes for multiple milestones in same month
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
                fullLabel: milestone.label, // Keep original label for tooltips
                shouldRenderShape: isFirstInMonth, // NEW: Only render shape for first milestone in month
                allMilestonesInProject: milestones, // Pass all milestones for ±4 months check
                currentMilestoneDate: milestoneDate // Pass current date for proximity check
            });
        });
    });

    // Sort by date for consistent rendering order
    return processedMilestones.sort((a, b) => a.date - b.date);
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
    
    // Progressive loading state
    const [currentPage, setCurrentPage] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const itemsPerPage = 100; // Increased chunk size to load more data per request

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

    // --- Load FILTER OPTIONS once on initial mount ---
    useEffect(() => {
        setLoading(true);
        getRegionFilterOptions()
            .then(options => {
                setFilterOptions(options);
                setAvailableMarkets(options.markets || []);
            })
            .catch(err => {
                console.error('Failed to load filter options:', err);
                setError(`Failed to load filter options: ${err.message}`);
            })
            .finally(() => {
                // We don't set loading to false here, because the main data is still loading
            });
    }, []); // Empty dependency array [] means this runs ONLY ONCE.

    // --- Load PROJECT DATA whenever filters or pagination changes ---
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            setError(null);
            
            try {
                console.log(`🔍 Loading data for page ${currentPage} with filters:`, filters);

                const regionFilter = filters.region === 'All' ? null : filters.region;
                const marketFilter = filters.market === 'All' ? null : filters.market;
                const functionFilter = filters.function === 'All' ? null : filters.function;
                const tierFilter = filters.tier === 'All' ? null : filters.tier;
                
                const response = await fetchRegionData(regionFilter, { 
                    page: currentPage, 
                    limit: itemsPerPage,
                    market: marketFilter,
                    function: functionFilter,
                    tier: tierFilter
                });
                
                const newData = response.data?.data || [];
                
                // If it's the first page, replace the data. Otherwise, append it.
                if (currentPage === 1) {
                    setProcessedData(newData);
                } else {
                    setProcessedData(prev => [...prev, ...newData]);
                }
                
                setHasMore(response.data?.totalCount > (currentPage * itemsPerPage));
                setTotalItems(response.data?.totalCount || 0);

            } catch (err) {
                console.error('Failed to load region data:', err);
                setError(`Failed to load data: ${err.message}`);
            } finally {
                setLoading(false);
            }
        };

        loadData();

    }, [filters, currentPage]); // This hook is now clean and predictable.

    // Handle initial scroll position after data loads and responsive constants are set
    useEffect(() => {
        if (!loading && timelineScrollRef.current && responsiveConstants.MONTH_WIDTH) {
            // Use utility function to calculate proper scroll position to show current month - 1
            const scrollPosition = getInitialScrollPosition(responsiveConstants.MONTH_WIDTH);
            timelineScrollRef.current.scrollLeft = scrollPosition;
            // Sync gantt scroll position
            if (ganttScrollRef.current) {
                ganttScrollRef.current.scrollLeft = scrollPosition;
            }
        }
    }, [loading, responsiveConstants.MONTH_WIDTH]);

    // Simple market update when region filter changes
    useEffect(() => {
        if (filterOptions.markets?.length > 0) {
            if (filters.region === 'All') {
                setAvailableMarkets(filterOptions.markets);
            } else {
                // For simplicity, show all markets when a specific region is selected
                // The backend filtering will handle the actual filtering
                setAvailableMarkets(filterOptions.markets);
            }
        }
    }, [filters.region, filterOptions.markets]);

    // Simple function to handle loading more data
    const loadMoreData = () => {
        if (hasMore && !loading) {
            setCurrentPage(prev => prev + 1);
        }
    };

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
        
        console.log(`🔍 CHECKING PROJECT "${project.name}":`, {
            rawStartDate: project.startDate,
            rawEndDate: project.endDate,
            parsedStart: projectStartDate?.toISOString().split('T')[0],
            parsedEnd: projectEndDate?.toISOString().split('T')[0],
            timelineStart: startDate.toISOString().split('T')[0],
            timelineEnd: endDate.toISOString().split('T')[0]
        });
        
        if (!projectStartDate || !projectEndDate) {
            console.log(`❌ Project "${project.name}" has invalid dates - EXCLUDED`);
            return false;
        }

        // Project overlaps if it starts before timeline ends AND ends after timeline starts
        const isWithinRange = projectStartDate <= endDate && projectEndDate >= startDate;
        
        if (!isWithinRange) {
            console.log(`❌ Project "${project.name}" outside timeline range - EXCLUDED`);
        } else {
            console.log(`✅ Project "${project.name}" within timeline range - INCLUDED`);
        }
        
        return isWithinRange;
    };

    // Filter projects to only include those within the timeline range
    const timelineFilteredData = useMemo(() => {
        console.log(`🔍 TIMELINE FILTERING DEBUG:`);
        console.log(`📊 Total processedData records: ${processedData.length}`);
        console.log(`📅 Timeline Range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
        
        // Log first few projects for debugging
        if (processedData.length > 0) {
            console.log(`📋 Sample projects:`, processedData.slice(0, 3).map(p => ({
                name: p.name,
                startDate: p.startDate,
                endDate: p.endDate,
                hasPhases: !!p.phases,
                phaseCount: p.phases?.length || 0
            })));
        }
        
        const filtered = processedData.filter(project => isProjectWithinTimelineRange(project));
        
        console.log(`✅ Timeline Filtering Result: ${filtered.length} of ${processedData.length} projects remain`);
        console.log(`❌ ${processedData.length - filtered.length} projects filtered out by timeline range`);
        
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

    // Phase colors mapping
    const phaseColors = {
        'Initiate': '#c1e5f5',
        'Evaluate': '#f6c6ad',
        'Develop': '#84e291',
        'Deploy': '#e59edd',
        'Sustain': '#156082',
        'Close': '#006400'
    };

    // PHASE_COLORS for Gantt bars (similar to SubProgram page)
    const PHASE_COLORS = {
        'Initiate': '#c1e5f5',
        'Evaluate': '#f6c6ad', 
        'Develop': '#84e291',
        'Deploy': '#e59edd',
        'Sustain': '#156082',
        'Close': '#006400',
        'Build': '#4F46E5',
        'Build - Scale': '#6366F1',
        'Implementation': '#8B5CF6',
        'Design': '#F59E0B',
        'Planning': '#06B6D4',
        'Testing': '#EF4444',
        'Unphased': '#9CA3AF', // Gray for projects without phases
        'Project': '#9CA3AF'   // Gray for single project bars
    };

    // Function to handle filter changes that resets the page to 1
    const handleFilterChange = (filterType, value) => {
        setFilters(prev => ({
            ...prev,
            [filterType]: value,
            // If the region changes, reset the market filter
            ...(filterType === 'region' && { market: 'All' })
        }));
        // CRITICAL: Reset to page 1 to start a new filtered search
        setCurrentPage(1);
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
            return timelineFilteredData;
        } else {
            const targetCount = Math.max(1, Math.round(timelineFilteredData.length * projectScale));
            return timelineFilteredData.slice(0, targetCount);
        }
    };

    // Calculate height needed for milestone labels to prevent overlap with bars
    const calculateMilestoneLabelHeight = (milestones, monthWidth) => {
        try {
            if (!milestones || milestones.length === 0) {
                return { total: 0, above: 0, below: 0 };
            }

            const monthlyGroups = groupMilestonesByMonth(milestones);
            let maxAboveHeight = 0;
            let maxBelowHeight = 0;

            Object.entries(monthlyGroups).forEach(([monthKey, monthMilestones]) => {
                const labelPosition = getMonthlyLabelPosition(monthKey);
                const stackedLabels = createVerticalMilestoneLabels(
                    monthMilestones, 
                    monthWidth * 8,
                    '14px',
                    milestones,
                    monthWidth
                );

                // Add null check and ensure stackedLabels is a string
                if (stackedLabels && typeof stackedLabels === 'string') {
                    const labelHeight = stackedLabels.split('\n').length * LINE_HEIGHT + LABEL_PADDING;

                    if (labelPosition === 'above') {
                        maxAboveHeight = Math.max(maxAboveHeight, labelHeight + ABOVE_LABEL_OFFSET);
                    } else {
                        maxBelowHeight = Math.max(maxBelowHeight, labelHeight + BELOW_LABEL_OFFSET);
                    }
                } else {
                    // Fallback if stackedLabels is not a string
                    const fallbackHeight = 20; // Default height for one line
                    if (labelPosition === 'above') {
                        maxAboveHeight = Math.max(maxAboveHeight, fallbackHeight + ABOVE_LABEL_OFFSET);
                    } else {
                        maxBelowHeight = Math.max(maxBelowHeight, fallbackHeight + BELOW_LABEL_OFFSET);
                    }
                }
            });

            return {
                total: maxAboveHeight + maxBelowHeight,
                above: maxAboveHeight,
                below: maxBelowHeight
            };
        } catch (error) {
            console.warn('Error calculating milestone label height:', error);
            return { total: 60, above: 30, below: 30 };
        }
    };

    // Helper function to estimate text height for wrapped text
    const estimateTextHeight = (text, fontSize, containerWidth) => {
        if (!text) return fontSize;
        
        const averageCharWidth = fontSize * 0.6;
        const availableWidth = containerWidth - 16;
        const charsPerLine = Math.floor(availableWidth / averageCharWidth);
        
        if (charsPerLine <= 0) return fontSize;
        
        const lines = Math.ceil(text.length / charsPerLine);
        return lines * (fontSize * 1.2);
    };

    const calculateRowHeight = (projectName = '', milestones = [], projectStartDate = null, projectEndDate = null, startDate = null, endDate = null) => {
        const baseBarHeight = 12;
        const fontSize = parseInt(responsiveConstants.FONT_SIZE) || 14;
        
        const milestoneHeights = calculateMilestoneLabelHeight(milestones, responsiveConstants.MONTH_WIDTH);
        
        const labelWidth = responsiveConstants.LABEL_WIDTH || 200;
        const estimatedTextHeight = estimateTextHeight(projectName, fontSize, labelWidth);
        const minTextHeight = Math.max(fontSize + 4, estimatedTextHeight + 4);
        
        const hasValidBar = projectStartDate && projectEndDate && startDate && endDate &&
                          !(projectStartDate > endDate || projectEndDate < startDate);
        
        let contentHeight;
        
        if (hasValidBar) {
            contentHeight = milestoneHeights.above + baseBarHeight + milestoneHeights.below;
        } else {
            const minimalMilestoneSpace = 8;
            contentHeight = milestoneHeights.above + minimalMilestoneSpace + milestoneHeights.below;
        }
        
        const finalHeight = Math.max(minTextHeight, contentHeight) + 2;
        return finalHeight;
    };

    return (
        <div className="w-full flex flex-col relative">
            {/* Status Badge - Top Right (matches ProgramGanttChart) */}
            {loading && (
                <div className="absolute top-4 right-4 z-50 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium shadow-md flex items-center gap-2">
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                    Loading data...
                </div>
            )}

            {/* Error State */}
            {error && (
                <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded m-4">
                    <h3 className="font-semibold">Error Loading Region Data</h3>
                    <p>{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 mt-2"
                    >
                        Retry
                    </button>
                </div>
            )}

            {/* Main Content - Show when data is available or when not loading */}
            {(processedData.length > 0 || !loading) && !error && (
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
                                        const projectStartDate = parseDate(project.startDate, `${project.name} - Project Start`);
                                        const projectEndDate = parseDate(project.endDate, `${project.name} - Project End`);
                                        const projectRowHeight = calculateRowHeight(project.name, project.milestones, projectStartDate, projectEndDate, startDate, endDate);
                                        return total + projectRowHeight + 1; // Minimal 1px spacing
                                    }, Math.round(10 * (responsiveConstants.ZOOM_LEVEL || 1.0))) }}>
                                        {getScaledFilteredData().map((project, index) => {
                                            const projectStartDate = parseDate(project.startDate, `${project.name} - Project Start`);
                                            const projectEndDate = parseDate(project.endDate, `${project.name} - Project End`);
                                            const projectRowHeight = calculateRowHeight(project.name, project.milestones, projectStartDate, projectEndDate, startDate, endDate);
                                            const minimalSpacing = 1; // Just 1px for visual separation between projects
                                            const topMargin = Math.round(8 * (responsiveConstants.ZOOM_LEVEL || 1.0)); // Absolute minimum top margin - just enough to prevent clipping
                                            const yOffset = getScaledFilteredData().slice(0, index).reduce((total, p) => {
                                                const pStartDate = parseDate(p.startDate, `${p.name} - Project Start`);
                                                const pEndDate = parseDate(p.endDate, `${p.name} - Project End`);
                                                const pRowHeight = calculateRowHeight(p.name, p.milestones, pStartDate, pEndDate, startDate, endDate);
                                                return total + pRowHeight + minimalSpacing;
                                            }, topMargin);
                                            return (
                                                <div
                                                    key={project.id}
                                                    className="absolute flex flex-col justify-start border-b border-gray-100 bg-gray-50/30 hover:bg-gray-100/50 transition-colors"
                                                    style={{
                                                        top: yOffset,
                                                        height: projectRowHeight,
                                                        paddingLeft: responsiveConstants.TOUCH_TARGET_SIZE > 24 ? '8px' : '6px',
                                                        paddingTop: '1px',
                                                        paddingBottom: '1px',
                                                        fontSize: responsiveConstants.FONT_SIZE,
                                                        lineHeight: '1.2',
                                                        width: '100%',
                                                        cursor: 'default'
                                                    }}
                                                >
                                                    <div className="flex items-start justify-between w-full h-full">
                                                        <div className="flex flex-col justify-start flex-1 min-w-0 h-full">
                                                            <span 
                                                                className="font-medium text-gray-800 pr-2 leading-tight" 
                                                                title={project.name}
                                                                style={{
                                                                    wordBreak: 'break-word',
                                                                    whiteSpace: 'normal',
                                                                    lineHeight: '1.2',
                                                                    fontSize: responsiveConstants.FONT_SIZE
                                                                }}
                                                            >
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
                                                const projectStartDate = parseDate(project.startDate, `${project.name} - Project Start`);
                                                const projectEndDate = parseDate(project.endDate, `${project.name} - Project End`);
                                                const projectRowHeight = calculateRowHeight(project.name, project.milestones, projectStartDate, projectEndDate, startDate, endDate);
                                                return total + projectRowHeight + 1; // Minimal 1px spacing
                                            }, Math.round(10 * (responsiveConstants.ZOOM_LEVEL || 1.0)))}
                                            style={{ height: getScaledFilteredData().reduce((total, project) => {
                                                const projectStartDate = parseDate(project.startDate, `${project.name} - Project Start`);
                                                const projectEndDate = parseDate(project.endDate, `${project.name} - Project End`);
                                                const projectRowHeight = calculateRowHeight(project.name, project.milestones, projectStartDate, projectEndDate, startDate, endDate);
                                                return total + projectRowHeight + 1; // Minimal 1px spacing
                                            }, Math.round(10 * (responsiveConstants.ZOOM_LEVEL || 1.0))) }}
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
                                                        const projectStartDate = parseDate(project.startDate, `${project.name} - Project Start`);
                                                        const projectEndDate = parseDate(project.endDate, `${project.name} - Project End`);
                                                        const projectRowHeight = calculateRowHeight(project.name, project.milestones, projectStartDate, projectEndDate, startDate, endDate);
                                                        return total + projectRowHeight + 1; // Minimal 1px spacing
                                                    }, Math.round(10 * (responsiveConstants.ZOOM_LEVEL || 1.0)))}
                                                    stroke="rgba(0,0,0,0.1)"
                                                    strokeWidth="1"
                                                />
                                            ))}
                                            {getScaledFilteredData().map((project, index) => {
                                                // Parse project dates first for accurate row height calculation
                                                const projectStartDate = parseDate(project.startDate, `${project.name} - Project Start`);
                                                const projectEndDate = parseDate(project.endDate, `${project.name} - Project End`);
                                                
                                                const projectRowHeight = calculateRowHeight(project.name, project.milestones, projectStartDate, projectEndDate, startDate, endDate);
                                                const minimalSpacing = 1; // Just 1px for visual separation between projects
                                                const topMargin = Math.round(8 * (responsiveConstants.ZOOM_LEVEL || 1.0)); // Absolute minimum top margin - just enough to prevent clipping
                                                
                                                // Calculate row Y position with minimal spacing
                                                const yOffset = getScaledFilteredData().slice(0, index).reduce((total, p) => {
                                                    const pStartDate = parseDate(p.startDate, `${p.name} - Project Start`);
                                                    const pEndDate = parseDate(p.endDate, `${p.name} - Project End`);
                                                    const pRowHeight = calculateRowHeight(p.name, p.milestones, pStartDate, pEndDate, startDate, endDate);
                                                    return total + pRowHeight + minimalSpacing; // Minimal spacing between rows
                                                }, topMargin);

                                                // Process milestones after we have projectEndDate
                                                const milestones = processMilestonesWithPosition(project.milestones || [], startDate, responsiveConstants.MONTH_WIDTH, projectEndDate);
                                                
                                                // Get detailed milestone height breakdown for proper positioning
                                                const milestoneHeights = calculateMilestoneLabelHeight(project.milestones || [], responsiveConstants.MONTH_WIDTH);
                                                
                                                // Check if this project has a valid bar (both start and end dates within timeline)
                                                const hasValidBar = projectStartDate && projectEndDate && 
                                                                  !(projectStartDate > endDate || projectEndDate < startDate);
                                                
                                                // FIXED: True top-anchoring without any centering inconsistencies
                                                // Bar positioning: immediately after milestone labels above (no centering)
                                                const ganttBarY = yOffset + milestoneHeights.above;
                                                
                                                // CRITICAL FIX: Milestone positioning with true top-anchoring
                                                // For projects WITH bars: milestone aligns with bar top (no centering)
                                                // For projects WITHOUT bars: milestone positioned with minimal space after labels above
                                                const milestoneY = hasValidBar 
                                                    ? ganttBarY  // Align milestone TOP with bar TOP (not center)
                                                    : yOffset + milestoneHeights.above;  // For milestone-only: place at exact top of content area
                                                
                                                // DEBUG LOGGING for positioning
                                                console.log(`🎯 POSITIONING DEBUG for "${project.name.substring(0, 20)}..."`);
                                                console.log(`  📊 yOffset: ${yOffset}`);
                                                console.log(`  📏 milestoneHeights:`, milestoneHeights);
                                                console.log(`  🎯 hasValidBar: ${hasValidBar}`);
                                                console.log(`  📐 ganttBarY: ${ganttBarY}`);
                                                console.log(`  🔴 milestoneY: ${milestoneY}`);
                                                console.log(`  🔵 projectRowHeight: ${projectRowHeight}`);
                                                console.log(`  ---`);

                                                return (
                                                    <g key={`project-${project.id}`} className="project-group">
                                                        {/* Project bars - PHASE-AWARE rendering similar to SubProgram page */}
                                                        {(() => {
                                                            if (!projectStartDate || !projectEndDate) return null;

                                                            // Skip projects that don't overlap with timeline range
                                                            if (projectStartDate > endDate || projectEndDate < startDate) {
                                                                return null;
                                                            }

                                                            // Check if project has phases - using Region data structure
                                                            const hasValidPhases = project.phases && project.phases.length > 0;
                                                            
                                                            // DEBUG: Log phase data structure
                                                            console.log(`🎨 PHASE DEBUG for "${project.name}":`, {
                                                                hasPhases: !!project.phases,
                                                                phasesLength: project.phases?.length || 0,
                                                                phases: project.phases,
                                                                isUnphased: project.isUnphased
                                                            });
                                                            
                                                            const validPhases = hasValidPhases ? project.phases.filter(phase => 
                                                                phase && 
                                                                phase.name && 
                                                                phase.startDate && 
                                                                phase.endDate && 
                                                                phase.startDate.trim() !== '' && 
                                                                phase.endDate.trim() !== ''
                                                            ) : [];
                                                            
                                                            // Check if phases are real phases (not just "Unphased" or "Project")
                                                            const hasRealPhases = validPhases.length > 0 && !validPhases.every(phase => 
                                                                phase.name === 'Unphased' || phase.name === 'Project'
                                                            );

                                                            // DEBUG: More detailed phase validation logging
                                                            if (validPhases.length > 0) {
                                                                console.log(`🎨 PHASE VALIDATION for "${project.name}":`, {
                                                                    validPhasesCount: validPhases.length,
                                                                    hasRealPhases: hasRealPhases,
                                                                    phaseNames: validPhases.map(p => p.name),
                                                                    phaseDetails: validPhases.map(p => ({ name: p.name, start: p.startDate, end: p.endDate })),
                                                                    isUnphased: project.isUnphased
                                                                });
                                                            }
                                                            
                                                            if (hasRealPhases) {
                                                                console.log(`✅ RENDERING PHASES for ${project.name}`);
                                                                // Render individual phase bars - copied from SubProgram logic
                                                                return validPhases.map((phase, phaseIndex) => {
                                                                    const phaseStartDate = parseDate(phase.startDate);
                                                                    const phaseEndDate = parseDate(phase.endDate);
                                                                    
                                                                    if (!phaseStartDate || !phaseEndDate) return null;
                                                                    
                                                                    const x = calculatePosition(phaseStartDate, startDate, responsiveConstants.MONTH_WIDTH);
                                                                    const width = calculatePosition(phaseEndDate, startDate, responsiveConstants.MONTH_WIDTH) - x;
                                                                    
                                                                    if (width <= 0) return null;
                                                                    
                                                                    // Get the phase color
                                                                    const phaseColor = PHASE_COLORS[phase.name] || PHASE_COLORS['Unphased'];
                                                                    
                                                                    console.log(`🎨 Phase rendering: ${phase.name}, color: ${phaseColor}, x: ${x}, width: ${width}`);
                                                                    
                                                                    return (
                                                                        <GanttBar
                                                                            key={`${project.id}-${phase.name}-${phaseIndex}`}
                                                                            data={{
                                                                                ...phase,
                                                                                id: `${project.id}-${phase.name}`,
                                                                                name: `${project.name} - ${phase.name}`
                                                                            }}
                                                                            startX={x}
                                                                            y={ganttBarY}
                                                                            width={width}
                                                                            label={phase.name}
                                                                            status={project.status}
                                                                            color={phaseColor}
                                                                            touchTargetSize={responsiveConstants.TOUCH_TARGET_SIZE}
                                                                            fontSize={responsiveConstants.FONT_SIZE}
                                                                            isMobile={false}
                                                                            zoomLevel={zoomLevel}
                                                                        />
                                                                    );
                                                                });
                                                            } else {
                                                                console.log(`📊 RENDERING SINGLE BAR for ${project.name} (no valid phases)`);
                                                                // Render single project bar for unphased projects
                                                                const startX = calculatePosition(projectStartDate, startDate, responsiveConstants.MONTH_WIDTH);
                                                                const endX = calculatePosition(projectEndDate, startDate, responsiveConstants.MONTH_WIDTH);
                                                                const width = endX - startX;

                                                                // Get status color
                                                                const statusColors = {
                                                                    'Red': '#ef4444',
                                                                    'Amber': '#f59e0b',
                                                                    'Green': '#10b981',
                                                                    'Grey': '#9ca3af',
                                                                    'Yellow': '#E5DE00'
                                                                };

                                                                return (
                                                                    <rect
                                                                        key={`bar-${project.id}`}
                                                                        x={startX}
                                                                        y={ganttBarY}
                                                                        width={Math.max(width + 2, 4)}
                                                                        height={12}
                                                                        rx={3}
                                                                        fill={project.status ? statusColors[project.status] : statusColors.Grey}
                                                                        className="transition-opacity duration-150 hover:opacity-90 cursor-default"
                                                                    >
                                                                        <title>{project.name}</title>
                                                                    </rect>
                                                                );
                                                            }
                                                        })()}

                                                        {/* Milestones - match PortfolioGanttChart positioning */}
                                                        {milestones.map((milestone, milestoneIndex) => (
                                                            <MilestoneMarker
                                                                key={`${project.id}-milestone-${milestoneIndex}`}
                                                                x={milestone.x}
                                                                y={milestoneY} // Use the fixed Y position
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
                                                                // NEW PROPS for the fixes (matching PortfolioGanttChart)
                                                                shouldRenderShape={milestone.shouldRenderShape}
                                                                allMilestonesInProject={milestone.allMilestonesInProject}
                                                                currentMilestoneDate={milestone.currentMilestoneDate}
                                                                // CRITICAL FIX: Tell MilestoneMarker to use top-anchoring instead of centering
                                                                useTopAnchoring={true} // Add this prop to eliminate internal centering
                                                                hasValidBar={hasValidBar} // Pass bar existence info for positioning logic
                                                            />
                                                        ))}
                                                    </g>
                                                );
                                            })}
                                        </svg>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Load More Data Button */}
                            {hasMore && !loading && (
                                <div className="flex justify-center py-4">
                                    <button
                                        onClick={loadMoreData}
                                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                                    >
                                        Load More Data ({totalItems - processedData.length} remaining)
                                    </button>
                                </div>
                            )}
                            
                            {/* Progressive Loading Info */}
                            <div className="text-sm text-gray-600 text-center py-2">
                                Showing {processedData.length} of {totalItems} items
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default RegionRoadMap;