import { MOCK_INVESTMENT } from "@/lib/mocks/investment";
import { InvestmentView } from "@/components/InvestmentView";

export const dynamic = "force-dynamic";

export default function Page() {
  return <InvestmentView initialData={MOCK_INVESTMENT} />;
}
