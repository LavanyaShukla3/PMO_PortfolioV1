import React, { useState, useEffect } from 'react';
import PortfolioGanttChart from './pages/PortfolioGanttChart';
import ProgramGanttChart from './pages/ProgramGanttChart';
import SubProgramGanttChart from './pages/SubProgramGanttChart';
import RegionRoadMap from './pages/RegionRoadMap';
import { validateApiData } from './services/apiDataService';
import './App.css';

function App() {
    const [currentView, setCurrentView] = useState('Portfolio');
    const [selectedProjectId, setSelectedProjectId] = useState(null);
    const [selectedProjectName, setSelectedProjectName] = useState('');
    const [selectedSubProgramId, setSelectedSubProgramId] = useState(null);
    const [selectedSubProgramName, setSelectedSubProgramName] = useState('');
    const [dataValidation, setDataValidation] = useState({ 
        isValid: null, 
        errors: [], 
        mode: 'unknown',
        isLoading: true 
    });

    // Validate data on app start
    useEffect(() => {
        const validateData = async () => {
            try {
                const validation = await validateApiData();
                setDataValidation({ ...validation, isLoading: false });
            } catch (error) {
                setDataValidation({
                    isValid: false,
                    errors: [`Failed to validate data: ${error.message}`],
                    mode: 'unknown',
                    isLoading: false
                });
            }
        };

        validateData();
    }, []);

    // Show loading state
    if (dataValidation.isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 p-4">
                <div className="max-w-7xl mx-auto">
                    <div className="bg-blue-50 border border-blue-400 text-blue-700 px-4 py-3 rounded">
                        <h2 className="text-lg font-semibold mb-2">Loading Data...</h2>
                        <p>Connecting to backend and validating data...</p>
                    </div>
                </div>
            </div>
        );
    }

    // Show error state
    if (!dataValidation.isValid) {
        return (
            <div className="min-h-screen bg-gray-50 p-4">
                <div className="max-w-7xl mx-auto">
                    <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded">
                        <h2 className="text-lg font-semibold mb-2">Data Validation Error</h2>
                        <ul className="list-disc list-inside mb-3">
                            {dataValidation.errors.map((error, index) => (
                                <li key={index}>{error}</li>
                            ))}
                        </ul>
                        <button 
                            onClick={() => window.location.reload()} 
                            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                        >
                            Retry
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">
                                {currentView} Roadmap
                            </h1>
                            <p className="text-sm text-gray-600 mt-1">
                                Data Mode: <span className="font-semibold capitalize">{dataValidation.mode}</span>
                                {dataValidation.mode === 'mock' && (
                                    <span className="ml-2 bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs">
                                        Demo Data
                                    </span>
                                )}
                                {dataValidation.mode === 'databricks' && (
                                    <span className="ml-2 bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                                        Live Data
                                    </span>
                                )}
                            </p>
                        </div>

                        <div className="flex items-center gap-2">
                            <label className="font-medium">View:</label>
                            <select
                                value={currentView}
                                onChange={(e) => {
                                    setCurrentView(e.target.value);
                                    if (e.target.value === 'Portfolio') {
                                        setSelectedProjectId(null);
                                        setSelectedProjectName('');
                                        setSelectedSubProgramId(null);
                                        setSelectedSubProgramName('');
                                    }
                                }}
                                className="border border-gray-300 rounded px-2 py-1 bg-white"
                            >
                                <option value="Portfolio">Portfolio Roadmap</option>
                                <option value="Program">Program Roadmap</option>
                                <option value="SubProgram">Sub-Program Roadmap</option>
                                <option value="Region">Region Roadmap</option>
                            </select>
                        </div>
                    </div>
                </div>
            </header>

            <main className="mx-auto px-4 py-6">
                <div className="bg-white shadow rounded-lg p-6">
                    {currentView === 'Portfolio' ? (
                        <PortfolioGanttChart
                            onDrillToProgram={(projectId, projectName) => {
                                setSelectedProjectId(projectId);
                                setSelectedProjectName(projectName);
                                setCurrentView('Program');
                            }}
                        />
                    ) : currentView === 'Program' ? (
                        <ProgramGanttChart
                            selectedProjectId={selectedProjectId}
                            selectedProjectName={selectedProjectName}
                            onBackToPortfolio={() => {
                                setCurrentView('Portfolio');
                                setSelectedProjectId(null);
                                setSelectedProjectName('');
                            }}
                            onDrillToSubProgram={(subProgramId, subProgramName) => {
                                // Task 1: Drill-through from Program to SubProgram
                                setSelectedSubProgramId(subProgramId);
                                setSelectedSubProgramName(subProgramName);
                                setCurrentView('SubProgram');
                            }}
                        />
                    ) : currentView === 'SubProgram' ? (
                        <SubProgramGanttChart
                            selectedSubProgramId={selectedSubProgramId}
                            selectedSubProgramName={selectedSubProgramName}
                            selectedProgramName={selectedProjectName} // Task 1: Pass program name for breadcrumb
                            onBackToProgram={() => {
                                setCurrentView('Program');
                                setSelectedSubProgramId(null);
                                setSelectedSubProgramName('');
                            }}
                        />
                    ) : (
                        <RegionRoadMap />
                    )}

                </div>
            </main>
        </div>
    );
}

export default App;
