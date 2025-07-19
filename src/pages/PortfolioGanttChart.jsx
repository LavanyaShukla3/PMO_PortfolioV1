// import React, { useState, useEffect } from 'react';
// import TimelineAxis from '../components/TimelineAxis';
// import GanttBar from '../components/GanttBar';
// import { getTimelineRange, parseDate, calculatePosition } from '../utils/dateUtils';
// import { processPortfolioData } from '../services/dataService';

// const PortfolioGanttChart = () => {
//     const [processedData, setProcessedData] = useState([]);
//     const [filteredData, setFilteredData] = useState([]);
//     const [selectedParent, setSelectedParent] = useState('All');


//     const { startDate, endDate } = getTimelineRange();

//     const CHART_WIDTH = 1200;
//     const LABEL_WIDTH = 200;
//     const BASE_BAR_HEIGHT = 40;
//     const MILESTONE_LABEL_HEIGHT = 24;

//     useEffect(() => {
//         const data = processPortfolioData();
//         setProcessedData(data);
//         setFilteredData(data);
//     }, []);

//     // Get distinct COE_ROADMAP_PARENT_NAME values
//     const parentNames = ['All', ...Array.from(new Set(processedData.map(item => item.parentName)))];


//     const handleParentChange = (e) => {
//         const value = e.target.value;
//         setSelectedParent(value);

//         if (value === 'All') {
//             setFilteredData(processedData);
//         } else {
//             setFilteredData(processedData.filter(item => item.parentName === value));
//         }
//     };

//     const calculateBarHeight = (project) => {
//         const textLines = Math.ceil(project.name.length / 30);
//         const hasMilestones = project.milestones && project.milestones.length > 0;
//         return BASE_BAR_HEIGHT + ((textLines - 1) * 16) + (hasMilestones ? MILESTONE_LABEL_HEIGHT : 0);
//     };

//     const getTotalHeight = () => {
//         return filteredData.reduce((total, project) => {
//             const barHeight = calculateBarHeight(project);
//             return total + barHeight + 16;
//         }, 50);
//     };

//     return (
//         <div className="w-full">
//             <div className="flex items-center gap-4 mb-4">
//                 <label className="font-medium">Select Portfolio:</label>
//                 <select
//                     value={selectedParent}
//                     onChange={handleParentChange}
//                     className="border border-gray-300 rounded px-3 py-1 bg-white"
//                 >
//                     {parentNames.map((name) => (
//                         <option key={name} value={name}>
//                             {name}
//                         </option>
//                     ))}
//                 </select>
//             </div>

//             <div className="w-full overflow-x-auto">
//                 <TimelineAxis startDate={startDate} />
//                 <div className="relative" style={{ minWidth: CHART_WIDTH }}>
//                     <svg
//                         className="w-full"
//                         style={{ height: Math.max(400, getTotalHeight()) }}
//                     >
//                         {filteredData.map((project, index) => {
//                             let yOffset = filteredData
//                                 .slice(0, index)
//                                 .reduce((total, p) => total + calculateBarHeight(p) + 16, 20);

//                             const projectStartDate = parseDate(project.startDate);
//                             const projectEndDate = parseDate(project.endDate);

//                             const startX = calculatePosition(
//                                 projectStartDate,
//                                 startDate,
//                                 CHART_WIDTH - LABEL_WIDTH
//                             ) + LABEL_WIDTH;

//                             const width = calculatePosition(
//                                 projectEndDate,
//                                 projectStartDate,
//                                 CHART_WIDTH - LABEL_WIDTH
//                             );

//                             return (
//                                 <GanttBar
//                                     key={project.id}
//                                     data={project}
//                                     y={yOffset}
//                                     startX={startX}
//                                     width={width}
//                                     label={project.name}
//                                     status={project.status}
//                                     milestones={project.milestones.map(m => ({
//                                         ...m,
//                                         x: calculatePosition(
//                                             parseDate(m.date),
//                                             startDate,
//                                             CHART_WIDTH - LABEL_WIDTH
//                                         ) + LABEL_WIDTH
//                                     }))}
//                                     onBarClick={() => console.log('Project clicked:', project.id)}
//                                 />
//                             );
//                         })}
//                     </svg>
//                 </div>
//             </div>
//         </div>
//     );
// };

// export default PortfolioGanttChart;

import React, { useState, useEffect } from 'react';
import TimelineAxis from '../components/TimelineAxis';
import GanttBar from '../components/GanttBar';
import MilestoneMarker from '../components/MilestoneMarker';
import { getTimelineRange, parseDate, calculatePosition } from '../utils/dateUtils';
import { processPortfolioData } from '../services/dataService';

// Layout Constants
const CHART_WIDTH = 1200;
const LABEL_WIDTH = 200;
const BAR_HEIGHT = 22;
const MILESTONE_VERTICAL_GAP = 20;
const MILESTONE_LABEL_HEIGHT = 24;
const PROJECT_PADDING = 16;
const MILESTONE_HORIZONTAL_THRESHOLD = 100;

