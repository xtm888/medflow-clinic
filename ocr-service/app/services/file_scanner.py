"""
File Scanner Service - Scans network shares for medical imaging files
"""
import os
from pathlib import Path
from typing import List, Dict, Generator, Optional
from datetime import datetime
from collections import defaultdict

from app.config import settings
from app.models.schemas import DeviceType, FolderScanResult


class FileScanner:
    """Service for scanning network shares and discovering medical imaging files"""

    def __init__(self):
        self.supported_extensions = (
            settings.SUPPORTED_IMAGE_TYPES +
            settings.SUPPORTED_PDF_TYPES +
            settings.SUPPORTED_DICOM_TYPES
        )

    def check_network_shares(self) -> Dict[str, bool]:
        """Check which network shares are currently accessible"""
        status = {}
        for name, path in settings.NETWORK_SHARES.items():
            status[name] = os.path.exists(path) and os.path.isdir(path)
        return status

    def scan_folder(
        self,
        folder_path: str,
        max_files: int = 1000,
        extensions: Optional[List[str]] = None,
        recursive: bool = True
    ) -> FolderScanResult:
        """
        Scan a folder and return statistics about files found

        Args:
            folder_path: Path to scan
            max_files: Maximum files to enumerate
            extensions: Filter by specific extensions
            recursive: Whether to scan subfolders

        Returns:
            FolderScanResult with file statistics
        """
        folder_path = Path(folder_path)

        if not folder_path.exists():
            return FolderScanResult(
                folder_path=str(folder_path),
                total_files=0,
                files_by_type={},
                estimated_patients=0,
                sample_files=[]
            )

        allowed_ext = extensions or self.supported_extensions

        files_by_type = defaultdict(int)
        sample_files = []
        patient_folders = set()
        total_files = 0

        for file_path in self._iterate_files(folder_path, recursive):
            ext = file_path.suffix.lower()

            if ext not in allowed_ext:
                continue

            total_files += 1
            files_by_type[ext] += 1

            # Track sample files (first 10)
            if len(sample_files) < 10:
                sample_files.append(str(file_path))

            # Estimate unique patients by parent folder name
            patient_folders.add(file_path.parent.name)

            if total_files >= max_files:
                break

        return FolderScanResult(
            folder_path=str(folder_path),
            total_files=total_files,
            files_by_type=dict(files_by_type),
            estimated_patients=len(patient_folders),
            sample_files=sample_files
        )

    def get_files_for_import(
        self,
        folder_path: str,
        device_type: DeviceType,
        max_patients: int = 20,
        max_files_per_patient: int = 10,
        extensions: Optional[List[str]] = None,
        recursive: bool = True
    ) -> List[Dict]:
        """
        Get files organized by patient for import

        Strategy: Select most recent patients based on file modification time

        Args:
            folder_path: Path to scan
            device_type: Device type for filename parsing
            max_patients: Target number of patients
            max_files_per_patient: Max files per patient
            extensions: Filter by extensions
            recursive: Scan subfolders

        Returns:
            List of patient file groups
        """
        folder_path = Path(folder_path)
        allowed_ext = extensions or self.supported_extensions

        # Group files by patient identifier (folder name or parsed name)
        patient_files = defaultdict(list)

        for file_path in self._iterate_files(folder_path, recursive):
            ext = file_path.suffix.lower()
            if ext not in allowed_ext:
                continue

            # Use parent folder as patient identifier
            patient_key = self._extract_patient_key(file_path, device_type)

            # Store with modification time for sorting
            mtime = file_path.stat().st_mtime
            patient_files[patient_key].append({
                "path": str(file_path),
                "name": file_path.name,
                "ext": ext,
                "mtime": mtime,
                "size": file_path.stat().st_size
            })

        # Sort patients by most recent file
        patients_sorted = sorted(
            patient_files.items(),
            key=lambda x: max(f["mtime"] for f in x[1]),
            reverse=True
        )

        # Select top N patients
        result = []
        for patient_key, files in patients_sorted[:max_patients]:
            # Sort files by modification time (newest first)
            files_sorted = sorted(files, key=lambda x: x["mtime"], reverse=True)

            result.append({
                "patient_key": patient_key,
                "files": files_sorted[:max_files_per_patient],
                "total_files": len(files),
                "latest_file_date": datetime.fromtimestamp(files_sorted[0]["mtime"])
            })

        return result

    def _iterate_files(self, folder_path: Path, recursive: bool) -> Generator[Path, None, None]:
        """Iterate through files in folder"""
        try:
            if recursive:
                for root, dirs, files in os.walk(folder_path):
                    # Skip hidden directories
                    dirs[:] = [d for d in dirs if not d.startswith(".")]

                    for file in files:
                        if not file.startswith("."):
                            yield Path(root) / file
            else:
                for item in folder_path.iterdir():
                    if item.is_file() and not item.name.startswith("."):
                        yield item
        except PermissionError:
            pass

    def _extract_patient_key(self, file_path: Path, device_type: DeviceType) -> str:
        """
        Extract patient identifier from file path

        Uses folder structure and filename patterns based on device type
        """
        # Default: use parent folder name
        patient_key = file_path.parent.name

        if device_type == DeviceType.ZEISS:
            # ZEISS: LastName_FirstName_ID_... in filename
            parts = file_path.stem.split("_")
            if len(parts) >= 3:
                patient_key = f"{parts[0]}_{parts[1]}_{parts[2]}"

        elif device_type == DeviceType.SOLIX:
            # Solix: Often has patient name in folder
            patient_key = file_path.parent.name

        elif device_type == DeviceType.TOMEY:
            # TOMEY: Patient folder structure
            patient_key = file_path.parent.name

        return patient_key.lower().strip()


# Singleton instance
file_scanner = FileScanner()
