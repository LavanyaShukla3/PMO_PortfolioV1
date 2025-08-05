import React, { useState, useEffect, useRef } from 'react';
import TimelineAxis from '../components/TimelineAxis';
import MilestoneMarker from '../components/MilestoneMarker';
import { getTimelineRange, parseDate, calculatePosition } from '../utils/dateUtils';
import { processProgramData } from '../services/dataService';
import { differenceInDays } from 'date-fns';
import programData from '../services/ProgramData.json';

const MONTH_WIDTH = 100;
const TOTAL_MONTHS = 73;
const LABEL_WIDTH = 200;
const BASE_BAR_HEIGHT = 40; // Reduced from 30
const PROGRAM_BAR_HEIGHT = BASE_BAR_HEIGHT + 2; // Reduced height difference from 10 to 6
const MILESTONE_LABEL_HEIGHT = 16; // Reduced from 20
const DAYS_THRESHOLD = 16;
const MAX_LABEL_LENGTH = 5;

const statusColors = {
    'Red': '#ef4444',    // Tailwind red-500
    'Amber': '#f59e0b',  // Tailwind amber-500
    'Green': '#10b981',  // Tailwind emerald-500
    'Grey': '#9ca3af',   // Tailwind gray-400
    'Yellow': '#E5DE00'
};

