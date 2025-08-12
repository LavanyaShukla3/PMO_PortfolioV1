"""
Test script for Azure Databricks connection
Run this to verify your connection is working
"""

import os
import sys
from dotenv import load_dotenv
from databricks_client import DatabricksClient

def test_databricks_connection():
    """Test the Databricks connection and basic queries"""
    
    # Load environment variables
    load_dotenv()
    
    print("🔧 Testing Azure Databricks Connection...")
    print("=" * 50)
    
    # Check environment variables
    required_vars = [
        'DATABRICKS_SERVER_HOSTNAME',
        'DATABRICKS_HTTP_PATH', 
        'DATABRICKS_ACCESS_TOKEN'
    ]
    
    missing_vars = []
    for var in required_vars:
        if not os.getenv(var):
            missing_vars.append(var)
    
    if missing_vars:
        print("❌ Missing required environment variables:")
        for var in missing_vars:
            print(f"   - {var}")
        print("\nPlease check your .env file")
        return False
    
    print("✅ Environment variables loaded")
    
    # Test connection
    try:
        client = DatabricksClient()
        print("✅ Databricks client initialized")
        
        # Test basic connection
        if client.test_connection():
            print("✅ Connection test successful")
        else:
            print("❌ Connection test failed")
            return False
            
    except Exception as e:
        print(f"❌ Failed to initialize client: {str(e)}")
        return False
    
    # Test data queries (these will fail if tables don't exist yet)
    print("\n🔍 Testing data queries...")
    print("-" * 30)
    
    test_queries = [
        ("Portfolio Data", client.get_portfolio_data),
        ("Program Data", client.get_program_data),
        ("SubProgram Data", client.get_subprogram_data),
        ("Investment Data", client.get_investment_data)
    ]
    
    for query_name, query_func in test_queries:
        try:
            data = query_func()
            print(f"✅ {query_name}: {len(data)} records")
        except Exception as e:
            print(f"⚠️  {query_name}: {str(e)}")
            print(f"   (This is expected if tables don't exist yet)")
    
    print("\n🎉 Connection test completed!")
    return True

if __name__ == "__main__":
    success = test_databricks_connection()
    sys.exit(0 if success else 1)
