import React, { useState, useEffect, useRef } from 'react';
import TimelineAxis from '../components/TimelineAxis';
import MilestoneMarker from '../components/MilestoneMarker';
import GanttBar from '../components/GanttBar';
import { getTimelineRange, parseDate, calculatePosition, calculateMilestonePosition, groupMilestonesByMonth, getMonthlyLabelPosition, createVerticalMilestoneLabels, getInitialScrollPosition, truncateLabel, processMilestonesForProject } from '../utils/dateUtils';
import { processSubProgramData } from '../services/apiDataService';

const ZOOM_LEVELS = {
    0.5: { MONTH_WIDTH: 40, VISIBLE_MONTHS: 24, FONT_SIZE: '8px', LABEL_WIDTH: 150, BASE_BAR_HEIGHT: 4, TOUCH_TARGET_SIZE: 20, MILESTONE_LABEL_HEIGHT: 6, MILESTONE_FONT_SIZE: '7px', PROJECT_SCALE: 2.0, ROW_PADDING: 4 },
    0.75: { MONTH_WIDTH: 60, VISIBLE_MONTHS: 18, FONT_SIZE: '10px', LABEL_WIDTH: 180, BASE_BAR_HEIGHT: 6, TOUCH_TARGET_SIZE: 20, MILESTONE_LABEL_HEIGHT: 9, MILESTONE_FONT_SIZE: '9px', PROJECT_SCALE: 1.5, ROW_PADDING: 6 },
    1.0: { MONTH_WIDTH: 80, VISIBLE_MONTHS: 12, FONT_SIZE: '12px', LABEL_WIDTH: 220, BASE_BAR_HEIGHT: 8, TOUCH_TARGET_SIZE: 24, MILESTONE_LABEL_HEIGHT: 12, MILESTONE_FONT_SIZE: '11px', PROJECT_SCALE: 1.0, ROW_PADDING: 8 },
    1.25: { MONTH_WIDTH: 100, VISIBLE_MONTHS: 10, FONT_SIZE: '14px', LABEL_WIDTH: 260, BASE_BAR_HEIGHT: 10, TOUCH_TARGET_SIZE: 28, MILESTONE_LABEL_HEIGHT: 15, MILESTONE_FONT_SIZE: '13px', PROJECT_SCALE: 0.8, ROW_PADDING: 10 },
    1.5: { MONTH_WIDTH: 120, VISIBLE_MONTHS: 8, FONT_SIZE: '16px', LABEL_WIDTH: 300, BASE_BAR_HEIGHT: 12, TOUCH_TARGET_SIZE: 32, MILESTONE_LABEL_HEIGHT: 18, MILESTONE_FONT_SIZE: '15px', PROJECT_SCALE: 0.6, ROW_PADDING: 12 }
};

const PHASE_COLORS = {
    'Initiate': '#1f77b4',    // Blue
    'Evaluate': '#2ca02c',    // Green (maps to Define)
    'Develop': '#9467bd',     // Purple (maps to Design)
    'Deploy': '#ff7f0e',      // Orange (maps to Build)
    'Sustain': '#d62728',     // Red (maps to Qualify)
    'Close': '#17becf',       // Cyan (more visible than dark grey)
    // Keep the original names for backward compatibility
    'Define': '#2ca02c',      // Green
    'Design': '#9467bd',      // Purple
    'Build': '#ff7f0e',       // Orange
    'Qualify': '#d62728',     // Red
    'Unphased': '#c0c0c0'     // Light Grey
};

const STATUS_COLORS = {
    'Red': '#EF4444',
    'Amber': '#F59E0B', 
    'Green': '#10B981',
    'Grey': '#9CA3AF',
    'Yellow': '#EAB308'
};

