"""
Debug script to test Databricks connection step by step and provide mock mode.
"""
import os
import sys
sys.path.insert(0, os.path.dirname(__file__))

from databricks_client import databricks_client
from dotenv import load_dotenv

load_dotenv()

def debug_connection():
    """Debug the Databricks connection with detailed info."""
    print("🔍 Debugging Databricks Connection")
    print("=" * 50)
    
    # Check environment variables
    hostname = os.getenv('DATABRICKS_SERVER_HOSTNAME')
    http_path = os.getenv('DATABRICKS_HTTP_PATH')
    token = os.getenv('DATABRICKS_ACCESS_TOKEN')
    
    print(f"📍 Server Hostname: {hostname}")
    print(f"🛣️  HTTP Path: {http_path}")
    print(f"🔑 Token Length: {len(token) if token else 0} characters")
    print(f"🔑 Token Starts With: {token[:10] + '...' if token and len(token) > 10 else 'N/A'}")
    print(f"🔑 Token Format: {'dapi-' if token and token.startswith('dapi-') else 'Unknown format'}")
    
    print("\n🔗 Testing connection...")
    
    try:
        # Test basic connection
        databricks_client.connect()
        print("✅ Basic connection established")
        
        # Test simple query
        result = databricks_client.execute_query("SELECT 1 as test")
        print(f"✅ Query test successful: {result}")
        
        return True
        
    except Exception as e:
        print(f"❌ Connection failed: {str(e)}")
        print(f"❌ Error type: {type(e).__name__}")
        return False
    finally:
        databricks_client.disconnect()

def test_mock_mode():
    """Test the Flask server in mock mode."""
    print("\n🎭 Testing Mock Mode")
    print("=" * 30)
    
    # Create mock data
    mock_hierarchy = [
        {
            "HIERARCHY_EXTERNAL_ID": "H-0056",
            "HIERARCHY_NAME": "PMO COE Hierarchy",
            "COE_ROADMAP_TYPE": "Portfolio",
            "COE_ROADMAP_PARENT_ID": "PTF000109",
            "COE_ROADMAP_PARENT_NAME": "Commercial Programs",
            "CHILD_ID": "PROG000328",
            "CHILD_NAME": "Account IQ"
        }
    ]
    
    mock_investment = [
        {
            "INV_INT_ID": 6352060,
            "INV_EXT_ID": "PR00003652",
            "INVESTMENT_NAME": "Test Project",
            "ROADMAP_ELEMENT": "Investment",
            "TASK_START": "12-Aug-24",
            "TASK_FINISH": "01-Jul-25",
            "INV_OVERALL_STATUS": "Green"
        }
    ]
    
    print(f"✅ Mock hierarchy data: {len(mock_hierarchy)} records")
    print(f"✅ Mock investment data: {len(mock_investment)} records")
    
    return mock_hierarchy, mock_investment

if __name__ == "__main__":
    print("🧪 Databricks Connection Debug Tool")
    print("=" * 50)
    
    # Test 1: Debug connection
    connection_success = debug_connection()
    
    # Test 2: Show mock data option
    if not connection_success:
        print("\n💡 Since Databricks connection failed, you can use mock mode:")
        print("   1. Update your token with a valid Databricks Personal Access Token")
        print("   2. Or run the Flask server in mock mode for testing")
        
        mock_hierarchy, mock_investment = test_mock_mode()
        
        print(f"\n🚀 To start Flask in mock mode:")
        print(f"   Set environment variable: MOCK_MODE=true")
        print(f"   Then run: python app.py")
    else:
        print("\n🎉 Databricks connection successful! You can run the full backend.")
        print("   Run: python app.py")
