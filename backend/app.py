"""
PMO Portfolio Flask Backend
Connects to Azure Databricks for real-time data access
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import os
from dotenv import load_dotenv
import logging
from datetime import datetime
import json
from databricks_client import DatabricksClient

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)

# Configure CORS for your React frontend
CORS(app, origins=[
    "http://localhost:3000",
    "http://localhost:3001", 
    "http://localhost:3002"
])

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Databricks client
try:
    db_client = DatabricksClient()
    logger.info("Databricks client initialized successfully")
except Exception as e:
    logger.warning(f"Databricks client initialization failed: {str(e)}")
    logger.info("Running in mock data mode")
    db_client = None

# Health check endpoint
@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'service': 'PMO Portfolio Backend'
    })

# Portfolio data endpoint
@app.route('/api/portfolio', methods=['GET'])
def get_portfolio_data():
    """Get portfolio data from Databricks"""
    try:
        logger.info("Fetching portfolio data from Databricks")

        if db_client:
            # Use real Databricks connection
            data = db_client.get_portfolio_data()
            source = 'Azure Databricks'
        else:
            # Fallback to mock data
            data = []
            source = 'Mock Data (Databricks not configured)'

        response_data = {
            'data': data,
            'last_updated': datetime.now().isoformat(),
            'source': source,
            'count': len(data)
        }

        return jsonify(response_data)

    except Exception as e:
        logger.error(f"Error fetching portfolio data: {str(e)}")
        return jsonify({'error': 'Failed to fetch portfolio data'}), 500

# Program data endpoint
@app.route('/api/program', methods=['GET'])
def get_program_data():
    """Get program data from Databricks"""
    try:
        logger.info("Fetching program data from Databricks")

        if db_client:
            data = db_client.get_program_data()
            source = 'Azure Databricks'
        else:
            data = []
            source = 'Mock Data (Databricks not configured)'

        response_data = {
            'data': data,
            'last_updated': datetime.now().isoformat(),
            'source': source,
            'count': len(data)
        }

        return jsonify(response_data)

    except Exception as e:
        logger.error(f"Error fetching program data: {str(e)}")
        return jsonify({'error': 'Failed to fetch program data'}), 500

# Sub-program data endpoint
@app.route('/api/subprogram', methods=['GET'])
def get_subprogram_data():
    """Get sub-program data from Databricks"""
    try:
        logger.info("Fetching sub-program data from Databricks")

        if db_client:
            data = db_client.get_subprogram_data()
            source = 'Azure Databricks'
        else:
            data = []
            source = 'Mock Data (Databricks not configured)'

        response_data = {
            'data': data,
            'last_updated': datetime.now().isoformat(),
            'source': source,
            'count': len(data)
        }

        return jsonify(response_data)

    except Exception as e:
        logger.error(f"Error fetching sub-program data: {str(e)}")
        return jsonify({'error': 'Failed to fetch sub-program data'}), 500

# Investment data endpoint
@app.route('/api/investment', methods=['GET'])
def get_investment_data():
    """Get investment data from Databricks"""
    try:
        logger.info("Fetching investment data from Databricks")

        if db_client:
            data = db_client.get_investment_data()
            source = 'Azure Databricks'
        else:
            data = []
            source = 'Mock Data (Databricks not configured)'

        response_data = {
            'data': data,
            'last_updated': datetime.now().isoformat(),
            'source': source,
            'count': len(data)
        }

        return jsonify(response_data)

    except Exception as e:
        logger.error(f"Error fetching investment data: {str(e)}")
        return jsonify({'error': 'Failed to fetch investment data'}), 500

# Filtered data endpoint
@app.route('/api/data/<data_type>', methods=['GET'])
def get_filtered_data(data_type):
    """Get filtered data based on query parameters"""
    try:
        # Get query parameters
        filters = request.args.to_dict()
        logger.info(f"Fetching {data_type} data with filters: {filters}")
        
        # TODO: Apply filters to Databricks query
        
        mock_data = {
            'data_type': data_type,
            'filters': filters,
            'data': [],
            'last_updated': datetime.now().isoformat(),
            'source': 'Azure Databricks'
        }
        
        return jsonify(mock_data)
    
    except Exception as e:
        logger.error(f"Error fetching filtered {data_type} data: {str(e)}")
        return jsonify({'error': f'Failed to fetch {data_type} data'}), 500

if __name__ == '__main__':
    # Validate configuration
    required_vars = ['DATABRICKS_SERVER_HOSTNAME', 'DATABRICKS_HTTP_PATH', 'DATABRICKS_ACCESS_TOKEN']
    missing_config = [var for var in required_vars if not os.getenv(var)]

    if missing_config:
        logger.warning(f"Missing Databricks configuration: {missing_config}")
        logger.info("Running in development mode with mock data")
    else:
        logger.info("Databricks configuration found, connecting to live data")

    # Run the Flask app
    app.run(
        host='0.0.0.0',
        port=int(os.getenv('PORT', 5000)),
        debug=os.getenv('FLASK_ENV') == 'development'
    )
