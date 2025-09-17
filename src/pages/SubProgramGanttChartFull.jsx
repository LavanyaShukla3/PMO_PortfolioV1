import React, { useState, useEffect, useRef } from 'react';
import TimelineAxis from '../components/TimelineAxis';
import MilestoneMarker from '../components/MilestoneMarker';
import GanttBar from '../components/GanttBar';
import { getTimelineRange, parseDate, calculatePosition, calculateMilestonePosition, groupMilestonesByMonth, getMonthlyLabelPosition, getInitialScrollPosition, truncateLabel } from '../utils/dateUtils';
import { fetchSubProgramData } from '../services/progressiveApiService';

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

const SubProgramGanttChart = ({ selectedSubProgramId, selectedSubProgramName, selectedProgramName, selectedProgramId, onNavigateUp, onBackToProgram }) => {
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

    // Simplified milestone processing to prevent infinite loops
    const processMilestonesForProject = (milestones, startDate, monthWidth, projectEndDate = null) => {
        if (!milestones || milestones.length === 0) return [];
        
        try {
            // CRITICAL FIX: Use the correct date property for grouping milestones
            const monthlyGroups = groupMilestonesByMonth(milestones, 'MILESTONE_DATE');
            const processedMilestones = [];

            // Step 2: Process each monthly group to handle overlaps.
            Object.entries(monthlyGroups).forEach(([monthKey, monthMilestones]) => {
                // Determine if labels should be 'above' or 'below' the bar for this month.
                const labelPosition = getMonthlyLabelPosition(monthKey);

                // Create a stack of vertical labels for all milestones in this month.
                // This prevents them from drawing on top of each other.
                const verticalLabels = monthMilestones.map(m => m.MILESTONE_NAME || m.TASK_NAME || 'Milestone');

                // Step 3: Create a single, consolidated milestone marker for the month.
                const firstMilestoneInMonth = monthMilestones[0];
                const milestoneDate = parseDate(firstMilestoneInMonth.MILESTONE_DATE);
                if (!milestoneDate) return;

                const x = calculateMilestonePosition(milestoneDate, startDate, monthWidth, projectEndDate);

                processedMilestones.push({
                    ...firstMilestoneInMonth,
                    x,
                    date: milestoneDate,
                    // Extract status correctly for milestone display
                    status: firstMilestoneInMonth.STATUS === 'Completed' ? 'Completed' : 'Incomplete',
                    label: firstMilestoneInMonth.MILESTONE_NAME || firstMilestoneInMonth.TASK_NAME || 'Milestone',
                    isSG3: firstMilestoneInMonth.MILESTONE_NAME?.includes('SG3') || firstMilestoneInMonth.TASK_NAME?.includes('SG3'),
                    isGrouped: monthMilestones.length > 1,
                    isMonthlyGrouped: true,
                    labelPosition: labelPosition,
                    verticalLabels: verticalLabels,
                    horizontalLabel: '',
                    showLabel: true,
                    fullLabel: verticalLabels.join(', '),
                    shouldRenderShape: true,
                    shouldWrapText: false,
                    hasAdjacentMilestones: false,
                    monthKey: monthKey,
                    groupLabels: monthMilestones.length > 1 ? verticalLabels : [],
                    monthlyLabels: [],
                    allMilestonesInProject: milestones,
                    currentMilestoneDate: milestoneDate
                });
            });

            return processedMilestones.sort((a, b) => a.date - b.date);
        } catch (error) {
            console.error('🎯 Error in milestone processing:', error);
            return [];
        }
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
                // Force fresh data by adding timestamp to avoid caching
                const result = await fetchSubProgramData(null, { 
                    page: 1, 
                    limit: 15000, // Increased to get all records like CaTAlyst
                    _timestamp: Date.now() // Force fresh request
                });
                
                
                // Add the sample data to the existing data for testing
                const combinedProjects = [...(result.projects || [])];
                
                // TEMPORARILY DISABLED: Remove sample project to see pure API result
                // Add sample project
                /*
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
                */
                
                const combinedData = {
                    ...result,
                    projects: combinedProjects
                };
                
                // Extract unique program names from projects (like the original logic)
                const uniquePrograms = new Set();
                combinedProjects.forEach(project => {
                    if (project.COE_ROADMAP_PARENT_NAME && project.COE_ROADMAP_PARENT_NAME.trim()) {
                        uniquePrograms.add(project.COE_ROADMAP_PARENT_NAME);
                    }
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
                console.error('❌ Failed to load sub-program data from progressiveApiService:', err);
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
        if (!milestones?.length) return 0;

        try {
            // Process milestones to get their positions and grouping info
            const processedMilestones = processMilestonesForProject(milestones, startDate, monthWidth);

            let maxAboveHeight = 0;
            let maxBelowHeight = 0;
            const LINE_HEIGHT = 12;
            const LABEL_PADDING = 25; // Increased padding for labels
            const ABOVE_LABEL_OFFSET = 35; // Increased space needed above the bar for labels
            const BELOW_LABEL_OFFSET = 30; // Increased space needed below the bar for labels

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

            // Add minimum spacing to ensure adequate separation even with few milestones
            const totalLabelHeight = maxAboveHeight + maxBelowHeight;
            const minimumSpacing = 50; // Minimum 50px spacing for milestone labels
            
            return Math.max(totalLabelHeight, minimumSpacing);
        } catch (error) {
            console.warn('Error calculating milestone label height:', error);
            return 60; // Increased fallback height if there's an error
        }
    };

    // Calculate row height for each project (matching PortfolioGanttChart logic)
    const calculateBarHeight = (project, processedMilestones = null) => {
        // Get responsive constants for this calculation
        const constants = getResponsiveConstants();
        
        // For SubProgramGanttChart, we want consistent row heights
        // that work well with the GanttBar component centering logic
        const baseHeight = constants.TOUCH_TARGET_SIZE;
        const minHeight = Math.max(baseHeight, 32);
        
        // Calculate height needed for milestone labels to prevent overlap
        let milestoneLabelHeight = 0;
        if (processedMilestones?.length > 0) {
            milestoneLabelHeight = calculateMilestoneLabelHeight(processedMilestones, constants.MONTH_WIDTH);
        } else if (project?.milestones?.length > 0) {
            milestoneLabelHeight = calculateMilestoneLabelHeight(project.milestones, constants.MONTH_WIDTH);
        }
        
        // Return total height needed: base height + milestone label height
        return Math.max(minHeight, baseHeight + milestoneLabelHeight);
    };

    // Render the main Gantt chart content
    const renderGanttChart = () => {
        if (!data || !data.projects || data.projects.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center h-64">
                    <div className="text-lg text-gray-600">No sub-program data available</div>
                    <div className="text-sm text-gray-500 mt-2">Try selecting a different program or check your filters</div>
                </div>
            );
        }

        const constants = getResponsiveConstants();
        let projects = data.projects || [];
        const milestones = data.milestones || [];

        console.log('🎯 MAIN PROCESSING: Starting with', projects.length, 'projects');
        console.log('🎯 MAIN PROCESSING: First 3 project names:', projects.slice(0, 3).map(p => p.PROJECT_NAME));

        // Filter out any null/undefined projects to prevent rendering errors
        projects = projects.filter(project => project && project.PROJECT_NAME);
        console.log('🎯 MAIN PROCESSING: After null filtering:', projects.length, 'projects');

        // Filter projects based on selected program
        if (selectedProgram !== 'All') {
            projects = projects.filter(project => {
                // Check both COE_ROADMAP_PARENT_NAME (from hierarchy) and INV_FUNCTION (from investment)
                return project.COE_ROADMAP_PARENT_NAME === selectedProgram || 
                       project.INV_FUNCTION === selectedProgram;
            });
        }

        // *** NEW: HIERARCHICAL GROUPING LOGIC (similar to Program GanttChart) ***
        
        // Group sub-programs by their parent programs
        const programGroups = {};
        const hierarchicalData = [];
        
        projects.forEach(project => {
            // Get the parent program name (could be from hierarchy or investment data)
            const parentName = project.COE_ROADMAP_PARENT_NAME || project.INV_FUNCTION || 'Unassigned';
            
            if (!programGroups[parentName]) {
                programGroups[parentName] = {
                    program: {
                        name: parentName,
                        PROJECT_ID: `PARENT_${parentName}`,
                        PROJECT_NAME: parentName,
                        isProgramHeader: true
                    },
                    children: []
                };
            }
            
            // Add project as child with isChildItem flag
            programGroups[parentName].children.push({
                ...project,
                isChildItem: true
            });
        });
        
        // Create flat hierarchical list: program header + indented children
        Object.values(programGroups).forEach(group => {
            // *** CALCULATE AGGREGATE DATA FOR PROGRAM HEADERS ***
            let programStartDate = null;
            let programEndDate = null;
            let programPhases = [];
            let programMilestones = [];
            
            // Aggregate data from all children projects
            group.children.forEach(child => {
                // Aggregate start and end dates
                if (child.START_DATE) {
                    const childStartDate = parseDate(child.START_DATE);
                    if (childStartDate && (!programStartDate || childStartDate < programStartDate)) {
                        programStartDate = childStartDate;
                    }
                }
                
                if (child.END_DATE) {
                    const childEndDate = parseDate(child.END_DATE);
                    if (childEndDate && (!programEndDate || childEndDate > programEndDate)) {
                        programEndDate = childEndDate;
                    }
                }
                
                // Aggregate phases (if any) - filter out null/undefined phases
                if (child.phaseData && child.phaseData.length > 0) {
                    const validChildPhases = child.phaseData.filter(phase => 
                        phase && 
                        phase.TASK_NAME && 
                        phase.TASK_START && 
                        phase.TASK_FINISH &&
                        phase.TASK_START.trim() !== '' && 
                        phase.TASK_FINISH.trim() !== ''
                    );
                    programPhases.push(...validChildPhases);
                }
                
                // *** MODIFIED: DO aggregate milestones for program headers ***
                // This follows the same pattern as Program GanttChart
                // Program headers should display milestone markers from all their children
                if (child.milestones && child.milestones.length > 0) {
                    programMilestones.push(...child.milestones);
                }
            });
            
            // Add program header with aggregated data (similar to Program GanttChart)
            hierarchicalData.push({
                ...group.program,
                isProgramHeader: true,
                displayName: `📌 ${group.program.name}`,
                originalName: group.program.name,
                // *** AGGREGATED DATA FOR GANTT BAR AND MILESTONES ***
                START_DATE: programStartDate ? programStartDate.toISOString().split('T')[0] : null,
                END_DATE: programEndDate ? programEndDate.toISOString().split('T')[0] : null,
                phaseData: programPhases, // Aggregated phases from children
                milestones: programMilestones, // *** RESTORED: Aggregated milestones from all children ***
                childrenCount: group.children.length
            });
            
            // Add indented children
            group.children.forEach(child => {
                hierarchicalData.push({
                    ...child,
                    isChildItem: true,
                    displayName: `   ${child.PROJECT_NAME}`, // Indent with spaces
                    originalName: child.PROJECT_NAME
                });
            });
        });
        
        // Use hierarchical data instead of flat projects list
        projects = hierarchicalData;
    
        // *** END HIERARCHICAL GROUPING LOGIC ***

    // Calculate timeline range from ALL project dates (including phased, unphased, and non-phased projects)
    let earliestDate = new Date();
    let latestDate = new Date();
    
    projects.forEach(project => {
        // Skip program headers when calculating timeline (they don't have real project dates)
        if (project.isProgramHeader) return;
        
        // Check phase data for phased projects
        if (project.phaseData && project.phaseData.length > 0) {
            const validProjectPhases = project.phaseData.filter(phase => 
                phase && 
                phase.TASK_NAME && 
                phase.TASK_START && 
                phase.TASK_FINISH &&
                phase.TASK_START.trim() !== '' && 
                phase.TASK_FINISH.trim() !== ''
            );
            validProjectPhases.forEach(phase => {
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
        
        // Also check project-level dates for all projects (some might have both)
        if (project.START_DATE) {
            const startDate = parseDate(project.START_DATE);
            if (startDate && startDate < earliestDate) earliestDate = startDate;
        }
        if (project.END_DATE) {
            const endDate = parseDate(project.END_DATE);
            if (endDate && endDate > latestDate) latestDate = endDate;
        }
    });

    // Add some padding to the timeline
    const startDate = new Date(earliestDate.getTime() - 90 * 24 * 60 * 60 * 1000); // 3 months before
    const endDate = new Date(latestDate.getTime() + 90 * 24 * 60 * 60 * 1000); // 3 months after
    
    const timelineWidth = constants.MONTH_WIDTH * Math.ceil((endDate - startDate) / (30 * 24 * 60 * 60 * 1000));
    
    // Process project phases for rendering - handle hierarchical structure
    const allProjectRows = [];
    projects.forEach((project, index) => {
        // Safety check for undefined projects
        if (!project) {
            console.error(`🚨 ERROR: Undefined project at index ${index} in projects array`);
            return; // Skip this iteration
        }
        
        // Handle program headers differently - they don't have real project data
        if (project.isProgramHeader) {
            console.log('🎯 HIERARCHICAL: Processing program header:', project.displayName);
            // Use aggregated phaseData for Gantt bar
            const validPhases = project.phaseData && project.phaseData.length > 0 ? project.phaseData.filter(phase =>
                phase && phase.TASK_NAME && phase.TASK_START && phase.TASK_FINISH && phase.TASK_START.trim() !== '' && phase.TASK_FINISH.trim() !== ''
            ) : [];
            
            // Use aggregated milestones from program header (already aggregated from children)
            const programMilestones = project.milestones || [];
            console.log('🎯 HIERARCHICAL: Program header has', programMilestones.length, 'aggregated milestones');
            
            allProjectRows.push({
                project: project,
                renderType: validPhases.length > 0 ? 'phases' : 'program-header',
                hasPhases: validPhases.length > 0,
                phases: validPhases,
                singleProjectPhase: validPhases.length === 0 && project.START_DATE && project.END_DATE ? {
                    TASK_NAME: 'Program',
                    TASK_START: project.START_DATE,
                    TASK_FINISH: project.END_DATE,
                    INV_OVERALL_STATUS: 'Green' // Default status for program headers
                } : null,
                // Note: milestones are accessed via project.milestones, not projectMilestones
                isProgramHeader: true
            });
            return;
        }

        if (project.phaseData && project.phaseData.length > 0) {
            console.log('🎯 DEBUG: Phase details:', project.phaseData
                .filter(p => p && p.TASK_NAME && p.TASK_START && p.TASK_FINISH) // Comprehensive filter
                .map(p => ({
                name: p.TASK_NAME,
                start: p.TASK_START,
                finish: p.TASK_FINISH,
                status: p.INV_OVERALL_STATUS
            })));
        }
        
        // Special debug for CaTAlyst
        if (project.PROJECT_NAME && project.PROJECT_NAME.toLowerCase().includes('catalyst')) {
            if (project.phaseData) {
                console.log('🔍 CATALYST DEBUG: Phase details:', project.phaseData
                    .filter(p => p && p.TASK_NAME && p.TASK_START && p.TASK_FINISH) // Comprehensive filter
                    .map(p => ({
                    name: p.TASK_NAME,
                    element: p.ROADMAP_ELEMENT,
                    start: p.TASK_START,
                    finish: p.TASK_FINISH
                })));
            }
        }
        
        // Check if project has phase data AND phases are not all "Unphased"
        const hasValidPhases = project.phaseData && project.phaseData.length > 0;
        const validPhases = hasValidPhases ? project.phaseData.filter(phase => 
            phase && 
            phase.TASK_NAME && 
            phase.TASK_START && 
            phase.TASK_FINISH && 
            phase.TASK_START.trim() !== '' && 
            phase.TASK_FINISH.trim() !== ''
        ) : [];
        const hasUnphasedOnly = validPhases.length > 0 && validPhases.every(phase => 
            phase.TASK_NAME === 'Unphased' || phase.TASK_NAME === 'Project'
        );
        
        console.log('🎯 DEBUG: hasValidPhases:', hasValidPhases, 'hasUnphasedOnly:', hasUnphasedOnly);
        console.log('🎯 DEBUG: validPhases count:', validPhases.length);
        if (validPhases.length > 0) {
            console.log('🎯 DEBUG: Phase names found:', validPhases.map(p => p.TASK_NAME));
            console.log('🎯 DEBUG: Phase details:', validPhases.map(p => ({
                name: p.TASK_NAME,
                start: p.TASK_START,
                finish: p.TASK_FINISH,
                status: p.INV_OVERALL_STATUS,
                element: p.ROADMAP_ELEMENT
            })));
        }
        
        // Enhanced debugging for projects that should have phases
        if (validPhases.length > 0 && !hasUnphasedOnly) {
            console.log('🎯 ENHANCED DEBUG: Project has REAL phases:', project.PROJECT_NAME);
            console.log('🎯 ENHANCED DEBUG: Phase count:', validPhases.length);
            console.log('🎯 ENHANCED DEBUG: All phase names:', validPhases.map(p => p.TASK_NAME));
            console.log('🎯 ENHANCED DEBUG: Phase dates check:', validPhases.map(p => ({
                name: p.TASK_NAME,
                start: p.TASK_START,
                finish: p.TASK_FINISH,
                startParsed: parseDate(p.TASK_START),
                finishParsed: parseDate(p.TASK_FINISH)
            })));
        }
        
        if (validPhases.length > 0 && !hasUnphasedOnly) {
            // Project WITH real phase data - show multiple colored phase bars
            console.log('🎯 DEBUG: Project WITH phases:', project.PROJECT_NAME, 'phases:', validPhases.length);
            console.log('🎯 DEBUG: Phase names:', validPhases.map(p => p.TASK_NAME));
            
            allProjectRows.push({
                project: project, // Keep the original project object with milestones
                displayName: project.PROJECT_NAME,
                phases: validPhases, // Use filtered valid phases only
                hasPhases: true,
                renderType: 'phases',
                ...project // Spread project properties for backward compatibility
            });
        } else if (hasUnphasedOnly) {
            // Project marked as "Unphased" - show single grey bar
            console.log('🎯 DEBUG: Project marked as UNPHASED:', project.PROJECT_NAME);
            
            const unphasedPhase = validPhases[0]; // Use the first valid unphased phase data
            if (unphasedPhase && unphasedPhase.TASK_START && unphasedPhase.TASK_FINISH) {
                allProjectRows.push({
                    project: project, // Keep the original project object with milestones
                    displayName: project.PROJECT_NAME,
                    phases: [], // No phases, will render single project bar
                    hasPhases: false,
                    renderType: 'unphased',
                    // Create a single "phase" from the unphased data for rendering
                    singleProjectPhase: {
                        TASK_NAME: 'Unphased',
                        TASK_START: unphasedPhase.TASK_START,
                        TASK_FINISH: unphasedPhase.TASK_FINISH,
                        INV_OVERALL_STATUS: unphasedPhase.INV_OVERALL_STATUS || project.STATUS
                    },
                    ...project // Spread project properties for backward compatibility
                });
            } else {
                console.warn('🚨 Skipping unphased project with invalid dates:', project.PROJECT_NAME);
            }
        } else {
            // Project WITHOUT phase data - show single status-colored bar using START_DATE and END_DATE
            console.log('🎯 DEBUG: Project WITHOUT phases:', project.PROJECT_NAME, 'START_DATE:', project.START_DATE, 'END_DATE:', project.END_DATE);
            
            // Only create a row if the project has valid start and end dates
            if (project.START_DATE && project.END_DATE && 
                project.START_DATE.trim() !== '' && project.END_DATE.trim() !== '') {
                allProjectRows.push({
                    project: project, // Keep the original project object with milestones
                    displayName: project.PROJECT_NAME,
                    phases: [], // No phases, will render single project bar
                    hasPhases: false,
                    renderType: 'project',
                    // Create a single "phase" from the project dates for rendering
                    singleProjectPhase: {
                        TASK_NAME: 'Project',
                        TASK_START: project.START_DATE,
                        TASK_FINISH: project.END_DATE,
                        INV_OVERALL_STATUS: project.STATUS
                    },
                    ...project // Spread project properties for backward compatibility
                });
            } else {
                console.warn('🚨 Skipping project with invalid dates:', project.PROJECT_NAME, 'START_DATE:', project.START_DATE, 'END_DATE:', project.END_DATE);
            }
        }
    });
    
    console.log('🎯 DEBUG: Total rows to render:', allProjectRows.length);
    console.log('🎯 DEBUG: Rows with phases:', allProjectRows.filter(r => r.renderType === 'phases').length);
    console.log('🎯 DEBUG: Rows marked unphased:', allProjectRows.filter(r => r.renderType === 'unphased').length);
    console.log('🎯 DEBUG: Rows without phases:', allProjectRows.filter(r => r.renderType === 'project').length);
    
    // *** CHECK FOR DUPLICATE PROJECT IDs ***
    const projectIds = allProjectRows.map(r => r.project?.PROJECT_ID).filter(id => id);
    const duplicateIds = projectIds.filter((id, index) => projectIds.indexOf(id) !== index);
    if (duplicateIds.length > 0) {
        console.error('🚨 DUPLICATE PROJECT IDs FOUND:', duplicateIds);
        const duplicateProjects = allProjectRows.filter(r => duplicateIds.includes(r.project?.PROJECT_ID));
        console.error('🚨 DUPLICATE PROJECT DETAILS:', duplicateProjects.map(r => ({
            projectId: r.project?.PROJECT_ID,
            projectName: r.project?.PROJECT_NAME,
            isProgramHeader: r.project?.isProgramHeader,
            isChildItem: r.project?.isChildItem,
            renderType: r.renderType
        })));
    }
    
    // Debug first few and last few projects to see if all are processed (with safety checks)
    const first5 = allProjectRows.slice(0, 5).map((r, i) => ({ 
        index: i,
        name: r?.project?.PROJECT_NAME || 'UNDEFINED_PROJECT', 
        renderType: r?.renderType || 'UNDEFINED_TYPE',
        hasProject: !!r?.project
    }));
    console.log('🎯 DEBUG: First 5 projects:', first5);
    
    const last5 = allProjectRows.slice(-5).map((r, i) => ({ 
        index: allProjectRows.length - 5 + i,
        name: r?.project?.PROJECT_NAME || 'UNDEFINED_PROJECT', 
        renderType: r?.renderType || 'UNDEFINED_TYPE',
        hasProject: !!r?.project
    }));
    console.log('🎯 DEBUG: Last 5 projects:', last5);
    
    // Check for any undefined projects in the array
    const undefinedProjects = allProjectRows.filter(r => !r || !r.project);
    if (undefinedProjects.length > 0) {
        console.error('🚨 ERROR: Found undefined projects:', undefinedProjects.length);
        console.error('🚨 ERROR: Undefined project details:', undefinedProjects);
    }
    
    // Final safety check: filter out any invalid rows before rendering
    const validProjectRows = allProjectRows.filter(row => {
        if (!row || !row.project) {
            console.error('🚨 ERROR: Invalid row filtered out:', row);
            return false;
        }
        return true;
    });
    
    console.log('🎯 DEBUG: Total valid rows for rendering:', validProjectRows.length);
    console.log('🎯 DEBUG: Filtered out invalid rows:', allProjectRows.length - validProjectRows.length);

    // Check if CaTAlyst is in the processed rows (use validProjectRows now)
    const catalystRow = validProjectRows.find(r => r?.project?.PROJECT_NAME === 'CaTAlyst');
    if (catalystRow) {
        console.log('🎯 CATALYST DEBUG: CaTAlyst found in processed rows!', catalystRow);
    } else {
        console.log('🎯 CATALYST DEBUG: CaTAlyst NOT found in processed rows');
    }

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
                    <div style={{ position: 'relative', height: validProjectRows.length * (calculateBarHeight({}) + constants.ROW_PADDING) + 50 }}>
                        {validProjectRows.map((row, index) => {
                            // Safety check for undefined rows
                            if (!row || !row.project) {
                                console.error(`🚨 ERROR: Undefined row at index ${index}:`, row);
                                return null;
                            }
                            
                                            // Process milestones first to get accurate height calculation
                                            const projectEndDate = row.hasPhases 
                                                ? (row.phases && row.phases.length > 0 ? row.phases.reduce((latest, phase) => {
                                                    if (!phase || !phase.TASK_FINISH) return latest;
                                                    const phaseEndDate = parseDate(phase.TASK_FINISH);
                                                    return (phaseEndDate && (!latest || phaseEndDate > latest)) ? phaseEndDate : latest;
                                                }, null) : null)
                                                : parseDate(row.singleProjectPhase?.TASK_FINISH); // For projects without phases
                            
                            const processedMilestones = processMilestonesForProject(
                                row.project.milestones || [], // Fix: Use milestones from project object
                                startDate,
                                constants.MONTH_WIDTH,
                                projectEndDate
                            );
                            
                            const rowHeight = calculateBarHeight(row, processedMilestones);
                            const rowSpacing = constants.ROW_PADDING || 8;
                            const topMargin = Math.round(10 * zoomLevel);
                            
                            // Calculate cumulative Y offset to match Gantt bars
                            const yOffset = validProjectRows
                                .slice(0, index)
                                .reduce((total, p, i) => {
                                    // Process milestones for previous rows for accurate height calculation
                                    const prevProjectEndDate = p.hasPhases
                                        ? (p.phases && p.phases.length > 0 ? p.phases.reduce((latest, phase) => {
                                            if (!phase || !phase.TASK_FINISH) return latest;
                                            const phaseEndDate = parseDate(phase.TASK_FINISH);
                                            return (phaseEndDate && (!latest || phaseEndDate > latest)) ? phaseEndDate : latest;
                                        }, null) : null)
                                        : parseDate(p.singleProjectPhase?.TASK_FINISH); // For projects without phases
                                    
                                    const prevProcessedMilestones = processMilestonesForProject(
                                        p.project.milestones || [], // Fix: Use milestones from project object
                                        startDate,
                                        constants.MONTH_WIDTH,
                                        prevProjectEndDate
                                    );
                                    
                                    return total + calculateBarHeight(p, prevProcessedMilestones) + rowSpacing;
                                }, topMargin);
                            
                            return (
                                <div
                                    key={`${row.project.PROJECT_ID}-${index}`}
                                    className={`absolute border-b border-gray-100 transition-colors px-4 ${
                                        row.isProgramHeader 
                                            ? 'bg-blue-50/80 hover:bg-blue-100/70 border-blue-200' 
                                            : 'bg-gray-50/30 hover:bg-gray-100/50'
                                    }`}
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
                                            <span 
                                                className={`${
                                                    row.isProgramHeader 
                                                        ? 'font-bold text-blue-800 text-sm' 
                                                        : 'font-medium text-gray-800'
                                                } pr-2`}
                                                title={row.project.displayName || row.project.PROJECT_NAME}
                                            >
                                                {row.project.displayName || row.project.PROJECT_NAME}
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
                                height={validProjectRows.reduce((total, row) => {
                                    // Safety check for row
                                    if (!row || !row.project) return total;
                                    
                                    // Process milestones for accurate height calculation with safety checks
                                    const projectEndDate = row.hasPhases
                                        ? (row.phases && row.phases.length > 0 ? row.phases.reduce((latest, phase) => {
                                            if (!phase || !phase.TASK_FINISH) return latest;
                                            const phaseEndDate = parseDate(phase.TASK_FINISH);
                                            return (phaseEndDate && (!latest || phaseEndDate > latest)) ? phaseEndDate : latest;
                                        }, null) : null)
                                        : parseDate(row.singleProjectPhase?.TASK_FINISH); // For projects without phases
                                    
                                    const processedMilestones = processMilestonesForProject(
                                        row.project.milestones || [], // Fix: Use milestones from project object
                                        startDate,
                                        constants.MONTH_WIDTH,
                                        projectEndDate
                                    );
                                    
                                    return total + calculateBarHeight(row, processedMilestones) + constants.ROW_PADDING;
                                }, 0)}
                            >
                                {validProjectRows.map((row, index) => {
                                    // Safety check for undefined rows
                                    if (!row || !row.project) {
                                        console.error(`🚨 ERROR: Undefined row at index ${index} in Gantt rendering:`, row);
                                        return null;
                                    }
                                    
                    // *** MODIFIED: Allow rendering Gantt bars for program headers ***
                    // Program headers now have aggregated data and should display Gantt bars
                    if (row.isProgramHeader) {
                        console.log('🎯 HIERARCHICAL: Rendering Gantt bar for program header:', row.project.displayName);
                        console.log('🎯 HIERARCHICAL: Program header has phases:', row.hasPhases, 'milestone count:', row.project.milestones?.length || 0);
                    }                                    // Process milestones first to get accurate height calculation
                                    const projectEndDate = row.hasPhases 
                                        ? (row.phases && row.phases.length > 0 ? row.phases.reduce((latest, phase) => {
                                            if (!phase || !phase.TASK_FINISH) return latest;
                                            const phaseEndDate = parseDate(phase.TASK_FINISH);
                                            return (phaseEndDate && (!latest || phaseEndDate > latest)) ? phaseEndDate : latest;
                                        }, null) : null)
                                        : parseDate(row.singleProjectPhase?.TASK_FINISH); // For projects without phases
                                    
                                    const processedMilestones = processMilestonesForProject(
                                        row.project.milestones || [], // Fix: Use milestones from project object
                                        startDate,
                                        constants.MONTH_WIDTH,
                                        projectEndDate
                                    );

                                    // Calculate proper Y offset using PortfolioGanttChart logic
                                    const rowSpacing = constants.ROW_PADDING || 8;
                                    const topMargin = Math.round(10 * zoomLevel);
                                    const yOffset = validProjectRows
                                        .slice(0, index)
                                        .reduce((total, p, i) => {
                                            // Process milestones for each previous row for accurate height calculation
                                            const prevProjectEndDate = p.hasPhases
                                                ? (p.phases && p.phases.length > 0 ? p.phases.reduce((latest, phase) => {
                                                    if (!phase || !phase.TASK_FINISH) return latest;
                                                    const phaseEndDate = parseDate(phase.TASK_FINISH);
                                                    return (phaseEndDate && (!latest || phaseEndDate > latest)) ? phaseEndDate : latest;
                                                }, null) : null)
                                                : parseDate(p.singleProjectPhase?.TASK_FINISH); // For projects without phases
                                            
                                            const prevProcessedMilestones = processMilestonesForProject(
                                                p.project.milestones || [], // Fix: Use milestones from project object
                                                startDate,
                                                constants.MONTH_WIDTH,
                                                prevProjectEndDate
                                            );
                                            
                                            return total + calculateBarHeight(p, prevProcessedMilestones) + rowSpacing;
                                        }, topMargin);
                                    
                                    // Calculate the project's total height and center point
                                    const totalHeight = calculateBarHeight(row, processedMilestones);
                                    const centerY = yOffset + totalHeight / 2;
                                    
                                    // CRITICAL FIX: Center GanttBar within the total row height
                                    // This matches how PortfolioGanttChart positions its bars
                                    const centeredY = yOffset + (totalHeight - constants.TOUCH_TARGET_SIZE) / 2;
                                    
                                    return (
                                        <g key={`${row.PROJECT_ID}-${index}`}>
                                            {/* Render phase bars OR single project bar based on renderType */}
                                            {row.renderType === 'phases' ? (
                                                // Project WITH phases - render multiple colored phase bars
                                                (() => {
                                                    console.log('🎨 RENDERING PHASES for:', row.PROJECT_NAME, 'with', row.phases.length, 'phases');
                                                    return row.phases
                                                        .filter(phase => phase && phase.TASK_NAME && phase.TASK_START && phase.TASK_FINISH) // Filter out null phases and ensure dates exist
                                                        .map((phase, phaseIndex) => {
                                                        console.log('🔍 Phase parsing for', row.PROJECT_NAME, '- Phase:', phase.TASK_NAME, 'Raw dates:', phase.TASK_START, 'to', phase.TASK_FINISH);
                                                        
                                                        const phaseStartDate = parseDate(phase.TASK_START);
                                                        const phaseEndDate = parseDate(phase.TASK_FINISH);
                                                        
                                                        console.log('🔍 Parsed dates for', phase.TASK_NAME, ':', phaseStartDate, 'to', phaseEndDate);
                                                        
                                                        if (!phaseStartDate || !phaseEndDate) {
                                                            console.log('🚨 Invalid phase dates:', phase.TASK_NAME, 'START:', phase.TASK_START, 'END:', phase.TASK_FINISH, 'Parsed START:', phaseStartDate, 'Parsed END:', phaseEndDate);
                                                            return null;
                                                        }
                                                        
                                                        const x = calculatePosition(phaseStartDate, startDate, constants.MONTH_WIDTH);
                                                        const width = calculatePosition(phaseEndDate, startDate, constants.MONTH_WIDTH) - x;
                                                        
                                                        // Get the phase color based on the task name
                                                        const phaseColor = PHASE_COLORS[phase.TASK_NAME] || PHASE_COLORS['Unphased'];
                                                        
                                                        console.log('🎨 Phase rendering:', phase.TASK_NAME, 'color:', phaseColor, 'dates:', phase.TASK_START, 'to', phase.TASK_FINISH, 'x:', x, 'width:', width);
                                                        
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
                                                                status={phase.INV_OVERALL_STATUS || row.STATUS}
                                                                color={phaseColor}
                                                                touchTargetSize={constants.TOUCH_TARGET_SIZE}
                                                                fontSize={constants.FONT_SIZE}
                                                                isMobile={false}
                                                                zoomLevel={zoomLevel}
                                                            />
                                                        );
                                                    });
                                                })()
                                            ) : (
                                                // Project WITHOUT phases OR marked as "Unphased" - render single bar
                                                (() => {
                                                    console.log('🎨 RENDERING SINGLE BAR for:', row.PROJECT_NAME, 'renderType:', row.renderType);
                                                    console.log('🎨 Single bar data:', row.singleProjectPhase);
                                                    
                                                    // CRITICAL FIX: Add comprehensive safety checks
                                                    if (!row.singleProjectPhase || 
                                                        !row.singleProjectPhase.TASK_START || 
                                                        !row.singleProjectPhase.TASK_FINISH) {
                                                        console.warn('🚨 Skipping single bar - missing singleProjectPhase data:', row.PROJECT_NAME);
                                                        return null;
                                                    }
                                                    
                                                    const projectStartDate = parseDate(row.singleProjectPhase.TASK_START);
                                                    const projectEndDate = parseDate(row.singleProjectPhase.TASK_FINISH);
                                                    
                                                    if (!projectStartDate || !projectEndDate) {
                                                        console.log('🚨 Invalid project dates:', row.PROJECT_NAME, 'START:', row.singleProjectPhase.TASK_START, 'END:', row.singleProjectPhase.TASK_FINISH, 'Parsed START:', projectStartDate, 'Parsed END:', projectEndDate);
                                                        return null;
                                                    }
                                                    
                                                    const x = calculatePosition(projectStartDate, startDate, constants.MONTH_WIDTH);
                                                    const width = calculatePosition(projectEndDate, startDate, constants.MONTH_WIDTH) - x;
                                                    
                                                    // Choose color based on render type
                                                    let barColor;
                                                    if (row.renderType === 'unphased') {
                                                        barColor = PHASE_COLORS['Unphased']; // Grey for unphased
                                                    } else {
                                                        barColor = STATUS_COLORS[row.STATUS] || STATUS_COLORS['Grey']; // Status color for projects
                                                    }
                                                    
                                                    console.log('🎨 Single bar rendering:', row.renderType, 'color:', barColor, 'dates:', row.singleProjectPhase.TASK_START, 'to', row.singleProjectPhase.TASK_FINISH, 'x:', x, 'width:', width);
                                                    
                                                    return (
                                                        <GanttBar
                                                            key={`${row.PROJECT_ID}-project`}
                                                            data={{
                                                                ...row.singleProjectPhase,
                                                                id: row.PROJECT_ID,
                                                                name: row.PROJECT_NAME
                                                            }}
                                                            startX={x}
                                                            y={centeredY}
                                                            width={width}
                                                            label={row.singleProjectPhase.TASK_NAME}
                                                            status={row.singleProjectPhase.INV_OVERALL_STATUS || row.STATUS}
                                                            color={barColor}
                                                            touchTargetSize={constants.TOUCH_TARGET_SIZE}
                                                            fontSize={constants.FONT_SIZE}
                                                            isMobile={false}
                                                            zoomLevel={zoomLevel}
                                                        />
                                                    );
                                                })()
                                            )}
                                            
                                            {/* Render Milestones using already processed milestone data */}
                                            {/* CRITICAL FIX: Don't render milestones for program headers */}
                                            {!row.isProgramHeader && processedMilestones.map((milestone, milestoneIndex) => {
                                                // EXACT SAME LOGIC AS PORTFOLIOGANTTCHART
                                                // Position milestone at: yOffset + (totalHeight - TOUCH_TARGET_SIZE) / 2 + (TOUCH_TARGET_SIZE / 2)
                                                // This ensures perfect alignment and no overlaps
                                                const milestoneY = Math.round(yOffset + (totalHeight - constants.TOUCH_TARGET_SIZE) / 2 + (constants.TOUCH_TARGET_SIZE / 2));
                                                
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
                                                        groupLabels={milestone.groupLabels || []}
                                                        fullLabel={milestone.fullLabel}
                                                        hasAdjacentMilestones={milestone.hasAdjacentMilestones}
                                                        showLabel={milestone.showLabel}
                                                        fontSize={constants.MILESTONE_FONT_SIZE}
                                                        isMobile={false}
                                                        zoomLevel={zoomLevel}
                                                        isMonthlyGrouped={milestone.isMonthlyGrouped}
                                                        monthlyLabels={milestone.monthlyLabels || []}
                                                        horizontalLabel={milestone.horizontalLabel || ''}
                                                        verticalLabels={milestone.verticalLabels || []}
                                                        monthKey={milestone.monthKey || ''}
                                                        shouldRenderShape={milestone.shouldRenderShape}
                                                        allMilestonesInProject={milestone.allMilestonesInProject || row.project.milestones || []}
                                                        currentMilestoneDate={milestone.currentMilestoneDate || milestone.date}
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

    // Main component return with new loading UI
    return (
        <div className="w-full flex flex-col relative">
            {/* Status Badge - Top Right (same as Program GanttChart) */}
            {loading && (
                <div className="absolute top-4 right-4 z-50 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium shadow-md flex items-center gap-2">
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                    Loading data...
                </div>
            )}

            {/* Error State */}
            {error && (
                <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded m-4">
                    <h3 className="font-semibold">Error Loading Sub-Program Data</h3>
                    <p>{error}</p>
                    <button 
                        onClick={() => window.location.reload()} 
                        className="mt-2 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                    >
                        Retry
                    </button>
                </div>
            )}

            {/* Show content even while loading (same pattern as Program GanttChart) */}
            {(!loading || (data && data.projects)) && !error && renderGanttChart()}
        </div>
    );
};

export default SubProgramGanttChart;
