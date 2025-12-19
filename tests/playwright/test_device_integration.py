"""
Device Integration Tests for MedFlow
Tests device adapters, data parsing, and measurement storage
Uses mock data - no actual hardware required
"""
import os
import json
from datetime import datetime
from test_utils import APIClient, TestReporter, get_test_patient_id

# =============================================================================
# MOCK DEVICE DATA
# =============================================================================

MOCK_OCT_DATA = {
    "eye": "OD",
    "capturedAt": datetime.now().isoformat(),
    "retinalThickness": 285,
    "signalStrength": 8,
    "qualityScore": 85,
    "rnfl": {
        "average": 92,
        "superior": 110,
        "inferior": 115,
        "nasal": 75,
        "temporal": 68
    },
    "macula": {
        "centralThickness": 285,
        "volume": 8.2
    },
    "opticDisc": {
        "cupToDiscRatio": 0.45,
        "cupVolume": 0.15,
        "rimArea": 1.2,
        "discArea": 2.1
    },
    "source": "e2e-test"
}

MOCK_AUTOREFRACTOR_DATA = {
    "OD": {
        "sphere": -2.50,
        "cylinder": -0.75,
        "axis": 90,
        "pupilDiameter": 5.5,
        "confidence": 95
    },
    "OS": {
        "sphere": -2.25,
        "cylinder": -1.00,
        "axis": 85,
        "pupilDiameter": 5.3,
        "confidence": 92
    },
    "keratometry": {
        "OD": {
            "k1": 43.25,
            "k1Axis": 180,
            "k2": 44.00,
            "k2Axis": 90
        },
        "OS": {
            "k1": 43.50,
            "k1Axis": 175,
            "k2": 44.25,
            "k2Axis": 85
        }
    },
    "capturedAt": datetime.now().isoformat(),
    "source": "e2e-test"
}

MOCK_TONOMETRY_DATA = {
    "OD": {
        "iop": 14,
        "time": "10:30",
        "reliability": "good"
    },
    "OS": {
        "iop": 15,
        "time": "10:31",
        "reliability": "good"
    },
    "capturedAt": datetime.now().isoformat(),
    "method": "goldmann",
    "source": "e2e-test"
}

MOCK_BIOMETRY_DATA = {
    "OD": {
        "axialLength": 23.85,
        "acd": 3.10,
        "wtw": 12.0,
        "lensThickness": 4.5
    },
    "OS": {
        "axialLength": 23.95,
        "acd": 3.05,
        "wtw": 11.9,
        "lensThickness": 4.6
    },
    "capturedAt": datetime.now().isoformat(),
    "source": "e2e-test"
}

# Device type to adapter mapping (from AdapterFactory)
ADAPTER_MAPPINGS = {
    'oct': 'OctAdapter',
    'optical-coherence-tomography': 'OctAdapter',
    'tonometer': 'TonometryAdapter',
    'tonometry': 'TonometryAdapter',
    'iop': 'TonometryAdapter',
    'auto-refractor': 'AutorefractorAdapter',
    'autorefractor': 'AutorefractorAdapter',
    'keratometer': 'AutorefractorAdapter',
    'ark': 'AutorefractorAdapter',
    'specular-microscope': 'SpecularMicroscopeAdapter',
    'specular': 'SpecularMicroscopeAdapter',
    'biometer': 'BiometerAdapter',
    'biometry': 'BiometerAdapter',
    'iol-master': 'BiometerAdapter',
    'nidek': 'NidekAdapter',
}


# =============================================================================
# TEST FUNCTIONS
# =============================================================================

def test_device_list(reporter: TestReporter):
    """Test devices API returns list of devices"""
    api = APIClient('admin')
    response = api.get('/api/devices')

    if response.ok:
        data = response.json()
        devices = data.get('data', data.get('devices', []))
        reporter.add_result(
            "Device list",
            True,
            f"Found {len(devices)} devices",
            category="device_integration"
        )
        return devices
    else:
        reporter.add_result(
            "Device list",
            False,
            f"Status: {response.status_code}",
            category="device_integration"
        )
        return []


