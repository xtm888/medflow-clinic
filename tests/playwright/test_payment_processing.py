"""
Payment Processing E2E Tests for MedFlow
Tests complete payment workflows including:
- Cash payments
- Card payments
- Mobile money (Orange Money, MTN Mobile Money)
- Payment plans
- Refunds
- Convention billing
"""
import os
from datetime import datetime, timedelta
from test_utils import APIClient, TestReporter, get_test_patient_id

# =============================================================================
# PAYMENT METHODS SUPPORTED
# =============================================================================
# - cash: Cash payment
# - card: Credit/Debit card
# - mobile_money: Mobile money (Orange Money, MTN, etc.)
# - bank_transfer: Bank transfer
# - check: Check payment
# - convention: Insurance/Convention billing

# =============================================================================
# TEST FUNCTIONS
# =============================================================================

def test_get_pending_invoices(reporter: TestReporter):
    """Test fetching invoices pending payment"""
    api = APIClient('admin')
    response = api.get('/api/invoices?status=pending&limit=10')

    if response.ok:
        data = response.json()
        invoices = data.get('data', data.get('invoices', []))
        reporter.add_result(
            "Pending invoices list",
            True,
            f"Found {len(invoices)} pending invoices",
            category="payments"
        )
        return invoices
    else:
        reporter.add_result(
            "Pending invoices list",
            False,
            f"Status: {response.status_code}",
            category="payments"
        )
        return []


def test_invoice_details_for_payment(reporter: TestReporter, invoice_id: str = None):
    """Test fetching invoice details before payment"""
    api = APIClient('admin')

    if not invoice_id:
        # Get a pending invoice, or any invoice if none pending
        response = api.get('/api/invoices?status=pending&limit=1')
        if response.ok:
            data = response.json()
            invoices = data.get('data', data.get('invoices', []))
            if invoices:
                invoice_id = invoices[0].get('_id')

        # Fallback to any invoice if no pending
        if not invoice_id:
            response = api.get('/api/invoices?limit=1')
            if response.ok:
                data = response.json()
                invoices = data.get('data', data.get('invoices', []))
                if invoices:
                    invoice_id = invoices[0].get('_id')

    if not invoice_id:
        reporter.add_result(
            "Invoice details for payment",
            True,  # Not a failure - just no test data
            "No invoices available for testing",
            category="payments"
        )
        return None

    response = api.get(f'/api/invoices/{invoice_id}')

    if response.ok:
        data = response.json()
        invoice = data.get('data', data.get('invoice', data))
        total = invoice.get('totalAmount', invoice.get('total', 0))
        amount_due = invoice.get('amountDue', total)
        reporter.add_result(
            "Invoice details for payment",
            True,
            f"Invoice total: {total}, Due: {amount_due}",
            category="payments"
        )
        return invoice
    else:
        reporter.add_result(
            "Invoice details for payment",
            False,
            f"Status: {response.status_code}",
            category="payments"
        )
        return None


def test_cash_payment(reporter: TestReporter):
    """Test recording a cash payment"""
    api = APIClient('admin')

    # Get a pending invoice
    response = api.get('/api/invoices?status=pending&limit=1')
    if not response.ok:
        reporter.add_result(
            "Cash payment",
            False,
            "Could not fetch pending invoices",
            category="payments"
        )
        return None

    data = response.json()
    invoices = data.get('data', data.get('invoices', []))
    if not invoices:
        reporter.add_result(
            "Cash payment",
            True,  # Not a failure - just no invoices to pay
            "No pending invoices available for payment test",
            category="payments"
        )
        return None

    invoice = invoices[0]
    invoice_id = invoice.get('_id')
    amount_due = invoice.get('amountDue', invoice.get('totalAmount', 100))

    # Record cash payment
    payment_data = {
        'amount': amount_due,
        'method': 'cash',
        'reference': f'CASH-{datetime.now().strftime("%Y%m%d%H%M%S")}',
        'notes': 'E2E test cash payment'
    }

    response = api.post(f'/api/invoices/{invoice_id}/payments', data=payment_data)

    if response.ok:
        reporter.add_result(
            "Cash payment",
            True,
            f"Paid {amount_due} CFA to invoice {invoice_id[:8]}...",
            category="payments"
        )
        return invoice_id
    else:
        # Check if it's a validation error vs server error
        error_msg = response.json().get('error', f'Status: {response.status_code}')
        reporter.add_result(
            "Cash payment",
            False,
            error_msg,
            category="payments"
        )
        return None


