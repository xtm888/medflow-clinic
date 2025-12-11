"""
OCR API Router - Endpoints for OCR processing
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks
from typing import Optional

from app.models.schemas import (
    OCRProcessRequest,
    OCRBatchRequest,
    OCRResult,
    BatchProgress,
    TaskResponse,
    TaskStatus,
    FolderScanResult
)
from app.services.ocr_service import ocr_service
from app.services.file_scanner import file_scanner
from app.tasks.ocr_tasks import process_single_file, process_batch, send_results_to_medflow
from app.celery_app import celery_app

router = APIRouter(prefix="/ocr", tags=["OCR"])


@router.post("/process", response_model=OCRResult)
async def process_file(request: OCRProcessRequest):
    """
    Process a single file with OCR (synchronous)

    Use this for individual file processing or testing
    """
    result = ocr_service.process_file(
        request.file_path,
        request.device_type,
        request.extract_thumbnail
    )

    if result.error:
        raise HTTPException(status_code=400, detail=result.error)

    return result


@router.post("/process/async", response_model=TaskResponse)
async def process_file_async(request: OCRProcessRequest):
    """
    Process a single file with OCR (asynchronous)

    Returns task ID for status polling
    """
    task = process_single_file.delay(
        request.file_path,
        request.device_type.value,
        request.extract_thumbnail
    )

    return TaskResponse(
        task_id=task.id,
        status=TaskStatus.PENDING,
        message="OCR task queued"
    )


@router.post("/batch", response_model=TaskResponse)
async def start_batch_processing(request: OCRBatchRequest):
    """
    Start batch OCR processing for a folder

    This processes files asynchronously and returns a task ID for tracking progress
    """
    # Validate folder exists
    scan_result = file_scanner.scan_folder(
        request.folder_path,
        max_files=100,
        extensions=request.file_extensions,
        recursive=request.recursive
    )

    if scan_result.total_files == 0:
        raise HTTPException(
            status_code=400,
            detail=f"No supported files found in {request.folder_path}"
        )

    # Start async batch processing
    task = process_batch.delay(
        request.folder_path,
        request.device_type.value,
        request.max_files,
        request.max_patients
    )

    return TaskResponse(
        task_id=task.id,
        status=TaskStatus.PENDING,
        message=f"Batch processing started. Found {scan_result.total_files} files, targeting {request.max_patients} patients."
    )


@router.get("/status/{task_id}", response_model=BatchProgress)
async def get_task_status(task_id: str):
    """
    Get the status and progress of an OCR task
    """
    task = celery_app.AsyncResult(task_id)

    if task.state == "PENDING":
        return BatchProgress(
            task_id=task_id,
            status=TaskStatus.PENDING,
            total_files=0,
            processed_files=0
        )

    elif task.state == "STARTED" or task.state == "PROGRESS":
        info = task.info or {}
        return BatchProgress(
            task_id=task_id,
            status=TaskStatus.STARTED,
            total_files=info.get("total_files", 0),
            processed_files=info.get("processed_files", 0),
            unique_patients=info.get("unique_patients", 0),
            errors=info.get("errors", 0),
            current_file=info.get("current_file")
        )

    elif task.state == "SUCCESS":
        result = task.result or {}
        return BatchProgress(
            task_id=task_id,
            status=TaskStatus.SUCCESS,
            total_files=result.get("total_files", 0),
            processed_files=result.get("processed_files", 0),
            unique_patients=result.get("unique_patients", 0),
            errors=result.get("errors", 0),
            results=result.get("results", [])
        )

    elif task.state == "FAILURE":
        return BatchProgress(
            task_id=task_id,
            status=TaskStatus.FAILURE,
            total_files=0,
            processed_files=0
        )

    else:
        return BatchProgress(
            task_id=task_id,
            status=TaskStatus.PENDING
        )


@router.post("/status/{task_id}/cancel")
async def cancel_task(task_id: str):
    """
    Cancel a running OCR task
    """
    celery_app.control.revoke(task_id, terminate=True)
    return {"message": f"Task {task_id} cancellation requested"}


@router.get("/scan", response_model=FolderScanResult)
async def scan_folder(
    folder_path: str,
    max_files: int = 1000,
    recursive: bool = True
):
    """
    Scan a folder to get file statistics without processing

    Use this to preview what will be imported
    """
    result = file_scanner.scan_folder(
        folder_path,
        max_files=max_files,
        recursive=recursive
    )

    if result.total_files == 0:
        raise HTTPException(
            status_code=404,
            detail=f"No supported files found in {folder_path}"
        )

    return result


@router.get("/patients-preview")
async def preview_patients(
    folder_path: str,
    device_type: str = "generic",
    max_patients: int = 20
):
    """
    Preview which patients would be imported from a folder

    Returns estimated patient list based on folder structure
    """
    from app.models.schemas import DeviceType

    try:
        device = DeviceType(device_type)
    except ValueError:
        device = DeviceType.GENERIC

    patients = file_scanner.get_files_for_import(
        folder_path=folder_path,
        device_type=device,
        max_patients=max_patients,
        max_files_per_patient=5
    )

    return {
        "folder_path": folder_path,
        "device_type": device_type,
        "patient_count": len(patients),
        "patients": [
            {
                "patient_key": p["patient_key"],
                "file_count": p["total_files"],
                "sample_files": [f["name"] for f in p["files"][:3]],
                "latest_date": p["latest_file_date"].isoformat()
            }
            for p in patients
        ]
    }
