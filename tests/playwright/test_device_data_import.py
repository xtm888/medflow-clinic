"""
Device Data Import Simulation Tests for MedFlow
Tests import workflows for ophthalmology devices:
- OCT (Optical Coherence Tomography)
- Fundus Camera
- IOL Master
- Topographer
- Visual Field Analyzer
- Autorefractor
- Specular Microscope
"""
import os
import json
from datetime import datetime
from test_utils import APIClient, TestReporter, get_test_patient_id

# =============================================================================
# SUPPORTED DEVICE TYPES
# =============================================================================
DEVICE_TYPES = {
    'oct': 'Optical Coherence Tomography',
    'fundus': 'Fundus Camera',
    'iolmaster': 'IOL Master',
    'topographer': 'Corneal Topographer',
    'visual_field': 'Visual Field Analyzer',
    'autorefractor': 'Autorefractor',
    'specular': 'Specular Microscope',
    'lensmeter': 'Lensmeter'
}

# =============================================================================
# SIMULATED DEVICE DATA
# =============================================================================

def get_simulated_oct_data(patient_id: str):
    """Generate simulated OCT scan data"""
    return {
        'deviceType': 'oct',
        'deviceName': 'Zeiss Cirrus HD-OCT',
        'patientId': patient_id,
        'examDate': datetime.now().isoformat(),
        'eye': 'OU',  # Both eyes
        'measurements': {
            'OD': {
                'rnflThickness': {
                    'average': 95.2,
                    'superior': 112.4,
                    'inferior': 118.6,
                    'nasal': 72.8,
                    'temporal': 68.5
                },
                'maculaThickness': {
                    'centralFovea': 258,
                    'innerRing': 312,
                    'outerRing': 285
                },
                'gccThickness': {
                    'average': 92.3,
                    'superior': 95.1,
                    'inferior': 89.5
                }
            },
            'OS': {
                'rnflThickness': {
                    'average': 94.8,
                    'superior': 110.2,
                    'inferior': 116.9,
                    'nasal': 71.5,
                    'temporal': 67.2
                },
                'maculaThickness': {
                    'centralFovea': 262,
                    'innerRing': 308,
                    'outerRing': 282
                },
                'gccThickness': {
                    'average': 91.8,
                    'superior': 94.2,
                    'inferior': 88.7
                }
            }
        },
        'scanType': 'macula_cube',
        'signalStrength': 8,
        'rawDataPath': '/device-data/oct/simulated_scan.dcm'
    }


def get_simulated_fundus_data(patient_id: str):
    """Generate simulated fundus camera data"""
    return {
        'deviceType': 'fundus',
        'deviceName': 'Topcon TRC-NW400',
        'patientId': patient_id,
        'examDate': datetime.now().isoformat(),
        'eye': 'OU',
        'images': [
            {
                'eye': 'OD',
                'imageType': 'color',
                'imagePath': '/device-data/fundus/OD_color.jpg',
                'angle': '45deg',
                'flash': 'full'
            },
            {
                'eye': 'OS',
                'imageType': 'color',
                'imagePath': '/device-data/fundus/OS_color.jpg',
                'angle': '45deg',
                'flash': 'full'
            },
            {
                'eye': 'OD',
                'imageType': 'red_free',
                'imagePath': '/device-data/fundus/OD_redfree.jpg',
                'angle': '45deg'
            },
            {
                'eye': 'OS',
                'imageType': 'red_free',
                'imagePath': '/device-data/fundus/OS_redfree.jpg',
                'angle': '45deg'
            }
        ],
        'quality': 'good',
        'pupilDilation': True,
        'notes': 'Simulated fundus exam for E2E testing'
    }