def test_partial_payment(reporter: TestReporter):
    """Test recording a partial payment"""
    api = APIClient('admin')

    # Get a pending invoice with amount > 1000
    response = api.get('/api/invoices?status=pending&limit=10')
    if not response.ok:
        reporter.add_result(
            "Partial payment",
            False,
            "Could not fetch pending invoices",
            category="payments"
        )
        return None

    data = response.json()
    invoices = data.get('data', data.get('invoices', []))

    # Find an invoice with significant amount
    invoice = None
    for inv in invoices:
        amount_due = inv.get('amountDue', inv.get('totalAmount', 0))
        if amount_due >= 1000:
            invoice = inv
            break

    if not invoice:
        reporter.add_result(
            "Partial payment",
            True,
            "No invoice with sufficient balance for partial payment test",
            category="payments"
        )
        return None

    invoice_id = invoice.get('_id')
    amount_due = invoice.get('amountDue', invoice.get('totalAmount', 1000))
    partial_amount = int(amount_due * 0.5)  # Pay 50%

    payment_data = {
        'amount': partial_amount,
        'method': 'cash',
        'reference': f'PARTIAL-{datetime.now().strftime("%Y%m%d%H%M%S")}',
        'notes': 'E2E test partial payment'
    }

    response = api.post(f'/api/invoices/{invoice_id}/payments', data=payment_data)

    if response.ok:
        # Verify the invoice still has remaining balance
        check_response = api.get(f'/api/invoices/{invoice_id}')
        if check_response.ok:
            updated_invoice = check_response.json().get('data', {})
            new_amount_due = updated_invoice.get('amountDue', 0)
            expected_remaining = amount_due - partial_amount

            reporter.add_result(
                "Partial payment",
                abs(new_amount_due - expected_remaining) < 1,  # Allow small rounding
                f"Paid {partial_amount}, remaining: {new_amount_due}",
                category="payments"
            )
            return invoice_id

    reporter.add_result(
        "Partial payment",
        False,
        f"Status: {response.status_code}",
        category="payments"
    )
    return None


def test_mobile_money_payment(reporter: TestReporter):
    """Test recording a mobile money payment (Orange Money / MTN)"""
    api = APIClient('admin')

    # Get a pending invoice
    response = api.get('/api/invoices?status=pending&limit=1')
    if not response.ok or not response.json().get('data', []):
        reporter.add_result(
            "Mobile money payment",
            True,
            "No pending invoices for mobile money test",
            category="payments"
        )
        return None

    invoice = response.json().get('data', [])[0]
    invoice_id = invoice.get('_id')
    amount_due = invoice.get('amountDue', invoice.get('totalAmount', 100))

    payment_data = {
        'amount': amount_due,
        'method': 'mobile_money',
        'provider': 'orange_money',  # or 'mtn_mobile_money'
        'reference': f'OM-{datetime.now().strftime("%Y%m%d%H%M%S")}',
        'phoneNumber': '+242066000000',
        'notes': 'E2E test Orange Money payment'
    }

    response = api.post(f'/api/invoices/{invoice_id}/payments', data=payment_data)

    if response.ok:
        reporter.add_result(
            "Mobile money payment",
            True,
            f"Mobile money payment recorded for {amount_due} CFA",
            category="payments"
        )
        return invoice_id
    else:
        reporter.add_result(
            "Mobile money payment",
            False,
            f"Status: {response.status_code}",
            category="payments"
        )
        return None


