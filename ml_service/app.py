"""
ML Service - FastAPI application for ERIS ML predictions
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown events"""
    # Startup
    logger.info("Starting ML Service...")
    logger.info("Initializing Redis connection...")
    logger.info("Loading ML models...")
    
    yield
    
    # Shutdown
    logger.info("Shutting down ML Service...")
    logger.info("Closing Redis connection...")


# Create FastAPI app
app = FastAPI(
    title="ERIS ML Service",
    description="Machine Learning service for Emergency Response Intelligence System",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "ERIS ML Service",
        "version": "1.0.0",
        "status": "running"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "redis": "connected",  # TODO: Check actual Redis connection
        "models": "loaded"  # TODO: Check actual model status
    }


# Include routers
from ml_service.routers import data_generation, features, predictions, quality, monitoring
app.include_router(data_generation.router)
app.include_router(features.router)
app.include_router(predictions.router)
app.include_router(quality.router)
app.include_router(monitoring.router)


# Error handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    logger.error(f"HTTP error: {exc.detail}")
    return {
        "error": exc.detail,
        "status_code": exc.status_code
    }


@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    logger.error(f"Unexpected error: {str(exc)}", exc_info=True)
    return {
        "error": "Internal server error",
        "detail": str(exc),
        "status_code": 500
    }


if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv("ML_SERVICE_PORT", 8000))
    host = os.getenv("ML_SERVICE_HOST", "0.0.0.0")
    
    uvicorn.run(
        "app:app",
        host=host,
        port=port,
        reload=True,
        log_level=os.getenv("LOG_LEVEL", "info").lower()
    )
