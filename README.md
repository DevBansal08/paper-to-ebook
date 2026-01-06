# Paper to eBook

A web application that converts PDF research papers into a readable eBook format.

## Prerequisites
- Node.js & npm
- Python 3.9+

## Setup

1. **Backend** (FastAPI)
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

2. **Frontend** (Next.js)
   ```bash
   cd frontend
   npm install
   ```

## Running the Application

You need two terminal windows running simultaneously:

1. **Backend**:
   ```bash
   # From root directory
   python -m uvicorn backend.main:app --reload --port 8000 --host 127.0.0.1
   ```

2. **Frontend**:
   ```bash
   # From root directory
   cd frontend
   npm run dev
   ```

Access the application at [http://localhost:3000](http://localhost:3000).
