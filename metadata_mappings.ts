
/**
 * ULTI-SALES ENCYCLOPEDIC MAPPING - v4.4
 * Extracted from SQL Database Maintenance Manual (18 Pages)
 */

export const DOMAIN_MAPPINGS = {
  AUDIT: {
    TRANSACTIONTYPE: {
      "0": "BLANK / DOES NOT EXIST",
      "1": "QUOTE",
      "2": "LINE VOID",
      "3": "REPRINTS",
      "10": "DUMMY FIELD (FLATFILE)",
      "33": "NEW DEBTOR",
      "35": "NEW STOCK",
      "36": "DELETE STOCK",
      "37": "NEW CREDITOR",
      "38": "SPLIT PAYMENT (PURCHASES)",
      "42": "CHANGED STOCK CODE",
      "48": "CREDIT LIMIT CHANGE",
      "49": "STOCK USAGES",
      "50": "STOCK TRANSFER (SAME ALLOC)",
      "51": "STOCK ON HAND CHANGE",
      "52": "SPLIT PAYMENT SALE",
      "53": "STOCK TRANSFER (DIFF ALLOC)",
      "54": "CASH RETURNS (PURCHASES)",
      "55": "CREDIT RETURNS (PURCHASES)",
      "57": "PRICE OVERRIDES (SALES)",
      "64": "DELETE DEBTOR",
      "65": "CASH PURCHASE",
      "66": "CASH SALE",
      "67": "CASH SALE ON SPECIAL",
      "68": "CREDIT SALE ON SPECIAL",
      "69": "CREDIT PURCHASE",
      "70": "CREDIT SALE",
      "71": "DEBTOR DT JOURNAL",
      "72": "DEBTOR CT JOURNAL",
      "73": "DEBTOR PAYMENTS",
      "74": "CREDITOR DT JOURNAL",
      "75": "CREDITOR CT JOURNAL",
      "76": "CREDITOR PAYMENTS",
      "77": "MONTHLY RENT ON DEBTOR",
      "78": "INTER BRANCH TRANSFER (I.B.T)",
      "79": "SALES ALLOCATION",
      "80": "LAY-BY",
      "81": "DEBTOR CT NOTE (NORMAL)",
      "82": "PURCHASE ALLOCATION",
      "83": "KREDIT INSURANCE",
      "84": "B.O.M ITEM SALES (RECIPE)",
      "85": "B.O.M ITEM CT NOTE",
      "89": "CASH RETURNS (NORMAL)",
      "94": "DELETE CREDITOR",
      "97": "CT NOTE ITEMS SPECIAL (CASH)",
      "98": "CT NOTE ITEMS SPECIAL (CREDIT)",
      "100": "CONTRACT SALE",
      "101": "LEASE PAYMENT (CASH)",
      "102": "LEASE",
      "104": "CREDIT PURCHASE RENTAL",
      "114": "MONTH END MARKER",
      "116": "ITEMS ON JOB CARD",
      "119": "STOCK TAKE VARIANCE",
      "121": "DEBTOR MATCHED TRANSACTIONS"
    },
    PAYMENTMETHOD: {
      "0": "CASH",
      "1": "CHEQUE",
      "2": "CREDIT CARD",
      "3": "VOUCHER",
      "4": "EFT CARD",
      "5": "VOUCHER 2"
    }
  },
  STOCK: {
    STOCKTYPE: {
      "0": "STOCKED ITEM",
      "1": "NON-STOCKED ITEM",
      "2": "ALL STOCK",
      "5": "CASH MANAGEMENT",
      "6": "PETTY CASH",
      "7": "SERIAL",
      "8": "DISCONTINUED - PURCHASES",
      "9": "EXPENSES",
      "10": "YARD ITEM STOCKED",
      "11": "B.O.M NON-STOCKED",
      "12": "YARD ITEM NON-STOCKED",
      "13": "DISCONTINUED - ALL"
    },
    TAXTYPE: {
      "0": "STANDARD RATE",
      "1": "ZERO RATE",
      "2": "EXEMPT",
      "3": "ACCOMODATION < 45 DAYS",
      "4": "ACCOMODATION >= 45 DAYS",
      "5": "FARM PRODUCE",
      "6": "SECOND-HAND GOODS"
    }
  },
  DEBTOR: {
    ACCOUNTTYPE: {
      "A": "NORMAL DEBTOR",
      "B": "REVOLVING FIX.MONTHS",
      "C": "LAY-BYS O.I",
      "D": "CREDIT LIMIT REDUCING",
      "E": "DEPENDENTS",
      "F": "KOOPVERENIGINGS",
      "G": "COD"
    },
    TERMS: {
      "0": "NO SETTLEMENT DISCOUNT",
      "1": "RUNNING DISCOUNT",
      "2": "30 DAYS",
      "3": "60 DAYS",
      "4": "90 DAYS",
      "5": "120 DAYS"
    },
    BADMARKER: {
      "A": "NORMAL DEBTOR",
      "B": "FIRST LETTER",
      "C": "SECOND LETTER",
      "D": "THIRD LETTER",
      "E": "AT ATTORNEY",
      "F": "LIQUIDATED / BAD DEBT",
      "Q": "CLOSED AND PAID"
    }
  },
  TRANSACTIONS: {
    MARKER: { "D": "DEBIT", "K": "CREDIT" },
    PAIDUP: { "0": "NOT PAID", "1": "PAID" },
    JOURNALTYPE: {
      "0": "OPEN BALANCE (NO VAT)",
      "1": "BAD DEBT (VAT)",
      "2": "INTEREST (NO VAT)",
      "3": "TAX JOURNAL (VAT)",
      "4": "OTHER (NO VAT)"
    }
  }
};
