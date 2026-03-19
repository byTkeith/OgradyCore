
import React from 'react';

export const CORE_TABLES = [
  "dbo.v_AI_Omnibus_Forecast_Master",
  "dbo.v_AI_Stock_Catalog",
  "dbo.v_AI_Sales_Truth",
  "dbo.v_AI_Branch_Trends_5Yr",
  "dbo.v_AI_Product_Size_Trends",
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
  "dbo.v_AI_Omnibus_Forecast_Master": {
    description: "OMNIBUS FORECAST MASTER: Every transaction with pre-calculated Momentum (_PrevMonthRev) and Seasonality (_LastYearSameMonthRev). Use for all sales and trend analysis. Handles Delphi Rounding and Fiscal Year logic.",
    primaryKeys: ["InvoiceNumber", "PLUCode", "SiteID"],
    fields: ["SiteID", "TranDate", "FiscalYear", "CalMonth", "InvoiceNumber", "PLUCode", "ProductName", "PackSize", "AccountCode", "BranchName", "SalesRepName", "SalesRepCode", "Quantity", "Revenue", "Cost", "GrossProfit", "_MonthlyRev", "_PrevMonthRev", "_LastYearSameMonthRev", "_RunRate3Month", "SeasonalPerformanceStatus", "MonthlyMomentumStatus"]
  },
  "dbo.v_AI_Stock_Catalog": {
    description: "STOCK CATALOG: Inventory master with costs, departments, and status. Use for stock analysis.",
    primaryKeys: ["StockCode", "SiteID"],
    fields: ["SiteID", "StockCode", "ProductName", "MainDepartment", "SubDepartment", "QuantityOnHand", "UnitCost", "ListPrice", "StockStatus", "LastSoldDate", "LastPurchasedDate"]
  },
  "dbo.v_AI_Sales_Truth": {
    description: "MASTER ENGINE: Sales, Net Qty, Costs, Customers, Pack Sizes, Sales Reps. Fiscal Year logic applied.",
    primaryKeys: ["InvoiceNumber", "PLUCode"],
    fields: ["SiteID", "TranDate", "FiscalYear", "InvoiceNumber", "PLUCode", "ProductName", "PackSize", "AccountCode", "CustomerName", "SalesRepName", "NetQty", "NetSalesExclVAT", "NetCost"]
  },
  "dbo.v_AI_Branch_Trends_5Yr": {
    description: "BRANCH TRENDS: Year-over-Year performance comparison for branches and regions.",
    primaryKeys: ["SiteID", "BranchName", "FiscalYear"],
    fields: ["SiteID", "AccountCode", "BranchName", "SalesRepName", "FiscalYear", "CurrentYearRevenue", "CurrentRev", "PreviousYearRevenue", "PrevRev", "RevenueVariance", "PerformanceStatus"]
  },
  "dbo.v_AI_Product_Size_Trends": {
    description: "PRODUCT TRENDS: Performance by pack size, product, and region over fiscal years.",
    primaryKeys: ["SiteID", "BranchName", "ProductName", "PackSize", "FiscalYear"],
    fields: ["SiteID", "BranchName", "SalesRepName", "ProductName", "PackSize", "FiscalYear", "CurrentYearQty", "CurrentQty", "PreviousYearQty", "PrevQty", "QtyVariance", "CurrentYearRevenue", "CurrentRev", "PreviousYearRevenue", "PrevRev", "RevenueVariance", "ProductTrend"]
  },
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
export const DEFAULT_BRIDGE_URL = 'https://unpanoplied-marianne-ciliately.ngrok-free.dev';
