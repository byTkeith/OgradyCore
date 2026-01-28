
import React from 'react';

/**
 * PRODUCTION SCHEMA MAP for Ultisales
 * VERIFIED AGAINST USER DATA DICTIONARY:
 * - All table names MUST use 'dbo.' prefix and be UPPERCASE.
 * - dbo.STOCK does NOT have PLUCode. Use 'Barcode' for joins.
 */
export const SCHEMA_MAP = {
  "dbo.AUDIT": {
    description: "Primary transactional audit log. Contains individual sales lines and item movements.",
    primaryKeys: ["ANUMBER", "LineGUID", "HeadGuid", "TransactionDate", "PLUCode", "TransactionType", "SequenceNumber", "ProviderTRNR"],
    fields: [
      "ANUMBER", "LineGUID", "HeadGuid", "PLUCode", "Description", 
      "TransactionDate", "TransactionTime", "Qty", "CostPriceExcl", 
      "RetailPriceExcl", "TransactionNumber", "DebtorOrCreditorNumber",
      "StockType", "OrderDate", "Operator", "TaxValue", "TaxRate", "SequenceNumber", "TransactionType"
    ],
    joins: {
      "dbo.DEBTOR": "dbo.AUDIT.DebtorOrCreditorNumber = dbo.DEBTOR.ANUMBER",
      "dbo.STOCK": "dbo.AUDIT.PLUCode = dbo.STOCK.Barcode",
      "dbo.TRANSACTIONS": "dbo.AUDIT.TransactionNumber = dbo.TRANSACTIONS.TransactionNumber"
    }
  },
  "dbo.STOCK": {
    description: "Inventory Master table. Stores product details and current stock levels.",
    primaryKeys: ["ANUMBER", "GUID", "Barcode"],
    fields: [
      "ANUMBER", "GUID", "Barcode", "Description", "CostPriceExcl", "RetailPriceExcl", 
      "OnHand", "TotalQtySold", "AvgCostPrice", "StockType", "Status"
    ],
    primaryKey: "Barcode"
  },
  "dbo.DEBTOR": {
    description: "Customer/Debtor master database. ANUMBER is the unique internal identifier.",
    primaryKeys: ["ANUMBER", "DebGUID", "Number"],
    fields: [
      "ANUMBER", "DebGUID", "Number", "Surname", "Title", "Initials", 
      "TelephoneNumber1", "Status", "PostalAdd1", "PostalCode", "MainAccountNumber"
    ]
  },
  "dbo.CREDITOR": {
    description: "Supplier/Vendor master database.",
    primaryKeys: ["ANUMBER", "KredGUID", "Number"],
    fields: [
      "ANUMBER", "KredGUID", "Number", "Name", "TelephoneNumber", "Status"
    ]
  },
  "dbo.TRANSACTIONS": {
    description: "Financial header summary records for invoices, receipts, and returns.",
    primaryKeys: ["ANUMBER", "GUID"],
    fields: [
      "ANUMBER", "GUID", "TransactionNumber", "InvoiceNumber", "InvoiceDate", 
      "InvoicePrice", "TransactionType", "PaidUp", "Branch"
    ]
  },
  "dbo.AUDIT_STOCK": {
    description: "Inventory-specific audit records.",
    primaryKeys: ["ANUMBER", "OuLineGuid", "OuHeadGuid"],
    fields: ["ANUMBER", "OuLineGuid", "OuHeadGuid"]
  }
};

export const MOCK_CHART_COLORS = ['#10b981', '#34d399', '#059669', '#047857', '#065f46', '#064e3b'];