const SubProgramGanttChart = ({ selectedSubProgramId, selectedSubProgramName, selectedProgramName, onNavigateUp, onBackToProgram }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [zoomLevel, setZoomLevel] = useState(1.0);
    const [selectedProgram, setSelectedProgram] = useState('All');
    const [programNames, setProgramNames] = useState(['All']);
    const [dataVersion, setDataVersion] = useState(0);
    
    const scrollContainerRef = useRef(null);
    const headerScrollRef = useRef(null);
    const leftPanelRef = useRef(null);

    const getResponsiveConstants = () => ZOOM_LEVELS[zoomLevel];

    // Milestone processing function (similar to PortfolioGanttChart)
    const processMilestonesForProject = (milestones, startDate, monthWidth, projectEndDate = null) => {
        if (!milestones || milestones.length === 0) return [];

        // Convert milestones to the format expected by grouping functions
        const formattedMilestones = milestones.map(milestone => ({
            date: milestone.MILESTONE_DATE,
            label: milestone.MILESTONE_NAME || milestone.TASK_NAME || 'Milestone',
            status: milestone.MILESTONE_STATUS === 'Completed' ? 'Completed' : 'Incomplete',
            isSG3: milestone.MILESTONE_TYPE === 'SG3' || milestone.TASK_NAME?.includes('SG3'),
            originalData: milestone
        }));

        // Group milestones by month
        const monthlyGroups = groupMilestonesByMonth(formattedMilestones);
        const maxInitialWidth = monthWidth * 8; // Allow intelligent calculation up to 8 months
        const processedMilestones = [];

        // Process each monthly group
        Object.entries(monthlyGroups).forEach(([monthKey, monthMilestones]) => {
            // Determine label position for this month (odd = above, even = below)
            const labelPosition = getMonthlyLabelPosition(monthKey);

            // Create vertical labels for this month with intelligent width calculation
            console.log('🎯 Processing monthly group:', monthKey, 'with', monthMilestones.length, 'milestones');
            console.log('🎯 Max initial width:', maxInitialWidth, 'Month width:', monthWidth);
            console.log('🎯 All project milestones:', formattedMilestones.length);
            
            const verticalLabels = createVerticalMilestoneLabels(monthMilestones, maxInitialWidth, '14px', formattedMilestones, monthWidth);

            console.log('🎯 Vertical labels result:', verticalLabels);

            // Process each milestone in the month
            monthMilestones.forEach((milestone, index) => {
                const milestoneDate = parseDate(milestone.date);
                if (!milestoneDate) return;

                const x = calculateMilestonePosition(milestoneDate, startDate, monthWidth, projectEndDate);
                const isFirstInMonth = index === 0;

                processedMilestones.push({
                    ...milestone,
                    x,
                    date: milestoneDate,
                    isGrouped: monthMilestones.length > 1,
                    isMonthlyGrouped: true,
                    monthKey,
                    labelPosition,
                    horizontalLabel: '', // Disabled for strict vertical stacking
                    verticalLabels: isFirstInMonth ? verticalLabels : [],
                    showLabel: true,
                    shouldWrapText: false,
                    hasAdjacentMilestones: false, // Not used in Display3
                    fullLabel: milestone.label,
                    shouldRenderShape: isFirstInMonth, // NEW: Only render shape for first milestone in month
                    allMilestonesInProject: formattedMilestones, // Pass all milestones for ±4 months check
                    currentMilestoneDate: milestoneDate // Pass current date for proximity check
                });
            });
        });

        return processedMilestones.sort((a, b) => a.date - b.date);
    };

    // Sample static data for testing
    const sampleData = {
        INV_INT_ID: 6407053,
        INV_EXT_ID: 'PR00005940',
        CLRTY_INV_TYPE: 'Project',
        INVESTMENT_NAME: 'DTV: PFNA Case Pack Optimization',
        phases: [
            { ROADMAP_ELEMENT: 'Phases', TASK_NAME: 'Initiate', TASK_START: '10-Jun-24', TASK_FINISH: '06-Aug-24', INV_OVERALL_STATUS: 'Grey', INV_FUNCTION: 'S&T' },
            { ROADMAP_ELEMENT: 'Phases', TASK_NAME: 'Define', TASK_START: '07-Aug-24', TASK_FINISH: '23-Aug-24', INV_OVERALL_STATUS: 'Grey', INV_FUNCTION: 'S&T' },
            { ROADMAP_ELEMENT: 'Phases', TASK_NAME: 'Design', TASK_START: '24-Aug-24', TASK_FINISH: '16-Sep-24', INV_OVERALL_STATUS: 'Grey', INV_FUNCTION: 'S&T' },
            { ROADMAP_ELEMENT: 'Phases', TASK_NAME: 'Build', TASK_START: '17-Sep-24', TASK_FINISH: '11-Nov-24', INV_OVERALL_STATUS: 'Grey', INV_FUNCTION: 'S&T' },
            { ROADMAP_ELEMENT: 'Phases', TASK_NAME: 'Qualify', TASK_START: '12-Nov-24', TASK_FINISH: '21-Apr-25', INV_OVERALL_STATUS: 'Grey', INV_FUNCTION: 'S&T' },
            { ROADMAP_ELEMENT: 'Phases', TASK_NAME: 'Close', TASK_START: '22-Apr-25', TASK_FINISH: '31-Dec-25', INV_OVERALL_STATUS: 'Grey', INV_FUNCTION: 'S&T' }
        ]
    };

    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);
                setError(null);
                
                const result = await processSubProgramData();
                
                // Get the raw hierarchy data to extract parent names
                const response = await fetch('/api/data');
                const apiResult = await response.json();
                const hierarchyData = apiResult.data.hierarchy;
                
                // Add the sample data to the existing data for testing
                const combinedProjects = [...(result.projects || [])];
                
                // Add sample project
                combinedProjects.push({
                    PROJECT_ID: 'SAMPLE_' + sampleData.INV_EXT_ID,
                    PROJECT_NAME: sampleData.INVESTMENT_NAME,
                    START_DATE: sampleData.phases[0].TASK_START,
                    END_DATE: sampleData.phases[sampleData.phases.length - 1].TASK_FINISH,
                    STATUS: sampleData.phases[0].INV_OVERALL_STATUS,
                    INV_FUNCTION: sampleData.phases[0].INV_FUNCTION,
                    COE_ROADMAP_PARENT_NAME: 'S&T Sample Program', // Add parent program name
                    isSubProgram: true,
                    phaseData: sampleData.phases,
                    milestones: []
                });
                
                const combinedData = {
                    ...result,
                    projects: combinedProjects,
                    hierarchyData: hierarchyData
                };
                
                // Extract unique program names from hierarchy data (like PortfolioGanttChart)
                const uniquePrograms = new Set();
                hierarchyData.forEach(item => {
                    if (item.COE_ROADMAP_PARENT_NAME && item.COE_ROADMAP_PARENT_NAME.trim()) {
                        uniquePrograms.add(item.COE_ROADMAP_PARENT_NAME);
                    }
                });
                
                // Also extract unique function names from investment data
                combinedProjects.forEach(project => {
                    if (project.INV_FUNCTION && project.INV_FUNCTION.trim()) {
                        uniquePrograms.add(project.INV_FUNCTION);
                    }
                });
                
                // Create sorted list with "All" first
                const sortedPrograms = ['All', ...Array.from(uniquePrograms).sort()];
                setProgramNames(sortedPrograms);
                
                setData(combinedData);
                setDataVersion(prev => prev + 1); // Increment data version to force re-render
                
                // Initial scroll to show current month - 1 (Aug 2025 if current is Sep 2025)
                setTimeout(() => {
                    if (scrollContainerRef.current && headerScrollRef.current) {
                        // Get responsive constants for month width
                        const constants = getResponsiveConstants();
                        const scrollPosition = getInitialScrollPosition(constants.MONTH_WIDTH);

                        scrollContainerRef.current.scrollLeft = scrollPosition;
                        headerScrollRef.current.scrollLeft = scrollPosition;
                    }
                }, 100);
                
            } catch (err) {
                console.error('❌ Failed to load sub-program data from API:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, []);

    const handleZoomChange = (newZoom) => {
        setZoomLevel(newZoom);
    };

    const handleProgramChange = (e) => {
        setSelectedProgram(e.target.value);
        setDataVersion(prev => prev + 1); // Increment data version to force re-render
    };

    const handleScroll = (e) => {
        if (headerScrollRef.current) {
            headerScrollRef.current.scrollLeft = e.target.scrollLeft;
        }
        // Sync vertical scroll with left panel
        if (leftPanelRef.current) {
            leftPanelRef.current.scrollTop = e.target.scrollTop;
        }
    };

    const handleHeaderScroll = (e) => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollLeft = e.target.scrollLeft;
        }
    };

    const handleLeftPanelScroll = (e) => {
        // Sync vertical scroll with gantt area
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = e.target.scrollTop;
        }
    };

    // Calculate milestone label height to prevent overlap
    const calculateMilestoneLabelHeight = (milestones, monthWidth = 100) => {
        if (!milestones?.length) return { total: 0, above: 0, below: 0 };

        try {
            // Process milestones to get their positions and grouping info
            const processedMilestones = processMilestonesForProject(milestones, startDate, monthWidth);

            let maxAboveHeight = 0;
            let maxBelowHeight = 0;
            const LINE_HEIGHT = 12;
            const LABEL_PADDING = 1; // Minimal padding for labels
            const ABOVE_LABEL_OFFSET = 1; // Minimal space above bar - very close to marker
            const BELOW_LABEL_OFFSET = 1; // Minimal space below bar - very close to marker

            processedMilestones.forEach(milestone => {
                if (milestone.isMonthlyGrouped) {
                    // Monthly grouped milestones - height depends on layout type
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
                    // Legacy grouped milestones
                    const groupHeight = milestone.groupLabels.length * LINE_HEIGHT;
                    maxBelowHeight = Math.max(maxBelowHeight, groupHeight + LABEL_PADDING);
                } else {
                    // Individual milestones
                    maxBelowHeight = Math.max(maxBelowHeight, LINE_HEIGHT + LABEL_PADDING);
                }
            });

            // Return detailed breakdown for better spacing calculations
            return {
                total: maxAboveHeight + maxBelowHeight,
                above: maxAboveHeight,
                below: maxBelowHeight
            };
        } catch (error) {
            console.warn('Error calculating milestone label height:', error);
            return 60; // Increased fallback height if there's an error
        }
    };

    // Calculate row height for each project (compact layout optimization)
    const calculateBarHeight = (project, processedMilestones = null) => {
        // Compact calculation for better space utilization
        const ganttBarHeight = 12; // Fixed 12px for Gantt bar
        const baseCompactHeight = Math.round(32 * zoomLevel); // Reduced minimum height
        
        // Calculate height needed for milestone labels to prevent overlap (detailed breakdown)
        let milestoneHeights = { total: 0, above: 0, below: 0 };
        if (processedMilestones?.length > 0) {
            milestoneHeights = calculateMilestoneLabelHeight(processedMilestones, constants.MONTH_WIDTH);
        } else if (project?.milestones?.length > 0) {
            milestoneHeights = calculateMilestoneLabelHeight(project.milestones, constants.MONTH_WIDTH);
        }
        
        // Proper vertical stacking: above labels + bar + below labels
        const compactPadding = 8; // Reduced padding
        
        // Return compact total height with proper milestone spacing
        const compactHeight = Math.max(
            baseCompactHeight, // Minimum touch target
            milestoneHeights.above + ganttBarHeight + milestoneHeights.below + compactPadding // Proper vertical stacking
        );
        
        return compactHeight;
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
                <div className="text-lg text-gray-600">Loading sub-program data...</div>
                <div className="text-sm text-gray-500 mt-2">Processing complex queries from Databricks (this may take a few minutes)</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-lg text-red-600">{error}</div>
            </div>
        );
    }

    if (!data || !data.projects || data.projects.length === 0) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-lg text-gray-600">No sub-program data available.</div>
            </div>
        );
    }

    const constants = getResponsiveConstants();
    let projects = data.projects || [];
    const milestones = data.milestones || [];

    // Filter projects based on selected program
    if (selectedProgram !== 'All') {
        projects = projects.filter(project => {
            // Check both COE_ROADMAP_PARENT_NAME (from hierarchy) and INV_FUNCTION (from investment)
            return project.COE_ROADMAP_PARENT_NAME === selectedProgram || 
                   project.INV_FUNCTION === selectedProgram;
        });
    }

    // Calculate timeline range from project dates
    let earliestDate = new Date();
    let latestDate = new Date();
    
    projects.forEach(project => {
        if (project.phaseData && project.phaseData.length > 0) {
            project.phaseData.forEach(phase => {
                if (phase.TASK_START) {
                    const startDate = parseDate(phase.TASK_START);
                    if (startDate && startDate < earliestDate) earliestDate = startDate;
                }
                if (phase.TASK_FINISH) {
                    const endDate = parseDate(phase.TASK_FINISH);
                    if (endDate && endDate > latestDate) latestDate = endDate;
                }
            });
        }
    });

    // Add some padding to the timeline
    const startDate = new Date(earliestDate.getTime() - 90 * 24 * 60 * 60 * 1000); // 3 months before
    const endDate = new Date(latestDate.getTime() + 90 * 24 * 60 * 60 * 1000); // 3 months after
    
    const timelineWidth = constants.MONTH_WIDTH * Math.ceil((endDate - startDate) / (30 * 24 * 60 * 60 * 1000));

    // Process project phases for rendering - show projects as single rows with multiple phase bars
    const allProjectRows = [];
    projects.forEach(project => {
        if (project.phaseData && project.phaseData.length > 0) {
            // Add one row per project (not per phase)
            allProjectRows.push({
                ...project,
                displayName: project.PROJECT_NAME,
                phases: project.phaseData, // All phases for this project
                projectMilestones: milestones.filter(m => m.PROJECT_ID === project.PROJECT_ID)
            });
        }
    });

    return (
        <div className="h-screen flex flex-col bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 p-4">
                {/* Navigation Breadcrumb */}
                {(onNavigateUp || onBackToProgram) && (
                    <div className="flex items-center space-x-2 mb-3">
                        <button
                            onClick={onNavigateUp || onBackToProgram}
                            className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 transition-colors text-sm"
                        >
                            <span>←</span>
                            <span>Back to Program</span>
                        </button>
                        <span className="text-gray-400">→</span>
                        <span className="text-gray-600 text-sm">
                            {selectedSubProgramName ? `${selectedSubProgramName} (Sub-Program)` : 'Sub-Program View'}
                        </span>
                    </div>
                )}
                
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-4">
                        <label className="font-medium text-sm sm:text-base">Select Program:</label>
                        <select
                            value={selectedProgram}
                            onChange={handleProgramChange}
                            className="border border-gray-300 rounded px-3 py-1 bg-white text-sm sm:text-base"
                        >
                            {programNames.map((name) => (
                                <option key={name} value={name}>
                                    {name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex items-center space-x-2">
                        <label className="text-sm font-medium text-gray-700">Zoom:</label>
                        <select
                            value={zoomLevel}
                            onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
                            className="border border-gray-300 rounded-md px-3 py-1 text-sm"
                        >
                            <option value={0.5}>50%</option>
                            <option value={0.75}>75%</option>
                            <option value={1.0}>100%</option>
                            <option value={1.25}>125%</option>
                            <option value={1.5}>150%</option>
                        </select>
                    </div>
                </div>
                
                {/* Phase Color Legend */}
                <div className="flex flex-wrap items-center gap-4">
                    <span className="text-sm font-medium text-gray-700">Phase Legend:</span>
                    <div className="flex flex-wrap gap-3">
                        {/* Show actual phase names from data */}
                        {['Initiate', 'Evaluate', 'Develop', 'Deploy', 'Sustain', 'Close'].map((phase) => (
                            <div key={phase} className="flex items-center gap-1.5">
                                <div 
                                    className="w-3 h-3 rounded" 
                                    style={{ backgroundColor: PHASE_COLORS[phase] || PHASE_COLORS['Unphased'] }}
                                ></div>
                                <span className="text-xs text-gray-600">{phase}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Gantt Chart */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left Panel - Project Names */}
                <div 
                    ref={leftPanelRef}
                    className="bg-white border-r border-gray-200 flex-shrink-0 overflow-y-auto relative"
                    style={{ width: `${constants.LABEL_WIDTH}px` }}
                    onScroll={handleLeftPanelScroll}
                >
                    {/* Header */}
                    <div 
                        className="bg-gray-100 border-b border-gray-200 flex items-center px-4 font-semibold text-gray-700"
                        style={{ height: '60px', fontSize: constants.FONT_SIZE }}
                    >
                        Project / Phase
                    </div>
                    
                    {/* Project Rows */}
                    <div style={{ position: 'relative', height: allProjectRows.length * (calculateBarHeight({}) + constants.ROW_PADDING) + 50 }}>
                        {allProjectRows.map((row, index) => {
                            // Process milestones first to get accurate height calculation
                            const projectEndDate = row.phases.reduce((latest, phase) => {
                                const phaseEndDate = parseDate(phase.TASK_FINISH);
                                return (phaseEndDate && (!latest || phaseEndDate > latest)) ? phaseEndDate : latest;
                            }, null);
                            
                            const processedMilestones = processMilestonesForProject(
                                row.projectMilestones || [],
                                startDate,
                                constants.MONTH_WIDTH,
                                projectEndDate
                            );
                            
                            const rowHeight = calculateBarHeight(row, processedMilestones);
                            const compactRowSpacing = Math.round(4 * zoomLevel); // Reduced spacing for compact layout
                            const topMargin = Math.round(32 * zoomLevel); // Increased top margin for first row milestone labels
                            
                            // Calculate cumulative Y offset to match Gantt bars
                            const yOffset = allProjectRows
                                .slice(0, index)
                                .reduce((total, p, i) => {
                                    // Process milestones for previous rows for accurate height calculation
                                    const prevProjectEndDate = p.phases.reduce((latest, phase) => {
                                        const phaseEndDate = parseDate(phase.TASK_FINISH);
                                        return (phaseEndDate && (!latest || phaseEndDate > latest)) ? phaseEndDate : latest;
                                    }, null);
                                    
                                    const prevProcessedMilestones = processMilestonesForProject(
                                        p.projectMilestones || [],
                                        startDate,
                                        constants.MONTH_WIDTH,
                                        prevProjectEndDate
                                    );
                                    
                                    return total + calculateBarHeight(p, prevProcessedMilestones) + compactRowSpacing;
                                }, topMargin);
                            
                            return (
                                <div
                                    key={`${row.PROJECT_ID}-${index}`}
                                    className="absolute border-b border-gray-100 bg-gray-50/30 hover:bg-gray-100/50 transition-colors px-4"
                                    style={{ 
                                        top: yOffset,
                                        height: `${rowHeight}px`,
                                        width: '100%',
                                        fontSize: constants.FONT_SIZE,
                                        cursor: 'default',
                                        minHeight: constants.TOUCH_TARGET_SIZE,
                                        display: 'flex',
                                        alignItems: 'center'
                                    }}
                                >
                                    <div className="flex items-center justify-between w-full">
                                        <div className="flex flex-col justify-center">
                                            <span className="font-medium text-gray-800 pr-2" title={row.displayName}>
                                                {row.displayName}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Right Panel - Timeline and Gantt */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Timeline Header */}
                    <div 
                        ref={headerScrollRef}
                        className="bg-gray-100 border-b border-gray-200 overflow-x-auto overflow-y-hidden"
                        style={{ height: '60px' }}
                        onScroll={handleHeaderScroll}
                    >
                        <TimelineAxis
                            startDate={startDate}
                            endDate={endDate}
                            monthWidth={constants.MONTH_WIDTH}
                            height={60}
                            fontSize={constants.FONT_SIZE}
                        />
                    </div>

                    {/* Gantt Chart Area */}
                    <div 
                        ref={scrollContainerRef}
                        className="flex-1 overflow-auto"
                        onScroll={handleScroll}
                    >
                        <div style={{ width: `${timelineWidth}px` }}>
                            <svg 
                                key={`gantt-${selectedProgram}-${dataVersion}`} // Add key to force re-render
                                width={timelineWidth} 
                                height={allProjectRows.reduce((total, row) => {
                                    // Process milestones for accurate height calculation
                                    const projectEndDate = row.phases.reduce((latest, phase) => {
                                        const phaseEndDate = parseDate(phase.TASK_FINISH);
                                        return (phaseEndDate && (!latest || phaseEndDate > latest)) ? phaseEndDate : latest;
                                    }, null);
                                    
                                    const processedMilestones = processMilestonesForProject(
                                        row.projectMilestones || [],
                                        startDate,
                                        constants.MONTH_WIDTH,
                                        projectEndDate
                                    );
                                    
                                    return total + calculateBarHeight(row, processedMilestones) + constants.ROW_PADDING;
                                }, 0)}
                            >
                                {allProjectRows.map((row, index) => {
                                    // Process milestones first to get accurate height calculation
                                    const projectEndDate = row.phases.reduce((latest, phase) => {
                                        const phaseEndDate = parseDate(phase.TASK_FINISH);
                                        return (phaseEndDate && (!latest || phaseEndDate > latest)) ? phaseEndDate : latest;
                                    }, null);
                                    
                                    const processedMilestones = processMilestonesForProject(
                                        row.projectMilestones || [],
                                        startDate,
                                        constants.MONTH_WIDTH,
                                        projectEndDate
                                    );

                                    // Calculate proper Y offset using PortfolioGanttChart logic
                                    const rowSpacing = constants.ROW_PADDING || 8;
                                    const topMargin = Math.round(32 * zoomLevel); // Increased top margin for first row milestone labels
                                    const yOffset = allProjectRows
                                        .slice(0, index)
                                        .reduce((total, p, i) => {
                                            // Process milestones for each previous row for accurate height calculation
                                            const prevProjectEndDate = p.phases.reduce((latest, phase) => {
                                                const phaseEndDate = parseDate(phase.TASK_FINISH);
                                                return (phaseEndDate && (!latest || phaseEndDate > latest)) ? phaseEndDate : latest;
                                            }, null);
                                            
                                            const prevProcessedMilestones = processMilestonesForProject(
                                                p.projectMilestones || [],
                                                startDate,
                                                constants.MONTH_WIDTH,
                                                prevProjectEndDate
                                            );
                                            
                                            return total + calculateBarHeight(p, prevProcessedMilestones) + rowSpacing;
                                        }, topMargin);
                                    
                                    // Calculate the project's total height and center point
                                    const totalHeight = calculateBarHeight(row, processedMilestones);
                                    const centerY = yOffset + totalHeight / 2;
                                    
                                    // Get detailed milestone height breakdown for proper positioning
                                    const milestoneHeights = calculateMilestoneLabelHeight(processedMilestones || row.milestones || [], constants.MONTH_WIDTH);
                                    
                                    // Position Gantt bar accounting for milestone labels above it
                                    const centeredY = yOffset + milestoneHeights.above + (constants.TOUCH_TARGET_SIZE / 2);
                                    
                                    return (
                                        <g key={`${row.PROJECT_ID}-${index}`}>
                                            {/* Render multiple phase bars for this project */}
                                            {row.phases.map((phase, phaseIndex) => {
                                                const phaseStartDate = parseDate(phase.TASK_START);
                                                const phaseEndDate = parseDate(phase.TASK_FINISH);
                                                
                                                if (!phaseStartDate || !phaseEndDate) return null;
                                                
                                                const x = calculatePosition(phaseStartDate, startDate, constants.MONTH_WIDTH);
                                                const width = calculatePosition(phaseEndDate, startDate, constants.MONTH_WIDTH) - x;
                                                
                                                // Get the phase color based on the task name
                                                const phaseColor = PHASE_COLORS[phase.TASK_NAME] || PHASE_COLORS['Unphased'];
                                                
                                                return (
                                                    <GanttBar
                                                        key={`${row.PROJECT_ID}-${phase.TASK_NAME}-${phaseIndex}`}
                                                        data={{
                                                            ...phase,
                                                            id: `${row.PROJECT_ID}-${phase.TASK_NAME}`,
                                                            name: `${row.PROJECT_NAME} - ${phase.TASK_NAME}`
                                                        }}
                                                        startX={x}
                                                        y={centeredY}
                                                        width={width}
                                                        label={`${phase.TASK_NAME}`}
                                                        status={row.STATUS}
                                                        color={phaseColor}
                                                        touchTargetSize={constants.TOUCH_TARGET_SIZE}
                                                        fontSize={constants.FONT_SIZE}
                                                        isMobile={false}
                                                        zoomLevel={zoomLevel}
                                                    />
                                                );
                                            })}
                                            
                                            {/* Render Milestones using already processed milestone data */}
                                            {processedMilestones.map((milestone, milestoneIndex) => {
                                                // EXACT SAME LOGIC AS PORTFOLIOGANTTCHART
                                                // Position milestone at: yOffset + (totalHeight - TOUCH_TARGET_SIZE) / 2 + (TOUCH_TARGET_SIZE / 2)
                                                // This ensures perfect alignment and no overlaps
                                                // Position milestone markers to align with Gantt bar
                                                const milestoneY = centeredY + 6; // Center with the 12px bar
                                                
                                                return (
                                                    <MilestoneMarker
                                                        key={`milestone-${row.PROJECT_ID}-${milestoneIndex}`}
                                                        x={milestone.x}
                                                        y={milestoneY}
                                                        complete={milestone.status}
                                                        label={milestone.label}
                                                        isSG3={milestone.isSG3}
                                                        labelPosition={milestone.labelPosition}
                                                        shouldWrapText={milestone.shouldWrapText}
                                                        isGrouped={milestone.isGrouped}
                                                        groupLabels={[]}
                                                        fullLabel={milestone.fullLabel}
                                                        hasAdjacentMilestones={milestone.hasAdjacentMilestones}
                                                        showLabel={milestone.showLabel}
                                                        fontSize={constants.MILESTONE_FONT_SIZE}
                                                        isMobile={false}
                                                        zoomLevel={zoomLevel}
                                                        isMonthlyGrouped={milestone.isMonthlyGrouped}
                                                        monthlyLabels={[]}
                                                        horizontalLabel={milestone.horizontalLabel}
                                                        verticalLabels={milestone.verticalLabels}
                                                        monthKey={milestone.monthKey}
                                                        shouldRenderShape={milestone.shouldRenderShape}
                                                    />
                                                );
                                            })}
                                        </g>
                                    );
                                })}
                            </svg>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SubProgramGanttChart;
