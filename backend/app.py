"""
Flask API server for PMO Portfolio application.
Provides endpoints to fetch data from Azure Databricks or mock data.
"""
import os
import logging
import json
from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv

# Load environment variables first
load_dotenv()

# Check if running in mock mode early
MOCK_MODE = os.getenv('MOCK_MODE', 'false').lower() == 'true'

# Only import databricks_client if not in mock mode
if not MOCK_MODE:
    from databricks_client import databricks_client

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)

# Configure CORS
frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:3000')
CORS(app, origins=[frontend_url])

# SQL query file paths
SQL_QUERIES_DIR = os.path.join(os.path.dirname(__file__), 'sql_queries')
HIERARCHY_QUERY_FILE = os.path.join(SQL_QUERIES_DIR, 'hierarchy_query.sql')
INVESTMENT_QUERY_FILE = os.path.join(SQL_QUERIES_DIR, 'investment_query.sql')

# Mock data for testing
MOCK_HIERARCHY_DATA = [
    {
        "HIERARCHY_EXTERNAL_ID": "H-0056",
        "HIERARCHY_NAME": "PMO COE Hierarchy",
        "COE_ROADMAP_TYPE": "Portfolio",
        "COE_ROADMAP_PARENT_ID": "PTF000109", 
        "COE_ROADMAP_PARENT_NAME": "Commercial Programs",
        "COE_ROADMAP_PARENT_CLRTY_TYPE": "Portfolios",
        "CHILD_ID": "PROG000328",
        "CHILD_NAME": "Account IQ",
        "CLRTY_CHILD_TYPE": "Programs",
        "If_parent_exist": 0
    },
    {
        "HIERARCHY_EXTERNAL_ID": "H-0056",
        "HIERARCHY_NAME": "PMO COE Hierarchy", 
        "COE_ROADMAP_TYPE": "Program",
        "COE_ROADMAP_PARENT_ID": "PROG000328",
        "COE_ROADMAP_PARENT_NAME": "Account IQ",
        "COE_ROADMAP_PARENT_CLRTY_TYPE": "Programs",
        "CHILD_ID": "PR00003652",
        "CHILD_NAME": "Test Investment",
        "CLRTY_CHILD_TYPE": "Projects", 
        "If_parent_exist": 1
    }
]

MOCK_INVESTMENT_DATA = [
    # Investment record for the Program (Portfolio view shows programs)
    {
        "INV_INT_ID": 6352059,
        "INV_EXT_ID": "PROG000328",
        "CLRTY_INV_TYPE": "Program",
        "INVESTMENT_NAME": "Account IQ",
        "ROADMAP_ELEMENT": "Investment",
        "TASK_NAME": "Start/Finish Dates",
        "TASK_START": "01-Jan-24",
        "TASK_FINISH": "31-Dec-25",
        "INV_OVERALL_STATUS": "Green",
        "INV_FUNCTION": "Commercial",
        "SortOrder": 10200
    },
    # Milestone for the Program
    {
        "INV_INT_ID": 6352070,
        "INV_EXT_ID": "PROG000328",
        "CLRTY_INV_TYPE": "Program",
        "INVESTMENT_NAME": "Account IQ",
        "ROADMAP_ELEMENT": "Milestones - Other",
        "TASK_NAME": "SG3 Program Review",
        "TASK_START": "15-Jun-24",
        "TASK_FINISH": "15-Jun-24",
        "MILESTONE_STATUS": "Green",
        "INV_FUNCTION": "Commercial"
    },
    # Investment record for the Project (Program/SubProgram views show projects)
    {
        "INV_INT_ID": 6352060,
        "INV_EXT_ID": "PR00003652",
        "CLRTY_INV_TYPE": "Project",
        "INVESTMENT_NAME": "Manufacturing Labor Forecasting Tool (MLFT)",
        "ROADMAP_ELEMENT": "Investment",
        "TASK_NAME": "Start/Finish Dates",
        "TASK_START": "12-Aug-24",
        "TASK_FINISH": "01-Jul-25",
        "INV_OVERALL_STATUS": "Green",
        "INV_FUNCTION": "Supply Chain",
        "SortOrder": 10274
    },
    # Milestone for the Project
    {
        "INV_INT_ID": 6352061,
        "INV_EXT_ID": "PR00003652", 
        "CLRTY_INV_TYPE": "Project",
        "INVESTMENT_NAME": "Manufacturing Labor Forecasting Tool (MLFT)",
        "ROADMAP_ELEMENT": "Milestones - Other",
        "TASK_NAME": "SG3 Gate Review",
        "TASK_START": "15-Oct-24",
        "TASK_FINISH": "15-Oct-24",
        "MILESTONE_STATUS": "Green",
        "INV_FUNCTION": "Supply Chain"
    }
]


