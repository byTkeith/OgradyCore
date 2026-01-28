
import React from 'react';

/**
 * PRODUCTION SCHEMA MAP for Ultisales
 * CRITICAL: All table names MUST have 'dbo.' prefix and be UPPERCASE.
 */
export const SCHEMA_MAP = {
  "dbo.AUDIT": {
    description: "Transactional log for all sales and purchases. Use this for revenue, quantity, and trend analysis.",
    fields: [
      "ANUMBER", "LineGUID", "HeadGuid", "PLUCode", "Description", 
      "TransactionDate", "TransactionTime", "Qty", "CostPriceExcl", 
      "RetailPriceExcl", "TransactionNumber", "DebtorOrCreditorNumber",
      "StockType", "OrderDate", "Operator", "TaxValue", "TaxRate"
    ],
    primaryKey: "LineGUID",
    joins: {
      "dbo.DEBTOR": "dbo.AUDIT.DebtorOrCreditorNumber = dbo.DEBTOR.ANUMBER",
      "dbo.CREDITOR": "dbo.AUDIT.DebtorOrCreditorNumber = dbo.CREDITOR.ANUMBER",
      "dbo.STOCK": "dbo.AUDIT.PLUCode = dbo.STOCK.PLUCode"
    }
  },
  "dbo.DEBTOR": {
    description: "Client/Customer table. Stores account balances and contact info.",
    fields: [
      "ANUMBER", "Surname", "Title", "Initials", "TelephoneNumber1", 
      "Status", "DebGUID", "PostalAdd1", "PostalCode", "MainAccountNumber"
    ],
    primaryKey: "ANUMBER"
  },
  "dbo.STOCK": {
    description: "Inventory Master. Use this for product descriptions, stock on hand, and current pricing.",
    fields: [
      "PLUCode", "Description", "CostPriceExcl", "RetailPriceExcl", 
      "OnHand", "Barcode", "StockType", "TotalQtySold", "AvgCostPrice", "BIGGRIDVALUE"
    ],
    primaryKey: "PLUCode"
  },
  "dbo.TRANSACTIONS": {
    description: "Financial header summary records.",
    fields: [
      "TransactionNumber", "InvoiceNumber", "InvoiceDate", "InvoicePrice", 
      "TransactionType", "PaidUp", "Branch"
    ],
    primaryKey: "TransactionNumber"
  }
};

export const MOCK_CHART_COLORS = ['#10b981', '#34d399', '#059669', '#047857', '#065f46', '#064e3b'];
