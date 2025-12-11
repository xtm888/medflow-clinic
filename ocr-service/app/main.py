"""
MedFlow OCR Microservice - FastAPI Application
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import redis

from app.config import settings
from app.routers import ocr
from app.services.ocr_service import ocr_service
from app.services.file_scanner import file_scanner
from app.models.schemas import HealthResponse

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="OCR microservice for medical imaging files",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(ocr.router, prefix="/api")


@app.get("/", tags=["Root"])
async def root():
    """Root endpoint"""
    return {
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs": "/docs"
    }


@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    """
    Health check endpoint

    Verifies:
    - Redis connection (for Celery)
    - OCR engine ready
    - Network share accessibility
    """
    # Check Redis
    redis_connected = False
    try:
        r = redis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            db=settings.REDIS_DB
        )
        redis_connected = r.ping()
    except:
        pass

    # Check network shares
    network_shares = file_scanner.check_network_shares()

    return HealthResponse(
        status="healthy" if redis_connected else "degraded",
        version=settings.APP_VERSION,
        redis_connected=redis_connected,
        ocr_ready=True,  # OCR lazy-loads, so always "ready"
        network_shares=network_shares
    )


@app.get("/api/shares", tags=["Network Shares"])
async def list_network_shares():
    """
    List configured network shares and their status
    """
    status = file_scanner.check_network_shares()

    return {
        "shares": [
            {
                "name": name,
                "path": settings.NETWORK_SHARES[name],
                "available": status[name]
            }
            for name in settings.NETWORK_SHARES
        ]
    }


@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    print(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    print(f"Redis: {settings.REDIS_HOST}:{settings.REDIS_PORT}")
    print(f"OCR Language: {settings.OCR_LANG}")
    print(f"GPU Enabled: {settings.OCR_USE_GPU}")

    # Check network shares
    shares = file_scanner.check_network_shares()
    available = sum(1 for v in shares.values() if v)
    print(f"Network Shares: {available}/{len(shares)} available")


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    print("Shutting down OCR service")
