import { NextResponse } from "next/server";
import { openapi } from "@/openapi";

export function GET() {
  return NextResponse.json(openapi);
}
