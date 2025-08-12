# PMO Portfolio Flask Backend

Flask backend service for connecting PMO Portfolio frontend to Azure Databricks.

## 🚀 Quick Start

### 1. Setup Environment

```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Configure Environment Variables

```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your Azure Databricks credentials
```

### 3. Required Environment Variables

```env
# Azure Databricks Configuration
DATABRICKS_SERVER_HOSTNAME=your-workspace.cloud.databricks.com
DATABRICKS_HTTP_PATH=/sql/1.0/warehouses/your-warehouse-id
DATABRICKS_ACCESS_TOKEN=your-personal-access-token

# Optional Configuration
DATABRICKS_CATALOG=main
DATABRICKS_SCHEMA=pmo_portfolio
FLASK_ENV=development
PORT=5000
```

### 4. Run the Application

```bash
# Development mode
python app.py

# Production mode with Gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

## 📡 API Endpoints

### Health Check
- `GET /health` - Service health status

### Data Endpoints
- `GET /api/portfolio` - Get portfolio data
- `GET /api/program` - Get program data  
- `GET /api/subprogram` - Get sub-program data
- `GET /api/investment` - Get investment data

### Filtered Data
- `GET /api/data/<data_type>?filter=value` - Get filtered data

## 🔧 Azure Databricks Setup

### 1. Get Access Token
1. Go to your Databricks workspace
2. Click on your profile → User Settings
3. Go to Access Tokens tab
4. Generate New Token
5. Copy the token to your `.env` file

### 2. Get Connection Details
1. Go to SQL Warehouses in your workspace
2. Click on your warehouse
3. Go to Connection Details tab
4. Copy Server hostname and HTTP path

### 3. Table Structure
Ensure your Databricks tables match the expected schema:

```sql
-- portfolio_data table
CREATE TABLE portfolio_data (
    HIERARCHY_EXTERNAL_ID STRING,
    HIERARCHY_NAME STRING,
    COE_ROADMAP_TYPE STRING,
    COE_ROADMAP_PARENT_ID STRING,
    COE_ROADMAP_PARENT_NAME STRING,
    COE_ROADMAP_PARENT_CLRTY_TYPE STRING,
    CHILD_ID STRING,
    CHILD_NAME STRING,
    CLRTY_CHILD_TYPE STRING,
    If_parent_exist INT
);

-- Similar structure for program_data, subprogram_data, investment_data
```

## 🧪 Testing

```bash
# Test connection
curl http://localhost:5000/health

# Test data endpoint
curl http://localhost:5000/api/portfolio
```

## 🔒 Security Notes

- Never commit your `.env` file
- Use environment variables for all sensitive data
- Consider using Azure Key Vault for production
- Implement proper authentication for production use

## 📝 Development

### Adding New Endpoints
1. Add route in `app.py`
2. Add corresponding method in `databricks_client.py`
3. Test with sample data first
4. Update documentation

### Error Handling
- All endpoints include try-catch blocks
- Errors are logged with structured logging
- Client receives appropriate HTTP status codes