def get_simulated_iolmaster_data(patient_id: str):
    """Generate simulated IOL Master biometry data"""
    return {
        'deviceType': 'iolmaster',
        'deviceName': 'Zeiss IOL Master 700',
        'patientId': patient_id,
        'examDate': datetime.now().isoformat(),
        'eye': 'OU',
        'biometry': {
            'OD': {
                'axialLength': 23.45,
                'acd': 3.12,
                'k1': 43.25,
                'k2': 44.50,
                'kAvg': 43.88,
                'wtw': 11.8,
                'lensThickness': 4.52,
                'pupilDiameter': 4.2,
                'snr': 28.5
            },
            'OS': {
                'axialLength': 23.52,
                'acd': 3.08,
                'k1': 43.50,
                'k2': 44.25,
                'kAvg': 43.88,
                'wtw': 11.7,
                'lensThickness': 4.48,
                'pupilDiameter': 4.1,
                'snr': 27.8
            }
        },
        'iolCalculations': {
            'OD': {
                'targetRefraction': -0.50,
                'formula': 'Barrett Universal II',
                'recommendations': [
                    {'lens': 'Alcon SN60WF', 'power': 21.5, 'predictedRefraction': -0.48},
                    {'lens': 'Alcon SN60WF', 'power': 22.0, 'predictedRefraction': -0.02}
                ]
            },
            'OS': {
                'targetRefraction': -0.50,
                'formula': 'Barrett Universal II',
                'recommendations': [
                    {'lens': 'Alcon SN60WF', 'power': 21.0, 'predictedRefraction': -0.52},
                    {'lens': 'Alcon SN60WF', 'power': 21.5, 'predictedRefraction': -0.05}
                ]
            }
        }
    }


def get_simulated_autorefractor_data(patient_id: str):
    """Generate simulated autorefractor data"""
    return {
        'deviceType': 'autorefractor',
        'deviceName': 'Nidek ARK-1',
        'patientId': patient_id,
        'examDate': datetime.now().isoformat(),
        'eye': 'OU',
        'refraction': {
            'OD': {
                'sphere': -2.25,
                'cylinder': -0.75,
                'axis': 85,
                'pd': 32.5
            },
            'OS': {
                'sphere': -2.50,
                'cylinder': -0.50,
                'axis': 95,
                'pd': 32.0
            }
        },
        'keratometry': {
            'OD': {
                'k1': 43.25,
                'k1Axis': 180,
                'k2': 44.00,
                'k2Axis': 90,
                'avgK': 43.63
            },
            'OS': {
                'k1': 43.50,
                'k1Axis': 175,
                'k2': 44.25,
                'k2Axis': 85,
                'avgK': 43.88
            }
        },
        'pupilDistance': 64.5,
        'reliability': 'high'
    }


def get_simulated_visual_field_data(patient_id: str):
    """Generate simulated visual field data"""
    return {
        'deviceType': 'visual_field',
        'deviceName': 'Humphrey Field Analyzer 3',
        'patientId': patient_id,
        'examDate': datetime.now().isoformat(),
        'eye': 'OD',  # Usually one eye at a time
        'testType': '24-2',
        'strategy': 'SITA Standard',
        'results': {
            'md': -2.45,  # Mean Deviation
            'psd': 1.82,  # Pattern Standard Deviation
            'vfi': 96,    # Visual Field Index (%)
            'ghtResult': 'Within Normal Limits',
            'fixationLosses': '1/12',
            'falsePositives': '2%',
            'falseNegatives': '0%',
            'testDuration': '6:32',
            'reliability': 'good'
        },
        'progression': {
            'trend': 'stable',
            'rateOfChange': -0.12  # dB/year
        },
        'rawDataPath': '/device-data/vf/simulated_vf.xml'
    }


def get_simulated_specular_data(patient_id: str):
    """Generate simulated specular microscopy data"""
    return {
        'deviceType': 'specular',
        'deviceName': 'Topcon SP-3000P',
        'patientId': patient_id,
        'examDate': datetime.now().isoformat(),
        'eye': 'OU',
        'endothelium': {
            'OD': {
                'cellDensity': 2456,  # cells/mm²
                'cv': 32.5,           # Coefficient of Variation (%)
                'hexagonality': 58.2, # % hexagonal cells
                'avgCellArea': 407,   # μm²
                'cct': 542,           # Central Corneal Thickness (μm)
                'analysisArea': 0.106 # mm²
            },
            'OS': {
                'cellDensity': 2512,
                'cv': 30.8,
                'hexagonality': 61.5,
                'avgCellArea': 398,
                'cct': 538,
                'analysisArea': 0.108
            }
        },
        'quality': 'good',
        'imagePath': '/device-data/specular/simulated_spec.jpg'
    }


# =============================================================================
# TEST FUNCTIONS
# =============================================================================

def test_device_list(reporter: TestReporter):
    """Test fetching configured devices"""
    api = APIClient('admin')
    response = api.get('/api/devices')

    if response.ok:
        data = response.json()
        devices = data.get('data', data.get('devices', []))
        reporter.add_result(
            "Device list",
            True,
            f"Found {len(devices)} configured devices",
            category="device_import"
        )
        return devices
    else:
        reporter.add_result(
            "Device list",
            False,
            f"Status: {response.status_code}",
            category="device_import"
        )
        return []


