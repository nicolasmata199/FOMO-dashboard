import { NextResponse } from 'next/server'
export function GET() {
    return NextResponse.redirect(new URL('/login', 'https://fomo-dashboard-ten.vercel.app'))
  }