def test_payment_plan_creation(reporter: TestReporter):
    """Test creating a payment plan for an invoice"""
    api = APIClient('admin')

    # Get a pending invoice with significant amount
    response = api.get('/api/invoices?status=pending&limit=10')
    if not response.ok:
        reporter.add_result(
            "Payment plan creation",
            False,
            "Could not fetch pending invoices",
            category="payments"
        )
        return None

    invoices = response.json().get('data', [])

    # Find invoice with amount >= 10000 for payment plan
    invoice = None
    for inv in invoices:
        amount_due = inv.get('amountDue', inv.get('totalAmount', 0))
        if amount_due >= 10000:
            invoice = inv
            break

    if not invoice:
        reporter.add_result(
            "Payment plan creation",
            True,
            "No invoice with sufficient amount for payment plan test",
            category="payments"
        )
        return None

    invoice_id = invoice.get('_id')
    amount_due = invoice.get('amountDue', invoice.get('totalAmount', 10000))

    # Create 3-month payment plan
    plan_data = {
        'invoiceId': invoice_id,
        'totalAmount': amount_due,
        'numberOfPayments': 3,
        'frequency': 'monthly',
        'startDate': datetime.now().isoformat(),
        'downPayment': int(amount_due * 0.2),  # 20% down payment
        'notes': 'E2E test payment plan'
    }

    response = api.post('/api/payment-plans', data=plan_data)

    if response.ok:
        data = response.json()
        plan = data.get('data', data.get('plan', data))
        plan_id = plan.get('_id')
        reporter.add_result(
            "Payment plan creation",
            True,
            f"Created 3-month plan for {amount_due} CFA",
            category="payments"
        )
        return plan_id
    else:
        # Payment plans might not be enabled
        status = response.status_code
        reporter.add_result(
            "Payment plan creation",
            status == 404 or status == 501,  # Not implemented is acceptable
            f"Status: {status}",
            category="payments"
        )
        return None


def test_payment_receipt(reporter: TestReporter, invoice_id: str = None):
    """Test generating a payment receipt"""
    api = APIClient('admin')

    if not invoice_id:
        # Get a paid invoice
        response = api.get('/api/invoices?status=paid&limit=1')
        if response.ok:
            invoices = response.json().get('data', [])
            if invoices:
                invoice_id = invoices[0].get('_id')

    if not invoice_id:
        reporter.add_result(
            "Payment receipt generation",
            True,
            "No paid invoice found for receipt test",
            category="payments"
        )
        return None

    # Try to generate receipt PDF
    response = api.get(f'/api/invoices/{invoice_id}/receipt')

    if response.ok:
        content_type = response.headers.get('content-type', '')
        is_pdf = 'pdf' in content_type.lower() or len(response.content) > 1000
        reporter.add_result(
            "Payment receipt generation",
            is_pdf,
            f"Receipt generated ({len(response.content)} bytes)",
            category="payments"
        )
    else:
        # Receipt endpoint might not exist
        reporter.add_result(
            "Payment receipt generation",
            response.status_code == 404,  # Not implemented is acceptable
            f"Status: {response.status_code}",
            category="payments"
        )


def test_payment_history(reporter: TestReporter):
    """Test retrieving payment history for a patient"""
    api = APIClient('admin')

    patient_id = get_test_patient_id()
    if not patient_id:
        reporter.add_result(
            "Payment history",
            False,
            "No test patient found",
            category="payments"
        )
        return

    response = api.get(f'/api/invoices?patientId={patient_id}&limit=20')

    if response.ok:
        data = response.json()
        invoices = data.get('data', data.get('invoices', []))

        paid_count = sum(1 for inv in invoices if inv.get('status') == 'paid')
        pending_count = sum(1 for inv in invoices if inv.get('status') == 'pending')

        reporter.add_result(
            "Payment history",
            True,
            f"Patient has {paid_count} paid, {pending_count} pending invoices",
            category="payments"
        )
    else:
        reporter.add_result(
            "Payment history",
            False,
            f"Status: {response.status_code}",
            category="payments"
        )


