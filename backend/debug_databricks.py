"""
Debug script to test Databricks connection with detailed error handling.
"""
import os
import sys
import logging
import requests
from databricks_client import DatabricksClient
from dotenv import load_dotenv

# Add the current directory to the path to import modules
sys.path.append(os.path.dirname(__file__))

# Load environment variables
load_dotenv()

# Configure detailed logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def test_basic_connectivity():
    """Test basic network connectivity to Databricks."""
    hostname = os.getenv('DATABRICKS_SERVER_HOSTNAME')
    
    print(f"\n{'='*60}")
    print("TESTING BASIC CONNECTIVITY")
    print(f"{'='*60}")
    
    if not hostname:
        print("❌ DATABRICKS_SERVER_HOSTNAME not found in environment")
        return False
    
    print(f"Testing connection to: {hostname}")
    
    try:
        # Test basic HTTPS connectivity
        url = f"https://{hostname}"
        response = requests.get(url, timeout=10)
        print(f"✅ Basic HTTPS connection successful (Status: {response.status_code})")
        return True
    except requests.exceptions.ConnectTimeout:
        print("❌ Connection timeout - network might be blocking access")
        return False
    except requests.exceptions.ConnectionError as e:
        print(f"❌ Connection error: {str(e)}")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {str(e)}")
        return False

def test_warehouse_status():
    """Test if the SQL warehouse is running."""
    hostname = os.getenv('DATABRICKS_SERVER_HOSTNAME')
    token = os.getenv('DATABRICKS_ACCESS_TOKEN')
    http_path = os.getenv('DATABRICKS_HTTP_PATH')
    
    print(f"\n{'='*60}")
    print("TESTING WAREHOUSE STATUS")
    print(f"{'='*60}")
    
    if not all([hostname, token, http_path]):
        print("❌ Missing required environment variables")
        return False
    
    # Extract warehouse ID from http_path
    warehouse_id = http_path.split('/')[-1] if http_path else None
    if not warehouse_id:
        print("❌ Could not extract warehouse ID from http_path")
        return False
    
    print(f"Warehouse ID: {warehouse_id}")
    
    try:
        # Check warehouse status using Databricks API
        url = f"https://{hostname}/api/2.0/sql/warehouses/{warehouse_id}"
        headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
        
        response = requests.get(url, headers=headers, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            state = data.get('state', 'UNKNOWN')
            print(f"✅ Warehouse status: {state}")
            
            if state == 'RUNNING':
                print("✅ Warehouse is running and ready")
                return True
            elif state in ['STARTING', 'STOPPED']:
                print(f"⚠️  Warehouse is {state} - it may need time to start")
                return False
            else:
                print(f"❌ Warehouse is in unexpected state: {state}")
                return False
        else:
            print(f"❌ API request failed with status: {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Error checking warehouse status: {str(e)}")
        return False

def test_databricks_connection():
    """Test the Databricks SQL connection."""
    print(f"\n{'='*60}")
    print("TESTING DATABRICKS SQL CONNECTION")
    print(f"{'='*60}")
    
    try:
        client = DatabricksClient()
        print("✅ DatabricksClient initialized successfully")
        
        # Test connection
        client.connect()
        print("✅ Connection established successfully")
        
        # Test simple query
        simple_query = "SELECT 1 as test_value"
        print(f"Testing simple query: {simple_query}")
        
        results = client.execute_query(simple_query)
        print(f"✅ Query executed successfully: {results}")
        
        client.disconnect()
        print("✅ Disconnected successfully")
        
        return True
        
    except Exception as e:
        print(f"❌ Databricks connection failed: {str(e)}")
        print(f"Error type: {type(e).__name__}")
        return False

def main():
    """Run all diagnostic tests."""
    print("DATABRICKS CONNECTION DIAGNOSTICS")
    print("="*60)
    
    # Check environment variables
    required_vars = [
        'DATABRICKS_SERVER_HOSTNAME',
        'DATABRICKS_HTTP_PATH',
        'DATABRICKS_ACCESS_TOKEN'
    ]
    
    print("\nEnvironment Variables:")
    for var in required_vars:
        value = os.getenv(var)
        if value:
            # Mask token for security
            display_value = value[:10] + "..." if var == 'DATABRICKS_ACCESS_TOKEN' else value
            print(f"✅ {var}: {display_value}")
        else:
            print(f"❌ {var}: Not found")
    
    # Run tests
    tests = [
        ("Basic Connectivity", test_basic_connectivity),
        ("Warehouse Status", test_warehouse_status),
        ("Databricks Connection", test_databricks_connection)
    ]
    
    results = {}
    for test_name, test_func in tests:
        try:
            results[test_name] = test_func()
        except Exception as e:
            print(f"❌ {test_name} failed with exception: {str(e)}")
            results[test_name] = False
    
    # Summary
    print(f"\n{'='*60}")
    print("SUMMARY")
    print(f"{'='*60}")
    
    for test_name, passed in results.items():
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"{test_name}: {status}")
    
    if all(results.values()):
        print("\n🎉 All tests passed! Your Databricks connection should work.")
        return 0
    else:
        print("\n⚠️  Some tests failed. Please check the issues above.")
        return 1

if __name__ == "__main__":
    exit(main())