// --- Milestone stagger logic ---
const calculateMilestoneOffsets = (milestones) => {
    if (!milestones?.length) return [];
    const sortedMilestones = [...milestones].sort((a, b) => a.x - b.x);
    const groups = [];
    let currentGroup = [sortedMilestones[0]];

    for (let i = 1; i < sortedMilestones.length; i++) {
        const prev = sortedMilestones[i - 1];
        const curr = sortedMilestones[i];
        if (curr.x - prev.x <= MILESTONE_HORIZONTAL_THRESHOLD) {
            currentGroup.push(curr);
        } else {
            groups.push(currentGroup);
            currentGroup = [curr];
        }
    }
    groups.push(currentGroup);

    return sortedMilestones.map(milestone => {
        const group = groups.find(g => g.includes(milestone));
        const indexInGroup = group.indexOf(milestone);
        return {
            ...milestone,
            yOffset: indexInGroup * MILESTONE_VERTICAL_GAP
        };
    });
};

// --- Component ---
const PortfolioGanttChart = () => {
    const [processedData, setProcessedData] = useState([]);
    const [selectedParent, setSelectedParent] = useState('Show All');
    const [parentNames, setParentNames] = useState([]);
    const { startDate } = getTimelineRange();

    useEffect(() => {
        const data = processPortfolioData();
        setProcessedData(data);
        const uniqueParents = ['Show All', ...Array.from(new Set(data.map(item => item.parentName)))];
        setParentNames(uniqueParents);
    }, []);

    const filteredData = selectedParent === 'Show All'
        ? processedData
        : processedData.filter(item => item.parentName === selectedParent);

    const calculateProjectSpacing = (project, index) => {
        const milestonesWithPositions = project.milestones.map(m => ({
            ...m,
            x: calculatePosition(parseDate(m.date), startDate, CHART_WIDTH - LABEL_WIDTH) + LABEL_WIDTH
        }));

        const staggeredMilestones = calculateMilestoneOffsets(milestonesWithPositions);
        const maxMilestoneOffset = Math.max(0, ...staggeredMilestones.map(m => m.yOffset || 0));
        const milestoneSpace = maxMilestoneOffset + MILESTONE_LABEL_HEIGHT;

        let yPosition = PROJECT_PADDING;
        for (let i = 0; i < index; i++) {
            const prev = filteredData[i];
            const prevMilestones = calculateMilestoneOffsets(
                prev.milestones.map(m => ({
                    ...m,
                    x: calculatePosition(parseDate(m.date), startDate, CHART_WIDTH - LABEL_WIDTH) + LABEL_WIDTH
                }))
            );
            const prevMaxOffset = Math.max(0, ...prevMilestones.map(m => m.yOffset || 0));
            yPosition += BAR_HEIGHT + prevMaxOffset + MILESTONE_LABEL_HEIGHT + PROJECT_PADDING;
        }

        return {
            y: yPosition,
            height: BAR_HEIGHT,
            totalSpace: BAR_HEIGHT + milestoneSpace + PROJECT_PADDING,
            staggeredMilestones
        };
    };

    return (
        <div className="w-full">
            <div className="flex justify-between items-center mb-4">
                <div>
                <select
    className="
        rounded px-3 py-2 text-sm 
        shadow-md focus:outline-none
        focus:ring-2 focus:ring-blue-400
        bg-white
        border-none
    "
    value={selectedParent}
    onChange={(e) => setSelectedParent(e.target.value)}
>
    {parentNames.map(name => (
        <option key={name} value={name}>
            {name}
        </option>
    ))}
</select>

                </div>
            </div>

            <div className="w-full overflow-x-auto">
                <TimelineAxis startDate={startDate} />
                <div className="relative" style={{ minWidth: CHART_WIDTH }}>
                    <svg
                        className="w-full"
                        style={{
                            height: filteredData.reduce((total, project, idx) =>
                                total + calculateProjectSpacing(project, idx).totalSpace,
                                PROJECT_PADDING
                            )
                        }}
                    >
                        {filteredData.map((project, index) => {
                            const { y, height, staggeredMilestones } = calculateProjectSpacing(project, index);
                            const projectStart = parseDate(project.startDate);
                            const projectEnd = parseDate(project.endDate);
                            const startX = calculatePosition(projectStart, startDate, CHART_WIDTH - LABEL_WIDTH) + LABEL_WIDTH;
                            const width = calculatePosition(projectEnd, projectStart, CHART_WIDTH - LABEL_WIDTH);

                            return (
                                <g key={project.id}>
                                    <GanttBar
                                        data={project}
                                        y={y}
                                        height={height}
                                        startX={startX}
                                        width={width}
                                        label={project.name}
                                        status={project.status}
                                        onBarClick={() => console.log('Project clicked:', project.id)}
                                    />

                                    {staggeredMilestones.map((milestone, mIndex) => (
                                        <MilestoneMarker
                                            key={`${project.id}-milestone-${mIndex}`}
                                            x={milestone.x}
                                            y={y + height / 2}
                                            yOffset={milestone.yOffset || 0}
                                            complete={milestone.status}
                                            label={milestone.label}
                                            isSG3={milestone.isSG3}
                                        />
                                    ))}
                                </g>
                            );
                        })}
                    </svg>
                </div>
            </div>
        </div>
    );
};

export default PortfolioGanttChart;
