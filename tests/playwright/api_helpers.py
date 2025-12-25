#!/usr/bin/env python3
"""
API Helper Functions for E2E Data Verification
Provides functions to call MedFlow API and verify responses
"""

import json
import requests
from typing import Optional, Dict, Any, List
from datetime import datetime

API_URL = "http://localhost:5001/api"
FRONTEND_URL = "http://localhost:5173"


class MedFlowAPI:
    """Helper class for MedFlow API interactions"""

    def __init__(self, page=None):
        self.page = page
        self.token = None
        self.cookies = {}

    def extract_auth_from_page(self) -> bool:
        """Extract auth cookies from Playwright page after login"""
        if not self.page:
            return False

        try:
            cookies = self.page.context.cookies()
            for cookie in cookies:
                if cookie['name'] in ['accessToken', 'refreshToken']:
                    self.cookies[cookie['name']] = cookie['value']
            return 'accessToken' in self.cookies
        except Exception as e:
            print(f"Failed to extract auth: {e}")
            return False

    def _get_headers(self) -> Dict[str, str]:
        """Get headers with auth token"""
        headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'
        return headers

    def _get_cookies_str(self) -> str:
        """Get cookies as string for requests"""
        return '; '.join([f"{k}={v}" for k, v in self.cookies.items()])

    def request(self, method: str, endpoint: str, data: Dict = None) -> Dict:
        """Make API request and return response"""
        url = f"{API_URL}{endpoint}"
        headers = self._get_headers()

        if self.cookies:
            headers['Cookie'] = self._get_cookies_str()

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, headers=headers, json=data, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, headers=headers, json=data, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)
            else:
                return {'success': False, 'error': f'Unknown method: {method}'}

            return response.json()
        except requests.exceptions.Timeout:
            return {'success': False, 'error': 'Request timeout'}
        except requests.exceptions.ConnectionError:
            return {'success': False, 'error': 'Connection failed - is backend running?'}
        except json.JSONDecodeError:
            return {'success': False, 'error': 'Invalid JSON response'}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    # ==================== PATIENT API ====================

    def get_patients(self, limit: int = 20, page: int = 1) -> Dict:
        """Get paginated patient list"""
        return self.request('GET', f'/patients?limit={limit}&page={page}')

    def get_patient(self, patient_id: str) -> Dict:
        """Get single patient by ID"""
        return self.request('GET', f'/patients/{patient_id}')

    def search_patients(self, query: str) -> Dict:
        """Search patients by name"""
        return self.request('GET', f'/patients/search?q={query}')

    def verify_patient_exists(self, patient_id: str) -> bool:
        """Verify patient exists in database"""
        result = self.get_patient(patient_id)
        return result.get('success', False) and result.get('data') is not None

    def verify_patient_by_name(self, first_name: str, last_name: str) -> Optional[Dict]:
        """Find patient by name, return patient data if found"""
        result = self.search_patients(f"{first_name} {last_name}")
        if result.get('success'):
            patients = result.get('data', result.get('patients', []))
            for p in patients:
                if p.get('firstName', '').upper() == first_name.upper() and \
                   p.get('lastName', '').upper() == last_name.upper():
                    return p
        return None

    # ==================== INVOICE API ====================

    def get_invoices(self, patient_id: str = None, status: str = None) -> Dict:
        """Get invoices with optional filters"""
        params = []
        if patient_id:
            params.append(f"patient={patient_id}")
        if status:
            params.append(f"status={status}")
        query = '&'.join(params)
        return self.request('GET', f'/invoices?{query}')

    def get_invoice(self, invoice_id: str) -> Dict:
        """Get single invoice by ID"""
        return self.request('GET', f'/invoices/{invoice_id}')

    def create_invoice(self, patient_id: str, items: List[Dict]) -> Dict:
        """Create new invoice"""
        data = {
            'patient': patient_id,
            'items': items,
            'status': 'draft'
        }
        return self.request('POST', '/invoices', data)

    def add_payment(self, invoice_id: str, amount: float, method: str = 'cash',
                    currency: str = 'CDF') -> Dict:
        """Add payment to invoice"""
        data = {
            'amount': amount,
            'method': method,
            'currency': currency,
            'date': datetime.now().isoformat()
        }
        return self.request('POST', f'/invoices/{invoice_id}/payments', data)

    def verify_invoice_exists(self, invoice_id: str) -> bool:
        """Verify invoice exists in database"""
        result = self.get_invoice(invoice_id)
        return result.get('success', False)

    def verify_invoice_paid(self, invoice_id: str) -> bool:
        """Verify invoice is fully paid"""
        result = self.get_invoice(invoice_id)
        if result.get('success'):
            invoice = result.get('data', {})
            return invoice.get('status') == 'paid' or \
                   invoice.get('summary', {}).get('amountDue', 1) == 0
        return False

    # ==================== QUEUE API ====================

    def get_queue(self) -> Dict:
        """Get current queue"""
        return self.request('GET', '/queue')

    def add_to_queue(self, patient_id: str, reason: str = 'Consultation') -> Dict:
        """Add patient to queue"""
        data = {
            'patient': patient_id,
            'reason': reason
        }
        return self.request('POST', '/queue', data)

    def call_next_patient(self, queue_entry_id: str) -> Dict:
        """Call next patient from queue"""
        return self.request('POST', f'/queue/{queue_entry_id}/call')

    def verify_patient_in_queue(self, patient_id: str) -> bool:
        """Verify patient is in queue"""
        result = self.get_queue()
        if result.get('success'):
            queue = result.get('data', result.get('queue', []))
            for entry in queue:
                if entry.get('patient', {}).get('_id') == patient_id or \
                   entry.get('patient') == patient_id:
                    return True
        return False

    # ==================== APPOINTMENT API ====================

    def get_appointments(self, date: str = None) -> Dict:
        """Get appointments, optionally for specific date"""
        endpoint = '/appointments'
        if date:
            endpoint += f'?date={date}'
        return self.request('GET', endpoint)

    def create_appointment(self, patient_id: str, provider_id: str,
                          date: str, time: str, type_: str = 'consultation') -> Dict:
        """Create new appointment"""
        data = {
            'patient': patient_id,
            'provider': provider_id,
            'date': date,
            'startTime': time,
            'type': type_
        }
        return self.request('POST', '/appointments', data)

    def verify_appointment_exists(self, appointment_id: str) -> bool:
        """Verify appointment exists"""
        result = self.request('GET', f'/appointments/{appointment_id}')
        return result.get('success', False)

    # ==================== PRESCRIPTION API ====================

    def get_prescriptions(self, patient_id: str = None) -> Dict:
        """Get prescriptions"""
        endpoint = '/prescriptions'
        if patient_id:
            endpoint += f'?patient={patient_id}'
        return self.request('GET', endpoint)

    def verify_prescription_exists(self, prescription_id: str) -> bool:
        """Verify prescription exists"""
        result = self.request('GET', f'/prescriptions/{prescription_id}')
        return result.get('success', False)

    # ==================== LAB API ====================

    def get_lab_orders(self, status: str = None) -> Dict:
        """Get lab orders"""
        endpoint = '/lab-orders'
        if status:
            endpoint += f'?status={status}'
        return self.request('GET', endpoint)

    def create_lab_order(self, patient_id: str, tests: List[str]) -> Dict:
        """Create lab order"""
        data = {
            'patient': patient_id,
            'tests': tests
        }
        return self.request('POST', '/lab-orders', data)

    # ==================== UTILITY FUNCTIONS ====================

    def health_check(self) -> bool:
        """Check if API is available"""
        try:
            response = requests.get(f"{API_URL}/health", timeout=5)
            return response.status_code == 200
        except:
            return False


def verify_api_response(response: Dict, expected_success: bool = True) -> Dict:
    """
    Verify API response and return verification result

    Returns:
        {
            'verified': bool,
            'success': bool,
            'data': any,
            'error': str or None,
            'message': str
        }
    """
    actual_success = response.get('success', False)

    if actual_success == expected_success:
        return {
            'verified': True,
            'success': actual_success,
            'data': response.get('data'),
            'error': None,
            'message': f"API returned expected success={expected_success}"
        }
    else:
        return {
            'verified': False,
            'success': actual_success,
            'data': response.get('data'),
            'error': response.get('error', response.get('message', 'Unknown error')),
            'message': f"Expected success={expected_success}, got success={actual_success}"
        }


def extract_id_from_response(response: Dict) -> Optional[str]:
    """Extract created resource ID from API response"""
    if not response.get('success'):
        return None

    data = response.get('data', {})

    # Try common ID fields
    for field in ['_id', 'id', 'patientId', 'invoiceId', 'appointmentId']:
        if field in data:
            return str(data[field])

    return None