// Reuse the same milestone processing logic from PortfolioGanttChart
const processMilestonesWithPosition = (milestones, startDate) => {
    if (!milestones?.length) return [];

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

    const milestonesWithX = [];
    const sameDateGroups = new Map();

    sortedMilestones.forEach(milestone => {
        const milestoneDate = parseDate(milestone.date);
        const x = calculatePosition(milestoneDate, startDate);
        const dateStr = milestoneDate.toISOString();
        
        const milestoneWithX = { ...milestone, x, date: milestoneDate };
        milestonesWithX.push(milestoneWithX);

        if (!sameDateGroups.has(dateStr)) {
            sameDateGroups.set(dateStr, []);
        }
        sameDateGroups.get(dateStr).push(milestoneWithX);
    });

    let lastPosition = 'below';
    
    return milestonesWithX.map((milestone, index) => {
        const dateStr = milestone.date.toISOString();
        const sameDateMilestones = sameDateGroups.get(dateStr);
        const isPartOfGroup = sameDateMilestones.length > 1;

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

const ProgramGanttChart = ({ selectedProjectId, selectedProjectName, onBackToPortfolio }) => {
    const [processedData, setProcessedData] = useState([]);
    const [filteredData, setFilteredData] = useState([]);
    const [selectedProgram, setSelectedProgram] = useState('');

    const timelineScrollRef = useRef(null);
    const ganttScrollRef = useRef(null);

    const { startDate } = getTimelineRange();
    const totalWidth = MONTH_WIDTH * TOTAL_MONTHS;

    // Get unique program names and set default selection
    const programNames = Array.from(new Set(programData
        .filter(item => item.COE_ROADMAP_PARENT_ID === item.CHILD_ID)
        .map(item => item.COE_ROADMAP_PARENT_NAME)
    ));

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
        // Initial scroll to show June 2025 to June 2026 (13 months)
        if (timelineScrollRef.current) {
            const monthsFromStart = 36;
            const scrollPosition = (monthsFromStart - 2) * MONTH_WIDTH; // June 2025 is month 34
            timelineScrollRef.current.scrollLeft = scrollPosition;
            // Sync gantt scroll position
            if (ganttScrollRef.current) {
                ganttScrollRef.current.scrollLeft = scrollPosition;
            }
        }
    }, []);

    const handleProgramChange = (e) => {
        setSelectedProgram(e.target.value);
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
        if (timelineScrollRef.current) {
            timelineScrollRef.current.scrollLeft = scrollLeft;
        }
    };

    const calculateMilestoneLabelHeight = (milestones) => {
        if (!milestones?.length) return 0;

        const processedMilestones = processMilestonesWithPosition(milestones, startDate);
        
        let maxAboveHeight = 0;
        let maxBelowHeight = 0;
        const LINE_HEIGHT = 10; // Reduced from 12
        const LABEL_PADDING = 10; // Reduced from 15
        const ABOVE_LABEL_OFFSET = 12; // Reduced from 15
        const BELOW_LABEL_OFFSET = 14; // Reduced from 20

        processedMilestones.forEach(milestone => {
            if (milestone.isGrouped) {
                const groupHeight = milestone.groupLabels.length * LINE_HEIGHT;
                maxBelowHeight = Math.max(maxBelowHeight, groupHeight + LABEL_PADDING);
            } else {
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
        const baseHeight = isProgram ? PROGRAM_BAR_HEIGHT : BASE_BAR_HEIGHT;
        const textLines = Math.ceil(project.name.length / 30);
        const nameHeight = baseHeight + ((textLines - 1) * 10); // Reduced line height from 12 to 10
        const milestoneLabelHeight = calculateMilestoneLabelHeight(project.milestones);
        return nameHeight + milestoneLabelHeight + 8; // Reduced padding from 16 to 8
    };

    const getTotalHeight = () => {
        return filteredData.reduce((total, project) => {
            const barHeight = calculateBarHeight(project);
            return total + barHeight + 4; // Reduced spacing between bars from 8 to 4
        }, 20); // Reduced initial offset from 40 to 20
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

            <div className="flex items-center gap-4 mb-4">
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

            {/* Fixed Header Area - Scrollable Timeline */}
            <div className="sticky top-0 z-20 bg-white border-b border-gray-200">
                <div className="relative flex w-full">
                    {/* Sticky Program Names Header */}
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
                        <div style={{ height: 30, padding: '6px', fontWeight: 600 }}>Programs</div>
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
                {/* Sticky Program Names */}
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
                    <div style={{ position: 'relative', height: getTotalHeight() }}>
                        {filteredData.map((project, index) => {
                            const yOffset = filteredData
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
                                        fontSize: '14px',
                                        borderBottom: '1px solid #f3f4f6',
                                        width: '100%',
                                        background: isProgram ? '#f0f9ff' : 'transparent',
                                        outline: '1px solid rgba(0, 0, 0, 0.08)',
                                        fontWeight: isProgram ? 600 : 'normal',
                                        textTransform: isProgram ? 'uppercase' : 'none'
                                    }}
                                >
                                    {isProgram ? '📌 ' : ''}{project.name}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Synchronized Scroll Container */}
                <div
                    ref={ganttScrollRef}
                    className="overflow-x-auto"
                    style={{ width: `${100 * 13}px` }}
                    onScroll={handleGanttScroll}
                >
                    <div className="relative" style={{ width: totalWidth }}>
                        {/* Gantt Bars */}
                        <svg
                            width={totalWidth}
                            style={{ height: Math.max(400, getTotalHeight()) }}
                        >
                            {filteredData.map((project, index) => {
                                const yOffset = filteredData
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
                                const barHeight = isProgram ? 24 : 18; // Reduced heights (was 34/24)

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

                                        {/* Program label above bar */}
                                        {isProgram && (
                                            <text
                                                x={startX + width / 2}
                                                y={yOffset + (totalHeight - barHeight) / 2 - 5}
                                                textAnchor="middle"
                                                className="text-xs font-semibold tracking-wider fill-gray-600"
                                                style={{ fontSize: '10px' }}
                                            >
                                                PROGRAM
                                            </text>
                                        )}

                                        {/* Render bar */}
                                        <rect
                                            key={`bar-${project.id}`}
                                            x={startX}
                                            y={yOffset + (totalHeight - barHeight) / 2}
                                            width={Math.max(width, 2)}
                                            height={barHeight}
                                            rx={4}
                                            fill={project.status ? statusColors[project.status] : statusColors.Grey}
                                            className="cursor-pointer transition-opacity duration-150 hover:opacity-90"
                                            onClick={() => console.log('Project clicked:', project.id)}
                                        />

                                        {/* Render milestones */}
                                        {milestones.map((milestone, mIndex) => (
                                            <MilestoneMarker
                                                key={`${project.id}-milestone-${mIndex}`}
                                                x={milestone.x}
                                                y={yOffset + (totalHeight - 24) / 2 + 12}
                                                complete={milestone.status}
                                                label={milestone.label}
                                                isSG3={milestone.isSG3}
                                                labelPosition={milestone.labelPosition}
                                                shouldWrapText={milestone.shouldWrapText}
                                                isGrouped={milestone.isGrouped}
                                                groupLabels={milestone.groupLabels}
                                                fullLabel={milestone.fullLabel} // Display2: Only next upcoming milestone
                                                showLabel={milestone.showLabel} // Display2: Control label visibility
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
        </div>
    );
};

export default ProgramGanttChart;