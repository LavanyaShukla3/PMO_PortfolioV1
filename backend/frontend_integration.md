# Frontend Integration Guide

## 🔗 Connecting Your React Frontend to Flask Backend

### 1. Update Your DataService

Replace your current JSON imports with API calls:

```javascript
// src/services/dataService.js

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// Replace JSON imports with API calls
export const fetchPortfolioData = async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/api/portfolio`);
        if (!response.ok) throw new Error('Failed to fetch portfolio data');
        const result = await response.json();
        return result.data; // Extract the data array
    } catch (error) {
        console.error('Error fetching portfolio data:', error);
        throw error;
    }
};

export const fetchProgramData = async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/api/program`);
        if (!response.ok) throw new Error('Failed to fetch program data');
        const result = await response.json();
        return result.data;
    } catch (error) {
        console.error('Error fetching program data:', error);
        throw error;
    }
};

export const fetchSubProgramData = async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/api/subprogram`);
        if (!response.ok) throw new Error('Failed to fetch subprogram data');
        const result = await response.json();
        return result.data;
    } catch (error) {
        console.error('Error fetching subprogram data:', error);
        throw error;
    }
};

export const fetchInvestmentData = async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/api/investment`);
        if (!response.ok) throw new Error('Failed to fetch investment data');
        const result = await response.json();
        return result.data;
    } catch (error) {
        console.error('Error fetching investment data:', error);
        throw error;
    }
};

// Update your existing functions to use async data
export const processPortfolioData = async () => {
    const portfolioData = await fetchPortfolioData();
    const investmentData = await fetchInvestmentData();
    
    // Your existing processing logic here
    return processRoadmapData(portfolioData, investmentData);
};

export const processProgramData = async () => {
    const programData = await fetchProgramData();
    const investmentData = await fetchInvestmentData();
    
    // Your existing processing logic here
    return processRoadmapDataWithSubPrograms(programData, investmentData);
};
```

### 2. Update Your Components to Handle Async Data

```javascript
// Example: PortfolioGanttChart.jsx

import { processPortfolioData } from '../services/dataService';

const PortfolioGanttChart = ({ onDrillToProgram }) => {
    const [processedData, setProcessedData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);
                const data = await processPortfolioData();
                setProcessedData(data);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, []);

    if (loading) return <div>Loading portfolio data...</div>;
    if (error) return <div>Error: {error}</div>;

    // Your existing component logic
    return (
        // Your existing JSX
    );
};
```

### 3. Add Environment Variables

Create `.env` file in your React project root:

```env
# React Frontend Environment Variables
REACT_APP_API_URL=http://localhost:5000
```

### 4. Add Loading States and Error Handling

```javascript
// src/components/LoadingSpinner.jsx
export const LoadingSpinner = () => (
    <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Loading data...</span>
    </div>
);

// src/components/ErrorMessage.jsx
export const ErrorMessage = ({ error, onRetry }) => (
    <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded">
        <h3 className="font-semibold">Error Loading Data</h3>
        <p>{error}</p>
        {onRetry && (
            <button 
                onClick={onRetry}
                className="mt-2 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
            >
                Retry
            </button>
        )}
    </div>
);
```

### 5. Testing the Integration

1. **Start your Flask backend:**
   ```bash
   cd backend
   python app.py
   ```

2. **Start your React frontend:**
   ```bash
   cd PMO_Portfolio
   npm start
   ```

3. **Test the connection:**
   - Check browser network tab for API calls
   - Verify data is loading from `http://localhost:5000`
   - Check console for any errors

### 6. Production Considerations

```javascript
// src/services/apiClient.js
class ApiClient {
    constructor() {
        this.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
        this.timeout = 30000; // 30 seconds
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            timeout: this.timeout,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        try {
            const response = await fetch(url, config);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`API request failed: ${endpoint}`, error);
            throw error;
        }
    }

    // Data fetching methods
    async getPortfolioData() {
        const result = await this.request('/api/portfolio');
        return result.data;
    }

    async getProgramData() {
        const result = await this.request('/api/program');
        return result.data;
    }

    // Add more methods as needed
}

export const apiClient = new ApiClient();
```

### 7. Gradual Migration Strategy

1. **Phase 1**: Keep JSON files as fallback
2. **Phase 2**: Switch to API calls with JSON fallback
3. **Phase 3**: Remove JSON files completely

```javascript
// Gradual migration example
export const processPortfolioData = async () => {
    try {
        // Try API first
        return await processPortfolioDataFromAPI();
    } catch (error) {
        console.warn('API failed, falling back to JSON files:', error);
        // Fallback to existing JSON logic
        return processRoadmapData(portfolioData);
    }
};
```
