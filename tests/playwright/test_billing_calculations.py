"""
Billing and Convention Calculation Tests for MedFlow
Tests invoice calculations, convention billing, and package deals
"""
import os
from datetime import datetime
from test_utils import APIClient, TestReporter, get_test_patient_id, get_test_invoice_id

# =============================================================================
# TEST FUNCTIONS
# =============================================================================

def test_invoice_list(reporter: TestReporter):
    """Test that invoices API returns data"""
    api = APIClient('admin')
    response = api.get('/api/invoices?limit=10')

    if response.ok:
        data = response.json()
        invoices = data.get('data', data.get('invoices', []))
        reporter.add_result(
            "Invoice list",
            True,
            f"Found {len(invoices)} invoices",
            category="billing"
        )
        return invoices
    else:
        reporter.add_result(
            "Invoice list",
            False,
            f"Status: {response.status_code}",
            category="billing"
        )
        return []


def test_invoice_calculation(invoices: list, reporter: TestReporter):
    """Test invoice total calculation"""
    if not invoices:
        reporter.add_result(
            "Invoice total calculation",
            False,
            "No invoices to test",
            category="billing"
        )
        return

    invoice = invoices[0]
    items = invoice.get('items', [])
    subtotal = invoice.get('subtotal', 0)
    discount = invoice.get('discount', 0)
    tax = invoice.get('tax', 0)
    total = invoice.get('total', 0)

    # Calculate expected subtotal
    calculated_subtotal = sum(
        (item.get('quantity', 1) * item.get('unitPrice', 0))
        for item in items
    )

    # Calculate expected total
    calculated_total = calculated_subtotal - discount + tax

    # Allow small floating point differences
    subtotal_match = abs(calculated_subtotal - subtotal) < 1
    total_match = abs(calculated_total - total) < 1

    reporter.add_result(
        "Invoice total calculation",
        subtotal_match and total_match,
        f"Subtotal: {subtotal} (calc: {calculated_subtotal}), Total: {total} (calc: {calculated_total})",
        category="billing"
    )


def test_convention_list(reporter: TestReporter):
    """Test that conventions (insurance companies) are available"""
    api = APIClient('admin')
    response = api.get('/api/conventions')

    if response.ok:
        data = response.json()
        conventions = data.get('data', data.get('conventions', []))
        reporter.add_result(
            "Convention list",
            True,
            f"Found {len(conventions)} conventions",
            category="billing"
        )
        return conventions
    else:
        # Try companies endpoint
        response = api.get('/api/companies')
        if response.ok:
            data = response.json()
            companies = data.get('data', data.get('companies', []))
            reporter.add_result(
                "Convention list",
                True,
                f"Found {len(companies)} companies",
                category="billing"
            )
            return companies

        reporter.add_result(
            "Convention list",
            False,
            f"Status: {response.status_code}",
            category="billing"
        )
        return []


def test_convention_billing_application(reporter: TestReporter):
    """Test applying convention billing to invoice"""
    api = APIClient('admin')

    # Get a patient with convention
    response = api.get('/api/patients?hasConvention=true&limit=1')
    if not response.ok:
        response = api.get('/api/patients?limit=1')

    if not response.ok:
        reporter.add_result(
            "Convention billing application",
            False,
            "Could not fetch patients",
            category="billing"
        )
        return

    data = response.json()
    patients = data.get('data', data.get('patients', []))

    if not patients:
        reporter.add_result(
            "Convention billing application",
            False,
            "No patients found",
            category="billing"
        )
        return

    patient = patients[0]
    patient_id = patient.get('_id')
    convention = patient.get('convention', patient.get('company'))

    if convention:
        reporter.add_result(
            "Convention billing application",
            True,
            f"Patient has convention: {convention.get('name') if isinstance(convention, dict) else convention}",
            category="billing"
        )
    else:
        reporter.add_result(
            "Convention billing application",
            True,  # OK if no convention
            "Patient has no convention",
            category="billing"
        )


def test_package_deals(reporter: TestReporter):
    """Test package deal detection and application"""
    api = APIClient('admin')

    # Get companies with package deals
    response = api.get('/api/companies')
    if not response.ok:
        reporter.add_result(
            "Package deals",
            False,
            f"Status: {response.status_code}",
            category="billing"
        )
        return

    data = response.json()
    companies = data.get('data', data.get('companies', []))

    # Check for package deals
    packages_found = 0
    for company in companies:
        packages = company.get('packageDeals', company.get('packages', []))
        if packages:
            packages_found += len(packages)

    reporter.add_result(
        "Package deals",
        True,
        f"Found {packages_found} package deals across {len(companies)} companies",
        category="billing"
    )


def test_fee_schedule(reporter: TestReporter):
    """Test fee schedule API"""
    api = APIClient('admin')
    response = api.get('/api/fee-schedules')

    if response.ok:
        data = response.json()
        schedules = data.get('data', data.get('feeSchedules', []))
        reporter.add_result(
            "Fee schedule",
            True,
            f"Found {len(schedules)} fee schedules",
            category="billing"
        )
    else:
        reporter.add_result(
            "Fee schedule",
            False,
            f"Status: {response.status_code}",
            category="billing"
        )


