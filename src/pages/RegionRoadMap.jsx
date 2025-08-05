import React, { useState, useEffect, useMemo, useRef } from 'react';
import { processRegionData, getRegionFilterOptions } from '../services/dataService';
import { parseDate, calculatePosition, getTimelineRange } from '../utils/dateUtils';
import { differenceInDays } from 'date-fns';
import TimelineAxis from '../components/TimelineAxis';
import MilestoneMarker from '../components/MilestoneMarker';

// Constants from dateUtils
const MONTH_WIDTH = 100;
const TOTAL_MONTHS = 73;
const LABEL_WIDTH = 300;

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

    const timelineScrollRef = useRef(null);
    const ganttScrollRef = useRef(null);

    // Load filter options on component mount
    useEffect(() => {
        const options = getRegionFilterOptions();
        setFilterOptions(options);
        setAvailableMarkets(options.markets);

        // Initial scroll to show June 2025 to June 2026 (13 months)
        if (timelineScrollRef.current) {
            // Calculate scroll position to show June 2025 (current month - 2)
            const monthsFromStart = 36; // MONTHS_BEFORE from dateUtils.js
            const scrollPosition = (monthsFromStart - 2) * MONTH_WIDTH; // June 2025 is month 34
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
        if (timelineScrollRef.current && timelineScrollRef.current.scrollLeft !== scrollLeft) {
            timelineScrollRef.current.scrollLeft = scrollLeft;
        }
    };

    // Process data based on current filters
    const processedData = useMemo(() => {
        return processRegionData(filters);
    }, [filters]);

    // Use the standard 73-month timeline
    const { startDate, endDate } = getTimelineRange();
    const totalWidth = MONTH_WIDTH * TOTAL_MONTHS;

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
    const processMilestonesWithPosition = (milestones, startDate) => {
        if (!milestones?.length) return [];

        // Sort milestones by date
        const sortedMilestones = [...milestones].sort((a, b) => {
            const dateA = parseDate(a.date);
            const dateB = parseDate(b.date);
            return dateA - dateB;
        });

        // First pass: calculate x positions and group by date
        const milestonesWithX = [];
        const sameDateGroups = new Map(); // Map of date string to array of milestones

        sortedMilestones.forEach(milestone => {
            const milestoneDate = parseDate(milestone.date);
            const x = calculatePosition(milestoneDate, startDate);
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

            // Handle same-date groups
            if (isPartOfGroup) {
                // Process each milestone in the group with potential truncation
                const groupLabels = sameDateMilestones.map(m =>
                    truncateLabel(m.label, hasAdjacentMilestones)
                );

                return {
                    ...milestone,
                    isGrouped: true,
                    groupLabels, // Array of labels for vertical stacking
                    labelPosition: 'below',
                    shouldWrapText: false,
                    hasAdjacentMilestones
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
                shouldWrapText: false, // We're not using wrapping anymore
                truncatedLabel: truncateLabel(milestone.label, hasAdjacentMilestones),
                hasAdjacentMilestones
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
                <>
                    {/* Fixed Header Area - Timeline Axis */}
                    <div className="sticky top-0 z-20 bg-white border-b border-gray-200">
                        <div className="relative flex w-full">
                            {/* Sticky Project Names Header */}
                            <div
                                style={{
                                    width: LABEL_WIDTH,
                                    position: 'sticky',
                                    left: 0,
                                    zIndex: 30,
                                    background: 'white',
                                    borderRight: '1px solid #e5e7eb',
                                }}
                            >
                                <div style={{ height: 30, padding: '6px', fontWeight: 600 }}>Region Projects</div>
                            </div>

                            {/* Timeline Axis */}
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

                    {/* Scrollable Content Area */}
                    <div className="relative flex w-full">
                        {/* Sticky Project Names */}
                        <div
                            style={{
                                width: LABEL_WIDTH,
                                position: 'sticky',
                                left: 0,
                                zIndex: 10,
                                background: 'white',
                                borderRight: '1px solid #e5e7eb',
                            }}
                        >
                            <div style={{ position: 'relative', height: timelineFilteredData.length * (rowHeight + 8) }}>
                                {timelineFilteredData.map((project, index) => {
                                    const yOffset = index * (rowHeight + 8);
                                    return (
                                        <div
                                            key={project.id}
                                            style={{
                                                position: 'absolute',
                                                top: yOffset,
                                                height: rowHeight,
                                                display: 'flex',
                                                flexDirection: 'column',
                                                justifyContent: 'center',
                                                paddingLeft: '8px',
                                                fontSize: '14px',
                                                borderBottom: '1px solid #f3f4f6',
                                                width: '100%',
                                                background: 'rgba(0, 0, 0, 0.015)',
                                                outline: '1px solid rgba(0, 0, 0, 0.08)',
                                                cursor: 'default'
                                            }}
                                        >
                                            <div className="font-medium text-sm text-gray-800 truncate" title={project.name}>
                                                {project.name}
                                            </div>
                                            <div className="text-xs text-gray-500 mt-1">
                                                {project.region}{project.market ? `/${project.market}` : ''} • {project.function} • Tier {project.tier}
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
                            style={{ width: `${100 * 13}px` }}
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

                                        const milestones = processMilestonesWithPosition(project.milestones || [], startDate);

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

                                                        const startX = calculatePosition(projectStartDate, startDate);
                                                        const endX = calculatePosition(projectEndDate, startDate);
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

                                                        const startX = calculatePosition(phaseStartDate, startDate);
                                                        const endX = calculatePosition(phaseEndDate, startDate);
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
                                                        y={yOffset + (rowHeight - 24) / 2 + 12}
                                                        complete={milestone.status}
                                                        label={milestone.label}
                                                        isSG3={milestone.isSG3}
                                                        labelPosition={milestone.labelPosition}
                                                        shouldWrapText={milestone.shouldWrapText}
                                                        isGrouped={milestone.isGrouped}
                                                        groupLabels={milestone.groupLabels}
                                                        truncatedLabel={milestone.truncatedLabel}
                                                        hasAdjacentMilestones={milestone.hasAdjacentMilestones}
                                                    />
                                                ))}
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

export default RegionRoadMap;