export type BrokerRecord = {
  date: string; // ISO YYYY-MM-DD
  broker: string; // "finvasia" | "angelone" | "fyers" | "kite"
  accountId: string;
  algos?: number;
  payin_payout_obligation: number;
  net_brokerage: number;
  other_charges: number;
  total_charges: number;
  final_net: number;
};

export type TradingDay = {
  date: string;
  day: string;
  profit: number;
  overall: number;
  drawdown: number;
  charges: number;
  algos: number;
  algoCharges: number;
  capital: number;
  avgProfit50: number | null;
  avgProfit100: number | null;
  avgCharge100: number | null;
  chargeProfitRatio: number | null;
  profitCapitalBps: number;
};

export type MonthlyBucket = {
  month: string;
  tradingGain: number;
  gainPct: number;
  gainAvg3m: number;
};

export type TradingModelResult = {
  daily: TradingDay[];
  brokers: BrokerRecord[];
  monthly: MonthlyBucket[];
};

export type EntitySnapshot = {
  profit: number;
  percentage: number;
  dailyChange: number;
};

export type InvestmentDay = {
  date: string;
  indian: EntitySnapshot;
  us: EntitySnapshot;
  satellite: EntitySnapshot;
  total: EntitySnapshot;
  nifty: EntitySnapshot;
  midcap: EntitySnapshot;
  smallcap: EntitySnapshot;
};

export type Holding = {
  broker: string;
  symbol: string;
  qty: number;
  avgCost: number;
  ltp: number;
  invested: number;
  currentValue: number;
  unrealizedPnl: number;
  dayChangePct: number;
  _source?: string;
};

export type Account = {
  broker: string;
  accountId: string;
  apiKey?: string;
  apiSecret?: string;
  pdfPassword?: string;
  sheetStartColumn?: string;
};

export type Mailbox = {
  email: string;
  emailPassword?: string;
  accounts: Account[];
};

export type KpiCard = {
  label: string;
  value: string;
  tone?: "pos" | "neg" | "";
  sub?: string;
};

export type User = {
  name: string;
  email: string;
};

export type TradingDataSource = "sheet" | "mock";
