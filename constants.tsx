
import React from 'react';

/**
 * PRODUCTION SCHEMA MAP for Ultisales
 * REVISED v2.6: Fixed 'Barcode' -> 'PLUCode' based on database feedback.
 */
export const SCHEMA_MAP = {
  "dbo.AUDIT": {
    description: "Primary transactional detail table.",
    primaryKeys: ["ANUMBER", "LineGUID"],
    fields: [
      "ANUMBER", "PLUCode", "Description", "TransactionDate", "Qty", 
      "CostPriceExcl", "RetailPriceExcl", "TransactionNumber", 
      "DebtorOrCreditorNumber", "TransactionType", "TaxValue", "Operator"
    ],
    joins: {
      "dbo.STOCK": "dbo.AUDIT.PLUCode = dbo.STOCK.PLUCode",
      "dbo.TYPES": "dbo.AUDIT.TransactionType = CAST(dbo.TYPES.TYPE_ID AS INT) AND dbo.TYPES.TABLE_NAME = 'AUDIT'",
      "dbo.DEBTOR": "dbo.AUDIT.DebtorOrCreditorNumber = dbo.DEBTOR.ANUMBER"
    }
  },
  "dbo.STOCK": {
    description: "Inventory Master table.",
    primaryKeys: ["PLUCode"], // Changed from Barcode based on error report
    fields: ["PLUCode", "Description", "CostPriceExcl", "RetailPriceExcl", "OnHand", "StockType", "Status"],
    joins: {
      "dbo.TYPES": "dbo.STOCK.StockType = CAST(dbo.TYPES.TYPE_ID AS INT) AND dbo.TYPES.TABLE_NAME = 'STOCK'"
    }
  },
  "dbo.TYPES": {
    description: "Metadata Lookup Table (ID to Description).",
    fields: ["TABLE_NAME", "TYPE_NAME", "TYPE_ID", "TYPE_DESCRIPTION"],
    usageNotes: "Use for translating TransactionType or StockType IDs."
  },
  "dbo.DEBTOR": {
    description: "Customer accounts.",
    fields: ["ANUMBER", "Number", "Surname", "Status", "AccountType"]
  }
};

export const MOCK_CHART_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
export const DEFAULT_BRIDGE_URL = 'https://unpanoplied-marianne-ciliately.ngrok-free.dev';
