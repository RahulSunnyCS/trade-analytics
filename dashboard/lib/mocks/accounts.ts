// Seed broker-account config for the Settings page — same shape as BROKER_ACCOUNTS_JSON.
import type { Mailbox } from "@/types";

export const MOCK_ACCOUNTS: Mailbox[] = [
  {
    email: "rahulsunny13@gmail.com",
    emailPassword: "gmail-app-password-1",
    accounts: [
      {
        broker: "finvasia",
        accountId: "FA1234",
        apiKey: "FV-API-XXXX",
        apiSecret: "FV-SECRET-XXXX",
        pdfPassword: "ABCDE1234F",
        sheetStartColumn: "D",
      },
      {
        broker: "angelone",
        accountId: "R59799620",
        apiKey: "AO-API-XXXX",
        apiSecret: "AO-SECRET-XXXX",
        pdfPassword: "PQRSX6789Z",
        sheetStartColumn: "I",
      },
      {
        broker: "fyers",
        accountId: "XF01234",
        apiKey: "FY-API-XXXX",
        apiSecret: "FY-SECRET-XXXX",
        pdfPassword: "",
        sheetStartColumn: "N",
      },
      {
        broker: "kite",
        accountId: "ZK1234",
        apiKey: "KT-API-XXXX",
        apiSecret: "KT-SECRET-XXXX",
        pdfPassword: "",
        sheetStartColumn: "S",
      },
    ],
  },
  {
    email: "rahul.trades2@gmail.com",
    emailPassword: "gmail-app-password-2",
    accounts: [
      {
        broker: "finvasia",
        accountId: "FA9999",
        apiKey: "FV2-API-XXXX",
        apiSecret: "FV2-SECRET-XXXX",
        pdfPassword: "LMNOP3456Q",
        sheetStartColumn: "D",
      },
    ],
  },
];
