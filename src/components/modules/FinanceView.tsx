"use client";

import React, { useMemo, useState } from "react";
import { useAgency } from "@/context/AgencyContext";
import {
  convertCurrency,
  CURRENCIES,
  formatCurrency,
  PAYMENT_STATUSES,
} from "@/lib/constants";
import { CurrencyCode, FinanceRecord, PaymentStatus } from "@/types/agency";
import {
  CreditCard,
  Download,
  FileBarChart,
  Lock,
  Plus,
  Receipt,
  Search,
  Trash2,
  X,
} from "lucide-react";

export function FinanceView() {
  const {
    db,
    permissions,
    addFinanceRecord,
    updateFinanceRecord,
    recordInvoicePayment,
    deleteFinanceRecord,
  } = useAgency();

  const defaultCurrency = db.settings.defaultCurrency;
  const todayStr = new Date().toISOString().slice(0, 10);

  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Modals
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [paymentModalRecord, setPaymentModalRecord] =
    useState<FinanceRecord | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  // Payment recording input
  const [payAmountInput, setPayAmountInput] = useState(0);
  const [payMethodInput, setPayMethodInput] = useState("Wire Transfer");

  // New Invoice form
  const emptyInvoiceForm = {
    clientId: db.clients[0]?.id || "",
    projectId: db.projects[0]?.id || "",
    amount: 16000,
    paidAmount: 0,
    currency: defaultCurrency as CurrencyCode,
    transactionType: "Invoice" as FinanceRecord["transactionType"],
    paymentDate: "",
    dueDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    paymentMethod: "Wire Transfer",
    paymentStatus: "Unpaid" as PaymentStatus,
    invoiceNumber: `INV-2026-${Math.floor(110 + Math.random() * 890)}`,
    notes: "Milestone Development & Design System Delivery",
  };
  const [invoiceForm, setInvoiceForm] = useState(emptyInvoiceForm);

  // New Expense form
  const emptyExpenseForm = {
    clientId: "",
    projectId: "",
    amount: 2400,
    paidAmount: 2400,
    currency: defaultCurrency as CurrencyCode,
    transactionType: "Expense" as FinanceRecord["transactionType"],
    expenseCategory: "Cloud Infrastructure & SaaS",
    paymentDate: todayStr,
    dueDate: todayStr,
    paymentMethod: "Corporate Card",
    paymentStatus: "Paid" as PaymentStatus,
    invoiceNumber: `EXP-2026-${Math.floor(50 + Math.random() * 500)}`,
    notes: "",
  };
  const [expenseForm, setExpenseForm] = useState(emptyExpenseForm);

  // Compute all 6 financial KPIs dynamically in defaultCurrency
  const kpis = useMemo(() => {
    const invoices = db.finance.filter((f) => f.transactionType !== "Expense");
    const expenses = db.finance.filter((f) => f.transactionType === "Expense");

    const totalRevenue = invoices.reduce(
      (s, f) => s + convertCurrency(f.amount, f.currency, defaultCurrency),
      0
    );
    const receivedPayments = invoices.reduce(
      (s, f) => s + convertCurrency(f.paidAmount, f.currency, defaultCurrency),
      0
    );
    const currentMonthPrefix = todayStr.slice(0, 7);
    const monthlyRevenue = invoices
      .filter((f) => (f.paymentDate || f.dueDate).startsWith(currentMonthPrefix))
      .reduce(
        (s, f) => s + convertCurrency(f.paidAmount, f.currency, defaultCurrency),
        0
      );
    const pendingPayments = invoices
      .filter((f) => f.paymentStatus !== "Paid" && f.paymentStatus !== "Refunded")
      .reduce(
        (s, f) =>
          s +
          convertCurrency(
            Math.max(0, f.amount - f.paidAmount),
            f.currency,
            defaultCurrency
          ),
        0
      );
    const totalExpenses = expenses.reduce(
      (s, f) => s + convertCurrency(f.amount, f.currency, defaultCurrency),
      0
    );
    const netProfit = receivedPayments - totalExpenses;

    return {
      totalRevenue,
      monthlyRevenue,
      pendingPayments,
      receivedPayments,
      totalExpenses,
      netProfit,
    };
  }, [db.finance, defaultCurrency, todayStr]);

  const filteredRecords = useMemo(() => {
    const q = search.trim().toLowerCase();
    return db.finance.filter((f) => {
      if (clientFilter !== "All" && f.clientId !== clientFilter) return false;
      if (typeFilter !== "All" && f.transactionType !== typeFilter)
        return false;
      if (statusFilter !== "All" && f.paymentStatus !== statusFilter)
        return false;
      const refDate = f.paymentDate || f.dueDate;
      if (dateFrom && refDate < dateFrom) return false;
      if (dateTo && refDate > dateTo) return false;
      if (!q) return true;
      const client = db.clients.find((c) => c.id === f.clientId);
      return (
        f.invoiceNumber.toLowerCase().includes(q) ||
        f.notes.toLowerCase().includes(q) ||
        (client?.businessName.toLowerCase().includes(q) ?? false)
      );
    });
  }, [
    db.finance,
    db.clients,
    search,
    clientFilter,
    typeFilter,
    statusFilter,
    dateFrom,
    dateTo,
  ]);

  if (!permissions.finance) {
    return (
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-10 text-center max-w-lg mx-auto my-12 space-y-3">
        <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto">
          <Lock className="w-5 h-5 text-neutral-500" />
        </div>
        <h2 className="text-base font-semibold">
          Financial &amp; Invoice Data Restricted
        </h2>
        <p className="text-xs text-neutral-500">
          Your current active role does not have permission to access agency revenue, invoices, or payroll records. Switch to an <strong>Admin</strong> or <strong>Manager</strong> profile in the top-right user menu to access Finance.
        </p>
      </div>
    );
  }

  const handleCreateInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    const isPaid = invoiceForm.paymentStatus === "Paid";
    addFinanceRecord({
      ...invoiceForm,
      paidAmount: isPaid ? invoiceForm.amount : invoiceForm.paidAmount,
      paymentDate: isPaid ? todayStr : invoiceForm.paymentDate,
    });
    setIsInvoiceModalOpen(false);
  };

  const handleCreateExpense = (e: React.FormEvent) => {
    e.preventDefault();
    addFinanceRecord(expenseForm);
    setIsExpenseModalOpen(false);
  };

  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModalRecord) return;
    recordInvoicePayment(
      paymentModalRecord.id,
      Number(payAmountInput),
      payMethodInput
    );
    setPaymentModalRecord(null);
  };

  const handleExportFinanceCsv = () => {
    const headers = [
      "Invoice/Ref Number",
      "Transaction Type",
      "Client",
      "Project",
      "Total Amount",
      "Paid Amount",
      "Balance Due",
      "Currency",
      "Payment Status",
      "Payment Method",
      "Payment Date",
      "Due Date",
      "Notes",
    ];
    const rows = filteredRecords.map((f) => {
      const client = db.clients.find((c) => c.id === f.clientId);
      const project = db.projects.find((p) => p.id === f.projectId);
      return [
        f.invoiceNumber,
        f.transactionType,
        client?.businessName || "Twofold Studio Expense",
        project?.projectName || "—",
        String(f.amount),
        String(f.paidAmount),
        String(Math.max(0, f.amount - f.paidAmount)),
        f.currency,
        f.paymentStatus,
        f.paymentMethod,
        f.paymentDate || "—",
        f.dueDate,
        f.notes,
      ];
    });
    const csv = [
      headers.join(","),
      ...rows.map((r) =>
        r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `twofold-studio-finance-${todayStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
            Finance, Invoices &amp; Multi-Currency Ledger
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            All multi-currency transactions (USD, EUR, GBP, CAD, AUD, INR) normalized to {defaultCurrency}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsReportModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50"
          >
            <FileBarChart className="w-3.5 h-3.5" /> Monthly Report
          </button>
          <button
            type="button"
            onClick={handleExportFinanceCsv}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
          <button
            type="button"
            onClick={() => {
              setExpenseForm({
                ...emptyExpenseForm,
                invoiceNumber: `EXP-2026-${Math.floor(50 + Math.random() * 500)}`,
              });
              setIsExpenseModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50"
          >
            <Receipt className="w-3.5 h-3.5" /> Add Expense
          </button>
          <button
            type="button"
            onClick={() => {
              setInvoiceForm({
                ...emptyInvoiceForm,
                invoiceNumber: `INV-2026-${Math.floor(110 + Math.random() * 890)}`,
              });
              setIsInvoiceModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900"
          >
            <Plus className="w-3.5 h-3.5" /> Create Invoice
          </button>
        </div>
      </div>

      {/* 6 Required Finance Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          {
            label: "Total Billed Revenue",
            value: formatCurrency(kpis.totalRevenue, defaultCurrency),
          },
          {
            label: "Monthly Revenue",
            value: formatCurrency(kpis.monthlyRevenue, defaultCurrency),
          },
          {
            label: "Received Payments",
            value: formatCurrency(kpis.receivedPayments, defaultCurrency),
            tone: "text-emerald-600 dark:text-emerald-400",
          },
          {
            label: "Pending Payments",
            value: formatCurrency(kpis.pendingPayments, defaultCurrency),
            tone: "text-amber-600 dark:text-amber-400",
          },
          {
            label: "Total Expenses",
            value: formatCurrency(kpis.totalExpenses, defaultCurrency),
          },
          {
            label: "Net Profit",
            value: formatCurrency(kpis.netProfit, defaultCurrency),
            tone: "text-emerald-600 dark:text-emerald-400",
          },
        ].map((card) => (
          <div
            key={card.label}
            className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-3.5"
          >
            <div className="text-[11px] text-neutral-500">{card.label}</div>
            <div
              className={`text-lg font-semibold mt-1 tabular-nums ${
                card.tone || "text-neutral-900 dark:text-neutral-100"
              }`}
            >
              {card.value}
            </div>
          </div>
        ))}
      </div>

      {/* Filters Bar */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-3.5 flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoice #, client, or notes..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
          />
        </div>

        <select
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          className="px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
        >
          <option value="All">All Clients</option>
          {db.clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.businessName}
            </option>
          ))}
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
        >
          <option value="All">All Transaction Types</option>
          <option value="Invoice">Invoices</option>
          <option value="Expense">Expenses</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
        >
          <option value="All">All Payment Statuses</option>
          {PAYMENT_STATUSES.map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
          title="From Date"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
          title="To Date"
        />
      </div>

      {/* Finance Ledger Table */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-200/80 dark:border-neutral-800 text-[11px] font-medium text-neutral-500 bg-neutral-50/60 dark:bg-neutral-950/50">
                <th className="py-2.5 px-3.5">Invoice / Ref #</th>
                <th className="py-2.5 px-3.5">Type</th>
                <th className="py-2.5 px-3.5">Client &amp; Project</th>
                <th className="py-2.5 px-3.5">Total Amount</th>
                <th className="py-2.5 px-3.5">Paid / Balance</th>
                <th className="py-2.5 px-3.5">Status</th>
                <th className="py-2.5 px-3.5">Due / Paid Date</th>
                <th className="py-2.5 px-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/70 text-xs">
              {filteredRecords.map((rec) => {
                const client = db.clients.find((c) => c.id === rec.clientId);
                const project = db.projects.find((p) => p.id === rec.projectId);
                const balanceDue = Math.max(0, rec.amount - rec.paidAmount);
                return (
                  <tr
                    key={rec.id}
                    className="hover:bg-neutral-50/80 dark:hover:bg-neutral-800/30 transition"
                  >
                    <td className="py-3 px-3.5 font-mono font-semibold text-neutral-900 dark:text-neutral-100">
                      {rec.invoiceNumber}
                      <div className="font-sans text-[11px] font-normal text-neutral-400 truncate max-w-[220px]">
                        {rec.notes}
                      </div>
                    </td>
                    <td className="py-3 px-3.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                          rec.transactionType === "Expense"
                            ? "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
                            : "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                        }`}
                      >
                        {rec.transactionType}
                      </span>
                    </td>
                    <td className="py-3 px-3.5">
                      <div className="font-medium">
                        {client?.businessName ||
                          rec.expenseCategory ||
                          "Studio Expense"}
                      </div>
                      <div className="text-[11px] text-neutral-400">
                        {project?.projectName || rec.paymentMethod}
                      </div>
                    </td>
                    <td className="py-3 px-3.5 font-semibold tabular-nums">
                      {formatCurrency(rec.amount, rec.currency)} ({rec.currency})
                    </td>
                    <td className="py-3 px-3.5 tabular-nums">
                      <div className="text-emerald-600 dark:text-emerald-400 font-medium">
                        Paid: {formatCurrency(rec.paidAmount, rec.currency)}
                      </div>
                      {balanceDue > 0 && (
                        <div className="text-[11px] text-amber-600">
                          Due: {formatCurrency(balanceDue, rec.currency)}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3.5">
                      <select
                        value={rec.paymentStatus}
                        onChange={(e) => {
                          const nextSt = e.target.value as PaymentStatus;
                          updateFinanceRecord(rec.id, {
                            paymentStatus: nextSt,
                            paidAmount:
                              nextSt === "Paid" ? rec.amount : rec.paidAmount,
                            paymentDate:
                              nextSt === "Paid"
                                ? rec.paymentDate || todayStr
                                : rec.paymentDate,
                          });
                        }}
                        className={`px-2 py-1 rounded-md text-[11px] font-medium border ${
                          rec.paymentStatus === "Paid"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800"
                            : rec.paymentStatus === "Overdue"
                            ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800"
                            : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800"
                        }`}
                      >
                        {PAYMENT_STATUSES.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 px-3.5 text-[11px] tabular-nums text-neutral-500">
                      <div>Due: {rec.dueDate}</div>
                      {rec.paymentDate && <div>Paid: {rec.paymentDate}</div>}
                    </td>
                    <td className="py-3 px-3.5 text-right">
                      <div className="inline-flex items-center gap-1">
                        {rec.transactionType !== "Expense" &&
                          rec.paymentStatus !== "Paid" && (
                            <button
                              type="button"
                              onClick={() => {
                                setPaymentModalRecord(rec);
                                setPayAmountInput(
                                  Math.max(0, rec.amount - rec.paidAmount)
                                );
                                setPayMethodInput(rec.paymentMethod);
                              }}
                              className="px-2 py-1 rounded text-[11px] font-medium bg-emerald-600 text-white hover:bg-emerald-500 inline-flex items-center gap-1"
                            >
                              <CreditCard className="w-3 h-3" /> Record Payment
                            </button>
                          )}
                        {permissions.deleteRecords && (
                          <button
                            type="button"
                            onClick={() => deleteFinanceRecord(rec.id)}
                            className="p-1.5 rounded hover:bg-red-50 text-neutral-400 hover:text-red-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE INVOICE MODAL */}
      {isInvoiceModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800 mb-4">
              <h2 className="text-base font-semibold">Create Client Invoice</h2>
              <button
                type="button"
                onClick={() => setIsInvoiceModalOpen(false)}
                className="p-1 rounded-lg hover:bg-neutral-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateInvoice} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1">
                    Invoice Number *
                  </label>
                  <input
                    required
                    value={invoiceForm.invoiceNumber}
                    onChange={(e) =>
                      setInvoiceForm({
                        ...invoiceForm,
                        invoiceNumber: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Currency</label>
                  <select
                    value={invoiceForm.currency}
                    onChange={(e) =>
                      setInvoiceForm({
                        ...invoiceForm,
                        currency: e.target.value as CurrencyCode,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} ({c.symbol}) — {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1">Client</label>
                  <select
                    value={invoiceForm.clientId}
                    onChange={(e) =>
                      setInvoiceForm({
                        ...invoiceForm,
                        clientId: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  >
                    {db.clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.businessName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">Project</label>
                  <select
                    value={invoiceForm.projectId}
                    onChange={(e) =>
                      setInvoiceForm({
                        ...invoiceForm,
                        projectId: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  >
                    {db.projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.projectName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium mb-1">
                    Total Amount *
                  </label>
                  <input
                    type="number"
                    required
                    value={invoiceForm.amount}
                    onChange={(e) =>
                      setInvoiceForm({
                        ...invoiceForm,
                        amount: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">
                    Initial Paid Amount
                  </label>
                  <input
                    type="number"
                    value={invoiceForm.paidAmount}
                    onChange={(e) =>
                      setInvoiceForm({
                        ...invoiceForm,
                        paidAmount: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Status</label>
                  <select
                    value={invoiceForm.paymentStatus}
                    onChange={(e) =>
                      setInvoiceForm({
                        ...invoiceForm,
                        paymentStatus: e.target.value as PaymentStatus,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  >
                    {PAYMENT_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1">Due Date</label>
                  <input
                    type="date"
                    value={invoiceForm.dueDate}
                    onChange={(e) =>
                      setInvoiceForm({
                        ...invoiceForm,
                        dueDate: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">
                    Payment Method
                  </label>
                  <input
                    value={invoiceForm.paymentMethod}
                    onChange={(e) =>
                      setInvoiceForm({
                        ...invoiceForm,
                        paymentMethod: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium mb-1">
                  Invoice Line Items / Notes
                </label>
                <textarea
                  rows={2}
                  value={invoiceForm.notes}
                  onChange={(e) =>
                    setInvoiceForm({ ...invoiceForm, notes: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-200 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setIsInvoiceModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-medium"
                >
                  Issue Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD EXPENSE MODAL */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800 mb-4">
              <h2 className="text-base font-semibold">Record Studio Expense</h2>
              <button
                type="button"
                onClick={() => setIsExpenseModalOpen(false)}
                className="p-1 rounded-lg hover:bg-neutral-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateExpense} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-medium mb-1">
                  Expense Category *
                </label>
                <input
                  required
                  value={expenseForm.expenseCategory}
                  onChange={(e) =>
                    setExpenseForm({
                      ...expenseForm,
                      expenseCategory: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1">Amount *</label>
                  <input
                    type="number"
                    required
                    value={expenseForm.amount}
                    onChange={(e) =>
                      setExpenseForm({
                        ...expenseForm,
                        amount: Number(e.target.value),
                        paidAmount: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Currency</label>
                  <select
                    value={expenseForm.currency}
                    onChange={(e) =>
                      setExpenseForm({
                        ...expenseForm,
                        currency: e.target.value as CurrencyCode,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-medium mb-1">Notes</label>
                <input
                  value={expenseForm.notes}
                  onChange={(e) =>
                    setExpenseForm({ ...expenseForm, notes: e.target.value })
                  }
                  placeholder="Vendor or subscription details..."
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-200 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-medium"
                >
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECORD FULL OR PARTIAL PAYMENT MODAL */}
      {paymentModalRecord && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800 mb-4">
              <div>
                <h2 className="text-base font-semibold">
                  Record Payment ({paymentModalRecord.invoiceNumber})
                </h2>
                <p className="text-xs text-neutral-500">
                  Total: {paymentModalRecord.currency}{" "}
                  {paymentModalRecord.amount.toLocaleString()} · Already Paid:{" "}
                  {paymentModalRecord.currency}{" "}
                  {paymentModalRecord.paidAmount.toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPaymentModalRecord(null)}
                className="p-1 rounded-lg hover:bg-neutral-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-medium mb-1">
                  Payment Amount Received ({paymentModalRecord.currency})
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  max={
                    paymentModalRecord.amount - paymentModalRecord.paidAmount
                  }
                  value={payAmountInput}
                  onChange={(e) => setPayAmountInput(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                />
                <p className="text-[11px] text-neutral-400 mt-1">
                  Enter partial amount to mark Partially Paid, or full remaining balance to mark Paid.
                </p>
              </div>
              <div>
                <label className="block font-medium mb-1">Payment Method</label>
                <input
                  value={payMethodInput}
                  onChange={(e) => setPayMethodInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-200 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setPaymentModalRecord(null)}
                  className="px-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium"
                >
                  Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MONTHLY FINANCIAL REPORT SUMMARY MODAL */}
      {isReportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl max-w-lg w-full p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
              <div>
                <h2 className="text-base font-semibold">
                  Twofold Studio — Monthly Financial Statement
                </h2>
                <p className="text-neutral-500">
                  Generated on {todayStr} · Normalized in {defaultCurrency}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsReportModalOpen(false)}
                className="p-1 rounded-lg hover:bg-neutral-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 p-4 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800">
              <div className="flex justify-between">
                <span className="text-neutral-500">Total Billed Invoices</span>
                <span className="font-semibold">
                  {formatCurrency(kpis.totalRevenue, defaultCurrency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Collected Cash Revenue</span>
                <span className="font-semibold text-emerald-600">
                  {formatCurrency(kpis.receivedPayments, defaultCurrency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">
                  Outstanding / Accounts Receivable
                </span>
                <span className="font-semibold text-amber-600">
                  {formatCurrency(kpis.pendingPayments, defaultCurrency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">
                  Operating &amp; Payroll Expenses
                </span>
                <span className="font-semibold">
                  {formatCurrency(kpis.totalExpenses, defaultCurrency)}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-neutral-200 dark:border-neutral-800 text-sm font-semibold">
                <span>Net Operating Profit</span>
                <span className="text-emerald-600">
                  {formatCurrency(kpis.netProfit, defaultCurrency)}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={handleExportFinanceCsv}
                className="px-3.5 py-2 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-medium inline-flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" /> Download CSV Ledger
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
