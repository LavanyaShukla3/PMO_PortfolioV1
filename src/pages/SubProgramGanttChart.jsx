import React, { useState, useEffect, useRef } from 'react';
import TimelineAxis from '../components/TimelineAxis';
import MilestoneMarker from '../components/MilestoneMarker';
import GanttBar from '../components/GanttBar';
import { getTimelineRange, parseDate, calculatePosition } from '../utils/dateUtils';
import { processSubProgramData } from '../services/apiDataService';

const ZOOM_LEVELS = {
    0.5: { MONTH_WIDTH: 40, VISIBLE_MONTHS: 24, FONT_SIZE: '8px', LABEL_WIDTH: 100, BASE_BAR_HEIGHT: 4, TOUCH_TARGET_SIZE: 20, MILESTONE_LABEL_HEIGHT: 6, MILESTONE_FONT_SIZE: '7px', PROJECT_SCALE: 2.0, ROW_PADDING: 4 },
    0.75: { MONTH_WIDTH: 60, VISIBLE_MONTHS: 18, FONT_SIZE: '10px', LABEL_WIDTH: 140, BASE_BAR_HEIGHT: 6, TOUCH_TARGET_SIZE: 20, MILESTONE_LABEL_HEIGHT: 9, MILESTONE_FONT_SIZE: '9px', PROJECT_SCALE: 1.5, ROW_PADDING: 6 },
    1.0: { MONTH_WIDTH: 100, VISIBLE_MONTHS: 13, FONT_SIZE: '14px', LABEL_WIDTH: 200, BASE_BAR_HEIGHT: 16, TOUCH_TARGET_SIZE: 24, MILESTONE_LABEL_HEIGHT: 12, MILESTONE_FONT_SIZE: '10px', PROJECT_SCALE: 1.0, ROW_PADDING: 8 },
    1.25: { MONTH_WIDTH: 125, VISIBLE_MONTHS: 10, FONT_SIZE: '16px', LABEL_WIDTH: 250, BASE_BAR_HEIGHT: 20, TOUCH_TARGET_SIZE: 30, MILESTONE_LABEL_HEIGHT: 15, MILESTONE_FONT_SIZE: '12px', PROJECT_SCALE: 0.7, ROW_PADDING: 12 },
    1.5: { MONTH_WIDTH: 150, VISIBLE_MONTHS: 8, FONT_SIZE: '18px', LABEL_WIDTH: 300, BASE_BAR_HEIGHT: 24, TOUCH_TARGET_SIZE: 36, MILESTONE_LABEL_HEIGHT: 18, MILESTONE_FONT_SIZE: '14px', PROJECT_SCALE: 0.5, ROW_PADDING: 16 }
};

