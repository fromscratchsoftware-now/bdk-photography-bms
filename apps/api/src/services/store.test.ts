import { beforeEach, describe, expect, it } from "vitest";
import {
  __resetForTests,
  addInvoicePayment,
  createBankAction,
  createCashTransfer,
  createCustomer,
  createExpense,
  createInvoice,
  createSale,
  decideBankAction,
  decideCashTransfer,
  getAdminCashDashboard,
  getUserCashAtHand,
  listInventory
} from "./store";

beforeEach(() => {
  __resetForTests();
});

describe("In-memory store business rules", () => {
  it("prevents negative stock on sales", () => {
    const initial = listInventory().find(
      (row) => row.shopId === "shop-kampala-main" && row.productId === "prod-board-a4c"
    );
    expect(initial?.quantity).toBe(200);

    expect(() =>
      createSale({
        shopId: "shop-kampala-main",
        userId: "user-sales-1",
        paymentMethod: "CASH",
        lines: [{ productId: "prod-board-a4c", quantity: 201, unitPrice: 2500 }]
      })
    ).toThrow(/Insufficient stock/);
  });

  it("cash at hand increases from cash sales", () => {
    createSale({
      shopId: "shop-kampala-main",
      userId: "user-sales-1",
      paymentMethod: "CASH",
      lines: [{ productId: "prod-board-a4c", quantity: 2, unitPrice: 2500 }]
    });

    expect(getUserCashAtHand("user-sales-1")).toBe(5000);
  });

  it("cash expenses reduce cash at hand and are blocked when insufficient", () => {
    expect(() =>
      createExpense({
        amount: 1000,
        category: "Transport",
        paidBy: "SALESPERSON_CASH",
        recordedByUserId: "user-sales-1"
      })
    ).toThrow(/Insufficient cash at hand/);

    createSale({
      shopId: "shop-kampala-main",
      userId: "user-sales-1",
      paymentMethod: "CASH",
      lines: [{ productId: "prod-board-a4c", quantity: 2, unitPrice: 2500 }]
    });

    createExpense({
      amount: 1200,
      category: "Food",
      notes: "Lunch",
      paidBy: "SALESPERSON_CASH",
      recordedByUserId: "user-sales-1"
    });

    expect(getUserCashAtHand("user-sales-1")).toBe(3800);
  });

  it("approved transfers move cash between users (pending transfers do not)", () => {
    createSale({
      shopId: "shop-kampala-main",
      userId: "user-sales-1",
      paymentMethod: "CASH",
      lines: [{ productId: "prod-board-a4c", quantity: 4, unitPrice: 2500 }]
    });
    expect(getUserCashAtHand("user-sales-1")).toBe(10000);

    const transfer = createCashTransfer({
      senderUserId: "user-sales-1",
      receiverUserId: "user-sales-2",
      amount: 3000
    });
    expect(getUserCashAtHand("user-sales-1")).toBe(10000);
    expect(getUserCashAtHand("user-sales-2")).toBe(0);

    decideCashTransfer(transfer.id, "APPROVED");
    expect(getUserCashAtHand("user-sales-1")).toBe(7000);
    expect(getUserCashAtHand("user-sales-2")).toBe(3000);
  });

  it("approved banking reduces user cash and increases bank cash; admin-bank expenses reduce bank cash", () => {
    createSale({
      shopId: "shop-kampala-main",
      userId: "user-sales-1",
      paymentMethod: "CASH",
      lines: [{ productId: "prod-board-a4c", quantity: 4, unitPrice: 2500 }]
    });

    const action = createBankAction({ userId: "user-sales-1", amount: 4000 });
    decideBankAction(action.id, "APPROVED");

    expect(getUserCashAtHand("user-sales-1")).toBe(6000);
    expect(getAdminCashDashboard().bankCash).toBe(4000);

    createExpense({
      amount: 2500,
      category: "Rent",
      paidBy: "ADMIN_BANK",
      recordedByUserId: "user-admin-1"
    });

    expect(getAdminCashDashboard().bankCash).toBe(1500);
  });

  it("invoice payments update balance and status", () => {
    const customer = createCustomer({
      mobileNumber: "256700000000",
      firstName: "Jane",
      lastName: "Doe"
    });

    const invoice = createInvoice({
      shopId: "shop-kampala-main",
      customerId: customer.id,
      createdByUserId: "user-sales-1",
      status: "ISSUED",
      lines: [{ productId: "prod-board-a4c", quantity: 2, unitPrice: 2500 }],
      notes: "Test invoice"
    });

    expect(invoice.totalAmount).toBe(5000);
    expect(invoice.balance).toBe(5000);
    expect(invoice.status).toBe("ISSUED");

    const first = addInvoicePayment({ invoiceId: invoice.id, amount: 2000, method: "CASH" });
    expect(first.invoice.balance).toBe(3000);
    expect(first.invoice.status).toBe("PARTIALLY_PAID");

    expect(() => addInvoicePayment({ invoiceId: invoice.id, amount: 4000, method: "CASH" })).toThrow(
      /exceeds invoice balance/
    );

    const second = addInvoicePayment({ invoiceId: invoice.id, amount: 3000, method: "CASH" });
    expect(second.invoice.balance).toBe(0);
    expect(second.invoice.status).toBe("PAID");
  });
});

