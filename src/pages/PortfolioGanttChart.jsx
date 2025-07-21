import React, { useState, useEffect, useRef } from 'react';
import TimelineAxis from '../components/TimelineAxis';
import GanttBar from '../components/GanttBar';
import { getTimelineRange, parseDate, calculatePosition } from '../utils/dateUtils';
import { processPortfolioData } from '../services/dataService';

const MONTH_WIDTH = 100;
const TOTAL_MONTHS = 73;
const LABEL_WIDTH = 200;
const BASE_BAR_HEIGHT = 40;
const MILESTONE_LABEL_HEIGHT = 24;

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
            scrollContainerRef.current.scrollLeft = 3700;
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
        return BASE_BAR_HEIGHT + ((textLines - 1) * 16) + (hasMilestones ? MILESTONE_LABEL_HEIGHT : 0);
    };

    const getTotalHeight = () => {
        return filteredData.reduce((total, project) => {
            const barHeight = calculateBarHeight(project);
            return total + barHeight + 16;
        }, 50);
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
                    <div style={{ height: 40, padding: '8px', fontWeight: 600 }}>Portfolios</div>
                    <div style={{ position: 'relative', height: getTotalHeight() }}>
                        {filteredData.map((project, index) => {
                            const yOffset = filteredData
                                .slice(0, index)
                                .reduce((total, p) => total + calculateBarHeight(p) + 16, 20);
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
                                    }}
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
                            {filteredData.map((project, index) => {
                                const yOffset = filteredData
                                    .slice(0, index)
                                    .reduce((total, p) => total + calculateBarHeight(p) + 16, 20);

                                const projectStartDate = parseDate(project.startDate);
                                const projectEndDate = parseDate(project.endDate);

                                const startX = calculatePosition(projectStartDate, startDate) + LABEL_WIDTH;
                                const endX = calculatePosition(projectEndDate, startDate) + LABEL_WIDTH;
                                const width = endX - startX;

                                const milestones = project.milestones.map(m => {
                                    const milestoneDate = parseDate(m.date);
                                    const x = calculatePosition(milestoneDate, startDate) + LABEL_WIDTH;
                                    return { ...m, x };
                                });

                                return (
                                    <GanttBar
                                        key={project.id}
                                        data={project}
                                        y={yOffset}
                                        startX={startX}
                                        width={width}
                                        label={project.name}
                                        status={project.status}
                                        milestones={milestones}
                                        onBarClick={() => console.log('Portfolio clicked:', project.id)}
                                    />
                                );
                            })}
                        </svg>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PortfolioGanttChart;