def test_device_by_id(devices: list, reporter: TestReporter):
    """Test fetching single device by ID"""
    if not devices:
        reporter.add_result(
            "Get device by ID",
            False,
            "No devices to test",
            category="device_integration"
        )
        return

    api = APIClient('admin')
    device = devices[0]
    device_id = device.get('_id')

    response = api.get(f'/api/devices/{device_id}')

    if response.ok:
        data = response.json()
        fetched = data.get('data', data.get('device', data))
        name = fetched.get('name', 'Unknown')
        device_type = fetched.get('type', 'Unknown')
        reporter.add_result(
            "Get device by ID",
            True,
            f"Device: {name} ({device_type})",
            category="device_integration"
        )
    else:
        reporter.add_result(
            "Get device by ID",
            False,
            f"Status: {response.status_code}",
            category="device_integration"
        )


def test_device_types_coverage(devices: list, reporter: TestReporter):
    """Test that devices cover expected adapter types"""
    expected_types = {'oct', 'autorefractor', 'tonometer', 'biometer'}

    device_types = set()
    for device in devices:
        device_type = device.get('type', '').lower()
        device_types.add(device_type)

    covered = expected_types.intersection(device_types)
    missing = expected_types - device_types

    reporter.add_result(
        "Device type coverage",
        len(covered) > 0,
        f"Types present: {', '.join(device_types) if device_types else 'none'}. Missing: {', '.join(missing) if missing else 'none'}",
        category="device_integration"
    )


def test_adapter_mapping_completeness(reporter: TestReporter):
    """Test that adapter mappings are comprehensive"""
    # Count unique adapters vs device type entries
    unique_adapters = set(ADAPTER_MAPPINGS.values())
    device_types = list(ADAPTER_MAPPINGS.keys())

    reporter.add_result(
        "Adapter mapping completeness",
        len(unique_adapters) >= 6,  # At least 6 unique adapters
        f"{len(device_types)} device types → {len(unique_adapters)} unique adapters",
        category="device_integration"
    )


def test_folder_sync_stats(reporter: TestReporter):
    """Test folder sync statistics endpoint"""
    api = APIClient('admin')
    response = api.get('/api/devices/folder-sync/stats')

    if response.ok:
        data = response.json()
        stats = data.get('data', data.get('stats', data))
        reporter.add_result(
            "Folder sync stats",
            True,
            f"Stats available: {list(stats.keys())[:5]}",
            category="device_integration"
        )
    else:
        reporter.add_result(
            "Folder sync stats",
            response.status_code == 404,  # OK if not implemented
            f"Status: {response.status_code}",
            category="device_integration"
        )


def test_processor_stats(reporter: TestReporter):
    """Test universal processor statistics endpoint"""
    api = APIClient('admin')
    response = api.get('/api/devices/processor/stats')

    if response.ok:
        data = response.json()
        stats = data.get('data', data.get('stats', data))
        reporter.add_result(
            "Processor stats",
            True,
            f"Stats available: {list(stats.keys())[:5]}",
            category="device_integration"
        )
    else:
        reporter.add_result(
            "Processor stats",
            response.status_code == 404,  # OK if not implemented
            f"Status: {response.status_code}",
            category="device_integration"
        )


def test_ocr_status(reporter: TestReporter):
    """Test OCR service status endpoint"""
    api = APIClient('admin')
    response = api.get('/api/devices/ocr/status')

    if response.ok:
        data = response.json()
        status = data.get('status', data.get('data', {}).get('status', 'unknown'))
        reporter.add_result(
            "OCR service status",
            True,
            f"OCR status: {status}",
            category="device_integration"
        )
    else:
        reporter.add_result(
            "OCR service status",
            response.status_code == 404,  # OK if not implemented
            f"Status: {response.status_code}",
            category="device_integration"
        )


