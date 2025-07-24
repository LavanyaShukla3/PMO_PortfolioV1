import React, { useState } from 'react';
import PortfolioGanttChart from './pages/PortfolioGanttChart';
import ProgramGanttChart from './pages/ProgramGanttChart';
import { validateData } from './services/dataService';
import './App.css';

function App() {
    const [currentView, setCurrentView] = useState('Portfolio');
    const { isValid, errors } = validateData();

    if (!isValid) {
        return (
            <div className="min-h-screen bg-gray-50 p-4">
                <div className="max-w-7xl mx-auto">
                    <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded">
                        <h2 className="text-lg font-semibold mb-2">Data Validation Error</h2>
                        <ul className="list-disc list-inside">
                            {errors.map((error, index) => (
                                <li key={index}>{error}</li>
                            ))}
                        </ul>
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
                        <h1 className="text-2xl font-bold text-gray-900">Portfolio Roadmap</h1>
                        <div className="flex items-center gap-2">
                            <label className="font-medium">View:</label>
                            <select
                                value={currentView}
                                onChange={(e) => setCurrentView(e.target.value)}
                                className="border border-gray-300 rounded px-2 py-1 bg-white"
                            >
                                <option value="Portfolio">Portfolio</option>
                                <option value="Program">Program Roadmap</option>
                            </select>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-6">
                <div className="bg-white shadow rounded-lg p-6">
                    {currentView === 'Portfolio' ? (
                        <PortfolioGanttChart />
                    ) : (
                        <ProgramGanttChart />
                    )}
                </div>
            </main>
        </div>
    );
}

export default App;