@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        'status': 'healthy',
        'message': 'PMO Portfolio API is running',
        'version': '1.0.0',
        'mode': 'mock' if MOCK_MODE else 'databricks'
    })


@app.route('/api/test-connection', methods=['GET'])
def test_databricks_connection():
    """Test Databricks connection endpoint."""
    if MOCK_MODE:
        return jsonify({
            'status': 'success',
            'message': 'Running in mock mode - Databricks connection bypassed',
            'mode': 'mock'
        })
    
    try:
        is_connected = databricks_client.test_connection()
        
        if is_connected:
            return jsonify({
                'status': 'success',
                'message': 'Databricks connection successful',
                'mode': 'databricks'
            })
        else:
            return jsonify({
                'status': 'error',
                'message': 'Databricks connection failed',
                'mode': 'databricks'
            }), 500
            
    except Exception as e:
        logger.error(f"Connection test error: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Connection test failed: {str(e)}',
            'mode': 'databricks'
        }), 500


@app.route('/api/hierarchy_data', methods=['GET'])
def get_hierarchy_data():
    """
    Fetch hierarchy data from Databricks or return mock data.
    Returns the same structure as hierarchyData.json for compatibility.
    """
    if MOCK_MODE:
        logger.info("Returning mock hierarchy data")
        return jsonify({
            'status': 'success',
            'data': MOCK_HIERARCHY_DATA,
            'count': len(MOCK_HIERARCHY_DATA),
            'mode': 'mock'
        })
    
    try:
        logger.info("Fetching hierarchy data from Databricks...")
        
        # Execute the hierarchy query
        data = databricks_client.execute_query_from_file(HIERARCHY_QUERY_FILE)
        
        logger.info(f"Successfully fetched {len(data)} hierarchy records")
        
        return jsonify({
            'status': 'success',
            'data': data,
            'count': len(data),
            'mode': 'databricks'
        })
        
    except FileNotFoundError:
        error_msg = f"Hierarchy query file not found: {HIERARCHY_QUERY_FILE}"
        logger.error(error_msg)
        return jsonify({
            'status': 'error',
            'message': error_msg
        }), 500
        
    except Exception as e:
        error_msg = f"Failed to fetch hierarchy data: {str(e)}"
        logger.error(error_msg)
        return jsonify({
            'status': 'error',
            'message': error_msg
        }), 500


@app.route('/api/investment_data', methods=['GET'])
def get_investment_data():
    """
    Fetch investment/roadmap data from Databricks or return mock data.
    Returns the same structure as investmentData.json for compatibility.
    """
    if MOCK_MODE:
        logger.info("Returning mock investment data")
        return jsonify({
            'status': 'success',
            'data': MOCK_INVESTMENT_DATA,
            'count': len(MOCK_INVESTMENT_DATA),
            'mode': 'mock'
        })
    
    try:
        logger.info("Fetching investment data from Databricks...")
        
        # Execute the investment query
        data = databricks_client.execute_query_from_file(INVESTMENT_QUERY_FILE)
        
        logger.info(f"Successfully fetched {len(data)} investment records")
        
        return jsonify({
            'status': 'success',
            'data': data,
            'count': len(data),
            'mode': 'databricks'
        })
        
    except FileNotFoundError:
        error_msg = f"Investment query file not found: {INVESTMENT_QUERY_FILE}"
        logger.error(error_msg)
        return jsonify({
            'status': 'error',
            'message': error_msg
        }), 500
        
    except Exception as e:
        error_msg = f"Failed to fetch investment data: {str(e)}"
        logger.error(error_msg)
        return jsonify({
            'status': 'error',
            'message': error_msg
        }), 500


@app.route('/api/portfolios', methods=['GET'])
def get_portfolios():
    """
    Fetch portfolio hierarchy data from Databricks.
    Filters for COE_ROADMAP_TYPE = 'Portfolio' only.
    """
    if MOCK_MODE:
        # Filter mock data for Portfolio type only
        mock_portfolio_data = [item for item in MOCK_HIERARCHY_DATA if item.get('COE_ROADMAP_TYPE') == 'Portfolio']
        logger.info("Returning mock portfolio data")
        return jsonify({
            'status': 'success',
            'data': mock_portfolio_data,
            'count': len(mock_portfolio_data),
            'mode': 'mock'
        })
    
    try:
        logger.info("Fetching portfolio data from Databricks...")
        
        # Execute the hierarchy query and filter for Portfolio type
        hierarchy_data = databricks_client.execute_query_from_file(HIERARCHY_QUERY_FILE)
        portfolio_data = [item for item in hierarchy_data if item.get('COE_ROADMAP_TYPE') == 'Portfolio']
        
        logger.info(f"Successfully fetched {len(portfolio_data)} portfolio records (filtered from {len(hierarchy_data)} total)")
        
        return jsonify({
            'status': 'success',
            'data': portfolio_data,
            'count': len(portfolio_data),
            'mode': 'databricks'
        })
        
    except Exception as e:
        error_msg = f"Failed to fetch portfolio data: {str(e)}"
        logger.error(error_msg)
        return jsonify({
            'status': 'error',
            'message': error_msg
        }), 500


