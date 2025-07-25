import React, { useState, useEffect, useRef } from 'react';
import TimelineAxis from '../components/TimelineAxis';
import MilestoneMarker from '../components/MilestoneMarker';
import { getTimelineRange, parseDate, calculatePosition } from '../utils/dateUtils';
import { processPortfolioData } from '../services/dataService';
import { differenceInDays } from 'date-fns';

const MONTH_WIDTH = 100;
const TOTAL_MONTHS = 73;
const LABEL_WIDTH = 200;
const BASE_BAR_HEIGHT = 30;
const MILESTONE_LABEL_HEIGHT = 20;
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

const PortfolioGanttChart = () => {
    const [processedData, setProcessedData] = useState([]);
    const [filteredData, setFilteredData] = useState([]);
    const [selectedParent, setSelectedParent] = useState('All');

    const scrollContainerRef = useRef(null);

    const { startDate } = getTimelineRange();
    const totalWidth = MONTH_WIDTH * TOTAL_MONTHS;

    useEffect(() => {
        const data = processPortfolioData();
        setProcessedData(data);
        setFilteredData(data);

        // Initial scroll to current-1 to current+11 months
        if (scrollContainerRef.current) {
            // Calculate scroll position to show current month - 1
            const monthsFromStart = 36; // MONTHS_BEFORE from dateUtils.js
            const scrollPosition = (monthsFromStart - 1) * MONTH_WIDTH;
            scrollContainerRef.current.scrollLeft = scrollPosition;
        }
    }, []);

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

    const calculateBarHeight = (project) => {
        const textLines = Math.ceil(project.name.length / 30);
        const hasMilestones = project.milestones && project.milestones.length > 0;
        return BASE_BAR_HEIGHT + ((textLines - 1) * 12) + (hasMilestones ? MILESTONE_LABEL_HEIGHT : 0);
    };

    const getTotalHeight = () => {
        return filteredData.reduce((total, project) => {
            const barHeight = calculateBarHeight(project);
            return total + barHeight + 8;
        }, 40);
    };

    return (
        <div className="w-full">
            <div className="flex items-center gap-4 mb-4">
                <label className="font-medium">Select Portfolio:</label>
                <select
                    value={selectedParent}
                    onChange={handleParentChange}
                    className="border border-gray-300 rounded px-3 py-1 bg-white"
                >
                    {parentNames.map((name) => (
                        <option key={name} value={name}>
                            {name}
                        </option>
                    ))}
                </select>
            </div>

            <div className="relative flex w-full">
                {/* Sticky Portfolio Names */}
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
                    <div style={{ height: 30, padding: '6px', fontWeight: 600 }}>Portfolios</div>
                    <div style={{ position: 'relative', height: getTotalHeight() }}>
                        {filteredData.map((project, index) => {
                            const yOffset = filteredData
                                .slice(0, index)
                                .reduce((total, p) => total + calculateBarHeight(p) + 8, 10);
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
                                        background: 'rgba(0, 0, 0, 0.015)',
                                        outline: '1px solid rgba(0, 0, 0, 0.08)'
                                    }}
                                    onClick={() => console.log('Box height:', calculateBarHeight(project))}
                                >
                                    {project.name}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Scrollable Timeline */}
                <div
                    ref={scrollContainerRef}
                    className="overflow-x-auto"
                    style={{ width: `calc(100% - ${LABEL_WIDTH}px)` }}

                >
                    <TimelineAxis startDate={startDate} />
                    <div className="relative" style={{ width: totalWidth }}>
                        <svg
                            width={totalWidth}
                            style={{ height: Math.max(400, getTotalHeight()) }}
                        >
                            {/* Render Gantt bars first (bottom layer) */}
                            <g className="gantt-bars-layer">
                                {filteredData.map((project, index) => {
                                    const yOffset = filteredData
                                        .slice(0, index)
                                        .reduce((total, p) => total + calculateBarHeight(p) + 8, 10);

                                    const projectStartDate = parseDate(project.startDate);
                                    const projectEndDate = parseDate(project.endDate);

                                    const startX = calculatePosition(projectStartDate, startDate) + 0;
                                    const endX = calculatePosition(projectEndDate, startDate) + 0;
                                    const width = endX - startX;

                                    return (
                                        <rect
                                            key={`bar-${project.id}`}
                                            x={startX}
                                            y={yOffset + (calculateBarHeight(project) - 24) / 2}
                                            width={Math.max(width, 2)}
                                            height={24}
                                            rx={4}
                                            fill={project.status ? statusColors[project.status] : statusColors.Grey}
                                            className="cursor-pointer transition-opacity duration-150 hover:opacity-90"
                                            onClick={() => console.log('Portfolio clicked:', project.id)}
                                        />
                                    );
                                })}
                            </g>

                            {/* Render milestones and labels in separate layer (top layer) */}
                            <g className="milestones-layer">
                                {filteredData.map((project, index) => {
                                    const yOffset = filteredData
                                        .slice(0, index)
                                        .reduce((total, p) => total + calculateBarHeight(p) + 8, 10);

                                    // Process milestones with position information
                                    const milestones = processMilestonesWithPosition(project.milestones, startDate);

                                    return (
                                        <g key={`milestones-${project.id}`}>
                                            {milestones.map((milestone, mIndex) => (
                                                <MilestoneMarker
                                                    key={`${project.id}-milestone-${mIndex}`}
                                                    x={milestone.x}
                                                    y={yOffset + (calculateBarHeight(project) - 24) / 2 + 12}
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
                            </g>
                        </svg>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PortfolioGanttChart;

