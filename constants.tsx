
import React from 'react';

export const CORE_TABLES = [
  "dbo.AUDIT", 
  "dbo.STOCK", 
  "dbo.TYPES", 
  "dbo.DEBTOR", 
  "dbo.CREDITOR",
  "dbo.TRANSACTIONS",
  "dbo.ORDERS"
];

export const SALES_TRANSACTION_TYPES = [
  '66', '67', '68', '70', '84', '100', '101', '102', '118'
];

export const SCHEMA_MAP: Record<string, { description?: string, primaryKeys: string[], fields: string[], joins?: Record<string, string> }> = {
  "dbo.AUDIT": {
    description: "Main transaction ledger. Join to STOCK on Description+ANUMBER due to barcode inconsistency.",
    primaryKeys: ["ANUMBER", "LineGUID", "HeadGuid", "TransactionDate", "PLUCode", "TransactionType", "SequenceNumber"],
    fields: ["ANUMBER", "Created_Date", "LineGUID", "HeadGuid", "StockType", "OrderDate", "TransactionDate", "PLUCode", "Description", "TransactionType", "CostPriceExcl", "RetailPriceExcl", "Qty", "LineDiscountPerc", "HeadDiscountPerc", "TransactionNumber", "DebtorOrCreditorNumber", "WorkstationNumber", "Operator", "TaxValue", "TaxNumber", "RoundValue", "ShiftNumber", "OrderQty", "PaymentMethod", "Branch", "OnHandAfterTran", "LoyaltyNumber"]
  },
  "dbo.STOCK": {
    description: "Inventory master. Use ANUMBER for branch-specific pricing.",
    primaryKeys: ["ANUMBER", "GUID", "Barcode"],
    fields: ["ANUMBER", "Status", "GUID", "Barcode", "Description", "Description2", "SupplierNumber", "CostPriceExcl", "RetailPriceExcl", "DangerLevel", "OnHand", "DebtorOnOrder", "CreditorOnOrder", "TotalPurchased", "AvgCostPrice", "TotalQtySold", "AvgRetailPrice", "MarkUpPercentage", "LastSoldDate", "LastPurchasedDate", "StockType", "TaxType", "TaxRate"]
  },
  "dbo.DEBTOR": {
    description: "Customer master. Join on Number + ANUMBER.",
    primaryKeys: ["ANUMBER", "DebGUID", "Number"],
    fields: ["ANUMBER", "Status", "DebGUID", "Number", "Title", "Initials", "Surname", "AccountType", "MaxCreditLimit", "ExpiryDate", "LastTransaction", "SalesRep", "EmailAddress"]
  }
};

export const MOCK_CHART_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
export const DEFAULT_BRIDGE_URL = '';
