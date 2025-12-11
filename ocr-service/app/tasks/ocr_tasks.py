"""
Celery tasks for OCR processing
"""
from typing import List, Dict, Any
from datetime import datetime
import httpx

from celery import current_task
from app.celery_app import celery_app
from app.services.ocr_service import ocr_service
from app.services.file_scanner import file_scanner
from app.models.schemas import DeviceType, TaskStatus, MatchConfidence
from app.config import settings


@celery_app.task(bind=True, name="ocr.process_single")
def process_single_file(
    self,
    file_path: str,
    device_type: str = "generic",
    extract_thumbnail: bool = True
) -> Dict[str, Any]:
    """
    Process a single file with OCR

    Args:
        file_path: Full path to the file
        device_type: Device type for pattern matching
        extract_thumbnail: Whether to generate thumbnail

    Returns:
        OCR result as dictionary
    """
    try:
        device = DeviceType(device_type)
        result = ocr_service.process_file(file_path, device, extract_thumbnail)
        return result.model_dump()
    except Exception as e:
        return {
            "file_path": file_path,
            "error": str(e),
            "status": "failed"
        }


@celery_app.task(bind=True, name="ocr.process_batch")
def process_batch(
    self,
    folder_path: str,
    device_type: str,
    max_files: int = 100,
    max_patients: int = 20
) -> Dict[str, Any]:
    """
    Process a batch of files from a folder

    Updates task state with progress information

    Args:
        folder_path: Folder to scan
        device_type: Device type
        max_files: Max files to process
        max_patients: Target patient count

    Returns:
        Batch processing results
    """
    task_id = self.request.id
    device = DeviceType(device_type)

    # Update state: started
    self.update_state(
        state="STARTED",
        meta={
            "status": TaskStatus.STARTED.value,
            "total_files": 0,
            "processed_files": 0,
            "matched_patients": 0,
            "current_file": None,
            "started_at": datetime.utcnow().isoformat()
        }
    )

    # Get files organized by patient
    patient_groups = file_scanner.get_files_for_import(
        folder_path=folder_path,
        device_type=device,
        max_patients=max_patients,
        max_files_per_patient=10
    )

    # Count total files
    total_files = sum(len(pg["files"]) for pg in patient_groups)
    processed = 0
    results = []
    errors = 0
    unique_patients = set()

    # Update state with total
    self.update_state(
        state="PROGRESS",
        meta={
            "status": TaskStatus.STARTED.value,
            "total_files": total_files,
            "processed_files": 0,
            "unique_patients": 0,
            "errors": 0,
            "current_file": None
        }
    )

    # Process each patient group
    for patient_group in patient_groups:
        patient_key = patient_group["patient_key"]

        for file_info in patient_group["files"]:
            file_path = file_info["path"]

            try:
                # Update progress
                self.update_state(
                    state="PROGRESS",
                    meta={
                        "status": TaskStatus.STARTED.value,
                        "total_files": total_files,
                        "processed_files": processed,
                        "unique_patients": len(unique_patients),
                        "errors": errors,
                        "current_file": file_info["name"]
                    }
                )

                # Process file
                result = ocr_service.process_file(file_path, device, True)

                if result.error:
                    errors += 1
                else:
                    # Track unique patients
                    if result.extracted_info:
                        patient_id = (
                            result.extracted_info.patient_id or
                            f"{result.extracted_info.last_name}_{result.extracted_info.first_name}"
                        )
                        unique_patients.add(patient_id.lower())

                results.append(result.model_dump())
                processed += 1

            except Exception as e:
                errors += 1
                results.append({
                    "file_path": file_path,
                    "error": str(e)
                })
                processed += 1

    # Final state
    return {
        "status": TaskStatus.SUCCESS.value,
        "task_id": task_id,
        "total_files": total_files,
        "processed_files": processed,
        "unique_patients": len(unique_patients),
        "errors": errors,
        "results": results,
        "completed_at": datetime.utcnow().isoformat()
    }


@celery_app.task(bind=True, name="ocr.send_to_medflow")
def send_results_to_medflow(
    self,
    ocr_results: List[Dict],
    auto_link_threshold: float = 0.85
) -> Dict[str, Any]:
    """
    Send OCR results to MedFlow backend for patient matching

    Args:
        ocr_results: List of OCR result dictionaries
        auto_link_threshold: Confidence threshold for auto-linking

    Returns:
        Summary of results sent
    """
    sent = 0
    failed = 0

    for result in ocr_results:
        if result.get("error"):
            continue

        try:
            # Send to MedFlow backend
            with httpx.Client(timeout=30.0) as client:
                response = client.post(
                    f"{settings.MEDFLOW_BACKEND_URL}/api/ocr/results",
                    json={
                        "file_path": result["file_path"],
                        "file_name": result["file_name"],
                        "file_type": result["file_type"],
                        "device_type": result["device_type"],
                        "ocr_text": result.get("ocr_text"),
                        "extracted_info": result.get("extracted_info"),
                        "thumbnail_path": result.get("thumbnail_path"),
                        "auto_link_threshold": auto_link_threshold
                    }
                )

                if response.status_code == 200:
                    sent += 1
                else:
                    failed += 1

        except Exception as e:
            print(f"Error sending result to MedFlow: {e}")
            failed += 1

    return {
        "sent": sent,
        "failed": failed,
        "total": len(ocr_results)
    }
