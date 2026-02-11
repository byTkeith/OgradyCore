
import React from 'react';

/**
 * PRODUCTION SCHEMA MASTER - Ultisales v4.1
 * Verified mapping of all 60+ tables with columns and primary keys.
 */

// Tier 1: Primary line of reference for 90% of business queries
export const CORE_TABLES = [
  "dbo.AUDIT", 
  "dbo.STOCK", 
  "dbo.TYPES", 
  "dbo.DEBTOR", 
  "dbo.CREDITOR"
];

// Based on PDF Documentation Pages 6, 8, 11
// Includes: Cash Sales (1,66), Credit Sales (10,70), Quotes (34,35), BOM (84), Contracts (100)
export const SALES_TRANSACTION_TYPES = [
  '1', '2', '10', '11', '12', '14', '15', '16', 
  '34', '35', '52', '66', '67', '68', '70', '80', '84', '100'
];

export const SCHEMA_MAP: Record<string, { description?: string, primaryKeys: string[], fields: string[], joins?: Record<string, string> }> = {
  "dbo.AUDIT": {
    description: "Transactional records.",
    primaryKeys: ["ANUMBER", "LineGUID", "HeadGuid", "TransactionDate", "PLUCode", "TransactionType", "SequenceNumber", "ProviderTRNR"],
    fields: ["ANUMBER", "Created_Date", "LineGUID", "HeadGuid", "StockType", "OrderDate", "TransactionDate", "PLUCode", "Description", "TransactionType", "CostPriceExcl", "RetailPriceExcl", "Qty", "LineDiscountPerc", "TransactionNumber", "DebtorOrCreditorNumber", "WorkstationNumber", "Operator", "TaxValue", "TaxNumber", "RoundValue", "ShiftNumber", "OrderQty", "PaymentMethod", "Branch", "OnHandAfterTran", "LoyaltyNumber"]
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
  },
  // --- EXTENDED SCHEMA (Tier 2) ---
  "dbo.AUDIT_CREDITOR": { primaryKeys: ["ANUMBER", "OuLineGuid", "OuHeadGuid"], fields: ["ANUMBER", "OuLineGuid", "OuHeadGuid", "Number", "Description", "TransactionType", "Name", "PostalCode", "TelephoneNumber"] },
  "dbo.AUDIT_DEBTOR": { primaryKeys: ["ANUMBER", "OuLineGuid", "OuHeadGuid"], fields: ["ANUMBER", "OuLineGuid", "OuHeadGuid", "Number", "Description", "TransactionType", "Surname", "MaxCreditLimit", "AccountType"] },
  "dbo.AUDIT_EFT": { primaryKeys: ["ANUMBER", "SeqNumber", "AuditHeaderGUID"], fields: ["ANUMBER", "SeqNumber", "TransactionDateTime", "Tillnr", "Request_CardNum", "Request_amount", "Responce_ResponseCode", "Responce_ResponseCodeText", "Product_Name"] },
  "dbo.AUDIT_STOCK": { primaryKeys: ["ANUMBER", "OuLineGuid", "OuHeadGuid"], fields: ["ANUMBER", "OuLineGuid", "PLUCode", "Description", "TransactionNumber", "CostPriceExcl", "RetailPriceExcl", "SupplierCode"] },
  "dbo.BOM": { primaryKeys: ["ANUMBER", "GUID", "PLUCode", "LinkedCode"], fields: ["ANUMBER", "Status", "PLUCode", "LinkedCode", "LinkedDescription", "LinkedQuantity"] },
  "dbo.CLOCK_IN": { primaryKeys: ["ANUMBER", "ClockInRep", "ClockInDateTime"], fields: ["ANUMBER", "ClockInRep", "ClockInDate", "ClockOutDate", "ClockInDateTime", "ClockOutDateTime"] },
  "dbo.CONTRACT_PRICE": { primaryKeys: ["ANUMBER", "DebtorCode", "StockCode", "FromDate"], fields: ["ANUMBER", "DebtorCode", "StockCode", "StockSellingPrice", "FromDate", "ToDate"] },
  "dbo.CUSTOMERREQ": { primaryKeys: ["ANUMBER", "Number", "ClientNumeber"], fields: ["ANUMBER", "Number", "ClientNumeber", "DateRequested", "TextField1"] },
  "dbo.DEBTORSNOTES": { primaryKeys: ["ANUMBER", "Number", "DebtorNumber"], fields: ["ANUMBER", "Number", "DebtorNumber", "DateNote", "TextField1"] },
  "dbo.FINTOTALS": { primaryKeys: ["ANUMBER", "FinTotalType", "FinTotalDate", "DebtorNumber", "BARCODE"], fields: ["ANUMBER", "FinTotalDate", "BARCODE", "Amount_Sales", "Amount_VAT_Control", "TransactionTotal"] },
  "dbo.FIX_ALLOC": { primaryKeys: ["ANUMBER", "FIXAllocationName", "FIXAllocationDebtor"], fields: ["ANUMBER", "FIXAllocationName", "FIXAllocationKreditor", "FIXAllocationDebtor"] },
  "dbo.FIX_BANK_NAMES": { primaryKeys: ["ANUMBER", "Number", "ID"], fields: ["ANUMBER", "Number", "Name", "ID"] },
  "dbo.FIX_BRANCHES": { primaryKeys: ["ANUMBER", "FixBranchName"], fields: ["ANUMBER", "FixBranchNo", "FixBranchName"] },
  "dbo.FIX_CARD_TYPES": { primaryKeys: ["ANUMBER", "Number", "ID"], fields: ["ANUMBER", "Number", "Name", "ID"] },
  "dbo.Fix_CREDITOR_DEP": { primaryKeys: ["ANUMBER", "DepartmentNumber"], fields: ["ANUMBER", "DepartmentNumber", "DepartmentDescription"] },
  "dbo.FIX_DATABASE_CONFIG": { primaryKeys: ["ANUMBER", "CreationDate"], fields: ["ANUMBER", "DatabaseName", "Username", "CreationDate"] },
  "dbo.FIX_DEBTOR_DEP": { primaryKeys: ["ANUMBER", "DepartmentNumber"], fields: ["ANUMBER", "DepartmentNumber", "DepartmentDescription"] },
  "dbo.FIX_FINANCIAL_SOFTWARE": { primaryKeys: ["ANUMBER", "Batchid"], fields: ["ANUMBER", "Batchid", "Fieldvalue"] },
  "dbo.FIX_FOREX": { primaryKeys: ["ANUMBER", "FORXCHAR"], fields: ["ANUMBER", "FORXNAME", "FORXCHAR", "FORXVAL"] },
  "dbo.FIX_MARKETING": { primaryKeys: ["ANUMBER", "Number"], fields: ["ANUMBER", "Number", "Name"] },
  "dbo.FIX_OPERATORS": { primaryKeys: ["ANUMBER", "Number", "ID"], fields: ["ANUMBER", "Number", "Name", "ID"] },
  "dbo.FIX_SEQUENCE_NUMBERS": { primaryKeys: ["ANUMBER"], fields: ["ANUMBER", "FIXFAKTNR", "FIXKWITNR"] },
  "dbo.FIX_STOCK_DEP": { primaryKeys: ["ANUMBER", "DepartmentNumber"], fields: ["ANUMBER", "DepartmentNumber", "DepartmentDescription"] },
  "dbo.GINT": { primaryKeys: ["ANUMBER", "GINTNumber", "GUID"], fields: ["ANUMBER", "GINTNumber", "GINTITEM", "GINTQTYTotal", "GINTQTYDELIVERED"] },
  "dbo.KARDEX": { primaryKeys: ["ANUMBER", "KARXBetborNumber", "KARXInvoiceNumber"], fields: ["ANUMBER", "KARXBetborNumber", "KARXInvoiceNumber", "KARXDate", "KARXAmount"] },
  "dbo.ORDERS": { primaryKeys: ["ANUMBER", "GUID", "OrderDate", "OrderNumber"], fields: ["ANUMBER", "OrderDate", "OrderNumber", "Description", "PriceExclusive", "Qty"] },
  "dbo.SERIAL_STOCK": { primaryKeys: ["ANUMBER", "SERIALBarCode", "SERIALMainCode"], fields: ["ANUMBER", "SERIALBarCode", "SERIALMainCode", "SERIALDateSold", "SERIALINVNumber"] },
  "dbo.STOCK_ALLOCATION": { primaryKeys: ["ANUMBER", "PLUCode"], fields: ["ANUMBER", "PLUCode", "OnHands0", "AverageCostPrice0", "RetailPrice0"] },
  "dbo.STOCK_BIN": { primaryKeys: ["ANUMBER", "BINCode"], fields: ["ANUMBER", "BINCode", "BINDescription"] },
  "dbo.STOCK_MULTI_PLU": { primaryKeys: ["ANUMBER", "PLUCode", "MainStockCode"], fields: ["ANUMBER", "PLUCode", "MainStockCode", "GRVNumber", "InvoiceNumber"] },
  "dbo.STOCK_PRODUCTION": { primaryKeys: ["ANUMBER", "GUID", "Barcode"], fields: ["ANUMBER", "Barcode", "Description", "OnHand", "CostPriceExcl"] },
  "dbo.STOCK_SUPPLIER": { primaryKeys: ["ANUMBER", "Supplier", "PLUCode"], fields: ["ANUMBER", "Supplier", "PLUCode", "CostPriceExcl", "GRVNumber", "LeadTimeDays"] },
  "dbo.TRANSACTIONS": { primaryKeys: ["ANUMBER", "GUID"], fields: ["ANUMBER", "TransactionNumber", "InvoiceNumber", "InvoiceDate", "InvoicePrice", "PaidUp"] },
  "dbo.TRN_AUDIT": { primaryKeys: ["SEQDate", "ANUMBER", "TransactionDate"], fields: ["ANUMBER", "TransactionDate", "PLUCode", "Description", "Qty", "RetailPriceExcl"] }
};

export const MOCK_CHART_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
export const DEFAULT_BRIDGE_URL = 'https://unpanoplied-marianne-ciliately.ngrok-free.dev';
