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
const BASE_BAR_HEIGHT = 30;
const PROGRAM_BAR_HEIGHT = BASE_BAR_HEIGHT + 10; // Taller height for program bars
const MILESTONE_LABEL_HEIGHT = 20;
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

        if (isPartOfGroup) {
            const groupLabels = sameDateMilestones.map(m => 
                m.label.length > MAX_LABEL_LENGTH && hasAdjacentMilestones 
                    ? m.label.substring(0, MAX_LABEL_LENGTH) + '...' 
                    : m.label
            );

            return {
                ...milestone,
                isGrouped: true,
                groupLabels,
                labelPosition: 'below',
                shouldWrapText: false,
                hasAdjacentMilestones
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
            truncatedLabel: hasAdjacentMilestones && milestone.label.length > MAX_LABEL_LENGTH 
                ? milestone.label.substring(0, MAX_LABEL_LENGTH) + '...' 
                : milestone.label,
            hasAdjacentMilestones
        };
    });
};

const ProgramGanttChart = () => {
    const [processedData, setProcessedData] = useState([]);
    const [filteredData, setFilteredData] = useState([]);
    const [selectedProgram, setSelectedProgram] = useState('');

    const scrollContainerRef = useRef(null);

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

    useEffect(() => {
        // Initial scroll to current-1 to current+11 months
        if (scrollContainerRef.current) {
            const monthsFromStart = 36;
            const scrollPosition = (monthsFromStart - 1) * MONTH_WIDTH;
            scrollContainerRef.current.scrollLeft = scrollPosition;
        }
    }, []);

    const handleProgramChange = (e) => {
        setSelectedProgram(e.target.value);
    };

    const calculateMilestoneLabelHeight = (milestones) => {
        if (!milestones?.length) return 0;

        const processedMilestones = processMilestonesWithPosition(milestones, startDate);
        
        let maxAboveHeight = 0;
        let maxBelowHeight = 0;
        const LINE_HEIGHT = 12;
        const LABEL_PADDING = 15;
        const ABOVE_LABEL_OFFSET = 15;
        const BELOW_LABEL_OFFSET = 20;

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
        const nameHeight = baseHeight + ((textLines - 1) * 12);
        const milestoneLabelHeight = calculateMilestoneLabelHeight(project.milestones);
        return nameHeight + milestoneLabelHeight + 16;
    };

    const getTotalHeight = () => {
        return filteredData.reduce((total, project) => {
            const barHeight = calculateBarHeight(project);
            return total + barHeight + 8;
        }, 40);
    };

    const isParentProgram = (project) => {
        return project.id === project.parentId;
    };

    return (
        <div className="w-full">
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
                    <div style={{ height: 30, padding: '6px', fontWeight: 600 }}>Programs</div>
                    <div style={{ position: 'relative', height: getTotalHeight() }}>
                        {filteredData.map((project, index) => {
                            const yOffset = filteredData
                                .slice(0, index)
                                .reduce((total, p) => total + calculateBarHeight(p) + 8, 10);

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
                            {filteredData.map((project, index) => {
                                const yOffset = filteredData
                                    .slice(0, index)
                                    .reduce((total, p) => total + calculateBarHeight(p) + 8, 10);

                                const projectStartDate = parseDate(project.startDate);
                                const projectEndDate = parseDate(project.endDate);
                                const startX = calculatePosition(projectStartDate, startDate);
                                const endX = calculatePosition(projectEndDate, startDate);
                                const width = endX - startX;

                                const totalHeight = calculateBarHeight(project);

                                const milestones = processMilestonesWithPosition(project.milestones, startDate);

                                const isProgram = project.isProgram;
                                const barHeight = isProgram ? 34 : 24; // Taller bar for program

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
        </div>
    );
};

export default ProgramGanttChart;