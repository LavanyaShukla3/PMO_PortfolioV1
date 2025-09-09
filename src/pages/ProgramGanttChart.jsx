import React, { useState, useEffect, useRef } from 'react';
import TimelineAxis from '../components/TimelineAxis';
import MilestoneMarker from '../components/MilestoneMarker';
import { getTimelineRange, parseDate, calculatePosition, calculateMilestonePosition, groupMilestonesByMonth, getMonthlyLabelPosition, createVerticalMilestoneLabels, getInitialScrollPosition, truncateLabel } from '../utils/dateUtils';
import { processProgramData } from '../services/apiDataService';
import { differenceInDays } from 'date-fns';

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
        PROGRAM_BAR_HEIGHT: 8,
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
        PROGRAM_BAR_HEIGHT: 12,
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
        BASE_BAR_HEIGHT: 14,
        PROGRAM_BAR_HEIGHT: 16,
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
        BASE_BAR_HEIGHT: 18,
        PROGRAM_BAR_HEIGHT: 20,
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
// Updated: Now processes only SG3 milestones (filtered in dataService.js)
const processMilestonesWithPosition = (milestones, startDate, monthWidth = 100, projectEndDate = null) => {
    if (!milestones?.length) return [];

    // Display3: Group milestones by month
    const monthlyGroups = groupMilestonesByMonth(milestones);
    const maxInitialWidth = monthWidth * 8; // Allow intelligent calculation up to 8 months
    
    console.log('🚀 ProgramGanttChart: processMilestonesWithPosition called with updated logic!');
    console.log('🚀 Month width:', monthWidth, 'Max initial width:', maxInitialWidth);

    const processedMilestones = [];

    // Process each monthly group
    Object.entries(monthlyGroups).forEach(([monthKey, monthMilestones]) => {
        // Determine label position for this month (odd = above, even = below)
        const labelPosition = getMonthlyLabelPosition(monthKey);

        // STRICT RULES: Only vertical stacking allowed, no horizontal layout
        // RULE 1: One milestone label per month with alternating positions
        // RULE 2: Multiple milestones stacked vertically with intelligent width calculation
        console.log('🎯 Processing monthly group:', monthKey, 'with', monthMilestones.length, 'milestones');
        console.log('🎯 Max initial width:', maxInitialWidth, 'Month width:', monthWidth);
        console.log('🎯 All project milestones:', milestones.length);
        console.log('🎯 Sample milestone data:', milestones[0]); // NEW: Debug milestone structure
        
        const verticalLabels = createVerticalMilestoneLabels(monthMilestones, maxInitialWidth, '14px', milestones, monthWidth);
        const horizontalLabel = ''; // Disabled to enforce strict vertical stacking

        console.log('🎯 Vertical labels result:', verticalLabels);

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

const ProgramGanttChart = ({ selectedPortfolioId, selectedPortfolioName, onBackToPortfolio, onDrillToSubProgram }) => {
    const [processedData, setProcessedData] = useState([]);
    const [filteredData, setFilteredData] = useState([]);
    const [selectedProgram, setSelectedProgram] = useState('All');
    const [zoomLevel, setZoomLevel] = useState(1.0);
    const [responsiveConstants, setResponsiveConstants] = useState(getResponsiveConstants(1.0));
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [dataVersion, setDataVersion] = useState(0); // Add version tracking for re-renders

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

    // Load data from API
    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);
                setError(null);
                
                const data = await processProgramData(selectedPortfolioId);
                setProcessedData(data);
                setFilteredData(data);
                setDataVersion(prev => prev + 1); // Increment version to trigger re-render

                // Initial scroll to show current month - 1 (Aug 2025 if current is Sep 2025)
                setTimeout(() => {
                    if (timelineScrollRef.current) {
                        // Use utility function to calculate proper scroll position
                        const scrollPosition = getInitialScrollPosition(responsiveConstants.MONTH_WIDTH);

                        timelineScrollRef.current.scrollLeft = scrollPosition;
                        // Sync gantt scroll position
                        if (ganttScrollRef.current) {
                            ganttScrollRef.current.scrollLeft = scrollPosition;
                        }
                    }
                }, 100);
            } catch (err) {
                console.error('❌ Failed to load program data from API:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [selectedPortfolioId, responsiveConstants.MONTH_WIDTH]);

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

    // Get unique program names for the dropdown
    const programNames = ['All', ...Array.from(new Set(processedData
        .filter(item => item.isProgram)
        .map(item => item.name)
    ))];

    const handleProgramChange = (e) => {
        const value = e.target.value;
        setSelectedProgram(value);

        if (value === 'All') {
            setFilteredData(processedData);
        } else {
            // Filter to show selected program and its children
            const selectedProgramData = processedData.find(item => 
                item.isProgram && item.name === value
            );
            
            if (selectedProgramData) {
                const programAndChildren = processedData.filter(item => 
                    item.parentId === selectedProgramData.id || item.id === selectedProgramData.id
                );
                setFilteredData(programAndChildren);
            } else {
                setFilteredData([]);
            }
        }
        
        setDataVersion(prev => prev + 1); // Force re-render to ensure milestones are properly loaded
    };

    // Apply project scaling based on zoom level and create hierarchical grouping for "All" view
    const getScaledFilteredData = () => {
        let dataToProcess = filteredData;
        
        // If showing "All", create hierarchical grouping
        if (selectedProgram === 'All') {
            const hierarchicalData = [];
            
            // Group by program names
            const programGroups = {};
            dataToProcess.forEach(item => {
                if (item.isProgram) {
                    // This is a program header
                    const programName = item.name;
                    if (!programGroups[programName]) {
                        programGroups[programName] = {
                            program: item,
                            children: []
                        };
                    }
                } else {
                    // This is a sub-program, find its parent
                    const parentProgram = dataToProcess.find(p => p.isProgram && p.id === item.parentId);
                    if (parentProgram) {
                        const programName = parentProgram.name;
                        if (!programGroups[programName]) {
                            programGroups[programName] = {
                                program: parentProgram,
                                children: []
                            };
                        }
                        programGroups[programName].children.push(item);
                    }
                }
            });
            
            // Create flat list with proper hierarchy: program header + indented children
            Object.values(programGroups).forEach(group => {
                // Add program header with special flag
                hierarchicalData.push({
                    ...group.program,
                    isProgramHeader: true,
                    displayName: `📌 ${group.program.name}`,
                    originalName: group.program.name
                });
                
                // Add indented children
                group.children.forEach(child => {
                    hierarchicalData.push({
                        ...child,
                        isChildItem: true,
                        displayName: `   ${child.name}`, // Indent with spaces
                        originalName: child.name
                    });
                });
            });
            
            dataToProcess = hierarchicalData;
        }
        
        const projectScale = responsiveConstants.PROJECT_SCALE;
        if (projectScale >= 1.0) {
            // Zooming out - show more projects (no change needed, show all)
            return dataToProcess;
        } else {
            // Zooming in - show fewer projects
            const targetCount = Math.max(1, Math.round(dataToProcess.length * projectScale));
            return dataToProcess.slice(0, targetCount);
        }
    };

    const calculateMilestoneLabelHeight = (milestones, monthWidth = 100) => {
        if (!milestones?.length) return { total: 0, above: 0, below: 0 };

        // Process milestones to get their positions and grouping info
        const processedMilestones = processMilestonesWithPosition(milestones, startDate, monthWidth);

        let maxAboveHeight = 0;
        let maxBelowHeight = 0;
        const LINE_HEIGHT = 12;
        const COMPACT_LABEL_PADDING = 1; // Minimal padding for labels
        const COMPACT_ABOVE_OFFSET = 1; // Minimal space above bar - very close to marker
        const COMPACT_BELOW_OFFSET = 1; // Minimal space below bar - very close to marker

        let hasAnyLabels = false;

        processedMilestones.forEach(milestone => {
            if (milestone.isMonthlyGrouped) {
                // Display3: Monthly grouped milestones - height depends on actual layout
                let labelHeight = 0;
                if (milestone.horizontalLabel && milestone.horizontalLabel.trim()) {
                    // Horizontal layout: single line
                    labelHeight = LINE_HEIGHT;
                    hasAnyLabels = true;
                } else if (milestone.verticalLabels?.length > 0) {
                    // Vertical layout: multiple lines, but only count non-empty labels
                    const nonEmptyLabels = milestone.verticalLabels.filter(label => label && label.trim());
                    labelHeight = nonEmptyLabels.length * LINE_HEIGHT;
                    if (nonEmptyLabels.length > 0) hasAnyLabels = true;
                }

                if (labelHeight > 0) {
                    if (milestone.labelPosition === 'above') {
                        maxAboveHeight = Math.max(maxAboveHeight, labelHeight + COMPACT_ABOVE_OFFSET);
                    } else {
                        maxBelowHeight = Math.max(maxBelowHeight, labelHeight + COMPACT_BELOW_OFFSET);
                    }
                }
            } else if (milestone.isGrouped && milestone.groupLabels?.length > 0) {
                // Display2: Legacy grouped milestones - only count non-empty labels
                const nonEmptyGroupLabels = milestone.groupLabels.filter(label => label && label.trim());
                if (nonEmptyGroupLabels.length > 0) {
                    const groupHeight = nonEmptyGroupLabels.length * LINE_HEIGHT;
                    maxBelowHeight = Math.max(maxBelowHeight, groupHeight + COMPACT_LABEL_PADDING);
                    hasAnyLabels = true;
                }
            } else if (milestone.label && milestone.label.trim()) {
                // Display2: Legacy individual milestones - only count if label exists
                hasAnyLabels = true;
                if (milestone.labelPosition === 'above') {
                    maxAboveHeight = Math.max(maxAboveHeight, COMPACT_ABOVE_OFFSET);
                } else {
                    maxBelowHeight = Math.max(maxBelowHeight, COMPACT_BELOW_OFFSET);
                }
            }
        });

        // Return detailed breakdown for better spacing calculations
        return {
            total: hasAnyLabels ? (maxAboveHeight + maxBelowHeight) : 0,
            above: hasAnyLabels ? maxAboveHeight : 0,
            below: hasAnyLabels ? maxBelowHeight : 0
        };
    };

    const calculateBarHeight = (project) => {
        const isProgram = project.isProgram;
        const isProgramHeader = project.isProgramHeader;
        
        // STEP 1: Calculate actual Gantt bar height (fixed)
        const ganttBarHeight = isProgramHeader ? 14 : 12; // Fixed height for the actual bar
        
        // STEP 2: Calculate milestone label space needed (detailed breakdown)
        const milestoneHeights = calculateMilestoneLabelHeight(project.milestones, responsiveConstants.MONTH_WIDTH);
        
        // STEP 3: Calculate project name space (minimal, just enough to display)
        const projectName = project.displayName || project.name || '';
        const estimatedNameWidth = responsiveConstants.LABEL_WIDTH - 16; // Account for padding
        const maxCharsPerLine = Math.max(30, estimatedNameWidth / 7); // More efficient text wrapping
        const textLines = Math.ceil(projectName.length / maxCharsPerLine);
        const lineHeight = Math.round(12 * (responsiveConstants.ZOOM_LEVEL || 1.0)); // Compact line height
        const nameHeight = Math.max(16, textLines * lineHeight); // Just enough for text
        
        // STEP 4: Content-driven height calculation with proper milestone spacing
        // The row height = MAX of:
        // - Space needed for project name in left panel
        // - Space needed for milestone labels above + Gantt bar + milestone labels below in right panel
        const leftPanelNeeds = nameHeight + 8; // Name + minimal padding
        const rightPanelNeeds = milestoneHeights.above + ganttBarHeight + milestoneHeights.below + 8; // Proper vertical stacking
        
        // Use the larger of the two, but keep it compact
        const contentDrivenHeight = Math.max(leftPanelNeeds, rightPanelNeeds);
        
        // STEP 5: Ensure minimum usability
        const minimumHeight = Math.round(28 * (responsiveConstants.ZOOM_LEVEL || 1.0)); // Reduced minimum
        
        return Math.max(minimumHeight, contentDrivenHeight);
    };

    const getTotalHeight = () => {
        const scaledData = getScaledFilteredData();
        const ultraMinimalSpacing = Math.round(1 * (responsiveConstants.ZOOM_LEVEL || 1.0)); // Ultra-minimal spacing - just 1px separation
        return scaledData.reduce((total, project) => {
            const barHeight = calculateBarHeight(project);
            return total + barHeight + ultraMinimalSpacing;
        }, Math.round(8 * (responsiveConstants.ZOOM_LEVEL || 1.0))); // Absolute minimum top margin - just enough to prevent clipping
    };

    return (
        <div className="w-full flex flex-col">
            {/* Loading State */}
            {loading && (
                <div className="flex items-center justify-center p-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <span className="ml-3">Loading program data...</span>
                </div>
            )}

            {/* Error State */}
            {error && (
                <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded m-4">
                    <h3 className="font-semibold">Error Loading Program Data</h3>
                    <p>{error}</p>
                    <button 
                        onClick={() => window.location.reload()} 
                        className="mt-2 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                    >
                        Retry
                    </button>
                </div>
            )}

            {/* Main Content - Only show when not loading and no error */}
            {!loading && !error && (
            <>
            {/* Breadcrumb Navigation */}
            <div className="flex-shrink-0 p-2 sm:p-4">
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
                        {selectedPortfolioName ? (
                            <>
                                <span className="text-gray-400">/</span>
                                <span className="font-medium">{selectedPortfolioName} Programs</span>
                            </>
                        ) : (
                            <>
                                <span className="text-gray-400">/</span>
                                <span className="font-medium">All Programs</span>
                            </>
                        )}
                    </div>
                </div>

                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    {/* Program Selector */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                        <label className="font-medium text-sm sm:text-base">Select Program:</label>
                        <select
                            value={selectedProgram}
                            onChange={handleProgramChange}
                            className="border border-gray-300 rounded px-2 py-1 sm:px-3 sm:py-1 bg-white text-sm sm:text-base"
                            style={{ minHeight: responsiveConstants.TOUCH_TARGET_SIZE }}
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
            </div>

            {/* Fixed Header Area - Timeline Axis */}
            <div className="flex-shrink-0 sticky top-0 z-20 bg-white border-b border-gray-200">
                <div className="relative flex w-full">
                    {/* Sticky Program Names Header */}
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
                {/* Sticky Program Names - Synchronized Scrolling */}
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
                            const ultraMinimalSpacing = Math.round(1 * (responsiveConstants.ZOOM_LEVEL || 1.0)); // Ultra-minimal spacing
                            const topMargin = Math.round(8 * (responsiveConstants.ZOOM_LEVEL || 1.0)); // Absolute minimum top margin - just enough to prevent clipping
                            const yOffset = scaledData
                                .slice(0, index)
                                .reduce((total, p) => total + calculateBarHeight(p) + ultraMinimalSpacing, topMargin);
                            
                            const isProgram = project.isProgram;
                            const isProgramHeader = project.isProgramHeader;
                            const isChildItem = project.isChildItem;
                            
                            return (
                                <div
                                    key={`${project.id}-${index}`}
                                    className={`absolute flex items-start border-b border-gray-100 transition-colors ${
                                        isProgramHeader 
                                            ? 'bg-blue-50 border-blue-200' 
                                            : isProgram 
                                                ? 'bg-gray-100' 
                                                : 'bg-white hover:bg-gray-50'
                                    }`}
                                    style={{
                                        top: yOffset,
                                        height: calculateBarHeight(project),
                                        paddingTop: '2px', // Minimal top padding - just enough to avoid clipping
                                        paddingLeft: responsiveConstants.TOUCH_TARGET_SIZE > 24 ? '12px' : '8px',
                                        fontSize: isProgramHeader ? 
                                            `calc(${responsiveConstants.FONT_SIZE} * 1.1)` : 
                                            responsiveConstants.FONT_SIZE,
                                        width: '100%',
                                        cursor: 'default',
                                        minHeight: responsiveConstants.TOUCH_TARGET_SIZE,
                                        fontWeight: (isProgram || isProgramHeader) ? 600 : 'normal',
                                        textTransform: (isProgram || isProgramHeader) ? 'uppercase' : 'none',
                                    }}
                                >
                                    <div className="flex items-center justify-between w-full h-full">
                                        <div className="flex flex-col justify-center flex-1 py-2">
                                            <span className={`pr-2 leading-tight ${
                                                isProgramHeader ? 'font-bold text-blue-900' :
                                                isProgram ? 'font-semibold text-gray-800' :
                                                'font-medium text-gray-700'
                                            }`} 
                                            title={project.originalName || project.name}
                                            style={{
                                                wordBreak: 'break-word',
                                                overflowWrap: 'break-word',
                                                lineHeight: '1.2',
                                                maxWidth: `${responsiveConstants.LABEL_WIDTH - 24}px`
                                            }}>
                                                {project.displayName || project.name}
                                            </span>
                                        </div>
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
                            key={`program-gantt-${selectedProgram}-${dataVersion}`} // Add key to force re-render
                            width={totalWidth}
                            style={{
                                height: Math.max(400, getTotalHeight()),
                                touchAction: 'pan-x pan-y' // Enable smooth touch scrolling
                            }}
                            className="block"
                        >
                            {getScaledFilteredData().map((project, index) => {
                                // Calculate cumulative Y offset with ultra-minimal spacing to pack rows ultra-tightly
                                const scaledData = getScaledFilteredData();
                                const ultraMinimalSpacing = Math.round(1 * (responsiveConstants.ZOOM_LEVEL || 1.0)); // Ultra-minimal spacing
                                const topMargin = Math.round(8 * (responsiveConstants.ZOOM_LEVEL || 1.0)); // Absolute minimum top margin - just enough to prevent clipping
                                const yOffset = scaledData
                                    .slice(0, index)
                                    .reduce((total, p) => total + calculateBarHeight(p) + ultraMinimalSpacing, topMargin);

                                const projectStartDate = parseDate(project.startDate);
                                const projectEndDate = parseDate(project.endDate);
                                const startX = calculatePosition(projectStartDate, startDate, responsiveConstants.MONTH_WIDTH);
                                const endX = calculatePosition(projectEndDate, startDate, responsiveConstants.MONTH_WIDTH);
                                const width = endX - startX;
                                
                                // Debug: Log date parsing for first few projects
                                if (index < 2) {
                                    console.log(`🗓️ Project "${project.name}" dates:`, {
                                        rawStart: project.startDate,
                                        rawEnd: project.endDate,
                                        parsedStart: projectStartDate,
                                        parsedEnd: projectEndDate,
                                        startX,
                                        endX,
                                        width,
                                        isProgramHeader: project.isProgramHeader
                                    });
                                }

                                // Calculate the project's actual content height
                                const totalHeight = calculateBarHeight(project);
                                
                                // Get detailed milestone label height breakdown
                                const milestoneHeights = calculateMilestoneLabelHeight(project.milestones, responsiveConstants.MONTH_WIDTH);
                                
                                // Position Gantt bar accounting for milestone labels above it
                                const ganttBarY = yOffset + Math.round(8 * (responsiveConstants.ZOOM_LEVEL || 1.0)) + milestoneHeights.above;
                                const milestoneY = ganttBarY + 6; // Center milestones with the 12px bar

                                // Process milestones with position information
                                const milestones = processMilestonesWithPosition(project.milestones, startDate, responsiveConstants.MONTH_WIDTH, projectEndDate);

                                const isProgram = project.isProgram;
                                const isProgramHeader = project.isProgramHeader;

                                return (
                                    <g key={`project-${project.id}-${index}`} className="project-group">
                                        {/* Background highlight for program row - only as tall as needed */}
                                        {(isProgram || isProgramHeader) && (
                                            <rect
                                                x={0}
                                                y={yOffset}
                                                width={totalWidth}
                                                height={totalHeight}
                                                fill={isProgramHeader ? "#e0f2fe" : "#f0f9ff"}
                                                opacity={0.5}
                                            />
                                        )}

                                        {/* Render Gantt bars for projects with valid dates, including program headers with investment data */}
                                        {projectStartDate && projectEndDate && (
                                            <>
                                                {/* Render bar - positioned based on actual content needs */}
                                                <rect
                                                    key={`bar-${project.id}`}
                                                    x={startX}
                                                    y={ganttBarY}
                                                    width={Math.max(width + 2, 4)} // Add 2px to width for milestone alignment
                                                    height={isProgramHeader ? 14 : 12} // Slightly taller bars for program headers
                                                    rx={3} // Keep 3px border radius
                                                    fill={project.status ? statusColors[project.status] : statusColors.Grey}
                                                    className="transition-opacity duration-150 hover:opacity-90 cursor-default"
                                                    stroke={isProgramHeader ? "#1e40af" : "none"} // Blue border for program headers
                                                    strokeWidth={isProgramHeader ? 1 : 0}
                                                />

                                                {/* Render milestones - positioned to align with bar center */}
                                                {milestones.map((milestone, mIndex) => (
                                                    <MilestoneMarker
                                                        key={`${project.id}-milestone-${mIndex}`}
                                                        x={milestone.x}
                                                        y={milestoneY}
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
                                                        // Fix for Issue 1: Only render shape for first milestone in month
                                                        shouldRenderShape={milestone.shouldRenderShape}
                                                        allMilestonesInProject={milestone.allMilestonesInProject}
                                                        currentMilestoneDate={milestone.currentMilestoneDate}
                                                    />
                                                ))}
                                            </>
                                        )}
                                    </g>
                                );
                            })}
                        </svg>
                    </div>
                </div>
            </div>
            </>
            )}
        </div>
    );
};

export default ProgramGanttChart;