"""
OCR Service - Handles image and document text extraction
Uses PaddleOCR for images, PyMuPDF for PDFs, pydicom for DICOM
"""
import os
import re
import time
from typing import Optional, Tuple, List, Dict, Any
from datetime import datetime
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from paddleocr import PaddleOCR
import fitz  # PyMuPDF
import pydicom

from app.config import settings
from app.models.schemas import (
    ExtractedPatientInfo,
    OCRResult,
    FileType,
    DeviceType,
    MatchConfidence
)


class OCRService:
    """Service for extracting text and metadata from medical imaging files"""

    def __init__(self):
        self._ocr = None
        self._initialized = False

    def _get_ocr(self) -> PaddleOCR:
        """Lazy initialization of PaddleOCR"""
        if self._ocr is None:
            self._ocr = PaddleOCR(
                use_angle_cls=True,
                lang=settings.OCR_LANG,
                use_gpu=settings.OCR_USE_GPU,
                show_log=False
            )
            self._initialized = True
        return self._ocr

    @property
    def is_ready(self) -> bool:
        """Check if OCR engine is initialized"""
        return self._initialized

    def process_file(
        self,
        file_path: str,
        device_type: DeviceType = DeviceType.GENERIC,
        extract_thumbnail: bool = True
    ) -> OCRResult:
        """
        Process a single file and extract text/metadata

        Args:
            file_path: Full path to the file
            device_type: Source device type for pattern matching
            extract_thumbnail: Whether to generate thumbnail

        Returns:
            OCRResult with extracted data
        """
        start_time = time.time()
        file_path = Path(file_path)

        if not file_path.exists():
            return OCRResult(
                file_path=str(file_path),
                file_name=file_path.name,
                file_type=FileType.IMAGE,
                file_size=0,
                device_type=device_type,
                error=f"File not found: {file_path}"
            )

        # Determine file type
        ext = file_path.suffix.lower()
        file_size = file_path.stat().st_size

        if ext in settings.SUPPORTED_DICOM_TYPES:
            file_type = FileType.DICOM
            ocr_text, confidence, extracted_info = self._process_dicom(file_path)
        elif ext in settings.SUPPORTED_PDF_TYPES:
            file_type = FileType.PDF
            ocr_text, confidence, extracted_info = self._process_pdf(file_path)
        elif ext in settings.SUPPORTED_IMAGE_TYPES:
            file_type = FileType.IMAGE
            ocr_text, confidence, extracted_info = self._process_image(file_path)
        else:
            return OCRResult(
                file_path=str(file_path),
                file_name=file_path.name,
                file_type=FileType.IMAGE,
                file_size=file_size,
                device_type=device_type,
                error=f"Unsupported file type: {ext}"
            )

        # Try to extract info from filename if OCR didn't get much
        filename_info = self._parse_filename(file_path.name, device_type)
        if filename_info:
            extracted_info = self._merge_extracted_info(extracted_info, filename_info)

        # Generate thumbnail if requested
        thumbnail_path = None
        if extract_thumbnail and file_type != FileType.DICOM:
            thumbnail_path = self._generate_thumbnail(file_path, "medium")

        processing_time = int((time.time() - start_time) * 1000)

        return OCRResult(
            file_path=str(file_path),
            file_name=file_path.name,
            file_type=file_type,
            file_size=file_size,
            device_type=device_type,
            ocr_text=ocr_text,
            ocr_confidence=confidence,
            extracted_info=extracted_info,
            thumbnail_path=thumbnail_path,
            processing_time_ms=processing_time
        )

    def _process_image(self, file_path: Path) -> Tuple[str, float, Optional[ExtractedPatientInfo]]:
        """Process image file with PaddleOCR"""
        try:
            ocr = self._get_ocr()
            result = ocr.ocr(str(file_path), cls=True)

            if not result or not result[0]:
                return "", 0.0, None

            # Extract text and confidence
            texts = []
            confidences = []
            for line in result[0]:
                if line and len(line) >= 2:
                    text = line[1][0]
                    conf = line[1][1]
                    texts.append(text)
                    confidences.append(conf)

            full_text = "\n".join(texts)
            avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0

            # Extract patient info from OCR text
            extracted_info = self._extract_patient_info_from_text(full_text)

            return full_text, avg_confidence, extracted_info

        except Exception as e:
            print(f"Error processing image {file_path}: {e}")
            return "", 0.0, None

    def _process_pdf(self, file_path: Path) -> Tuple[str, float, Optional[ExtractedPatientInfo]]:
        """Process PDF file - extract embedded text or OCR images"""
        try:
            doc = fitz.open(file_path)
            all_text = []

            for page in doc:
                # Try to extract embedded text first (fast)
                text = page.get_text()
                if text.strip():
                    all_text.append(text)
                else:
                    # No embedded text, render page and OCR
                    pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
                    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                    img_np = np.array(img)

                    ocr = self._get_ocr()
                    result = ocr.ocr(img_np, cls=True)

                    if result and result[0]:
                        for line in result[0]:
                            if line and len(line) >= 2:
                                all_text.append(line[1][0])

            doc.close()

            full_text = "\n".join(all_text)
            extracted_info = self._extract_patient_info_from_text(full_text)

            # Confidence is 1.0 for embedded text, 0.8 for OCR
            confidence = 1.0 if any(page.get_text().strip() for page in fitz.open(file_path)) else 0.8

            return full_text, confidence, extracted_info

        except Exception as e:
            print(f"Error processing PDF {file_path}: {e}")
            return "", 0.0, None

    def _process_dicom(self, file_path: Path) -> Tuple[str, float, Optional[ExtractedPatientInfo]]:
        """Process DICOM file - extract metadata only (fast)"""
        try:
            # Read only headers, not pixel data
            ds = pydicom.dcmread(file_path, stop_before_pixels=True)

            # Extract patient information from DICOM tags
            extracted_info = ExtractedPatientInfo(
                first_name=self._get_dicom_value(ds, "PatientName", "first"),
                last_name=self._get_dicom_value(ds, "PatientName", "last"),
                patient_id=self._get_dicom_value(ds, "PatientID"),
                date_of_birth=self._parse_dicom_date(self._get_dicom_value(ds, "PatientBirthDate")),
                gender=self._get_dicom_value(ds, "PatientSex"),
                exam_date=self._parse_dicom_date(self._get_dicom_value(ds, "StudyDate")),
                exam_type=self._get_dicom_value(ds, "Modality"),
                laterality=self._get_dicom_value(ds, "Laterality"),
                source="dicom"
            )

            # Build text representation of metadata
            metadata_text = f"""
Patient: {extracted_info.last_name} {extracted_info.first_name}
ID: {extracted_info.patient_id}
DOB: {extracted_info.date_of_birth}
Study Date: {extracted_info.exam_date}
Modality: {extracted_info.exam_type}
Laterality: {extracted_info.laterality}
""".strip()

            return metadata_text, 1.0, extracted_info

        except Exception as e:
            print(f"Error processing DICOM {file_path}: {e}")
            return "", 0.0, None

    def _get_dicom_value(self, ds, tag: str, part: str = None) -> Optional[str]:
        """Safely get DICOM tag value"""
        try:
            value = getattr(ds, tag, None)
            if value is None:
                return None

            if tag == "PatientName":
                name = str(value)
                parts = name.split("^")
                if part == "last" and len(parts) > 0:
                    return parts[0]
                elif part == "first" and len(parts) > 1:
                    return parts[1]
                return name

            return str(value)
        except:
            return None

    def _parse_dicom_date(self, date_str: Optional[str]) -> Optional[datetime]:
        """Parse DICOM date format (YYYYMMDD)"""
        if not date_str or len(date_str) < 8:
            return None
        try:
            return datetime.strptime(date_str[:8], "%Y%m%d")
        except:
            return None

    def _extract_patient_info_from_text(self, text: str) -> Optional[ExtractedPatientInfo]:
        """Extract patient information from OCR text using regex patterns"""
        if not text:
            return None

        info = ExtractedPatientInfo(source="ocr", raw_text=text[:500])

        # Pattern for names (French format: NOM Prénom)
        name_patterns = [
            r"(?:Patient|Nom|Name)[:\s]+([A-ZÉÈÊËÀÂÄÔÖÛÜÇ][a-zéèêëàâäôöûüç]+)\s+([A-ZÉÈÊËÀÂÄÔÖÛÜÇ][a-zéèêëàâäôöûüç]+)",
            r"([A-Z][A-Z]+)\s+([A-Z][a-z]+)",  # LASTNAME Firstname
        ]

        for pattern in name_patterns:
            match = re.search(pattern, text)
            if match:
                info.last_name = match.group(1)
                info.first_name = match.group(2)
                break

        # Pattern for patient ID
        id_patterns = [
            r"(?:ID|N°|Numéro)[:\s]*([A-Z0-9]{5,15})",
            r"(?:Patient\s*ID)[:\s]*([A-Z0-9]+)",
        ]

        for pattern in id_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                info.patient_id = match.group(1)
                break

        # Pattern for dates (DD/MM/YYYY or YYYY-MM-DD)
        date_patterns = [
            (r"(\d{2})/(\d{2})/(\d{4})", "%d/%m/%Y"),
            (r"(\d{4})-(\d{2})-(\d{2})", "%Y-%m-%d"),
            (r"(\d{2})\.(\d{2})\.(\d{4})", "%d.%m.%Y"),
        ]

        for pattern, fmt in date_patterns:
            match = re.search(pattern, text)
            if match:
                try:
                    date_str = match.group(0)
                    info.date_of_birth = datetime.strptime(date_str, fmt)
                    break
                except:
                    pass

        # Pattern for laterality (OD/OS/OU)
        lat_match = re.search(r"\b(OD|OS|OU|O\.D\.|O\.S\.|O\.U\.)\b", text, re.IGNORECASE)
        if lat_match:
            lat = lat_match.group(1).replace(".", "").upper()
            info.laterality = lat

        return info if (info.first_name or info.last_name or info.patient_id) else None

    def _parse_filename(self, filename: str, device_type: DeviceType) -> Optional[ExtractedPatientInfo]:
        """Parse patient info from filename based on device-specific patterns"""
        info = ExtractedPatientInfo(source="filename")

        # Remove extension
        name_part = Path(filename).stem

        if device_type == DeviceType.ZEISS:
            # ZEISS format: LastName_FirstName_PatientID_DOB_Gender_Type_DateTime_Eye
            parts = name_part.split("_")
            if len(parts) >= 4:
                info.last_name = parts[0]
                info.first_name = parts[1]
                info.patient_id = parts[2]
                if len(parts[3]) == 8:
                    try:
                        info.date_of_birth = datetime.strptime(parts[3], "%Y%m%d")
                    except:
                        pass
                # Find laterality
                for part in parts:
                    if part.upper() in ["OD", "OS", "OU"]:
                        info.laterality = part.upper()
                        break

        elif device_type == DeviceType.SOLIX:
            # Solix format: Often in folder structure or PatientName_ExamType_Date
            parts = name_part.replace("-", "_").split("_")
            if len(parts) >= 2:
                # Try to parse as Name parts
                if not parts[0].isdigit():
                    info.last_name = parts[0]
                    if len(parts) > 1 and not parts[1].isdigit():
                        info.first_name = parts[1]

        elif device_type == DeviceType.TOMEY:
            # TOMEY format varies
            parts = name_part.split("_")
            if len(parts) >= 2:
                info.last_name = parts[0]
                info.first_name = parts[1] if len(parts) > 1 else None

        else:
            # Generic pattern
            parts = re.split(r"[_\-\s]+", name_part)
            if len(parts) >= 2:
                # Check if first part looks like a name
                if parts[0].isalpha():
                    info.last_name = parts[0]
                    info.first_name = parts[1] if parts[1].isalpha() else None

        # Try to extract laterality from any filename
        lat_match = re.search(r"[_\-\s](OD|OS|OU)[_\-\s\.]", name_part, re.IGNORECASE)
        if lat_match:
            info.laterality = lat_match.group(1).upper()

        return info if (info.first_name or info.last_name or info.patient_id) else None

    def _merge_extracted_info(
        self,
        primary: Optional[ExtractedPatientInfo],
        secondary: Optional[ExtractedPatientInfo]
    ) -> Optional[ExtractedPatientInfo]:
        """Merge two ExtractedPatientInfo, preferring primary values"""
        if not primary and not secondary:
            return None
        if not primary:
            return secondary
        if not secondary:
            return primary

        # Merge, preferring primary
        return ExtractedPatientInfo(
            first_name=primary.first_name or secondary.first_name,
            last_name=primary.last_name or secondary.last_name,
            patient_id=primary.patient_id or secondary.patient_id,
            date_of_birth=primary.date_of_birth or secondary.date_of_birth,
            gender=primary.gender or secondary.gender,
            laterality=primary.laterality or secondary.laterality,
            exam_date=primary.exam_date or secondary.exam_date,
            exam_type=primary.exam_type or secondary.exam_type,
            raw_text=primary.raw_text,
            source=f"{primary.source}+{secondary.source}"
        )

    def _generate_thumbnail(self, file_path: Path, size: str = "medium") -> Optional[str]:
        """Generate thumbnail for image/PDF file"""
        try:
            target_size = settings.THUMBNAIL_SIZES.get(size, 720)

            # Create cache directory
            cache_dir = Path(settings.THUMBNAIL_CACHE_DIR)
            cache_dir.mkdir(parents=True, exist_ok=True)

            # Generate unique thumbnail filename
            file_hash = str(hash(str(file_path)))[-10:]
            thumb_name = f"{file_hash}_{size}.jpg"
            thumb_path = cache_dir / thumb_name

            if thumb_path.exists():
                return str(thumb_path)

            # Load image
            ext = file_path.suffix.lower()
            if ext in settings.SUPPORTED_PDF_TYPES:
                # Render first page of PDF
                doc = fitz.open(file_path)
                page = doc[0]
                pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
                img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                doc.close()
            else:
                img = Image.open(file_path)
                if img.mode != "RGB":
                    img = img.convert("RGB")

            # Resize maintaining aspect ratio
            img.thumbnail((target_size, target_size), Image.Resampling.LANCZOS)

            # Save thumbnail
            img.save(thumb_path, "JPEG", quality=85)

            return str(thumb_path)

        except Exception as e:
            print(f"Error generating thumbnail for {file_path}: {e}")
            return None


# Singleton instance
ocr_service = OCRService()
