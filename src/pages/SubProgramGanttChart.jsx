import React, { useState, useEffect, useRef } from 'react';
import TimelineAxis from '../components/TimelineAxis';
import MilestoneMarker from '../components/MilestoneMarker';
import { getTimelineRange, parseDate, calculatePosition } from '../utils/dateUtils';
import { processSubProgramData } from '../services/dataService';
import subProgramData from '../services/SubProgramData.json';
import investmentData from '../services/investmentData.json';
import { differenceInDays } from 'date-fns';

const MONTH_WIDTH = 100;
const TOTAL_MONTHS = 73;
const LABEL_WIDTH = 180; // Reduced from 200
const BASE_BAR_HEIGHT = 16; // Reduced from 20
const MILESTONE_LABEL_HEIGHT = 12; // Reduced from 16
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

    const scrollContainerRef = useRef(null);

    const { startDate } = getTimelineRange();
    const totalWidth = MONTH_WIDTH * TOTAL_MONTHS;

    // Get unique sub-program names (only the parent sub-programs)
    const subProgramNames = Array.from(new Set(subProgramData
        .filter(item => item.COE_ROADMAP_PARENT_ID === item.CHILD_ID)
        .map(item => item.COE_ROADMAP_PARENT_NAME)
    )).sort();

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
        // Initial scroll to current-1 to current+11 months
        if (scrollContainerRef.current) {
            const monthsFromStart = 36;
            const scrollPosition = (monthsFromStart - 1) * MONTH_WIDTH;
            scrollContainerRef.current.scrollLeft = scrollPosition;
        }
    }, []);

    const handleSubProgramChange = (e) => {
        setSelectedSubProgram(e.target.value);
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

    const calculateMilestoneLabelHeight = (milestones) => {
        if (!milestones?.length) return 0;

        // Process milestones to get their positions and grouping info
        const processedMilestones = processMilestonesWithPosition(milestones, startDate);
        
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
        // Calculate height needed for project name wrapping
        const textLines = Math.ceil(project.name.length / 30);
        const nameHeight = BASE_BAR_HEIGHT + ((textLines - 1) * 10); // Reduced from 12
        
        // Calculate height needed for milestone labels
        const milestones = getMilestones(project.id);
        const milestoneLabelHeight = calculateMilestoneLabelHeight(milestones);
        
        // Add extra height for sub-program rows to make them pop
        const extraHeight = project.isSubProgram ? 10 : 0;
        
        // Return total height needed: name height + milestone label height + padding + extra height
        return nameHeight + milestoneLabelHeight + 8 + extraHeight; // Reduced from 16px padding
    };

    const getTotalHeight = () => {
        return filteredData.reduce((total, project) => {
            const barHeight = calculateBarHeight(project);
            return total + barHeight + 4; // Reduced from 8
        }, 20); // Reduced from 40
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

            <div className="flex items-center gap-4 mb-4">
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

            <div className="relative flex w-full">
                {/* Sticky Sub-Program Names */}
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
                    <div style={{ height: 30, padding: '6px', fontWeight: 600 }}>Sub-Programs</div>
                    <div style={{ position: 'relative', height: getTotalHeight() }}>
                        {filteredData.map((project, index) => {
                            const yOffset = filteredData
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
                                        fontSize: '12px', // Reduced from 14px
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
                                        <span>{project.name}</span>
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
                                                        y={yOffset + (totalHeight - (project.isSubProgram ? 18 : 14)) / 2}
                                                        width={Math.max(width, 2)}
                                                        height={project.isSubProgram ? 18 : 14}
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
                                                            y={yOffset + (totalHeight - (project.isSubProgram ? 18 : 14)) / 2}
                                                            width={Math.max(width, 2)}
                                                            height={project.isSubProgram ? 18 : 14}
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
                                                        y={yOffset + (totalHeight - (project.isSubProgram ? 18 : 14)) / 2}
                                                        width={Math.max(calculatePosition(parseDate(project.endDate), startDate) - calculatePosition(parseDate(project.startDate), startDate), 2)}
                                                        height={project.isSubProgram ? 18 : 14}
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
                                            const processedMilestones = processMilestonesWithPosition(milestones, startDate);
                                            
                                            return processedMilestones.map((milestone, mIndex) => (
                                                <MilestoneMarker
                                                    key={`${project.id}-milestone-${mIndex}`}
                                                    x={milestone.x}
                                                    y={yOffset + (totalHeight - 14) / 2 + 7}
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