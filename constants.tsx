
import React from 'react';

export const CORE_TABLES = [
  "dbo.v_AI_Omnibus_Master_Truth",
  "dbo.v_AI_Omnibus_Forecast_Master",
  "dbo.v_AI_Omnibus_Comparison",
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
  "dbo.v_AI_Omnibus_Master_Truth": {
    description: "THE MASTER TRUTH: The single source of truth for all BI analysis. Includes historical audits, trends, and forecasting. Replaces all previous views.",
    primaryKeys: ["BranchName", "SalesRepName", "ProductName", "TimeKey"],
    fields: ["BranchName", "SalesRepName", "ProductName", "TimeKey", "Period", "FiscalYear", "MonthlyRevenue", "Revenue", "ActualRevenue", "MonthlyQty", "LastYearRevenue", "PrevYearRev", "ProjectedRunRate", "CurrentRunRate", "Momentum", "MomentumStatus", "PerformanceStatus", "InvoiceNumber", "TranDate", "NetCost", "GrossProfit"]
  },
  "dbo.v_AI_Omnibus_Forecast_Master": {
    description: "FORECASTING ENGINE: Predictive intelligence using TimeKey (YYYYMM). Includes Period (Label), MonthlyRevenue, MonthlyQty, PrevMonthRev, LastYearRevenue (Seasonality), ProjectedRunRate (Momentum), Momentum (Numeric change), and MomentumStatus (Improving/Declining). Use for all future projections.",
    primaryKeys: ["BranchName", "SalesRepName", "ProductName", "TimeKey"],
    fields: ["BranchName", "SalesRepName", "ProductName", "TimeKey", "Period", "MonthlyRevenue", "MonthlyQty", "PrevMonthRev", "LastYearRevenue", "ProjectedRunRate", "Momentum", "MomentumStatus", "PerformanceStatus", "SuggestedWeeklySafetyStock", "LastYearSameMonthQty", "QuantityRunRate"]
  },
  "dbo.v_AI_Omnibus_Comparison": {
    description: "COMPARISON ENGINE: Year-over-Year performance analysis. Includes AnnualRev, AnnualQty, PrevYearRev, RevenueVariance, and GrowthPercentage. Use for CEO-level trend comparisons.",
    primaryKeys: ["BranchName", "SalesRepName", "ProductName", "FiscalYear"],
    fields: ["BranchName", "SalesRepName", "ProductName", "FiscalYear", "AnnualRev", "AnnualQty", "PrevYearRev", "PrevYearQty", "RevenueVariance", "GrowthPercentage"]
  },
  "dbo.v_AI_Stock_Catalog": {
    description: "STOCK CATALOG: Inventory master with costs, departments, and status. Use for stock analysis.",
    primaryKeys: ["StockCode", "SiteID"],
    fields: ["SiteID", "StockCode", "ProductName", "MainDepartment", "SubDepartment", "QuantityOnHand", "UnitCost", "ListPrice", "StockStatus", "LastSoldDate", "LastPurchasedDate"]
  },
  "dbo.v_AI_Sales_Truth": {
    description: "CORE TRUTH ENGINE: The foundation for all other views. Handles Delphi rounding, tax flags, and compound discounts. Includes TimeKey (YYYYMM) for chronological grouping.",
    primaryKeys: ["InvoiceNumber", "PLUCode"],
    fields: ["SiteID", "TranDate", "FiscalYear", "CalYear", "CalMonth", "TimeKey", "InvoiceNumber", "PLUCode", "ProductName", "PackSize", "AccountCode", "BranchName", "SalesRepName", "NetQty", "Revenue", "NetCost"]
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
