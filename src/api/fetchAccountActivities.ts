import { trading } from "./alpacaClient";
import { parseOsiSymbol } from "./optionOrders";

export interface BalanceActivity {
  id: string;
  timestamp: string;
  activityType: string;
  label: string;
  symbol?: string;
  /** Signed cash impact: positive = credit, negative = debit. */
  amount: number;
  /** Present on trade fills. */
  side?: "buy" | "sell";
  /** Contracts/shares filled (trade fills only). */
  qty?: number;
}

interface AlpacaActivityBase {
  id: string;
  activity_type: string;
  symbol?: string;
}

interface AlpacaNonTradeActivity extends AlpacaActivityBase {
  date?: string;
  created_at?: string;
  net_amount?: string;
  description?: string;
}

interface AlpacaTradeActivity extends AlpacaActivityBase {
  transaction_time: string;
  price: string;
  qty: string;
  side: string;
  type?: string;
}

type AlpacaActivity = AlpacaNonTradeActivity | AlpacaTradeActivity;

function isTradeActivity(a: AlpacaActivity): a is AlpacaTradeActivity {
  return a.activity_type === "FILL" && "transaction_time" in a && "price" in a;
}

function contractMultiplier(symbol: string | undefined): number {
  if (!symbol) return 1;
  return parseOsiSymbol(symbol) ? 100 : 1;
}

function tradeAmount(activity: AlpacaTradeActivity): number {
  const price = parseFloat(activity.price);
  const qty = parseFloat(activity.qty);
  const gross = price * qty * contractMultiplier(activity.symbol);
  return activity.side === "sell" ? gross : -gross;
}

const ACTIVITY_LABELS: Record<string, string> = {
  CSD: "Cash deposit",
  CSW: "Cash withdrawal",
  DIV: "Dividend",
  DIVCGL: "Dividend (LT cap gain)",
  DIVCGS: "Dividend (ST cap gain)",
  DIVNRA: "Dividend withholding",
  INT: "Interest",
  FEE: "Fee",
  OPASN: "Option assignment",
  OPEXP: "Option expiration",
  OPEXC: "Option exercise",
  OPTRD: "Option trade",
  JNLC: "Journal (cash)",
  ACATC: "ACATS cash",
};

function formatActivityLabel(activity: AlpacaActivity, _amount: number): string {
  if (isTradeActivity(activity)) {
    const verb = activity.side === "sell" ? "Sell" : "Buy";
    const parsed = activity.symbol ? parseOsiSymbol(activity.symbol) : null;
    if (parsed) {
      const leg = parsed.type === "call" ? "Call" : "Put";
      return `${verb} ${parsed.underlying} ${leg} ${parsed.strike}`;
    }
    return `${verb} ${activity.symbol}`;
  }

  const base = ACTIVITY_LABELS[activity.activity_type] ?? activity.activity_type;
  const desc = "description" in activity ? activity.description : undefined;
  if (desc) return desc;
  if (activity.symbol) return `${base} · ${activity.symbol}`;
  return base;
}

function activityTimestamp(activity: AlpacaActivity): string {
  if (isTradeActivity(activity)) return activity.transaction_time;
  const nonTrade = activity as AlpacaNonTradeActivity;
  return nonTrade.created_at ?? nonTrade.date ?? new Date().toISOString();
}

function normalizeActivity(activity: AlpacaActivity): BalanceActivity | null {
  let amount: number;

  if (isTradeActivity(activity)) {
    amount = tradeAmount(activity);
  } else {
    const net = (activity as AlpacaNonTradeActivity).net_amount;
    if (net == null || net === "") return null;
    amount = parseFloat(net);
    if (!Number.isFinite(amount) || amount === 0) return null;
  }

  if (!Number.isFinite(amount) || amount === 0) return null;

  const side =
    isTradeActivity(activity) && (activity.side === "buy" || activity.side === "sell")
      ? activity.side
      : undefined;
  const qty = isTradeActivity(activity) ? parseFloat(activity.qty) : undefined;

  return {
    id: activity.id,
    timestamp: activityTimestamp(activity),
    activityType: activity.activity_type,
    label: formatActivityLabel(activity, amount),
    symbol: activity.symbol,
    amount,
    side,
    qty: Number.isFinite(qty) ? qty : undefined,
  };
}

export async function fetchAccountActivities(pageSize = 40): Promise<BalanceActivity[]> {
  const raw = await trading.get<AlpacaActivity[]>("/v2/account/activities", {
    direction: "desc",
    page_size: String(pageSize),
  });

  return (raw ?? [])
    .map(normalizeActivity)
    .filter((a): a is BalanceActivity => a !== null)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

/** Sum credits from sell-to-open option fills (wheel premium). */
export function sumOptionPremiumCollected(activities: BalanceActivity[]): number {
  const chronological = [...activities].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
  const position = new Map<string, number>();

  return chronological.reduce((sum, a) => {
    if (a.activityType !== "FILL") return sum;
    if (!a.symbol || !parseOsiSymbol(a.symbol)) return sum;

    if (a.side == null || a.qty == null) {
      if (a.amount > 0) return sum + a.amount;
      return sum;
    }

    const qty = a.qty;
    let pos = position.get(a.symbol) ?? 0;

    if (a.side === "buy") {
      pos += qty;
      position.set(a.symbol, pos);
      return sum;
    }

    if (a.amount <= 0) return sum;

    if (pos > 0) {
      const closeQty = Math.min(pos, qty);
      pos -= closeQty;
      const openQty = qty - closeQty;
      if (openQty > 0) {
        pos -= openQty;
        sum += a.amount * (openQty / qty);
      }
      position.set(a.symbol, pos);
      return sum;
    }

    pos -= qty;
    position.set(a.symbol, pos);
    return sum + a.amount;
  }, 0);
}
