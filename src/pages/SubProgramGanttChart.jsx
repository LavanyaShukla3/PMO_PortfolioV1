import React, { useState, useEffect, useRef } from 'react';
import TimelineAxis from '../components/TimelineAxis';
import MilestoneMarker from '../components/MilestoneMarker';
import { getTimelineRange, parseDate, calculatePosition } from '../utils/dateUtils';
import { processSubProgramData } from '../services/dataService';
import subProgramData from '../services/SubProgramData.json';
import investmentData from '../services/investmentData.json';
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
        MILESTONE_LABEL_HEIGHT: 6,
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
        MILESTONE_LABEL_HEIGHT: 9,
        MILESTONE_FONT_SIZE: '9px',
        PROJECT_SCALE: 1.5, // Show more projects
        ROW_PADDING: 6
    },
    1.0: { // 100% - Default
        MONTH_WIDTH: 100,
        VISIBLE_MONTHS: 13,
        FONT_SIZE: '14px',
        LABEL_WIDTH: 200,
        BASE_BAR_HEIGHT: 16,
        TOUCH_TARGET_SIZE: 24,
        MILESTONE_LABEL_HEIGHT: 12,
        MILESTONE_FONT_SIZE: '10px', // Reduced from default
        PROJECT_SCALE: 1.0, // Normal project count
        ROW_PADDING: 8 // Standard padding
    },
    1.25: { // 125% - Zoom In
        MONTH_WIDTH: 125,
        VISIBLE_MONTHS: 10,
        FONT_SIZE: '16px',
        LABEL_WIDTH: 250,
        BASE_BAR_HEIGHT: 20,
        TOUCH_TARGET_SIZE: 30,
        MILESTONE_LABEL_HEIGHT: 15,
        MILESTONE_FONT_SIZE: '12px',
        PROJECT_SCALE: 0.7, // Show fewer projects
        ROW_PADDING: 12 // More padding for larger rows
    },
    1.5: { // 150% - Maximum Zoom In
        MONTH_WIDTH: 150,
        VISIBLE_MONTHS: 8,
        FONT_SIZE: '18px',
        LABEL_WIDTH: 300,
        BASE_BAR_HEIGHT: 24,
        TOUCH_TARGET_SIZE: 36,
        MILESTONE_LABEL_HEIGHT: 18,
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

const DAYS_THRESHOLD = 16;
const MAX_LABEL_LENGTH = 5;

// Phase colors
const phaseColors = {
    'Initiate': '#c1e5f5',
    'Evaluate': '#f6c6ad',
    'Develop': '#84e291',
    'Deploy': '#e59edd',
    'Sustain': '#156082',
    'Close': '#006400', // dark green as specified
    'Unphased': '#9ca3af' // grey as specified
};

const statusColors = {
    'Red': '#ef4444',
    'Amber': '#f59e0b',
    'Green': '#10b981',
    'Grey': '#9ca3af',
    'Yellow': '#E5DE00'
};

const SubProgramGanttChart = ({ selectedSubProgramId, selectedSubProgramName, onBackToProgram }) => {
    const [processedData, setProcessedData] = useState([]);
    const [filteredData, setFilteredData] = useState([]);
    const [selectedSubProgram, setSelectedSubProgram] = useState('');
    const [zoomLevel, setZoomLevel] = useState(1.0);
    const [responsiveConstants, setResponsiveConstants] = useState(getResponsiveConstants(1.0));

    const timelineScrollRef = useRef(null);
    const ganttScrollRef = useRef(null);
    const leftPanelScrollRef = useRef(null);

    const { startDate } = getTimelineRange();
    const totalWidth = responsiveConstants.MONTH_WIDTH * responsiveConstants.TOTAL_MONTHS;

    // Get unique sub-program names (only the parent sub-programs)
    const subProgramNames = Array.from(new Set(subProgramData
        .filter(item => item.COE_ROADMAP_PARENT_ID === item.CHILD_ID)
        .map(item => item.COE_ROADMAP_PARENT_NAME)
    )).sort();

    // Handle window resize for responsive behavior
    useEffect(() => {
        const handleResize = () => {
            setResponsiveConstants(getResponsiveConstants());
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const data = processSubProgramData();
        setProcessedData(data);

        // Set default sub-program (first in the list)
        if (subProgramNames.length > 0 && !selectedSubProgram) {
            setSelectedSubProgram(subProgramNames[0]);
        }
    }, []);

    useEffect(() => {
        if (selectedSubProgram) {
            // Get the sub-program and its children
            const subProgramData = processedData.filter(item => 
                item.parentName === selectedSubProgram
            );
            setFilteredData(subProgramData);
        }
    }, [selectedSubProgram, processedData]);

    // Auto-select sub-program when a project is drilled down to
    useEffect(() => {
        if (selectedSubProgramId && processedData.length > 0) {
            const subProgram = processedData.find(item => item.id === selectedSubProgramId);
            if (subProgram) {
                setSelectedSubProgram(subProgram.parentName);
            }
        }
    }, [selectedSubProgramId, processedData]);

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

    const handleSubProgramChange = (e) => {
        setSelectedSubProgram(e.target.value);
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

    // Process investment data for the selected sub-program
    const getInvestmentData = (subProgramId) => {
        console.log('Looking for sub-program ID:', subProgramId);
        const data = investmentData.filter(inv => inv.INV_EXT_ID === subProgramId);
        console.log('Found investment data:', data.length, 'records');
        return data;
    };

    // Group tasks by type (Unphased vs Phased)
    const processTasks = (investmentData) => {
        const unphasedTasks = investmentData.filter(inv => 
            inv.ROADMAP_ELEMENT === "Phases" && inv.TASK_NAME === "Unphased"
        );
        
        const phasedTasks = investmentData.filter(inv => 
            inv.ROADMAP_ELEMENT === "Phases" && inv.TASK_NAME !== "Unphased" && 
            ['Initiate', 'Evaluate', 'Develop', 'Deploy', 'Sustain', 'Close'].includes(inv.TASK_NAME)
        );
        
        // Sort phased tasks by phase order
        const phaseOrder = ['Initiate', 'Evaluate', 'Develop', 'Deploy', 'Sustain', 'Close'];
        phasedTasks.sort((a, b) => {
            const aIndex = phaseOrder.indexOf(a.TASK_NAME);
            const bIndex = phaseOrder.indexOf(b.TASK_NAME);
            return aIndex - bIndex;
        });
        
        return { unphasedTasks, phasedTasks };
    };

    // Get milestones for a sub-program
    const getMilestones = (subProgramId) => {
        const milestones = investmentData.filter(inv => 
            inv.INV_EXT_ID === subProgramId &&
            (inv.ROADMAP_ELEMENT === "Milestones - Deployment" || inv.ROADMAP_ELEMENT === "Milestones - Other")
        ).map(milestone => ({
            date: milestone.TASK_START,
            status: milestone.MILESTONE_STATUS,
            label: milestone.TASK_NAME,
            isSG3: false
        }));
        return milestones;
    };

    // Find the next upcoming milestone
    const getNextUpcomingMilestone = (milestones) => {
        const today = new Date();
        const upcomingMilestones = milestones.filter(m => {
            const milestoneDate = parseDate(m.date);
            return milestoneDate && milestoneDate >= today;
        });
        
        return upcomingMilestones.length > 0 ? upcomingMilestones[0] : null;
    };

    const calculateMilestoneLabelHeight = (milestones, monthWidth = 100) => {
        if (!milestones?.length) return 0;

        // Process milestones to get their positions and grouping info
        const processedMilestones = processMilestonesWithPosition(milestones, startDate, monthWidth);
        
        let maxAboveHeight = 0;
        let maxBelowHeight = 0;
        const LINE_HEIGHT = 10; // Reduced from 12
        const LABEL_PADDING = 10; // Reduced from 15
        const ABOVE_LABEL_OFFSET = 10; // Reduced from 15
        const BELOW_LABEL_OFFSET = 12; // Reduced from 20

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
        const nameHeight = responsiveConstants.BASE_BAR_HEIGHT + ((textLines - 1) * Math.round(12 * (responsiveConstants.ZOOM_LEVEL || 1.0)));

        // Calculate height needed for milestone labels (responsive)
        const milestones = getMilestones(project.id);
        const milestoneLabelHeight = calculateMilestoneLabelHeight(milestones, responsiveConstants.MONTH_WIDTH);

        // Add extra height for sub-program rows to make them pop
        const extraHeight = project.isSubProgram ? 10 : 0;

        // Return total height needed: name height + milestone label height + responsive padding
        const basePadding = responsiveConstants.ROW_PADDING || 8;
        const extraPadding = responsiveConstants.TOUCH_TARGET_SIZE > 24 ? Math.round(basePadding * 1.5) : basePadding;
        return nameHeight + milestoneLabelHeight + extraPadding + extraHeight;
    };

    const getTotalHeight = () => {
        const scaledData = getScaledFilteredData();
        const rowSpacing = responsiveConstants.ROW_PADDING || 8;
        return scaledData.reduce((total, project) => {
            const barHeight = calculateBarHeight(project);
            return total + barHeight + rowSpacing;
        }, Math.round(40 * (responsiveConstants.ZOOM_LEVEL || 1.0))); // Responsive top margin
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

    return (
        <div className="w-full">
            {/* Breadcrumb Navigation */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                    {onBackToProgram && (
                        <button
                            onClick={onBackToProgram}
                            className="flex items-center gap-1 text-blue-600 hover:text-blue-800 transition-colors"
                        >
                            ← Back to Program
                        </button>
                    )}
                    {selectedSubProgramName && (
                        <span className="text-gray-400">/</span>
                    )}
                    {selectedSubProgramName && (
                        <span className="font-medium">{selectedSubProgramName}</span>
                    )}
                </div>
            </div>

            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
                {/* Sub-Program Selector */}
                <div className="flex items-center gap-4">
                    <label className="font-medium">Select Sub-Program:</label>
                    <select
                        value={selectedSubProgram}
                        onChange={handleSubProgramChange}
                        className="border border-gray-300 rounded px-3 py-1 bg-white"
                    >
                        {subProgramNames.map((name) => (
                            <option key={name} value={name}>
                                {name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Milestone Legend - Beside Sub-Program */}
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
                    {/* Sticky Sub-Program Names Header */}
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
                            <span className="truncate">Sub-Programs</span>
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
                {/* Sticky Sub-Program Names - Synchronized Scrolling */}
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
                                .reduce((total, p) => total + calculateBarHeight(p) + 4, 6); // Reduced spacing

                            return (
                                <div
                                    key={project.id}
                                    style={{
                                        position: 'absolute',
                                        top: yOffset,
                                        height: calculateBarHeight(project),
                                        display: 'flex',
                                        alignItems: 'center',
                                        paddingLeft: project.isChild ? '20px' : '6px', // Reduced padding
                                        fontSize: responsiveConstants.FONT_SIZE,
                                        borderBottom: '1px solid #f3f4f6',
                                        width: '100%',
                                        background: project.isSubProgram ? '#f0f9ff' : 'rgba(0, 0, 0, 0.015)',
                                        outline: '1px solid rgba(0, 0, 0, 0.08)',
                                        cursor: 'default',
                                        fontWeight: project.isSubProgram ? '700' : '400',
                                        textTransform: project.isSubProgram ? 'uppercase' : 'none',
                                        color: project.isSubProgram ? '#1e40af' : 'inherit'
                                    }}
                                >
                                    <div className="flex items-center justify-between w-full">
                                        <div className="flex flex-col justify-center">
                                            <span className="font-medium text-gray-800 pr-2" title={project.name}>
                                                {project.name}
                                            </span>
                                        </div>
                                        {project.isChild && (
                                            <span className="text-xs text-gray-500 ml-2"></span>
                                        )}
                                        {project.isSubProgram && (
                                            <span className="text-xs text-gray-500 ml-2">📌</span>
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
                            {getScaledFilteredData().map((project, index) => {
                                const scaledData = getScaledFilteredData();
                                const yOffset = scaledData
                                    .slice(0, index)
                                    .reduce((total, p) => total + calculateBarHeight(p) + 4, 6); // Reduced spacing

                                const totalHeight = calculateBarHeight(project);
                                
                                console.log('Rendering project:', project.name, 'ID:', project.id);
                                console.log('Project data:', project);

                                // Get investment data for this sub-program
                                const investmentData = getInvestmentData(project.id);
                                const { unphasedTasks, phasedTasks } = processTasks(investmentData);
                                const milestones = getMilestones(project.id);
                                const nextMilestone = getNextUpcomingMilestone(milestones);
                                return (
                                    <g key={`project-${project.id}`} className="project-group">
                                        {/* Background highlighting for sub-program rows */}
                                        {project.isSubProgram && (
                                            <rect
                                                x={0}
                                                y={yOffset}
                                                width={totalWidth}
                                                height={totalHeight}
                                                fill="#f0f9ff"
                                                opacity={0.3}
                                            />
                                        )}
                                        
                                        {/* Label above the bar for sub-programs */}
                                        {project.isSubProgram && (
                                            <text
                                                x={totalWidth / 2}
                                                y={yOffset + 8}
                                                textAnchor="middle"
                                                style={{
                                                    fontSize: '10px',
                                                    fontWeight: '600',
                                                    fill: '#1e40af',
                                                    fontFamily: 'system-ui, -apple-system, sans-serif'
                                                }}
                                            >
                                                SUB-PROGRAM
                                            </text>
                                        )}
                                        
                                        {/* Render Gantt bars based on phase structure */}
                                        {(() => {
                                            // If there are unphased tasks, render a single grey bar
                                            if (unphasedTasks.length > 0) {
                                                const unphasedTask = unphasedTasks[0];
                                                const startX = calculatePosition(parseDate(unphasedTask.TASK_START), startDate);
                                                const endX = calculatePosition(parseDate(unphasedTask.TASK_FINISH), startDate);
                                                const width = endX - startX;
                                                
                                                return (
                                                    <rect
                                                        key={`unphased-bar-${project.id}`}
                                                        x={startX}
                                                        y={yOffset + (totalHeight - responsiveConstants.TOUCH_TARGET_SIZE) / 2}
                                                        width={Math.max(width, 2)}
                                                        height={responsiveConstants.TOUCH_TARGET_SIZE}
                                                        rx={4}
                                                        fill={phaseColors.Unphased}
                                                        className="transition-opacity duration-150 hover:opacity-90"
                                                    />
                                                );
                                            }
                                            
                                            // If there are phased tasks, render sequential phase bars
                                            if (phasedTasks.length > 0) {
                                                return phasedTasks.map((task, taskIndex) => {
                                                    const startX = calculatePosition(parseDate(task.TASK_START), startDate);
                                                    const endX = calculatePosition(parseDate(task.TASK_FINISH), startDate);
                                                    const width = endX - startX;
                                                    
                                                    return (
                                                        <rect
                                                            key={`phased-bar-${project.id}-${taskIndex}`}
                                                            x={startX}
                                                            y={yOffset + (totalHeight - responsiveConstants.TOUCH_TARGET_SIZE) / 2}
                                                            width={Math.max(width, 2)}
                                                            height={responsiveConstants.TOUCH_TARGET_SIZE}
                                                            rx={4}
                                                            fill={phaseColors[task.TASK_NAME] || phaseColors.Unphased}
                                                            className="transition-opacity duration-150 hover:opacity-90"
                                                        />
                                                    );
                                                });
                                            }
                                            
                                            // Fallback: render a simple bar based on project start/end dates
                                            if (project.startDate && project.endDate) {
                                                return (
                                                    <rect
                                                        key={`fallback-bar-${project.id}`}
                                                        x={calculatePosition(parseDate(project.startDate), startDate)}
                                                        y={yOffset + (totalHeight - responsiveConstants.TOUCH_TARGET_SIZE) / 2}
                                                        width={Math.max(calculatePosition(parseDate(project.endDate), startDate) - calculatePosition(parseDate(project.startDate), startDate), 2)}
                                                        height={responsiveConstants.TOUCH_TARGET_SIZE}
                                                        rx={4}
                                                        fill={project.status ? statusColors[project.status] : statusColors.Grey}
                                                        className="transition-opacity duration-150 hover:opacity-90"
                                                    />
                                                );
                                            }
                                            
                                            return null;
                                        })()}



                                        {/* Process and render milestones with complex positioning logic */}
                                        {(() => {
                                            const processedMilestones = processMilestonesWithPosition(milestones, startDate, responsiveConstants.MONTH_WIDTH);
                                            
                                            return processedMilestones.map((milestone, mIndex) => (
                                                <MilestoneMarker
                                                    key={`${project.id}-milestone-${mIndex}`}
                                                    x={milestone.x}
                                                    y={yOffset + (totalHeight - responsiveConstants.BASE_BAR_HEIGHT) / 2 + (responsiveConstants.BASE_BAR_HEIGHT / 2)}
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
                                                />
                                            ));
                                        })()}
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

export default SubProgramGanttChart;