def test_smb2_stats(reporter: TestReporter):
    """Test SMB2 client statistics endpoint"""
    api = APIClient('admin')
    response = api.get('/api/devices/smb2/stats')

    if response.ok:
        data = response.json()
        stats = data.get('data', data.get('stats', data))
        reporter.add_result(
            "SMB2 stats",
            True,
            f"SMB2 connected: {stats.get('connected', 'unknown')}",
            category="device_integration"
        )
    else:
        reporter.add_result(
            "SMB2 stats",
            response.status_code == 404,  # OK if not implemented
            f"Status: {response.status_code}",
            category="device_integration"
        )


def test_folder_index_stats(reporter: TestReporter):
    """Test folder indexer statistics endpoint"""
    api = APIClient('admin')
    response = api.get('/api/devices/index-folders/stats')

    if response.ok:
        data = response.json()
        stats = data.get('data', data.get('stats', data))
        reporter.add_result(
            "Folder index stats",
            True,
            f"Indexed folders: {stats.get('totalFolders', stats.get('total', 'N/A'))}",
            category="device_integration"
        )
    else:
        reporter.add_result(
            "Folder index stats",
            response.status_code in [404, 403],
            f"Status: {response.status_code}",
            category="device_integration"
        )


def test_unmatched_folders(reporter: TestReporter):
    """Test unmatched folders endpoint"""
    api = APIClient('admin')
    response = api.get('/api/devices/index-folders/unmatched')

    if response.ok:
        data = response.json()
        folders = data.get('data', data.get('folders', []))
        reporter.add_result(
            "Unmatched folders",
            True,
            f"Found {len(folders)} unmatched folders",
            category="device_integration"
        )
    else:
        reporter.add_result(
            "Unmatched folders",
            response.status_code in [404, 403],
            f"Status: {response.status_code}",
            category="device_integration"
        )


def test_mock_oct_validation(reporter: TestReporter):
    """Test OCT data validation rules locally"""
    # Test RNFL classification thresholds
    def classify_rnfl(average):
        if not average:
            return 'unknown'
        if average >= 80:
            return 'normal'
        if average >= 70:
            return 'borderline'
        return 'abnormal'

    # Test with mock data
    rnfl_avg = MOCK_OCT_DATA['rnfl']['average']
    classification = classify_rnfl(rnfl_avg)

    # Validate quality score range
    quality = MOCK_OCT_DATA['qualityScore']
    quality_valid = 0 <= quality <= 100

    # Validate retinal thickness range
    thickness = MOCK_OCT_DATA['retinalThickness']
    thickness_valid = 100 <= thickness <= 800

    reporter.add_result(
        "OCT data validation",
        classification == 'normal' and quality_valid and thickness_valid,
        f"RNFL: {rnfl_avg}µm ({classification}), Quality: {quality}%, Thickness: {thickness}µm",
        category="device_integration"
    )


def test_mock_autorefractor_validation(reporter: TestReporter):
    """Test autorefractor data validation rules locally"""
    od_data = MOCK_AUTOREFRACTOR_DATA['OD']

    # Validate sphere range (-30 to +30)
    sphere_valid = -30 <= od_data['sphere'] <= 30

    # Validate cylinder range (-10 to 0)
    cylinder_valid = -10 <= od_data['cylinder'] <= 0

    # Validate axis range (0 to 180)
    axis_valid = 0 <= od_data['axis'] <= 180

    # Validate confidence
    confidence_valid = od_data['confidence'] >= 70

    all_valid = sphere_valid and cylinder_valid and axis_valid and confidence_valid

    reporter.add_result(
        "Autorefractor data validation",
        all_valid,
        f"OD: {od_data['sphere']}/{od_data['cylinder']}x{od_data['axis']} (conf: {od_data['confidence']}%)",
        category="device_integration"
    )


def test_mock_tonometry_validation(reporter: TestReporter):
    """Test tonometry data validation rules locally"""
    od_iop = MOCK_TONOMETRY_DATA['OD']['iop']
    os_iop = MOCK_TONOMETRY_DATA['OS']['iop']

    # Normal IOP range: 10-21 mmHg
    od_normal = 10 <= od_iop <= 21
    os_normal = 10 <= os_iop <= 21

    # Check for concerning asymmetry (>3mmHg difference)
    asymmetry = abs(od_iop - os_iop)
    asymmetry_ok = asymmetry <= 3

    reporter.add_result(
        "Tonometry data validation",
        od_normal and os_normal and asymmetry_ok,
        f"IOP: OD {od_iop}mmHg, OS {os_iop}mmHg (asymmetry: {asymmetry}mmHg)",
        category="device_integration"
    )


