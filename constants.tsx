
import React from 'react';

export const SCHEMA_MAP = {
  tblAudit: {
    description: "The primary transactional audit log. Use this for deep history and price override analysis.",
    fields: [
      "ANUMBER", "LINEGUID", "HEADGUID", "STOCKTYPE", "ORDERDATE", 
      "TRANSACTIONDATE", "PLUCODE", "DESCRIPTION", "TRANSACTIONTYPE", 
      "COSTPRICEEXCL", "RETAILPRICEEXCL", "QTY", "TRANSACTIONNUMBER",
      "DEBTORORCREDITORNUMBER"
    ],
    primaryKey: "LINEGUID",
    joins: {
      tblClients: "tblAudit.DEBTORORCREDITORNUMBER = tblClients.ANUMBER",
      tblStock: "tblAudit.PLUCODE = tblStock.PLUCODE",
      tblInvoices: "tblAudit.TRANSACTIONNUMBER = tblInvoices.TRANSACTIONNUMBER"
    }
  },
  tblClients: {
    description: "Client/Debtor information containing names, addresses, and terms.",
    fields: ["ANUMBER", "NAME_ADRES_1", "ACCOUNTTYPE", "DEBTORTYPE", "PREFERREDLANGUAGE"],
    primaryKey: "ANUMBER",
    joins: {
      tblInvoices: "tblClients.ANUMBER = tblInvoices.ANUMBER"
    }
  },
  tblInvoices: {
    description: "Header information for all debtor and creditor invoices/transactions.",
    fields: ["ANUMBER", "TRANSACTIONNUMBER", "INVOICENUMBER", "INVOICEDATE", "INVOICEPRICE", "TRANSACTIONTYPE"],
    primaryKey: "TRANSACTIONNUMBER"
  },
  tblStock: {
    description: "Inventory/Stock table containing levels and item details.",
    fields: ["PLUCODE", "DESCRIPTION", "BIGGRIDVALUE", "VOORGRIDX"],
    primaryKey: "PLUCODE"
  }
};

export const MOCK_CHART_COLORS = ['#10b981', '#34d399', '#059669', '#047857', '#065f46', '#064e3b'];