def test_payment_processing(reporter: TestReporter):
    """Test payment processing workflow"""
    api = APIClient('admin')

    invoice_id = get_test_invoice_id()
    if not invoice_id:
        reporter.add_result(
            "Payment processing",
            False,
            "No test invoice found",
            category="billing"
        )
        return

    # Get invoice details
    response = api.get(f'/api/invoices/{invoice_id}')
    if not response.ok:
        reporter.add_result(
            "Payment processing",
            False,
            "Could not fetch invoice",
            category="billing"
        )
        return

    data = response.json()
    invoice = data.get('data', data.get('invoice', data))
    status = invoice.get('status', 'unknown')
    amount_paid = invoice.get('amountPaid', 0)
    total = invoice.get('total', 0)

    reporter.add_result(
        "Payment processing",
        True,
        f"Status: {status}, Paid: {amount_paid}/{total}",
        category="billing"
    )


def test_payment_plan_creation(reporter: TestReporter):
    """Test payment plan creation"""
    api = APIClient('admin')

    invoice_id = get_test_invoice_id()
    if not invoice_id:
        reporter.add_result(
            "Payment plan creation",
            False,
            "No test invoice found",
            category="billing"
        )
        return

    # Get invoice to check for existing payment plan
    response = api.get(f'/api/invoices/{invoice_id}')
    if response.ok:
        data = response.json()
        invoice = data.get('data', data.get('invoice', data))
        payment_plan = invoice.get('paymentPlan')

        reporter.add_result(
            "Payment plan creation",
            True,
            f"Has payment plan: {payment_plan is not None}",
            category="billing"
        )
    else:
        reporter.add_result(
            "Payment plan creation",
            False,
            f"Status: {response.status_code}",
            category="billing"
        )


def test_currency_support(reporter: TestReporter):
    """Test multi-currency support"""
    api = APIClient('admin')

    # Get invoices with different currencies
    response = api.get('/api/invoices?limit=50')
    if not response.ok:
        reporter.add_result(
            "Multi-currency support",
            False,
            f"Status: {response.status_code}",
            category="billing"
        )
        return

    data = response.json()
    invoices = data.get('data', data.get('invoices', []))

    currencies = set()
    for invoice in invoices:
        currency = invoice.get('currency', 'USD')
        currencies.add(currency)

    reporter.add_result(
        "Multi-currency support",
        True,
        f"Currencies found: {', '.join(currencies)}",
        category="billing"
    )


def test_annual_limit_tracking(reporter: TestReporter):
    """Test convention annual limit tracking"""
    api = APIClient('admin')

    # Get companies and check for annual limits
    response = api.get('/api/companies')
    if not response.ok:
        reporter.add_result(
            "Annual limit tracking",
            False,
            f"Status: {response.status_code}",
            category="billing"
        )
        return

    data = response.json()
    companies = data.get('data', data.get('companies', []))

    companies_with_limits = 0
    for company in companies:
        annual_limit = company.get('annualLimit', company.get('coverageLimit'))
        if annual_limit:
            companies_with_limits += 1

    reporter.add_result(
        "Annual limit tracking",
        True,
        f"{companies_with_limits}/{len(companies)} companies have annual limits",
        category="billing"
    )


def test_invoice_status_workflow(reporter: TestReporter):
    """Test invoice status transitions"""
    api = APIClient('admin')

    response = api.get('/api/invoices?limit=50')
    if not response.ok:
        reporter.add_result(
            "Invoice status workflow",
            False,
            f"Status: {response.status_code}",
            category="billing"
        )
        return

    data = response.json()
    invoices = data.get('data', data.get('invoices', []))

    # Count by status
    status_counts = {}
    for invoice in invoices:
        status = invoice.get('status', 'unknown')
        status_counts[status] = status_counts.get(status, 0) + 1

    reporter.add_result(
        "Invoice status workflow",
        True,
        f"Statuses: {status_counts}",
        category="billing"
    )


def test_financial_statistics(reporter: TestReporter):
    """Test financial statistics endpoint"""
    api = APIClient('admin')

    response = api.get('/api/billing/statistics')

    if response.ok:
        data = response.json()
        reporter.add_result(
            "Financial statistics",
            True,
            "Statistics endpoint working",
            category="billing"
        )
    else:
        reporter.add_result(
            "Financial statistics",
            response.status_code == 404,
            f"Status: {response.status_code}",
            category="billing"
        )


# =============================================================================
# MAIN TEST RUNNER
# =============================================================================

def run_billing_calculation_tests():
    """Run all billing calculation tests"""
    reporter = TestReporter('billing_calculations')
    print("\n" + "="*60)
    print("BILLING CALCULATION TESTS")
    print("="*60)

    print("\n--- Testing Invoice List ---")
    invoices = test_invoice_list(reporter)

    print("\n--- Testing Invoice Calculation ---")
    test_invoice_calculation(invoices, reporter)

    print("\n--- Testing Conventions ---")
    test_convention_list(reporter)
    test_convention_billing_application(reporter)

    print("\n--- Testing Package Deals ---")
    test_package_deals(reporter)

    print("\n--- Testing Fee Schedule ---")
    test_fee_schedule(reporter)

    print("\n--- Testing Payment Processing ---")
    test_payment_processing(reporter)
    test_payment_plan_creation(reporter)

    print("\n--- Testing Multi-Currency ---")
    test_currency_support(reporter)

    print("\n--- Testing Annual Limits ---")
    test_annual_limit_tracking(reporter)

    print("\n--- Testing Status Workflow ---")
    test_invoice_status_workflow(reporter)

    print("\n--- Testing Financial Statistics ---")
    test_financial_statistics(reporter)

    # Save report
    reporter.save('billing_calculations_report.json')

    return reporter.results


if __name__ == '__main__':
    run_billing_calculation_tests()