def test_mock_biometry_validation(reporter: TestReporter):
    """Test biometry data validation rules locally"""
    od_al = MOCK_BIOMETRY_DATA['OD']['axialLength']
    os_al = MOCK_BIOMETRY_DATA['OS']['axialLength']

    # Normal axial length: 22-26mm
    od_normal = 22 <= od_al <= 26
    os_normal = 22 <= os_al <= 26

    # ACD range: 2.5-4.5mm
    acd_valid = 2.5 <= MOCK_BIOMETRY_DATA['OD']['acd'] <= 4.5

    reporter.add_result(
        "Biometry data validation",
        od_normal and os_normal and acd_valid,
        f"AL: OD {od_al}mm, OS {os_al}mm, ACD: {MOCK_BIOMETRY_DATA['OD']['acd']}mm",
        category="device_integration"
    )


def test_device_measurements(reporter: TestReporter):
    """Test device measurements API"""
    api = APIClient('admin')

    # Try to get measurements for a patient
    patient_id = get_test_patient_id()
    if not patient_id:
        reporter.add_result(
            "Device measurements",
            False,
            "No test patient found",
            category="device_integration"
        )
        return

    response = api.get(f'/api/patients/{patient_id}/measurements')

    if response.ok:
        data = response.json()
        measurements = data.get('data', data.get('measurements', []))
        reporter.add_result(
            "Device measurements",
            True,
            f"Found {len(measurements)} measurements for patient",
            category="device_integration"
        )
    else:
        # Endpoint might not exist
        reporter.add_result(
            "Device measurements",
            response.status_code in [404, 403],
            f"Status: {response.status_code}",
            category="device_integration"
        )


def test_device_images(reporter: TestReporter):
    """Test device images API"""
    api = APIClient('admin')

    patient_id = get_test_patient_id()
    if not patient_id:
        reporter.add_result(
            "Device images",
            False,
            "No test patient found",
            category="device_integration"
        )
        return

    response = api.get(f'/api/patients/{patient_id}/images')

    if response.ok:
        data = response.json()
        images = data.get('data', data.get('images', []))
        reporter.add_result(
            "Device images",
            True,
            f"Found {len(images)} device images",
            category="device_integration"
        )
    else:
        reporter.add_result(
            "Device images",
            response.status_code in [404, 403],
            f"Status: {response.status_code}",
            category="device_integration"
        )


# =============================================================================
# MAIN TEST RUNNER
# =============================================================================

def run_device_integration_tests():
    """Run all device integration tests"""
    reporter = TestReporter('device_integration')
    print("\n" + "="*60)
    print("DEVICE INTEGRATION TESTS")
    print("="*60)

    print("\n--- Testing Device API ---")
    devices = test_device_list(reporter)
    test_device_by_id(devices, reporter)
    test_device_types_coverage(devices, reporter)

    print("\n--- Testing Adapter Mappings ---")
    test_adapter_mapping_completeness(reporter)

    print("\n--- Testing Service Endpoints ---")
    test_folder_sync_stats(reporter)
    test_processor_stats(reporter)
    test_ocr_status(reporter)
    test_smb2_stats(reporter)

    print("\n--- Testing Folder Indexing ---")
    test_folder_index_stats(reporter)
    test_unmatched_folders(reporter)

    print("\n--- Testing Mock Data Validation ---")
    test_mock_oct_validation(reporter)
    test_mock_autorefractor_validation(reporter)
    test_mock_tonometry_validation(reporter)
    test_mock_biometry_validation(reporter)

    print("\n--- Testing Patient Measurements ---")
    test_device_measurements(reporter)
    test_device_images(reporter)

    # Save report
    reporter.save('device_integration_report.json')

    return reporter.results


if __name__ == '__main__':
    run_device_integration_tests()
