"""
Configuration settings for OCR microservice
"""
from pydantic_settings import BaseSettings
from typing import Optional
import os


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    # Service settings
    APP_NAME: str = "MedFlow OCR Service"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # Redis settings (for Celery)
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    CELERY_BROKER_URL: Optional[str] = None
    CELERY_RESULT_BACKEND: Optional[str] = None

    # OCR settings
    OCR_LANG: str = "fr"  # French for medical documents
    OCR_USE_GPU: bool = False
    OCR_CONFIDENCE_THRESHOLD: float = 0.6

    # Patient matching thresholds
    MATCH_AUTO_LINK_THRESHOLD: float = 0.85  # Auto-link if confidence >= 85%
    MATCH_SUGGEST_THRESHOLD: float = 0.60    # Suggest match if >= 60%

    # File processing
    SUPPORTED_IMAGE_TYPES: list = [".jpg", ".jpeg", ".png", ".tiff", ".tif", ".bmp"]
    SUPPORTED_PDF_TYPES: list = [".pdf"]
    SUPPORTED_DICOM_TYPES: list = [".dcm", ".dicom"]

    # Thumbnail settings
    THUMBNAIL_SIZES: dict = {
        "small": 120,
        "medium": 720,
        "large": 1600
    }
    THUMBNAIL_CACHE_DIR: str = "/tmp/medflow_thumbnails"

    # Network share paths (mounted via MedFlow at /tmp/medflow_mounts/)
    NETWORK_SHARES: dict = {
        "zeiss": "/tmp/medflow_mounts/ZEISS_RETINO",
        "solix": "/tmp/medflow_mounts/Export_Solix_OCT",
        "tomey": "/tmp/medflow_mounts/TOMEY_DATA",
        "export": "/tmp/medflow_mounts/Export",
        "archives": "/Volumes/Archives",  # Keep /Volumes for manually mounted shares
        "image_matrix": "/tmp/medflow_mounts/image_matrix"
    }

    # MedFlow backend URL
    MEDFLOW_BACKEND_URL: str = "http://localhost:5001"

    @property
    def celery_broker(self) -> str:
        return self.CELERY_BROKER_URL or f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"

    @property
    def celery_backend(self) -> str:
        return self.CELERY_RESULT_BACKEND or f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"

    class Config:
        env_file = ".env"
        extra = "allow"


settings = Settings()
