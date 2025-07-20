import React from 'react';
import PortfolioGanttChart from './pages/PortfolioGanttChart';
import { validateData } from './services/dataService';
import './App.css';

function App() {
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
                    <h1 className="text-2xl font-bold text-gray-900">Portfolio Roadmap</h1>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-6">
                <div className="bg-white shadow rounded-lg p-6">
                    <PortfolioGanttChart />
                </div>
            </main>
        </div>
    );
}

export default App;

