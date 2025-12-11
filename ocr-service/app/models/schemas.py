"""
Pydantic models for API request/response schemas
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class DeviceType(str, Enum):
    """Supported medical imaging device types"""
    ZEISS = "zeiss"
    SOLIX = "solix"
    TOMEY = "tomey"
    QUANTEL = "quantel"
    GENERIC = "generic"


class FileType(str, Enum):
    """Supported file types"""
    IMAGE = "image"
    PDF = "pdf"
    DICOM = "dicom"


class MatchConfidence(str, Enum):
    """Patient match confidence levels"""
    HIGH = "high"      # >= 85% - Auto-link
    MEDIUM = "medium"  # 60-84% - Manual review with suggestion
    LOW = "low"        # < 60% - Manual review, no suggestion
    NONE = "none"      # No match found


class TaskStatus(str, Enum):
    """Celery task status"""
    PENDING = "pending"
    STARTED = "started"
    SUCCESS = "success"
    FAILURE = "failure"
    RETRY = "retry"


# ==================== Request Models ====================

class OCRProcessRequest(BaseModel):
    """Single file OCR processing request"""
    file_path: str = Field(..., description="Full path to the file on network share")
    device_type: DeviceType = Field(DeviceType.GENERIC, description="Source device type for pattern matching")
    extract_thumbnail: bool = Field(True, description="Generate thumbnail during processing")


class OCRBatchRequest(BaseModel):
    """Batch OCR processing request"""
    folder_path: str = Field(..., description="Folder path to scan")
    device_type: DeviceType = Field(..., description="Device type for this folder")
    max_files: int = Field(100, description="Maximum files to process", ge=1, le=1000)
    max_patients: int = Field(20, description="Target number of unique patients", ge=1, le=100)
    file_extensions: Optional[List[str]] = Field(None, description="Filter by extensions")
    recursive: bool = Field(True, description="Scan subfolders recursively")


class PatientMatchRequest(BaseModel):
    """Request to match OCR results to patients"""
    ocr_result_id: str = Field(..., description="OCR result ID to match")
    patient_id: Optional[str] = Field(None, description="Manual patient ID override")


# ==================== Response Models ====================

class ExtractedPatientInfo(BaseModel):
    """Patient information extracted from OCR/filename"""
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    patient_id: Optional[str] = None
    date_of_birth: Optional[datetime] = None
    gender: Optional[str] = None
    laterality: Optional[str] = None  # OD, OS, OU
    exam_date: Optional[datetime] = None
    exam_type: Optional[str] = None
    raw_text: Optional[str] = None
    source: str = Field(..., description="Source of extraction: filename, ocr, dicom")


class OCRResult(BaseModel):
    """OCR processing result for a single file"""
    file_path: str
    file_name: str
    file_type: FileType
    file_size: int
    device_type: DeviceType

    # OCR data
    ocr_text: Optional[str] = None
    ocr_confidence: float = 0.0
    extracted_info: Optional[ExtractedPatientInfo] = None

    # Patient matching
    match_confidence: MatchConfidence = MatchConfidence.NONE
    match_score: float = 0.0
    suggested_patient_id: Optional[str] = None
    suggested_patient_name: Optional[str] = None

    # Thumbnail
    thumbnail_path: Optional[str] = None

    # Metadata
    processed_at: datetime = Field(default_factory=datetime.utcnow)
    processing_time_ms: int = 0
    error: Optional[str] = None


class BatchProgress(BaseModel):
    """Progress information for batch processing"""
    task_id: str
    status: TaskStatus
    total_files: int = 0
    processed_files: int = 0
    matched_patients: int = 0
    unique_patients: int = 0
    errors: int = 0
    current_file: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    results: List[OCRResult] = []


class TaskResponse(BaseModel):
    """Generic task response"""
    task_id: str
    status: TaskStatus
    message: str


class FolderScanResult(BaseModel):
    """Result of scanning a folder"""
    folder_path: str
    total_files: int
    files_by_type: Dict[str, int]
    estimated_patients: int
    sample_files: List[str]


class ThumbnailResponse(BaseModel):
    """Thumbnail generation response"""
    file_path: str
    thumbnail_path: str
    size: str
    width: int
    height: int


class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    version: str
    redis_connected: bool
    ocr_ready: bool
    network_shares: Dict[str, bool]