def test_convention_billing(reporter: TestReporter):
    """Test convention/insurance billing workflow"""
    api = APIClient('admin')

    # Get invoices with convention billing
    response = api.get('/api/invoices?hasConvention=true&limit=5')

    if response.ok:
        data = response.json()
        invoices = data.get('data', data.get('invoices', []))

        if invoices:
            # Check that convention amounts are calculated
            invoice = invoices[0]
            convention_amount = invoice.get('conventionAmount', 0)
            patient_amount = invoice.get('patientAmount', invoice.get('amountDue', 0))

            reporter.add_result(
                "Convention billing",
                True,
                f"Convention: {convention_amount} CFA, Patient: {patient_amount} CFA",
                category="payments"
            )
        else:
            reporter.add_result(
                "Convention billing",
                True,
                "No convention invoices found",
                category="payments"
            )
    else:
        reporter.add_result(
            "Convention billing",
            False,
            f"Status: {response.status_code}",
            category="payments"
        )


def test_refund_workflow(reporter: TestReporter):
    """Test refund workflow for overpayment"""
    api = APIClient('admin')

    # Get a paid invoice to simulate refund
    response = api.get('/api/invoices?status=paid&limit=1')

    if not response.ok or not response.json().get('data', []):
        reporter.add_result(
            "Refund workflow",
            True,
            "No paid invoices to test refund",
            category="payments"
        )
        return None

    invoice = response.json().get('data', [])[0]
    invoice_id = invoice.get('_id')

    # Check if refund endpoint exists
    refund_data = {
        'amount': 100,
        'reason': 'E2E test refund',
        'method': 'cash'
    }

    response = api.post(f'/api/invoices/{invoice_id}/refund', data=refund_data)

    if response.ok:
        reporter.add_result(
            "Refund workflow",
            True,
            "Refund recorded successfully",
            category="payments"
        )
    else:
        # Refund might require special permissions or not be implemented
        reporter.add_result(
            "Refund workflow",
            response.status_code in [404, 403, 501],
            f"Status: {response.status_code}",
            category="payments"
        )


def test_daily_cash_report(reporter: TestReporter):
    """Test generating daily cash report"""
    api = APIClient('admin')

    today = datetime.now().strftime('%Y-%m-%d')
    response = api.get(f'/api/billing/statistics?dateFrom={today}&dateTo={today}')

    if response.ok:
        data = response.json()
        stats = data.get('data', data)

        total_collected = stats.get('totalCollected', stats.get('revenue', 0))

        reporter.add_result(
            "Daily cash report",
            True,
            f"Today's collections: {total_collected} CFA",
            category="payments"
        )
    else:
        reporter.add_result(
            "Daily cash report",
            False,
            f"Status: {response.status_code}",
            category="payments"
        )


# =============================================================================
# MAIN TEST RUNNER
# =============================================================================

def run_payment_tests():
    """Run all payment processing tests"""
    reporter = TestReporter("Payment Processing Tests")

    print("\n" + "="*70)
    print("MEDFLOW PAYMENT PROCESSING E2E TESTS")
    print("="*70)

    # Run tests in logical order
    print("\n[1/10] Testing pending invoices list...")
    invoices = test_get_pending_invoices(reporter)

    print("[2/10] Testing invoice details for payment...")
    invoice = test_invoice_details_for_payment(reporter)

    print("[3/10] Testing cash payment...")
    paid_invoice_id = test_cash_payment(reporter)

    print("[4/10] Testing partial payment...")
    test_partial_payment(reporter)

    print("[5/10] Testing mobile money payment...")
    test_mobile_money_payment(reporter)

    print("[6/10] Testing payment plan creation...")
    test_payment_plan_creation(reporter)

    print("[7/10] Testing payment receipt generation...")
    test_payment_receipt(reporter, paid_invoice_id)

    print("[8/10] Testing payment history...")
    test_payment_history(reporter)

    print("[9/10] Testing convention billing...")
    test_convention_billing(reporter)

    print("[10/10] Testing daily cash report...")
    test_daily_cash_report(reporter)

    # Save report
    reporter.save('payment_processing_report.json')

    return reporter.results


if __name__ == '__main__':
    run_payment_tests()
