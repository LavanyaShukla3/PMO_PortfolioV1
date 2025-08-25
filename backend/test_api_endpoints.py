"""
Simple test script to verify backend API endpoints are working
Run this before starting your React frontend to ensure the backend is ready
"""
import requests
import json
import time

def test_api_endpoints():
    """Test all the new API endpoints"""
    base_url = "http://localhost:5000"
    
    endpoints = [
        ('/api/health', 'Health Check'),
        ('/api/portfolios', 'Portfolio Data'),
        ('/api/investments', 'Investment Data')
    ]
    
    print("🚀 Testing Backend API Endpoints")
    print("=" * 50)
    
    for endpoint, name in endpoints:
        try:
            print(f"\n📡 Testing {name}: {endpoint}")
            response = requests.get(f"{base_url}{endpoint}", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if endpoint == '/api/health':
                    print(f"✅ {name}: {data.get('status', 'Unknown')} - {data.get('message', 'No message')}")
                else:
                    count = data.get('count', 0)
                    mode = data.get('mode', 'Unknown')
                    print(f"✅ {name}: {count} records returned (mode: {mode})")
            else:
                print(f"❌ {name}: HTTP {response.status_code} - {response.text}")
                
        except requests.exceptions.ConnectionError:
            print(f"❌ {name}: Connection failed - Is the Flask server running on port 5000?")
        except requests.exceptions.Timeout:
            print(f"❌ {name}: Request timed out")
        except Exception as e:
            print(f"❌ {name}: Error - {str(e)}")
    
    print("\n" + "=" * 50)
    print("✅ API testing complete!")
    print("💡 If all tests passed, your React frontend should work correctly")
    print("🚀 Start your backend with: python backend/app.py")
    print("🌐 Start your frontend with: npm start")

if __name__ == "__main__":
    test_api_endpoints()
