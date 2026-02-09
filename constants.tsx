
import React from 'react';

/**
 * PRODUCTION SCHEMA MAP for Ultisales
 * ENHANCED WITH DEVELOPER DOCUMENTATION (v2.5):
 * - Incorporates logic from TYPES table for status and transaction resolution.
 */
export const SCHEMA_MAP = {
  "dbo.AUDIT": {
    description: "Primary transactional detail. Join to dbo.TYPES for human-readable transaction names.",
    primaryKeys: ["ANUMBER", "LineGUID", "HeadGuid"],
    fields: [
      "ANUMBER", "PLUCode", "Description", "TransactionDate", "Qty", 
      "CostPriceExcl", "RetailPriceExcl", "TransactionNumber", 
      "DebtorOrCreditorNumber", "TransactionType", "TaxValue", "Operator"
    ],
    joins: {
      "dbo.TYPES": "dbo.AUDIT.TransactionType = CAST(dbo.TYPES.TYPE_ID AS INT) AND dbo.TYPES.TABLE_NAME = 'AUDIT' AND dbo.TYPES.TYPE_NAME = 'TRANSACTIONTYPE'",
      "dbo.STOCK": "dbo.AUDIT.PLUCode = dbo.STOCK.Barcode",
      "dbo.DEBTOR": "dbo.AUDIT.DebtorOrCreditorNumber = dbo.DEBTOR.ANUMBER"
    }
  },
  "dbo.STOCK": {
    description: "Inventory Master. Use dbo.TYPES (TABLE_NAME='STOCK', TYPE_NAME='STOCKTYPE') for status.",
    primaryKeys: ["Barcode"],
    fields: ["Barcode", "Description", "CostPriceExcl", "RetailPriceExcl", "OnHand", "StockType", "Status"],
    joins: {
      "dbo.TYPES": "dbo.STOCK.StockType = CAST(dbo.TYPES.TYPE_ID AS INT) AND dbo.TYPES.TABLE_NAME = 'STOCK' AND dbo.TYPES.TYPE_NAME = 'STOCKTYPE'"
    }
  },
  "dbo.TYPES": {
    description: "Critical Metadata Lookup Table. Translates IDs (TYPE_ID) to Descriptions (TYPE_DESCRIPTION).",
    fields: ["TABLE_ID", "TABLE_NAME", "TYPE_NAME", "TYPE_ID", "TYPE_DESCRIPTION"],
    usageNotes: "Standard join: TABLE_NAME = [ParentTable] AND TYPE_NAME = [FieldRole]"
  },
  "dbo.DEBTOR": {
    description: "Customer Database. Use TYPES (TABLE_NAME='DEBTOR', TYPE_NAME='ACCOUNTTYPE') for classes.",
    fields: ["ANUMBER", "Number", "Surname", "Status", "AccountType", "PostalCode"]
  },
  "dbo.TRANSACTIONS": {
    description: "Header summary records. Use TYPES (TABLE_NAME='TRANSACTIONS', TYPE_NAME='PAIDUP') for payment status.",
    fields: ["TransactionNumber", "InvoiceNumber", "InvoiceDate", "InvoicePrice", "PaidUp"]
  }
};

/**
 * High-contrast professional palette for complex BI reports
 */
export const MOCK_CHART_COLORS = [
  '#10b981', // Emerald
  '#3b82f6', // Blue
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#f97316', // Orange
  '#6366f1', // Indigo
  '#14b8a6', // Teal
  '#84cc16', // Lime
  '#a855f7'  // Purple
];

export const DEFAULT_BRIDGE_URL = 'https://unpanoplied-marianne-ciliately.ngrok-free.dev';
