import { getTradingBrokerRecords } from "@/lib/sheets";
import { TradingView } from "@/components/TradingView";

export const dynamic = "force-dynamic";

export default async function Page() {
  const { records, source } = await getTradingBrokerRecords();
  return <TradingView initialRecords={records} source={source} />;
}
