import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ message: 'Labor import test route works!' })
}

export async function POST() {
  return NextResponse.json({ message: 'Labor import POST test works!' })
}