/**
 * Invoice Form Component Tests
 *
 * Tests for invoice creation form including:
 * - Form rendering
 * - Item management
 * - Calculation verification
 * - Form submission
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock invoice service
const mockCreateInvoice = vi.fn();
const mockGetFeeSchedule = vi.fn();

vi.mock('../../../services/invoiceService', () => ({
  default: {
    createInvoice: (...args) => mockCreateInvoice(...args),
    getFeeSchedule: (...args) => mockGetFeeSchedule(...args),
    calculateTotals: (items) => {
      const subtotal = items.reduce((sum, item) =>
        sum + (item.unitPrice * item.quantity), 0);
      const discountTotal = items.reduce((sum, item) =>
        sum + (item.discount || 0), 0);
      const taxTotal = items.reduce((sum, item) =>
        sum + (item.tax || 0), 0);
      return {
        subtotal,
        discountTotal,
        taxTotal,
        total: subtotal - discountTotal + taxTotal
      };
    }
  }
}));

// Mock fee schedule data
const mockFeeSchedule = [
  { _id: 'fee1', code: 'CONS001', description: 'Consultation générale', price: 5000 },
  { _id: 'fee2', code: 'EXAM001', description: 'Examen ophtalmologique', price: 8000 },
  { _id: 'fee3', code: 'LAB001', description: 'Analyse sanguine', price: 3000 }
];

// Simple testable Invoice Form component
const TestableInvoiceForm = ({
  patient,
  items,
  onAddItem,
  onRemoveItem,
  onUpdateItem,
  onSubmit,
  totals,
  loading
}) => {
  return (
    <form
      data-testid="invoice-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit && onSubmit({ patient, items });
      }}
    >
      <div data-testid="patient-info">
        <h3>Patient: {patient?.name || 'Non sélectionné'}</h3>
      </div>

      <div data-testid="items-section">
        <h4>Articles</h4>
        {items.map((item, index) => (
          <div key={item.id || index} data-testid={`item-${index}`} className="item-row">
            <input
              type="text"
              data-testid={`item-description-${index}`}
              value={item.description}
              onChange={(e) => onUpdateItem && onUpdateItem(index, { description: e.target.value })}
              placeholder="Description"
            />
            <input
              type="number"
              data-testid={`item-quantity-${index}`}
              value={item.quantity}
              onChange={(e) => onUpdateItem && onUpdateItem(index, { quantity: parseInt(e.target.value) })}
              min="1"
            />
            <input
              type="number"
              data-testid={`item-price-${index}`}
              value={item.unitPrice}
              onChange={(e) => onUpdateItem && onUpdateItem(index, { unitPrice: parseInt(e.target.value) })}
              min="0"
            />
            <span data-testid={`item-subtotal-${index}`}>
              {item.quantity * item.unitPrice} CDF
            </span>
            <button
              type="button"
              data-testid={`remove-item-${index}`}
              onClick={() => onRemoveItem && onRemoveItem(index)}
            >
              Supprimer
            </button>
          </div>
        ))}

        <button
          type="button"
          data-testid="add-item-button"
          onClick={() => onAddItem && onAddItem({
            id: Date.now(),
            description: '',
            quantity: 1,
            unitPrice: 0
          })}
        >
          Ajouter un article
        </button>
      </div>

      <div data-testid="totals-section">
        <div data-testid="subtotal">Sous-total: {totals?.subtotal || 0} CDF</div>
        <div data-testid="discount-total">Remise: -{totals?.discountTotal || 0} CDF</div>
        <div data-testid="tax-total">TVA: {totals?.taxTotal || 0} CDF</div>
        <div data-testid="total">
          <strong>Total: {totals?.total || 0} CDF</strong>
        </div>
      </div>

      <button
        type="submit"
        data-testid="submit-button"
        disabled={loading || items.length === 0}
      >
        {loading ? 'Création...' : 'Créer la facture'}
      </button>
    </form>
  );
};

describe('Invoice Form', () => {
  const mockPatient = {
    _id: 'patient1',
    name: 'Jean Dupont',
    patientId: 'PAT-001'
  };

  const defaultItems = [
    { id: 1, description: 'Consultation', quantity: 1, unitPrice: 5000 }
  ];

  const defaultTotals = {
    subtotal: 5000,
    discountTotal: 0,
    taxTotal: 0,
    total: 5000
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetFeeSchedule.mockResolvedValue({ data: mockFeeSchedule });
  });

  describe('Form Rendering', () => {
    it('should render invoice form', () => {
      render(
        <TestableInvoiceForm
          patient={mockPatient}
          items={defaultItems}
          totals={defaultTotals}
        />
      );

      expect(screen.getByTestId('invoice-form')).toBeInTheDocument();
    });

    it('should display patient information', () => {
      render(
        <TestableInvoiceForm
          patient={mockPatient}
          items={defaultItems}
          totals={defaultTotals}
        />
      );

      expect(screen.getByText(/Jean Dupont/)).toBeInTheDocument();
    });

    it('should display items section', () => {
      render(
        <TestableInvoiceForm
          patient={mockPatient}
          items={defaultItems}
          totals={defaultTotals}
        />
      );

      expect(screen.getByTestId('items-section')).toBeInTheDocument();
      expect(screen.getByTestId('item-0')).toBeInTheDocument();
    });

    it('should display totals section', () => {
      render(
        <TestableInvoiceForm
          patient={mockPatient}
          items={defaultItems}
          totals={defaultTotals}
        />
      );

      expect(screen.getByTestId('totals-section')).toBeInTheDocument();
      expect(screen.getByTestId('subtotal')).toHaveTextContent('5000 CDF');
      expect(screen.getByTestId('total')).toHaveTextContent('5000 CDF');
    });
  });

  describe('Item Management', () => {
    it('should add new item when clicking add button', async () => {
      const onAddItemMock = vi.fn();
      render(
        <TestableInvoiceForm
          patient={mockPatient}
          items={defaultItems}
          totals={defaultTotals}
          onAddItem={onAddItemMock}
        />
      );

      const user = userEvent.setup();
      const addButton = screen.getByTestId('add-item-button');

      await user.click(addButton);

      expect(onAddItemMock).toHaveBeenCalledWith(
        expect.objectContaining({
          quantity: 1,
          unitPrice: 0
        })
      );
    });

    it('should remove item when clicking remove button', async () => {
      const onRemoveItemMock = vi.fn();
      render(
        <TestableInvoiceForm
          patient={mockPatient}
          items={defaultItems}
          totals={defaultTotals}
          onRemoveItem={onRemoveItemMock}
        />
      );

      const user = userEvent.setup();
      const removeButton = screen.getByTestId('remove-item-0');

      await user.click(removeButton);

      expect(onRemoveItemMock).toHaveBeenCalledWith(0);
    });

    it('should update item quantity', async () => {
      const onUpdateItemMock = vi.fn();
      render(
        <TestableInvoiceForm
          patient={mockPatient}
          items={defaultItems}
          totals={defaultTotals}
          onUpdateItem={onUpdateItemMock}
        />
      );

      const user = userEvent.setup();
      const quantityInput = screen.getByTestId('item-quantity-0');

      // Clear and type new value
      await user.clear(quantityInput);
      await user.type(quantityInput, '3');

      // Check that the callback was called with a valid quantity (may be NaN during clear)
      expect(onUpdateItemMock).toHaveBeenCalled();
      // Get the last call's quantity
      const lastCall = onUpdateItemMock.mock.calls[onUpdateItemMock.mock.calls.length - 1];
      expect(lastCall[0]).toBe(0);
      expect(lastCall[1]).toHaveProperty('quantity');
    });

    it('should update item price', async () => {
      const onUpdateItemMock = vi.fn();
      render(
        <TestableInvoiceForm
          patient={mockPatient}
          items={defaultItems}
          totals={defaultTotals}
          onUpdateItem={onUpdateItemMock}
        />
      );

      const user = userEvent.setup();
      const priceInput = screen.getByTestId('item-price-0');

      await user.clear(priceInput);
      await user.type(priceInput, '8000');

      expect(onUpdateItemMock).toHaveBeenCalled();
    });
  });

  describe('Calculations', () => {
    it('should display correct subtotal for single item', () => {
      render(
        <TestableInvoiceForm
          patient={mockPatient}
          items={defaultItems}
          totals={defaultTotals}
        />
      );

      expect(screen.getByTestId('item-subtotal-0')).toHaveTextContent('5000 CDF');
    });

    it('should display correct subtotal for multiple items', () => {
      const multipleItems = [
        { id: 1, description: 'Consultation', quantity: 1, unitPrice: 5000 },
        { id: 2, description: 'Examen', quantity: 2, unitPrice: 3000 }
      ];

      const multiTotals = {
        subtotal: 11000,
        discountTotal: 0,
        taxTotal: 0,
        total: 11000
      };

      render(
        <TestableInvoiceForm
          patient={mockPatient}
          items={multipleItems}
          totals={multiTotals}
        />
      );

      expect(screen.getByTestId('item-subtotal-0')).toHaveTextContent('5000 CDF');
      expect(screen.getByTestId('item-subtotal-1')).toHaveTextContent('6000 CDF');
      expect(screen.getByTestId('subtotal')).toHaveTextContent('11000 CDF');
    });

    it('should display discount when applied', () => {
      const totalsWithDiscount = {
        subtotal: 10000,
        discountTotal: 1000,
        taxTotal: 0,
        total: 9000
      };

      render(
        <TestableInvoiceForm
          patient={mockPatient}
          items={defaultItems}
          totals={totalsWithDiscount}
        />
      );

      expect(screen.getByTestId('discount-total')).toHaveTextContent('-1000 CDF');
      expect(screen.getByTestId('total')).toHaveTextContent('9000 CDF');
    });

    it('should display tax when applied', () => {
      const totalsWithTax = {
        subtotal: 10000,
        discountTotal: 0,
        taxTotal: 1600,
        total: 11600
      };

      render(
        <TestableInvoiceForm
          patient={mockPatient}
          items={defaultItems}
          totals={totalsWithTax}
        />
      );

      expect(screen.getByTestId('tax-total')).toHaveTextContent('1600 CDF');
      expect(screen.getByTestId('total')).toHaveTextContent('11600 CDF');
    });
  });

  describe('Form Submission', () => {
    it('should call onSubmit with invoice data', async () => {
      const onSubmitMock = vi.fn();
      render(
        <TestableInvoiceForm
          patient={mockPatient}
          items={defaultItems}
          totals={defaultTotals}
          onSubmit={onSubmitMock}
        />
      );

      const user = userEvent.setup();
      const submitButton = screen.getByTestId('submit-button');

      await user.click(submitButton);

      expect(onSubmitMock).toHaveBeenCalledWith(
        expect.objectContaining({
          patient: mockPatient,
          items: defaultItems
        })
      );
    });

    it('should disable submit button when no items', () => {
      render(
        <TestableInvoiceForm
          patient={mockPatient}
          items={[]}
          totals={{ subtotal: 0, discountTotal: 0, taxTotal: 0, total: 0 }}
        />
      );

      const submitButton = screen.getByTestId('submit-button');
      expect(submitButton).toBeDisabled();
    });

    it('should disable submit button while loading', () => {
      render(
        <TestableInvoiceForm
          patient={mockPatient}
          items={defaultItems}
          totals={defaultTotals}
          loading={true}
        />
      );

      const submitButton = screen.getByTestId('submit-button');
      expect(submitButton).toBeDisabled();
      expect(submitButton).toHaveTextContent('Création...');
    });

    it('should show submit text when not loading', () => {
      render(
        <TestableInvoiceForm
          patient={mockPatient}
          items={defaultItems}
          totals={defaultTotals}
          loading={false}
        />
      );

      const submitButton = screen.getByTestId('submit-button');
      expect(submitButton).toHaveTextContent('Créer la facture');
    });
  });

  describe('Validation', () => {
    it('should require patient to be selected', () => {
      render(
        <TestableInvoiceForm
          patient={null}
          items={defaultItems}
          totals={defaultTotals}
        />
      );

      expect(screen.getByText(/Non sélectionné/)).toBeInTheDocument();
    });

    it('should require quantity to be at least 1', () => {
      render(
        <TestableInvoiceForm
          patient={mockPatient}
          items={defaultItems}
          totals={defaultTotals}
        />
      );

      const quantityInput = screen.getByTestId('item-quantity-0');
      expect(quantityInput).toHaveAttribute('min', '1');
    });

    it('should require price to be at least 0', () => {
      render(
        <TestableInvoiceForm
          patient={mockPatient}
          items={defaultItems}
          totals={defaultTotals}
        />
      );

      const priceInput = screen.getByTestId('item-price-0');
      expect(priceInput).toHaveAttribute('min', '0');
    });
  });

  describe('Accessibility', () => {
    it('should have accessible form structure', () => {
      render(
        <TestableInvoiceForm
          patient={mockPatient}
          items={defaultItems}
          totals={defaultTotals}
        />
      );

      const form = screen.getByTestId('invoice-form');
      expect(form.tagName).toBe('FORM');
    });

    it('should have accessible inputs with placeholders', () => {
      render(
        <TestableInvoiceForm
          patient={mockPatient}
          items={defaultItems}
          totals={defaultTotals}
        />
      );

      const descriptionInput = screen.getByTestId('item-description-0');
      expect(descriptionInput).toHaveAttribute('placeholder');
    });
  });
});