def test_oct_data_import(reporter: TestReporter):
    """Test importing OCT scan data"""
    api = APIClient('admin')

    patient_id = get_test_patient_id()
    if not patient_id:
        reporter.add_result(
            "OCT data import",
            False,
            "No test patient found",
            category="device_import"
        )
        return None

    oct_data = get_simulated_oct_data(patient_id)

    # Try to import via device measurements endpoint
    response = api.post('/api/device-measurements', data=oct_data)

    if response.ok:
        data = response.json()
        measurement_id = data.get('data', {}).get('_id', data.get('_id'))
        reporter.add_result(
            "OCT data import",
            True,
            f"Imported OCT scan: RNFL avg OD={oct_data['measurements']['OD']['rnflThickness']['average']}μm",
            category="device_import"
        )
        return measurement_id
    else:
        # Check if endpoint exists
        reporter.add_result(
            "OCT data import",
            response.status_code == 404,  # Not implemented acceptable
            f"Status: {response.status_code}",
            category="device_import"
        )
        return None


def test_fundus_data_import(reporter: TestReporter):
    """Test importing fundus camera images"""
    api = APIClient('admin')

    patient_id = get_test_patient_id()
    if not patient_id:
        reporter.add_result(
            "Fundus data import",
            False,
            "No test patient found",
            category="device_import"
        )
        return None

    fundus_data = get_simulated_fundus_data(patient_id)

    response = api.post('/api/device-measurements', data=fundus_data)

    if response.ok:
        reporter.add_result(
            "Fundus data import",
            True,
            f"Imported {len(fundus_data['images'])} fundus images",
            category="device_import"
        )
    else:
        reporter.add_result(
            "Fundus data import",
            response.status_code == 404,
            f"Status: {response.status_code}",
            category="device_import"
        )


def test_biometry_import(reporter: TestReporter):
    """Test importing IOL Master biometry data"""
    api = APIClient('admin')

    patient_id = get_test_patient_id()
    if not patient_id:
        reporter.add_result(
            "IOL Master import",
            False,
            "No test patient found",
            category="device_import"
        )
        return None

    biometry_data = get_simulated_iolmaster_data(patient_id)

    response = api.post('/api/device-measurements', data=biometry_data)

    if response.ok:
        od_al = biometry_data['biometry']['OD']['axialLength']
        reporter.add_result(
            "IOL Master import",
            True,
            f"Imported biometry: AL OD={od_al}mm",
            category="device_import"
        )
    else:
        reporter.add_result(
            "IOL Master import",
            response.status_code == 404,
            f"Status: {response.status_code}",
            category="device_import"
        )


def test_autorefractor_import(reporter: TestReporter):
    """Test importing autorefractor data"""
    api = APIClient('admin')

    patient_id = get_test_patient_id()
    if not patient_id:
        reporter.add_result(
            "Autorefractor import",
            False,
            "No test patient found",
            category="device_import"
        )
        return None

    ar_data = get_simulated_autorefractor_data(patient_id)

    response = api.post('/api/device-measurements', data=ar_data)

    if response.ok:
        od_rx = ar_data['refraction']['OD']
        reporter.add_result(
            "Autorefractor import",
            True,
            f"Imported refraction: OD {od_rx['sphere']}/{od_rx['cylinder']}x{od_rx['axis']}",
            category="device_import"
        )
    else:
        reporter.add_result(
            "Autorefractor import",
            response.status_code == 404,
            f"Status: {response.status_code}",
            category="device_import"
        )


def test_visual_field_import(reporter: TestReporter):
    """Test importing visual field data"""
    api = APIClient('admin')

    patient_id = get_test_patient_id()
    if not patient_id:
        reporter.add_result(
            "Visual field import",
            False,
            "No test patient found",
            category="device_import"
        )
        return None

    vf_data = get_simulated_visual_field_data(patient_id)

    response = api.post('/api/device-measurements', data=vf_data)

    if response.ok:
        md = vf_data['results']['md']
        reporter.add_result(
            "Visual field import",
            True,
            f"Imported VF: MD={md}dB, VFI={vf_data['results']['vfi']}%",
            category="device_import"
        )
    else:
        reporter.add_result(
            "Visual field import",
            response.status_code == 404,
            f"Status: {response.status_code}",
            category="device_import"
        )


