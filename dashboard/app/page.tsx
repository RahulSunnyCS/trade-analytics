import { getTradingBrokerRecords } from "@/lib/sheets";
import { buildTradingModel } from "@/lib/trading-model";
import { MOCK_INVESTMENT } from "@/lib/mocks/investment";
import { OverviewView } from "@/components/OverviewView";

export const dynamic = "force-dynamic";

const CAPITAL = 1200000;

export default async function Page() {
  const { records, source } = await getTradingBrokerRecords();
  const trading = buildTradingModel(records, CAPITAL);
  return <OverviewView trading={trading} investment={MOCK_INVESTMENT} source={source} />;
}
