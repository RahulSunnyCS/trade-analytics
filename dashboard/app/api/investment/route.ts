import { NextResponse } from "next/server";
import { MOCK_INVESTMENT } from "@/lib/mocks/investment";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(MOCK_INVESTMENT);
}
