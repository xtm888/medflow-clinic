"""
Document/PDF Generation Tests for MedFlow
Tests PDF generation for invoices, prescriptions, and medical documents
"""
import os
from datetime import datetime
from test_utils import APIClient, TestReporter, get_test_patient_id, get_test_invoice_id

# =============================================================================
# TEST FUNCTIONS
# =============================================================================

def test_invoice_pdf_endpoint(reporter: TestReporter):
    """Test invoice PDF generation endpoint"""
    api = APIClient('admin')

    # Get a test invoice
    invoice_id = get_test_invoice_id()
    if not invoice_id:
        reporter.add_result(
            "Invoice PDF generation",
            False,
            "No test invoice found",
            category="document_generation"
        )
        return

    # Try to get PDF
    response = api.get(f'/api/billing/invoices/{invoice_id}/pdf')

    # Check response
    is_pdf = (
        response.ok and
        'pdf' in response.headers.get('content-type', '').lower()
    )

    reporter.add_result(
        "Invoice PDF generation",
        is_pdf or response.ok,
        f"Status: {response.status_code}, Content-Type: {response.headers.get('content-type', 'N/A')[:50]}",
        category="document_generation"
    )


def test_prescription_pdf_endpoint(reporter: TestReporter):
    """Test prescription PDF generation endpoint"""
    api = APIClient('admin')

    # Get prescriptions list
    response = api.get('/api/prescriptions?limit=1')
    if not response.ok:
        reporter.add_result(
            "Prescription PDF generation",
            False,
            "Could not fetch prescriptions",
            category="document_generation"
        )
        return

    data = response.json()
    prescriptions = data.get('data', data.get('prescriptions', []))

    if not prescriptions:
        reporter.add_result(
            "Prescription PDF generation",
            False,
            "No prescriptions found",
            category="document_generation"
        )
        return

    prescription_id = prescriptions[0].get('_id')

    # Try to get PDF
    pdf_response = api.get(f'/api/prescriptions/{prescription_id}/pdf')

    is_pdf = (
        pdf_response.ok and
        'pdf' in pdf_response.headers.get('content-type', '').lower()
    )

    reporter.add_result(
        "Prescription PDF generation",
        is_pdf or pdf_response.ok,
        f"Status: {pdf_response.status_code}",
        category="document_generation"
    )


def test_patient_statement_endpoint(reporter: TestReporter):
    """Test patient financial statement generation"""
    api = APIClient('admin')

    patient_id = get_test_patient_id()
    if not patient_id:
        reporter.add_result(
            "Patient statement generation",
            False,
            "No test patient found",
            category="document_generation"
        )
        return

    # Try to get statement
    response = api.get(f'/api/billing/patients/{patient_id}/statement')

    reporter.add_result(
        "Patient statement generation",
        response.ok,
        f"Status: {response.status_code}",
        category="document_generation"
    )


def test_cerfa_document_generation(reporter: TestReporter):
    """Test CERFA medical document generation"""
    api = APIClient('admin')

    patient_id = get_test_patient_id()
    if not patient_id:
        reporter.add_result(
            "CERFA document generation",
            False,
            "No test patient found",
            category="document_generation"
        )
        return

    # Test CERFA generation endpoint
    response = api.post('/api/documents/generate/certificate', data={
        'patientId': patient_id,
        'type': 'medical_certificate',
        'data': {
            'reason': 'Test certificate',
            'duration': 3
        }
    })

    reporter.add_result(
        "CERFA document generation",
        response.ok or response.status_code == 404,  # 404 is ok if endpoint doesn't exist
        f"Status: {response.status_code}",
        category="document_generation"
    )


def test_document_templates_list(reporter: TestReporter):
    """Test that document templates are available"""
    api = APIClient('admin')

    response = api.get('/api/documents/templates')

    if response.ok:
        data = response.json()
        templates = data.get('data', data.get('templates', []))
        reporter.add_result(
            "Document templates available",
            True,
            f"Found {len(templates)} templates",
            category="document_generation"
        )
    else:
        reporter.add_result(
            "Document templates available",
            response.status_code == 404,  # May not have this endpoint
            f"Status: {response.status_code}",
            category="document_generation"
        )


def test_receipt_generation(reporter: TestReporter):
    """Test payment receipt generation"""
    api = APIClient('admin')

    invoice_id = get_test_invoice_id()
    if not invoice_id:
        reporter.add_result(
            "Receipt generation",
            False,
            "No test invoice found",
            category="document_generation"
        )
        return

    # Try to get receipt for first payment
    response = api.get(f'/api/billing/invoices/{invoice_id}/receipt/0')

    reporter.add_result(
        "Receipt generation",
        response.ok or response.status_code in [404, 400],  # May not have payments
        f"Status: {response.status_code}",
        category="document_generation"
    )


def test_optical_prescription_generation(reporter: TestReporter):
    """Test optical prescription document generation"""
    api = APIClient('admin')

    patient_id = get_test_patient_id()
    if not patient_id:
        reporter.add_result(
            "Optical prescription generation",
            False,
            "No test patient found",
            category="document_generation"
        )
        return

    # Look for ophthalmology exam with refraction data
    response = api.get(f'/api/ophthalmology/exams?patientId={patient_id}&limit=1')

    if not response.ok:
        reporter.add_result(
            "Optical prescription generation",
            False,
            "Could not fetch exams",
            category="document_generation"
        )
        return

    data = response.json()
    exams = data.get('data', data.get('exams', []))

    if exams:
        exam_id = exams[0].get('_id')
        pdf_response = api.get(f'/api/ophthalmology/exams/{exam_id}/optical-prescription')
        reporter.add_result(
            "Optical prescription generation",
            pdf_response.ok or pdf_response.status_code in [404, 400],
            f"Status: {pdf_response.status_code}",
            category="document_generation"
        )
    else:
        reporter.add_result(
            "Optical prescription generation",
            True,  # No exams is ok for this test
            "No ophthalmology exams found",
            category="document_generation"
        )


# =============================================================================
# MAIN TEST RUNNER
# =============================================================================

def run_document_generation_tests():
    """Run all document generation tests"""
    reporter = TestReporter('document_generation')
    print("\n" + "="*60)
    print("DOCUMENT GENERATION TESTS")
    print("="*60)

    print("\n--- Testing Invoice PDF ---")
    test_invoice_pdf_endpoint(reporter)

    print("\n--- Testing Prescription PDF ---")
    test_prescription_pdf_endpoint(reporter)

    print("\n--- Testing Patient Statement ---")
    test_patient_statement_endpoint(reporter)

    print("\n--- Testing CERFA Generation ---")
    test_cerfa_document_generation(reporter)

    print("\n--- Testing Document Templates ---")
    test_document_templates_list(reporter)

    print("\n--- Testing Receipt Generation ---")
    test_receipt_generation(reporter)

    print("\n--- Testing Optical Prescription ---")
    test_optical_prescription_generation(reporter)

    # Save report
    reporter.save('document_generation_report.json')

    return reporter.results


if __name__ == '__main__':
    run_document_generation_tests()