@app.route('/api/investments', methods=['GET'])
def get_investments():
    """
    Fetch investment/roadmap data from Databricks.
    Returns all roadmap elements (investments, phases, milestones).
    """
    if MOCK_MODE:
        logger.info("Returning mock investment data")
        return jsonify({
            'status': 'success',
            'data': MOCK_INVESTMENT_DATA,
            'count': len(MOCK_INVESTMENT_DATA),
            'mode': 'mock'
        })
    
    try:
        logger.info("Fetching investment data from Databricks...")
        
        # Execute the investment query
        data = databricks_client.execute_query_from_file(INVESTMENT_QUERY_FILE)
        
        logger.info(f"Successfully fetched {len(data)} investment records")
        
        return jsonify({
            'status': 'success',
            'data': data,
            'count': len(data),
            'mode': 'databricks'
        })
        
    except Exception as e:
        error_msg = f"Failed to fetch investment data: {str(e)}"
        logger.error(error_msg)
        return jsonify({
            'status': 'error',
            'message': error_msg
        }), 500


@app.route('/api/data', methods=['GET'])
def get_all_data():
    """
    Fetch both hierarchy and investment data in a single request.
    Useful for frontend components that need both datasets.
    """
    if MOCK_MODE:
        logger.info("Returning all mock data")
        return jsonify({
            'status': 'success',
            'data': {
                'hierarchy': MOCK_HIERARCHY_DATA,
                'investment': MOCK_INVESTMENT_DATA
            },
            'counts': {
                'hierarchy': len(MOCK_HIERARCHY_DATA),
                'investment': len(MOCK_INVESTMENT_DATA)
            },
            'mode': 'mock'
        })
    
    try:
        logger.info("Fetching all data from Databricks...")
        
        # Execute both queries
        hierarchy_data = databricks_client.execute_query_from_file(HIERARCHY_QUERY_FILE)
        investment_data = databricks_client.execute_query_from_file(INVESTMENT_QUERY_FILE)
        
        logger.info(f"Successfully fetched {len(hierarchy_data)} hierarchy records and {len(investment_data)} investment records")
        
        return jsonify({
            'status': 'success',
            'data': {
                'hierarchy': hierarchy_data,
                'investment': investment_data
            },
            'counts': {
                'hierarchy': len(hierarchy_data),
                'investment': len(investment_data)
            },
            'mode': 'databricks'
        })
        
    except Exception as e:
        error_msg = f"Failed to fetch all data: {str(e)}"
        logger.error(error_msg)
        return jsonify({
            'status': 'error',
            'message': error_msg
        }), 500


@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors."""
    return jsonify({
        'status': 'error',
        'message': 'Endpoint not found'
    }), 404


@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors."""
    return jsonify({
        'status': 'error',
        'message': 'Internal server error'
    }), 500


if __name__ == '__main__':
    # Validate environment variables on startup
    required_env_vars = [
        'DATABRICKS_SERVER_HOSTNAME',
        'DATABRICKS_HTTP_PATH', 
        'DATABRICKS_ACCESS_TOKEN'
    ]
    
    missing_vars = [var for var in required_env_vars if not os.getenv(var)]
    if missing_vars:
        logger.error(f"Missing required environment variables: {', '.join(missing_vars)}")
        logger.error("Please check your .env file and ensure all required variables are set.")
        exit(1)
    
    # Check if SQL query files exist
    if not os.path.exists(HIERARCHY_QUERY_FILE):
        logger.error(f"Hierarchy query file not found: {HIERARCHY_QUERY_FILE}")
        exit(1)
    
    if not os.path.exists(INVESTMENT_QUERY_FILE):
        logger.error(f"Investment query file not found: {INVESTMENT_QUERY_FILE}")
        exit(1)
    
    # Start the Flask server
    port = int(os.getenv('PORT', 5000))
    debug = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'
    
    logger.info(f"Starting PMO Portfolio API server on port {port}")
    logger.info(f"CORS enabled for: {frontend_url}")
    
    app.run(
        host='0.0.0.0',
        port=port,
        debug=debug
    )
