import { NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export async function GET() {
  try {
    const user = await currentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // For now, return mock data - we'll connect to backend later
    const mockData = {
      clockIn: null,
      clockOut: null,
      lunchStart: null,
      lunchEnd: null,
      totalHours: 0,
      overtimeHours: 0
    }

    return NextResponse.json(mockData)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch time log' },
      { status: 500 }
    )
  }
}