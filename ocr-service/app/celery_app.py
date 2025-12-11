"""
Celery application configuration for async OCR processing
"""
from celery import Celery
from app.config import settings

celery_app = Celery(
    "ocr_tasks",
    broker=settings.celery_broker,
    backend=settings.celery_backend,
    include=["app.tasks.ocr_tasks"]
)

# Celery configuration
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,

    # Task settings
    task_track_started=True,
    task_time_limit=300,  # 5 minutes max per task
    task_soft_time_limit=240,  # Soft limit at 4 minutes

    # Worker settings
    worker_prefetch_multiplier=1,  # Process one task at a time per worker
    worker_concurrency=2,  # 2 concurrent workers

    # Result settings
    result_expires=3600,  # Results expire after 1 hour
)
