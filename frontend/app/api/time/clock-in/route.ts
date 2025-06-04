import { NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'

export async function POST() {
  try {
    const user = await currentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // TODO: Call backend API to record clock-in
    
    return NextResponse.json({ success: true, clockedInAt: new Date().toISOString() })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to clock in' },
      { status: 500 }
    )
  }
}