const getResponsiveConstants = (zoomLevel = 1.0) => {
    const screenWidth = window.innerWidth;
    const isMobile = screenWidth < 768;
    const zoomConfig = ZOOM_LEVELS[zoomLevel] || ZOOM_LEVELS[1.0];
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

const phaseColors = {
    'Initiate': '#c1e5f5', 'Evaluate': '#f6c6ad', 'Develop': '#84e291', 'Deploy': '#e59edd',
    'Sustain': '#156082', 'Close': '#006400', 'Unphased': '#9ca3af'
};

const statusColors = {
    'Red': '#ef4444', 'Amber': '#f59e0b', 'Green': '#10b981', 'Grey': '#9ca3af', 'Yellow': '#E5DE00'
};

const SubProgramGanttChart = () => {
    const [processedData, setProcessedData] = useState([]);
    const [filteredData, setFilteredData] = useState([]);
    const [selectedSubProgram, setSelectedSubProgram] = useState('All');
    const [zoomLevel, setZoomLevel] = useState(1.0);
    const [responsiveConstants, setResponsiveConstants] = useState(getResponsiveConstants(1.0));
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const timelineScrollRef = useRef(null);
    const ganttScrollRef = useRef(null);
    const leftPanelScrollRef = useRef(null);

    const { startDate } = getTimelineRange();
    const totalWidth = responsiveConstants.MONTH_WIDTH * responsiveConstants.TOTAL_MONTHS;

    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);
                setError(null);
                console.log('🚀 Loading sub-program data from backend API...');
                
                const data = await processSubProgramData();
                console.log('📊 API returned data:', data);
                
                if (data && data.projects) {
                    setProcessedData(data.projects);
                    setFilteredData(data.projects);
                    console.log(`✅ Successfully loaded ${data.projects.length} sub-program projects from API`);
                } else {
                    console.log('⚠️ No projects found in API response');
                    setProcessedData([]);
                    setFilteredData([]);
                }

                setTimeout(() => {
                    if (timelineScrollRef.current) {
                        const monthsFromStart = 36;
                        const scrollPosition = (monthsFromStart - 2) * responsiveConstants.MONTH_WIDTH;
                        timelineScrollRef.current.scrollLeft = scrollPosition;
                        if (ganttScrollRef.current) {
                            ganttScrollRef.current.scrollLeft = scrollPosition;
                        }
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
    }, [responsiveConstants.MONTH_WIDTH]);

    useEffect(() => {
        const handleResize = () => {
            setResponsiveConstants(getResponsiveConstants(zoomLevel));
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [zoomLevel]);

    useEffect(() => {
        setResponsiveConstants(getResponsiveConstants(zoomLevel));
    }, [zoomLevel]);

    const subProgramNames = ['All', ...Array.from(new Set(processedData
        .filter(item => item.isSubProgram)
        .map(item => item.name)
    ))];

    const handleSubProgramChange = (e) => {
        const value = e.target.value;
        setSelectedSubProgram(value);
        if (value === 'All') {
            setFilteredData(processedData);
        } else {
            const selectedSubProgramData = processedData.find(item => 
                item.isSubProgram && item.name === value
            );
            if (selectedSubProgramData) {
                const subProgramAndChildren = processedData.filter(item => 
                    item.parentId === selectedSubProgramData.id
                );
                setFilteredData(subProgramAndChildren);
            }
        }
    };

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
        if (leftPanelScrollRef.current && leftPanelScrollRef.current.scrollTop !== scrollTop) {
            leftPanelScrollRef.current.scrollTop = scrollTop;
        }
    };

    const handleLeftPanelScroll = (e) => {
        const scrollTop = e.target.scrollTop;
        if (ganttScrollRef.current && ganttScrollRef.current.scrollTop !== scrollTop) {
            ganttScrollRef.current.scrollTop = scrollTop;
        }
    };

    const processPhases = (project) => {
        if (!project?.phaseData || !Array.isArray(project.phaseData)) {
            return { unphasedTasks: [], phasedTasks: [] };
        }
        
        // Extract phases from the phaseData array
        const unphasedTasks = project.phaseData.filter(phase => 
            phase.TASK_NAME === "Unphased"
        );
        
        const phasedTasks = project.phaseData.filter(phase => 
            phase.TASK_NAME !== "Unphased" && 
            ['Initiate', 'Evaluate', 'Develop', 'Deploy', 'Sustain', 'Close'].includes(phase.TASK_NAME)
        );
        
        // Sort phases in proper order
        const phaseOrder = ['Initiate', 'Evaluate', 'Develop', 'Deploy', 'Sustain', 'Close'];
        phasedTasks.sort((a, b) => {
            const aIndex = phaseOrder.indexOf(a.TASK_NAME);
            const bIndex = phaseOrder.indexOf(b.TASK_NAME);
            return aIndex - bIndex;
        });
        
        return { unphasedTasks, phasedTasks };
    };

    const getMilestones = (project) => {
        if (!project?.milestones || !Array.isArray(project.milestones)) return [];
        
        return project.milestones.filter(milestone =>
            milestone.TASK_NAME?.toLowerCase().includes('sg3')
        ).map(milestone => ({
            date: milestone.TASK_START,
            status: milestone.MILESTONE_STATUS,
            label: milestone.TASK_NAME,
            isSG3: true
        }));
    };

    const calculateRowHeight = (project) => {
        const baseHeight = responsiveConstants.BASE_BAR_HEIGHT;
        const extraPadding = project.isSubProgram ? 16 : 8;
        const milestoneHeight = project.milestones?.length > 0 ? 20 : 0;
        return baseHeight + extraPadding + milestoneHeight + responsiveConstants.ROW_PADDING;
    };

    if (loading) {
        return (
            <div className="container mx-auto p-4">
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
                    <span className="ml-4 text-lg text-gray-600">Loading sub-program data...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="container mx-auto p-4">
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                    <h3 className="text-lg font-semibold text-red-800 mb-2">Failed to Load Sub-Program Data</h3>
                    <p className="text-red-600 mb-4">{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    // Debug output - remove after testing
    console.log('🔍 Component render - filteredData:', filteredData);
    console.log('🔍 Component render - filteredData length:', filteredData?.length);

    if (!filteredData || filteredData.length === 0) {
        return (
            <div className="container mx-auto p-4">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
                    <h3 className="text-lg font-semibold text-yellow-800 mb-2">No Sub-Program Data Available</h3>
                    <p className="text-yellow-600">No sub-programs found in the current dataset.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Sub-Program Gantt Chart</h1>
                <p className="text-gray-600">Live data from Azure Databricks - {filteredData.length} projects</p>
            </div>

            <div className="flex flex-wrap items-center gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                    <label htmlFor="subProgram" className="text-sm font-medium text-gray-700">Sub-Program:</label>
                    <select id="subProgram" value={selectedSubProgram} onChange={handleSubProgramChange} className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        {subProgramNames.map(name => (
                            <option key={name} value={name}>{name}</option>
                        ))}
                    </select>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">Zoom:</span>
                    <button onClick={handleZoomOut} disabled={zoomLevel <= 0.5} className="px-2 py-1 text-xs border border-gray-300 rounded disabled:opacity-50 hover:bg-gray-100">-</button>
                    <span className="px-2 py-1 text-xs bg-white border border-gray-300 rounded min-w-[3rem] text-center">{Math.round(zoomLevel * 100)}%</span>
                    <button onClick={handleZoomIn} disabled={zoomLevel >= 1.5} className="px-2 py-1 text-xs border border-gray-300 rounded disabled:opacity-50 hover:bg-gray-100">+</button>
                    <button onClick={handleZoomReset} className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100">Reset</button>
                </div>
            </div>

            <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                <div className="flex">
                    <div className="bg-gray-100 border-r border-gray-200 flex-shrink-0" style={{ width: responsiveConstants.LABEL_WIDTH }}>
                        <div className="p-3 font-medium text-gray-900 text-sm">Project Name</div>
                    </div>
                    <div className="flex-1">
                        <div ref={timelineScrollRef} className="overflow-x-auto scrollbar-thin scrollbar-track-gray-100 scrollbar-thumb-gray-400" onScroll={handleTimelineScroll} style={{ width: '100%' }}>
                            <TimelineAxis startDate={startDate} totalMonths={responsiveConstants.TOTAL_MONTHS} monthWidth={responsiveConstants.MONTH_WIDTH} fontSize={responsiveConstants.FONT_SIZE} />
                        </div>
                    </div>
                </div>

                <div className="flex">
                    <div ref={leftPanelScrollRef} className="bg-gray-50 border-r border-gray-200 flex-shrink-0 overflow-y-auto" style={{ width: responsiveConstants.LABEL_WIDTH, maxHeight: '600px' }} onScroll={handleLeftPanelScroll}>
                        {filteredData.map((project, index) => {
                            const rowHeight = calculateRowHeight(project);
                            return (
                                <div key={project.id} className={`p-3 border-b border-gray-200 flex items-center ${project.isSubProgram ? 'bg-blue-50 font-semibold' : 'bg-white'}`} style={{ minHeight: rowHeight }}>
                                    <div className="text-sm text-gray-900 truncate" title={project.name}>{project.name}</div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="flex-1">
                        <div ref={ganttScrollRef} className="overflow-auto scrollbar-thin scrollbar-track-gray-100 scrollbar-thumb-gray-400" style={{ width: '100%', maxHeight: '600px' }} onScroll={handleGanttScroll}>
                            <svg width={totalWidth} height={filteredData.reduce((total, project) => total + calculateRowHeight(project), 0)} className="block">
                                {filteredData.map((project, index) => {
                                    const yOffset = filteredData.slice(0, index).reduce((total, p) => total + calculateRowHeight(p), 0);
                                    const rowHeight = calculateRowHeight(project);
                                    return (
                                        <rect key={`bg-${project.id}`} x={0} y={yOffset} width={totalWidth} height={rowHeight} fill={index % 2 === 0 ? '#ffffff' : '#f9fafb'} />
                                    );
                                })}

                                {filteredData.map((project, index) => {
                                    const yOffset = filteredData.slice(0, index).reduce((total, p) => total + calculateRowHeight(p), 0);
                                    const rowHeight = calculateRowHeight(project);
                                    const { unphasedTasks, phasedTasks } = processPhases(project);
                                    const milestones = getMilestones(project);

                                    return (
                                        <g key={project.id}>
                                            {unphasedTasks.map((task, taskIndex) => {
                                                const startDate = parseDate(task.TASK_START);
                                                const endDate = parseDate(task.TASK_FINISH);
                                                if (!startDate || !endDate) return null;
                                                return (
                                                    <GanttBar key={`unphased-${taskIndex}`} x={calculatePosition(startDate, getTimelineRange().startDate)} y={yOffset + (rowHeight - responsiveConstants.BASE_BAR_HEIGHT) / 2} width={Math.max(calculatePosition(endDate, getTimelineRange().startDate) - calculatePosition(startDate, getTimelineRange().startDate), 2)} height={responsiveConstants.BASE_BAR_HEIGHT} color={phaseColors.Unphased} label="Unphased" className="transition-opacity duration-150 hover:opacity-90" />
                                                );
                                            })}

                                            {phasedTasks.map((task, taskIndex) => {
                                                const startDate = parseDate(task.TASK_START);
                                                const endDate = parseDate(task.TASK_FINISH);
                                                if (!startDate || !endDate) return null;
                                                return (
                                                    <GanttBar key={`phased-${taskIndex}`} x={calculatePosition(startDate, getTimelineRange().startDate)} y={yOffset + (rowHeight - responsiveConstants.BASE_BAR_HEIGHT) / 2} width={Math.max(calculatePosition(endDate, getTimelineRange().startDate) - calculatePosition(startDate, getTimelineRange().startDate), 2)} height={responsiveConstants.BASE_BAR_HEIGHT} color={phaseColors[task.TASK_NAME] || phaseColors.Unphased} label={task.TASK_NAME} className="transition-opacity duration-150 hover:opacity-90" />
                                                );
                                            })}

                                            {milestones.map((milestone, mIndex) => {
                                                const milestoneDate = parseDate(milestone.date);
                                                if (!milestoneDate) return null;
                                                const x = calculatePosition(milestoneDate, getTimelineRange().startDate);
                                                return (
                                                    <MilestoneMarker key={`milestone-${mIndex}`} x={x} y={yOffset + (rowHeight - responsiveConstants.BASE_BAR_HEIGHT) / 2 + (responsiveConstants.BASE_BAR_HEIGHT / 2)} complete={milestone.status} label={milestone.label} isSG3={milestone.isSG3} fontSize={responsiveConstants.MILESTONE_FONT_SIZE} isMobile={responsiveConstants.TOUCH_TARGET_SIZE > 24} zoomLevel={responsiveConstants.ZOOM_LEVEL} />
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