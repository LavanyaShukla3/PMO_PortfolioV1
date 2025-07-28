import React, { useState, useEffect, useRef } from 'react';
import TimelineAxis from '../components/TimelineAxis';
import MilestoneMarker from '../components/MilestoneMarker';
import { getTimelineRange, parseDate, calculatePosition } from '../utils/dateUtils';
import { processSubProgramData } from '../services/dataService';
import subProgramData from '../services/SubProgramData.json';
import investmentData from '../services/investmentData.json';

const MONTH_WIDTH = 100;
const TOTAL_MONTHS = 73;
const LABEL_WIDTH = 200;
const BASE_BAR_HEIGHT = 20;
const MILESTONE_LABEL_HEIGHT = 16;
const DAYS_THRESHOLD = 16;
const MAX_LABEL_LENGTH = 5;

// Phase colors
const phaseColors = {
    'Initiate': '#c1e5f5',
    'Evaluate': '#f6c6ad',
    'Develop': '#84e291',
    'Deploy': '#e59edd',
    'Sustain': '#156082',
    'Close': '#006400', // dark green
    'Unphased': '#bfbfbf'
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

    // Get unique sub-program names
    const subProgramNames = Array.from(new Set(subProgramData
        .filter(item => item.COE_ROADMAP_PARENT_ID === item.CHILD_ID)
        .map(item => item.COE_ROADMAP_PARENT_NAME)
    ));

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
            inv.ROADMAP_ELEMENT === "Investment" && inv.TASK_NAME === "Unphased"
        );
        
        const phasedTasks = investmentData.filter(inv => 
            inv.ROADMAP_ELEMENT === "Investment" && inv.TASK_NAME !== "Unphased" && 
            ['Initiate', 'Evaluate', 'Develop', 'Deploy', 'Sustain', 'Close'].includes(inv.TASK_NAME)
        );

        console.log('Unphased tasks:', unphasedTasks.length);
        console.log('Phased tasks:', phasedTasks.length);

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
        
        console.log('Milestones for', subProgramId, ':', milestones.length);
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

    const calculateBarHeight = (project) => {
        const textLines = Math.ceil(project.name.length / 30);
        const nameHeight = BASE_BAR_HEIGHT + ((textLines - 1) * 10);
        return nameHeight + 8;
    };

    const getTotalHeight = () => {
        return filteredData.reduce((total, project) => {
            const barHeight = calculateBarHeight(project);
            return total + barHeight + 4;
        }, 20);
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
                                .reduce((total, p) => total + calculateBarHeight(p) + 4, 6);

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
                                        outline: '1px solid rgba(0, 0, 0, 0.08)',
                                        cursor: 'default'
                                    }}
                                >
                                    <div className="flex items-center justify-between w-full">
                                        <span>{project.name}</span>
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
                                    .reduce((total, p) => total + calculateBarHeight(p) + 4, 6);

                                const totalHeight = calculateBarHeight(project);
                                
                                console.log('Rendering project:', project.name, 'ID:', project.id);
                                console.log('Project data:', project);

                                // Get investment data for this sub-program
                                const investmentData = getInvestmentData(project.id);
                                const { unphasedTasks, phasedTasks } = processTasks(investmentData);
                                const milestones = project.milestones || [];
                                const nextMilestone = getNextUpcomingMilestone(milestones);

                                console.log('Investment data count:', investmentData.length);
                                console.log('Unphased tasks:', unphasedTasks.length);
                                console.log('Phased tasks:', phasedTasks.length);
                                console.log('Milestones:', milestones.length);

                                return (
                                    <g key={`project-${project.id}`} className="project-group">
                                        {/* Render a simple Gantt bar based on project start/end dates */}
                                        {project.startDate && project.endDate && (
                                            <rect
                                                key={`bar-${project.id}`}
                                                x={calculatePosition(parseDate(project.startDate), startDate)}
                                                y={yOffset + (totalHeight - 18) / 2}
                                                width={Math.max(calculatePosition(parseDate(project.endDate), startDate) - calculatePosition(parseDate(project.startDate), startDate), 2)}
                                                height={18}
                                                rx={4}
                                                fill={project.status ? statusColors[project.status] : statusColors.Grey}
                                                className="transition-opacity duration-150 hover:opacity-90"
                                            />
                                        )}

                                        {/* Render Unphased Tasks */}
                                        {unphasedTasks.map((task, taskIndex) => {
                                            const startX = calculatePosition(parseDate(task.TASK_START), startDate);
                                            const endX = calculatePosition(parseDate(task.TASK_FINISH), startDate);
                                            const width = endX - startX;

                                            return (
                                                <rect
                                                    key={`unphased-${taskIndex}`}
                                                    x={startX}
                                                    y={yOffset + (totalHeight - 18) / 2}
                                                    width={Math.max(width, 2)}
                                                    height={18}
                                                    rx={4}
                                                    fill={phaseColors.Unphased}
                                                    className="transition-opacity duration-150 hover:opacity-90"
                                                />
                                            );
                                        })}

                                        {/* Render Phased Tasks */}
                                        {phasedTasks.map((task, taskIndex) => {
                                            const startX = calculatePosition(parseDate(task.TASK_START), startDate);
                                            const endX = calculatePosition(parseDate(task.TASK_FINISH), startDate);
                                            const width = endX - startX;

                                            return (
                                                <rect
                                                    key={`phased-${taskIndex}`}
                                                    x={startX}
                                                    y={yOffset + (totalHeight - 18) / 2}
                                                    width={Math.max(width, 2)}
                                                    height={18}
                                                    rx={4}
                                                    fill={phaseColors[task.TASK_NAME] || phaseColors.Unphased}
                                                    className="transition-opacity duration-150 hover:opacity-90"
                                                />
                                            );
                                        })}

                                        {/* Render Milestones */}
                                        {milestones.map((milestone, mIndex) => {
                                            const milestoneX = calculatePosition(parseDate(milestone.date), startDate);
                                            const isNextMilestone = nextMilestone && milestone.date === nextMilestone.date;

                                            return (
                                                <MilestoneMarker
                                                    key={`${project.id}-milestone-${mIndex}`}
                                                    x={milestoneX}
                                                    y={yOffset + (totalHeight - 18) / 2 + 9}
                                                    complete={milestone.status}
                                                    label={isNextMilestone ? milestone.label : ''}
                                                    isSG3={milestone.isSG3}
                                                    labelPosition="below"
                                                    shouldWrapText={false}
                                                    isGrouped={false}
                                                    groupLabels={[]}
                                                    truncatedLabel={isNextMilestone ? milestone.label : ''}
                                                    hasAdjacentMilestones={false}
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
    );
};

export default SubProgramGanttChart;