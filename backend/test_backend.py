"""
Test script for Databricks connection and API endpoints.
Run this to verify your backend setup is working correctly.
"""
import sys
import os
import requests
import time

# Add the backend directory to Python path
sys.path.insert(0, os.path.dirname(__file__))

from databricks_client import databricks_client


def test_databricks_connection():
    """Test direct Databricks connection."""
    print("🔗 Testing Databricks connection...")
    try:
        is_connected = databricks_client.test_connection()
        if is_connected:
            print("✅ Databricks connection successful!")
            return True
        else:
            print("❌ Databricks connection failed!")
            return False
    except Exception as e:
        print(f"❌ Databricks connection error: {str(e)}")
        return False


def test_simple_query():
    """Test a simple query execution."""
    print("\n📊 Testing simple query execution...")
    try:
        databricks_client.connect()
        result = databricks_client.execute_query("SELECT 'Hello from Databricks!' as message, CURRENT_TIMESTAMP() as timestamp")
        if result:
            print(f"✅ Query successful! Result: {result[0]}")
            return True
        else:
            print("❌ Query returned no results!")
            return False
    except Exception as e:
        print(f"❌ Query execution error: {str(e)}")
        return False
    finally:
        databricks_client.disconnect()


def test_flask_server():
    """Test Flask server endpoints."""
    print("\n🌐 Testing Flask server...")
    
    # Base URL for the API
    base_url = "http://localhost:5000"
    
    # Test health endpoint
    try:
        response = requests.get(f"{base_url}/api/health", timeout=10)
        if response.status_code == 200:
            print("✅ Health endpoint working!")
            print(f"   Response: {response.json()}")
        else:
            print(f"❌ Health endpoint failed with status {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to Flask server. Make sure it's running on localhost:5000")
        return False
    except Exception as e:
        print(f"❌ Health endpoint error: {str(e)}")
        return False
    
    # Test connection endpoint
    try:
        response = requests.get(f"{base_url}/api/test-connection", timeout=30)
        if response.status_code == 200:
            print("✅ Connection test endpoint working!")
            print(f"   Response: {response.json()}")
        else:
            print(f"❌ Connection test failed with status {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Connection test error: {str(e)}")
        return False
    
    return True


def test_data_endpoints():
    """Test data fetching endpoints."""
    print("\n📈 Testing data endpoints...")
    
    base_url = "http://localhost:5000"
    
    # Test hierarchy data endpoint
    try:
        print("   Testing hierarchy data endpoint...")
        response = requests.get(f"{base_url}/api/hierarchy_data", timeout=60)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Hierarchy data endpoint working! Retrieved {data.get('count', 0)} records")
        else:
            print(f"❌ Hierarchy data endpoint failed with status {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Hierarchy data endpoint error: {str(e)}")
        return False
    
    # Test investment data endpoint  
    try:
        print("   Testing investment data endpoint...")
        response = requests.get(f"{base_url}/api/investment_data", timeout=120)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Investment data endpoint working! Retrieved {data.get('count', 0)} records")
        else:
            print(f"❌ Investment data endpoint failed with status {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Investment data endpoint error: {str(e)}")
        return False
    
    return True


def main():
    """Run all tests."""
    print("🧪 PMO Portfolio Backend Test Suite")
    print("=" * 50)
    
    # Test 1: Direct Databricks connection
    connection_ok = test_databricks_connection()
    
    # Test 2: Simple query execution
    if connection_ok:
        query_ok = test_simple_query()
    else:
        print("⏭️  Skipping query test due to connection failure")
        query_ok = False
    
    # Test 3: Flask server endpoints
    if connection_ok:
        server_ok = test_flask_server()
    else:
        print("⏭️  Skipping Flask server tests due to connection failure")
        server_ok = False
    
    # Test 4: Data endpoints (only if server is working)
    if server_ok:
        data_ok = test_data_endpoints()
    else:
        print("⏭️  Skipping data endpoint tests due to server issues")
        data_ok = False
    
    # Summary
    print("\n" + "=" * 50)
    print("📋 Test Summary:")
    print(f"   Databricks Connection: {'✅' if connection_ok else '❌'}")
    print(f"   Query Execution: {'✅' if query_ok else '❌'}")
    print(f"   Flask Server: {'✅' if server_ok else '❌'}")
    print(f"   Data Endpoints: {'✅' if data_ok else '❌'}")
    
    if all([connection_ok, query_ok, server_ok, data_ok]):
        print("\n🎉 All tests passed! Your backend is ready!")
    else:
        print("\n⚠️  Some tests failed. Check the errors above and fix them.")
        
    return all([connection_ok, query_ok, server_ok, data_ok])


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
