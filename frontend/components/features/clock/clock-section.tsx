'use client'

import { useState, useEffect } from 'react'
import { Clock, LogIn, LogOut, Coffee, AlertCircle } from 'lucide-react'
import { useUser } from '@clerk/nextjs'
import { format } from 'date-fns'

interface TimeLog {
  clockIn?: string
  clockOut?: string
  lunchStart?: string
  lunchEnd?: string
  totalHours?: number
  overtimeHours?: number
}

export function ClockSection() {
  const { user } = useUser()
  const [currentTime, setCurrentTime] = useState(new Date())
  const [todayLog, setTodayLog] = useState<TimeLog | null>(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<'clocked-out' | 'clocked-in' | 'lunch'>('clocked-out')

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Fetch today's time log
  useEffect(() => {
    fetchTodayLog()
  }, [user])

  const fetchTodayLog = async () => {
    if (!user) return
    
    try {
      const response = await fetch('/api/time/today')
      if (response.ok) {
        const data = await response.json()
        setTodayLog(data)
        
        // Determine current status
        if (data?.clockIn && !data?.clockOut) {
          if (data?.lunchStart && !data?.lunchEnd) {
            setStatus('lunch')
          } else {
            setStatus('clocked-in')
          }
        } else {
          setStatus('clocked-out')
        }
      }
    } catch (error) {
      console.error('Error fetching time log:', error)
    }
  }

  const handleClockIn = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/time/clock-in', {
        method: 'POST',
      })
      if (response.ok) {
        await fetchTodayLog()
      }
    } catch (error) {
      console.error('Error clocking in:', error)
    }
    setLoading(false)
  }

  const handleClockOut = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/time/clock-out', {
        method: 'POST',
      })
      if (response.ok) {
        await fetchTodayLog()
      }
    } catch (error) {
      console.error('Error clocking out:', error)
    }
    setLoading(false)
  }

  const handleLunchStart = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/time/lunch-start', {
        method: 'POST',
      })
      if (response.ok) {
        await fetchTodayLog()
      }
    } catch (error) {
      console.error('Error starting lunch:', error)
    }
    setLoading(false)
  }

  const handleLunchEnd = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/time/lunch-end', {
        method: 'POST',
      })
      if (response.ok) {
        await fetchTodayLog()
      }
    } catch (error) {
      console.error('Error ending lunch:', error)
    }
    setLoading(false)
  }

  // Calculate hours worked
  const calculateHoursWorked = () => {
    if (!todayLog?.clockIn) return '0h 0m'
    
    const clockIn = new Date(todayLog.clockIn)
    const now = new Date()
    const clockOut = todayLog.clockOut ? new Date(todayLog.clockOut) : now
    
    let totalMinutes = Math.floor((clockOut.getTime() - clockIn.getTime()) / 1000 / 60)
    
    // Subtract lunch time if taken
    if (todayLog.lunchStart && todayLog.lunchEnd) {
      const lunchMinutes = Math.floor(
        (new Date(todayLog.lunchEnd).getTime() - new Date(todayLog.lunchStart).getTime()) / 1000 / 60
      )
      totalMinutes -= lunchMinutes
    }
    
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    
    return `${hours}h ${minutes}m`
  }

  // Check if overtime (>8 hours)
  const isOvertime = () => {
    if (!todayLog?.clockIn) return false
    const hoursWorked = parseFloat(calculateHoursWorked())
    return hoursWorked > 8
  }

  return (
    <div className="glass-effect rounded-2xl p-8 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-500/20 to-purple-600/20 rounded-full blur-3xl" />
      
      <div className="relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Clock className="w-6 h-6 text-indigo-400" />
            Time Tracking
          </h2>
          <span className="text-sm text-slate-400">
            {format(currentTime, 'EEEE, MMMM d')}
          </span>
        </div>

        {/* Current Time Display */}
        <div className="text-center mb-8">
          <div className="text-6xl font-light text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-600">
            {format(currentTime, 'HH:mm:ss')}
          </div>
          
          {/* Status */}
          <div className="mt-4 flex items-center justify-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              status === 'clocked-in' ? 'bg-green-500' : 
              status === 'lunch' ? 'bg-yellow-500' : 
              'bg-red-500'
            } animate-pulse`} />
            <span className="text-sm text-slate-300">
              {status === 'clocked-in' ? `Clocked in since ${todayLog?.clockIn ? format(new Date(todayLog.clockIn), 'HH:mm') : ''}` :
               status === 'lunch' ? 'On lunch break' :
               'Not clocked in'}
            </span>
          </div>

          {/* Hours worked */}
          {todayLog?.clockIn && (
            <div className="mt-2 text-sm text-slate-400">
              Hours worked today: <span className="text-indigo-400 font-semibold">{calculateHoursWorked()}</span>
              {isOvertime() && (
                <span className="ml-2 text-yellow-500 flex items-center gap-1 inline-flex">
                  <AlertCircle className="w-3 h-3" />
                  Overtime
                </span>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-4">
          {/* Clock In/Out */}
          {status === 'clocked-out' ? (
            <button
              onClick={handleClockIn}
              disabled={loading}
              className="col-span-2 flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl font-semibold transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <LogIn className="w-5 h-5" />
              Clock In
            </button>
          ) : (
            <button
              onClick={handleClockOut}
              disabled={loading || status === 'lunch'}
              className="col-span-2 flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white rounded-xl font-semibold transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <LogOut className="w-5 h-5" />
              Clock Out
            </button>
          )}

          {/* Lunch Buttons */}
          {status === 'clocked-in' && (
            <button
              onClick={handleLunchStart}
              disabled={loading}
              className="col-span-2 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700 text-white rounded-xl font-semibold transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Coffee className="w-5 h-5" />
              Start Lunch Break
            </button>
          )}

          {status === 'lunch' && (
            <button
              onClick={handleLunchEnd}
              disabled={loading}
              className="col-span-2 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl font-semibold transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Coffee className="w-5 h-5" />
              End Lunch Break
            </button>
          )}
        </div>

        {/* Overtime Notification */}
        {isOvertime() && status === 'clocked-in' && (
          <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <p className="text-sm text-yellow-500 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              You've worked over 8 hours today. Consider requesting overtime approval.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}