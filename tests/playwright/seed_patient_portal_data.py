#!/usr/bin/env python3
"""
MedFlow Patient Portal Test Data Seeder
========================================

Creates test data required for patient portal E2E tests:
- Test patient user account
- Sample appointments
- Sample prescriptions
- Sample invoices

Run before running patient portal tests:
    python seed_patient_portal_data.py

Author: MedFlow Test Automation
Created: 2025-12-25
"""

import requests
import json
import sys
from datetime import datetime, timedelta
from typing import Optional, Dict, List

# Configuration
API_URL = "http://localhost:5001"
DEFAULT_PASSWORD = "MedFlow$ecure1"

# Admin credentials for seeding
ADMIN_USER = {
    'email': 'admin@medflow.com',
    'password': DEFAULT_PASSWORD
}

# Test patient to create
TEST_PATIENT = {
    'email': 'patient.test@medflow.com',
    'password': DEFAULT_PASSWORD,
    'firstName': 'Jean',
    'lastName': 'Patient',
    'dateOfBirth': '1985-05-15',
    'gender': 'M',
    'phone': '+243 81 555 1234',
    'address': '123 Avenue Lumumba, Kinshasa',
    'bloodType': 'A+',
    'allergies': ['Penicilline', 'Latex']
}


class PatientPortalSeeder:
    """Seed test data for patient portal tests"""

    def __init__(self):
        self.session = requests.Session()
        self.token = None
        self.csrf_token = None
        self.clinic_id = None
        self.patient_id = None
        self.user_id = None

    def login(self) -> bool:
        """Login as admin to seed data"""
        print("Logging in as admin...")
        try:
            response = self.session.post(
                f"{API_URL}/api/auth/login",
                json={'email': ADMIN_USER['email'], 'password': ADMIN_USER['password']},
                timeout=10
            )
            if response.ok:
                self.token = response.cookies.get('accessToken')
                # Get CSRF token
                self.session.get(f"{API_URL}/api/auth/me", timeout=10)
                self.csrf_token = self.session.cookies.get('XSRF-TOKEN')
                print("  Login successful")
                return True
            else:
                print(f"  Login failed: {response.status_code}")
                return False
        except Exception as e:
            print(f"  Login error: {e}")
            return False

    def _headers(self) -> Dict:
        """Get headers with CSRF token"""
        headers = {}
        if self.csrf_token:
            headers['X-XSRF-TOKEN'] = self.csrf_token
        return headers

    def get_clinic(self) -> Optional[str]:
        """Get first clinic ID"""
        print("Getting clinic ID...")
        try:
            response = self.session.get(f"{API_URL}/api/clinics", timeout=10)
            if response.ok:
                data = response.json()
                clinics = data.get('data', data.get('clinics', []))
                if clinics:
                    self.clinic_id = clinics[0].get('_id')
                    print(f"  Clinic ID: {self.clinic_id}")
                    return self.clinic_id
        except Exception as e:
            print(f"  Error getting clinic: {e}")
        return None

    def check_patient_exists(self) -> Optional[str]:
        """Check if test patient already exists"""
        print("Checking if test patient exists...")
        try:
            response = self.session.get(
                f"{API_URL}/api/patients",
                params={'email': TEST_PATIENT['email']},
                timeout=10
            )
            if response.ok:
                data = response.json()
                patients = data.get('data', data.get('patients', []))
                for patient in patients:
                    if patient.get('email') == TEST_PATIENT['email']:
                        self.patient_id = patient.get('_id')
                        print(f"  Patient already exists: {self.patient_id}")
                        return self.patient_id
        except Exception as e:
            print(f"  Error checking patient: {e}")
        print("  Patient does not exist")
        return None

    def create_patient(self) -> Optional[str]:
        """Create test patient"""
        print("Creating test patient...")
        try:
            patient_data = {
                'firstName': TEST_PATIENT['firstName'],
                'lastName': TEST_PATIENT['lastName'],
                'email': TEST_PATIENT['email'],
                'phone': TEST_PATIENT['phone'],
                'dateOfBirth': TEST_PATIENT['dateOfBirth'],
                'gender': TEST_PATIENT['gender'],
                'address': TEST_PATIENT['address'],
                'bloodType': TEST_PATIENT['bloodType'],
                'allergies': TEST_PATIENT['allergies'],
                'clinic': self.clinic_id
            }

            response = self.session.post(
                f"{API_URL}/api/patients",
                json=patient_data,
                headers=self._headers(),
                timeout=15
            )

            if response.ok:
                data = response.json()
                self.patient_id = data.get('data', data).get('_id')
                print(f"  Patient created: {self.patient_id}")
                return self.patient_id
            else:
                print(f"  Create patient failed: {response.status_code} - {response.text[:200]}")
        except Exception as e:
            print(f"  Error creating patient: {e}")
        return None

    def check_user_exists(self) -> Optional[str]:
        """Check if test user account exists"""
        print("Checking if test user exists...")
        try:
            response = self.session.get(
                f"{API_URL}/api/users",
                params={'email': TEST_PATIENT['email']},
                timeout=10
            )
            if response.ok:
                data = response.json()
                users = data.get('data', data.get('users', []))
                for user in users:
                    if user.get('email') == TEST_PATIENT['email']:
                        self.user_id = user.get('_id')
                        print(f"  User already exists: {self.user_id}")
                        return self.user_id
        except Exception as e:
            print(f"  Error checking user: {e}")
        print("  User does not exist")
        return None

    def create_user_account(self) -> Optional[str]:
        """Create user account for patient portal access"""
        print("Creating user account for patient...")
        try:
            user_data = {
                'email': TEST_PATIENT['email'],
                'password': TEST_PATIENT['password'],
                'firstName': TEST_PATIENT['firstName'],
                'lastName': TEST_PATIENT['lastName'],
                'role': 'patient',  # or appropriate role
                'patientId': self.patient_id,
                'active': True
            }

            response = self.session.post(
                f"{API_URL}/api/users",
                json=user_data,
                headers=self._headers(),
                timeout=15
            )

            if response.ok:
                data = response.json()
                self.user_id = data.get('data', data).get('_id')
                print(f"  User created: {self.user_id}")
                return self.user_id
            else:
                print(f"  Create user failed: {response.status_code} - {response.text[:200]}")
        except Exception as e:
            print(f"  Error creating user: {e}")
        return None

    def create_sample_appointments(self) -> List[str]:
        """Create sample appointments for patient"""
        print("Creating sample appointments...")
        appointment_ids = []

        # Create 2 future appointments
        for i in range(2):
            try:
                apt_date = datetime.now() + timedelta(days=7 + i * 7)
                apt_data = {
                    'patient': self.patient_id,
                    'clinic': self.clinic_id,
                    'date': apt_date.strftime('%Y-%m-%d'),
                    'time': f'{9 + i}:00',
                    'duration': 30,
                    'type': 'consultation',
                    'status': 'CONFIRMED' if i == 0 else 'PENDING',
                    'reason': f'Consultation ophtalmologique #{i+1}'
                }

                response = self.session.post(
                    f"{API_URL}/api/appointments",
                    json=apt_data,
                    headers=self._headers(),
                    timeout=15
                )

                if response.ok:
                    data = response.json()
                    apt_id = data.get('data', data).get('_id')
                    appointment_ids.append(apt_id)
                    print(f"  Appointment created: {apt_id}")
            except Exception as e:
                print(f"  Error creating appointment: {e}")

        # Create 1 past appointment
        try:
            past_date = datetime.now() - timedelta(days=14)
            apt_data = {
                'patient': self.patient_id,
                'clinic': self.clinic_id,
                'date': past_date.strftime('%Y-%m-%d'),
                'time': '14:00',
                'duration': 30,
                'type': 'consultation',
                'status': 'COMPLETED',
                'reason': 'Examen de routine'
            }

            response = self.session.post(
                f"{API_URL}/api/appointments",
                json=apt_data,
                headers=self._headers(),
                timeout=15
            )

            if response.ok:
                data = response.json()
                apt_id = data.get('data', data).get('_id')
                appointment_ids.append(apt_id)
                print(f"  Past appointment created: {apt_id}")
        except Exception as e:
            print(f"  Error creating past appointment: {e}")

        return appointment_ids

    def create_sample_prescriptions(self) -> List[str]:
        """Create sample prescriptions for patient"""
        print("Creating sample prescriptions...")
        prescription_ids = []

        try:
            rx_data = {
                'patient': self.patient_id,
                'clinic': self.clinic_id,
                'date': datetime.now().strftime('%Y-%m-%d'),
                'status': 'PENDING',
                'medications': [
                    {
                        'name': 'Latanoprost 0.005%',
                        'drug': 'Latanoprost',
                        'dosage': '1 goutte par jour le soir',
                        'duration': '3 mois',
                        'quantity': 3,
                        'route': 'ophthalmic',
                        'applicationLocation': {'eye': 'OU'}
                    },
                    {
                        'name': 'Larmes artificielles',
                        'drug': 'Hyaluronate de sodium',
                        'dosage': '1-2 gouttes 4 fois par jour',
                        'duration': '1 mois',
                        'quantity': 2,
                        'route': 'ophthalmic'
                    }
                ],
                'notes': 'Renouvellement a 3 mois'
            }

            response = self.session.post(
                f"{API_URL}/api/prescriptions",
                json=rx_data,
                headers=self._headers(),
                timeout=15
            )

            if response.ok:
                data = response.json()
                rx_id = data.get('data', data).get('_id')
                prescription_ids.append(rx_id)
                print(f"  Prescription created: {rx_id}")
        except Exception as e:
            print(f"  Error creating prescription: {e}")

        return prescription_ids

    def create_sample_invoices(self) -> List[str]:
        """Create sample invoices for patient"""
        print("Creating sample invoices...")
        invoice_ids = []

        try:
            invoice_data = {
                'patient': self.patient_id,
                'clinic': self.clinic_id,
                'date': datetime.now().strftime('%Y-%m-%d'),
                'items': [
                    {
                        'description': 'Consultation ophtalmologique',
                        'quantity': 1,
                        'unitPrice': 50,
                        'total': 50
                    },
                    {
                        'description': 'Fond d\'oeil',
                        'quantity': 1,
                        'unitPrice': 30,
                        'total': 30
                    }
                ],
                'total': 80,
                'amountPaid': 0,
                'balance': 80,
                'currency': 'USD',
                'status': 'PENDING'
            }

            response = self.session.post(
                f"{API_URL}/api/invoices",
                json=invoice_data,
                headers=self._headers(),
                timeout=15
            )

            if response.ok:
                data = response.json()
                inv_id = data.get('data', data).get('_id')
                invoice_ids.append(inv_id)
                print(f"  Invoice created: {inv_id}")
        except Exception as e:
            print(f"  Error creating invoice: {e}")

        return invoice_ids

    def run(self) -> bool:
        """Run all seeding steps"""
        print("\n" + "="*60)
        print("MedFlow Patient Portal Test Data Seeder")
        print("="*60 + "\n")

        # Step 1: Login
        if not self.login():
            print("\nFailed to login. Make sure the backend is running.")
            return False

        # Step 2: Get clinic
        if not self.get_clinic():
            print("\nNo clinics found. Run database seeders first.")
            return False

        # Step 3: Check/Create patient
        if not self.check_patient_exists():
            if not self.create_patient():
                print("\nFailed to create patient.")
                return False

        # Step 4: Check/Create user account
        if not self.check_user_exists():
            if not self.create_user_account():
                print("\nNote: User account creation failed. Patient may need manual account creation.")
                # Continue anyway - we can test with admin fallback

        # Step 5: Create sample data
        self.create_sample_appointments()
        self.create_sample_prescriptions()
        self.create_sample_invoices()

        print("\n" + "="*60)
        print("Seeding Complete!")
        print("="*60)
        print(f"\nTest Patient: {TEST_PATIENT['email']}")
        print(f"Password: {TEST_PATIENT['password']}")
        print(f"Patient ID: {self.patient_id}")
        print(f"User ID: {self.user_id or 'Not created (use admin fallback)'}")
        print("\nYou can now run the patient portal tests:")
        print("  pytest test_patient_portal.py -v")
        print()

        return True


def main():
    """Main entry point"""
    seeder = PatientPortalSeeder()
    success = seeder.run()
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
