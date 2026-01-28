
import React from 'react';

/**
 * PRODUCTION SCHEMA MAP for Ultisales
 * ALL TABLES REQUIRE 'dbo.' PREFIX AND MUST BE UPPERCASE.
 */
export const SCHEMA_MAP = {
  "dbo.AUDIT": {
    description: "Line-level transactional data. Use for sales history, quantity, and daily performance.",
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
    description: "Client account database.",
    fields: [
      "ANUMBER", "Surname", "Title", "Initials", "TelephoneNumber1", 
      "Status", "DebGUID", "PostalAdd1", "PostalCode", "MainAccountNumber"
    ],
    primaryKey: "ANUMBER"
  },
  "dbo.STOCK": {
    description: "Product Master. Contains stock levels and product descriptions.",
    fields: [
      "PLUCode", "Description", "CostPriceExcl", "RetailPriceExcl", 
      "OnHand", "Barcode", "StockType", "TotalQtySold", "AvgCostPrice", "BIGGRIDVALUE"
    ],
    primaryKey: "PLUCode"
  },
  "dbo.TRANSACTIONS": {
    description: "Header summary records for invoices and payments.",
    fields: [
      "TransactionNumber", "InvoiceNumber", "InvoiceDate", "InvoicePrice", 
      "TransactionType", "PaidUp", "Branch"
    ],
    primaryKey: "TransactionNumber"
  }
};

export const MOCK_CHART_COLORS = ['#10b981', '#34d399', '#059669', '#047857', '#065f46', '#064e3b'];