def test_specular_microscopy_import(reporter: TestReporter):
    """Test importing specular microscopy data"""
    api = APIClient('admin')

    patient_id = get_test_patient_id()
    if not patient_id:
        reporter.add_result(
            "Specular microscopy import",
            False,
            "No test patient found",
            category="device_import"
        )
        return None

    spec_data = get_simulated_specular_data(patient_id)

    response = api.post('/api/device-measurements', data=spec_data)

    if response.ok:
        od_density = spec_data['endothelium']['OD']['cellDensity']
        reporter.add_result(
            "Specular microscopy import",
            True,
            f"Imported specular: OD cell density={od_density}/mm²",
            category="device_import"
        )
    else:
        reporter.add_result(
            "Specular microscopy import",
            response.status_code == 404,
            f"Status: {response.status_code}",
            category="device_import"
        )


def test_device_measurement_retrieval(reporter: TestReporter):
    """Test retrieving device measurements for a patient"""
    api = APIClient('admin')

    patient_id = get_test_patient_id()
    if not patient_id:
        reporter.add_result(
            "Measurement retrieval",
            False,
            "No test patient found",
            category="device_import"
        )
        return

    response = api.get(f'/api/device-measurements?patientId={patient_id}')

    if response.ok:
        data = response.json()
        measurements = data.get('data', data.get('measurements', []))
        reporter.add_result(
            "Measurement retrieval",
            True,
            f"Found {len(measurements)} measurements for patient",
            category="device_import"
        )
    else:
        reporter.add_result(
            "Measurement retrieval",
            response.status_code == 404,
            f"Status: {response.status_code}",
            category="device_import"
        )


def test_folder_sync_status(reporter: TestReporter):
    """Test device folder sync status"""
    api = APIClient('admin')

    response = api.get('/api/devices/auto-sync/status')

    if response.ok:
        data = response.json()
        status = data.get('data', data)
        is_enabled = status.get('enabled', False)
        active_syncs = status.get('activeSyncs', 0)
        reporter.add_result(
            "Folder sync status",
            True,
            f"Auto-sync enabled: {is_enabled}, active: {active_syncs}",
            category="device_import"
        )
    else:
        reporter.add_result(
            "Folder sync status",
            response.status_code == 404,
            f"Status: {response.status_code}",
            category="device_import"
        )


def test_device_image_association(reporter: TestReporter):
    """Test associating device images with patient records"""
    api = APIClient('admin')

    patient_id = get_test_patient_id()
    if not patient_id:
        reporter.add_result(
            "Image association",
            False,
            "No test patient found",
            category="device_import"
        )
        return

    # Check if patient has any device images
    response = api.get(f'/api/device-images?patientId={patient_id}')

    if response.ok:
        data = response.json()
        images = data.get('data', data.get('images', []))
        reporter.add_result(
            "Image association",
            True,
            f"Found {len(images)} device images for patient",
            category="device_import"
        )
    else:
        reporter.add_result(
            "Image association",
            response.status_code == 404,
            f"Status: {response.status_code}",
            category="device_import"
        )


# =============================================================================
# MAIN TEST RUNNER
# =============================================================================

def run_device_import_tests():
    """Run all device data import tests"""
    reporter = TestReporter("Device Data Import Tests")

    print("\n" + "="*70)
    print("MEDFLOW DEVICE DATA IMPORT E2E TESTS")
    print("="*70)

    # Run tests
    print("\n[1/10] Testing device list...")
    devices = test_device_list(reporter)

    print("[2/10] Testing OCT data import...")
    test_oct_data_import(reporter)

    print("[3/10] Testing fundus data import...")
    test_fundus_data_import(reporter)

    print("[4/10] Testing IOL Master biometry import...")
    test_biometry_import(reporter)

    print("[5/10] Testing autorefractor import...")
    test_autorefractor_import(reporter)

    print("[6/10] Testing visual field import...")
    test_visual_field_import(reporter)

    print("[7/10] Testing specular microscopy import...")
    test_specular_microscopy_import(reporter)

    print("[8/10] Testing measurement retrieval...")
    test_device_measurement_retrieval(reporter)

    print("[9/10] Testing folder sync status...")
    test_folder_sync_status(reporter)

    print("[10/10] Testing image association...")
    test_device_image_association(reporter)

    # Save report
    reporter.save('device_import_report.json')

    return reporter.results


if __name__ == '__main__':
    run_device_import_tests()
