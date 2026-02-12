
import React from 'react';

export const CORE_TABLES = [
  "dbo.AUDIT", 
  "dbo.STOCK", 
  "dbo.TYPES", 
  "dbo.DEBTOR", 
  "dbo.CREDITOR"
];

export const SALES_TRANSACTION_TYPES = [
  '1', '2', '10', '11', '12', '14', '15', '16', 
  '34', '35', '52', '66', '67', '68', '70', '80', '84', '100'
];

export const SCHEMA_MAP: Record<string, { description?: string, primaryKeys: string[], fields: string[], joins?: Record<string, string> }> = {
  "dbo.AUDIT": {
    description: "Transactional records.",
    primaryKeys: ["ANUMBER", "LineGUID", "HeadGuid", "TransactionDate", "PLUCode", "TransactionType", "SequenceNumber"],
    fields: ["ANUMBER", "Created_Date", "LineGUID", "HeadGuid", "StockType", "OrderDate", "TransactionDate", "PLUCode", "Description", "TransactionType", "CostPriceExcl", "RetailPriceExcl", "Qty", "LineDiscountPerc", "HeadDiscountPerc", "TransactionNumber", "DebtorOrCreditorNumber", "WorkstationNumber", "Operator", "TaxValue", "TaxNumber", "RoundValue", "ShiftNumber", "OrderQty", "PaymentMethod", "Branch", "OnHandAfterTran", "LoyaltyNumber"]
  },
  "dbo.STOCK": {
    description: "Inventory Master.",
    primaryKeys: ["ANUMBER", "GUID", "Barcode"],
    fields: ["ANUMBER", "Status", "GUID", "Barcode", "Description", "Description2", "SupplierNumber", "CostPriceExcl", "RetailPriceExcl", "DangerLevel", "OnHand", "DebtorOnOrder", "CreditorOnOrder", "TotalPurchased", "AvgCostPrice", "TotalQtySold", "AvgRetailPrice", "MarkUpPercentage", "LastSoldDate", "LastPurchasedDate", "StockType", "TaxType", "TaxRate"]
  },
  "dbo.TYPES": {
    primaryKeys: ["TABLE_ID", "TYPE_NAME_ID", "TYPE_ID"],
    fields: ["TABLE_ID", "TABLE_NAME", "TYPE_NAME_ID", "TYPE_NAME", "TYPE_ID", "TYPE_DESCRIPTION"]
  },
  "dbo.DEBTOR": {
    primaryKeys: ["ANUMBER", "DebGUID", "Number"],
    fields: ["ANUMBER", "Status", "DebGUID", "Number", "Title", "Initials", "Surname", "AccountType", "MaxCreditLimit", "ExpiryDate", "LastTransaction", "SalesRep", "EmailAddress"]
  },
  "dbo.CREDITOR": {
    primaryKeys: ["ANUMBER", "KredGUID", "Number"],
    fields: ["ANUMBER", "Status", "KredGUID", "Number", "Name", "TelephoneNumber", "MaxCreditLimit", "ContactPerson", "EmailAddress", "KredAccStatus"]
  }
};

export const MOCK_CHART_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
export const DEFAULT_BRIDGE_URL = '';
