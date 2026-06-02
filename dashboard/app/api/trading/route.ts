import { NextResponse } from "next/server";
import { getTradingBrokerRecords } from "@/lib/sheets";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { records, source } = await getTradingBrokerRecords();
    return NextResponse.json({ records, source });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
