// === Option 1: Put RequestModal in the same file (RECOMMENDED) ===
// frontend/components/features/requests/requests-section.tsx
// This is the complete file with RequestModal included at the bottom

'use client'

import { useState } from 'react'
import { Calendar, Clock, ChevronRight, Plus, CheckCircle, XCircle, Timer } from 'lucide-react'

interface Request {
  id: string
  type: 'overtime' | 'vacation'
  date: string
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string
}

export function RequestsSection() {
  const [showOvertimeModal, setShowOvertimeModal] = useState(false)
  const [showVacationModal, setShowVacationModal] = useState(false)
  const [recentRequests, setRecentRequests] = useState<Request[]>([
    // Mock data - will be replaced with API calls
    {
      id: '1',
      type: 'overtime',
      date: '2024-01-15',
      reason: 'Project deadline',
      status: 'approved',
      createdAt: '2024-01-14'
    },
    {
      id: '2',
      type: 'vacation',
      date: '2024-02-01',
      reason: 'Family vacation',
      status: 'pending',
      createdAt: '2024-01-10'
    }
  ])

  const getStatusIcon = (status: Request['status']) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'rejected':
        return <XCircle className="w-4 h-4 text-red-500" />
      case 'pending':
        return <Timer className="w-4 h-4 text-yellow-500" />
    }
  }

  const getStatusColor = (status: Request['status']) => {
    switch (status) {
      case 'approved':
        return 'text-green-500 bg-green-500/10'
      case 'rejected':
        return 'text-red-500 bg-red-500/10'
      case 'pending':
        return 'text-yellow-500 bg-yellow-500/10'
    }
  }

  return (
    <>
      <div className="glass-effect rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Plus className="w-6 h-6 text-indigo-400" />
            Quick Requests
          </h2>
        </div>

        {/* Request Buttons */}
        <div className="space-y-4 mb-6">
          <button
            onClick={() => setShowOvertimeModal(true)}
            className="w-full group relative overflow-hidden rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-4 transition-all hover:border-indigo-500/40 hover:bg-indigo-500/20"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-indigo-500/20">
                  <Clock className="w-5 h-5 text-indigo-400" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-white">Request Overtime</h3>
                  <p className="text-sm text-slate-400">Submit overtime approval request</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-indigo-400 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

          <button
            onClick={() => setShowVacationModal(true)}
            className="w-full group relative overflow-hidden rounded-xl border border-purple-500/20 bg-purple-500/10 p-4 transition-all hover:border-purple-500/40 hover:bg-purple-500/20"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/20">
                  <Calendar className="w-5 h-5 text-purple-400" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-white">Request Vacation</h3>
                  <p className="text-sm text-slate-400">Submit time off request</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-purple-400 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>
        </div>

        {/* Recent Requests */}
        <div>
          <h3 className="text-sm font-medium text-slate-400 mb-3">Recent Requests</h3>
          <div className="space-y-2">
            {recentRequests.map((request) => (
              <div
                key={request.id}
                className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-lg ${
                      request.type === 'overtime' ? 'bg-indigo-500/20' : 'bg-purple-500/20'
                    }`}>
                      {request.type === 'overtime' ? 
                        <Clock className="w-4 h-4 text-indigo-400" /> : 
                        <Calendar className="w-4 h-4 text-purple-400" />
                      }
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">
                        {request.type === 'overtime' ? 'Overtime' : 'Vacation'} - {request.date}
                      </p>
                      <p className="text-xs text-slate-500">{request.reason}</p>
                    </div>
                  </div>
                  <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>
                    {getStatusIcon(request.status)}
                    {request.status}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Overtime Modal */}
      {showOvertimeModal && (
        <RequestModal
          type="overtime"
          onClose={() => setShowOvertimeModal(false)}
          onSubmit={(data) => {
            console.log('Overtime request:', data)
            setShowOvertimeModal(false)
            // TODO: API call
          }}
        />
      )}

      {/* Vacation Modal */}
      {showVacationModal && (
        <RequestModal
          type="vacation"
          onClose={() => setShowVacationModal(false)}
          onSubmit={(data) => {
            console.log('Vacation request:', data)
            setShowVacationModal(false)
            // TODO: API call
          }}
        />
      )}
    </>
  )
}

// === Request Modal Component (in same file) ===
interface RequestModalProps {
  type: 'overtime' | 'vacation'
  onClose: () => void
  onSubmit: (data: { type: string; date: string; reason: string; hours?: string }) => void
}

function RequestModal({ type, onClose, onSubmit }: RequestModalProps) {
  const [date, setDate] = useState('')
  const [reason, setReason] = useState('')
  const [hours, setHours] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      type,
      date,
      reason,
      ...(type === 'overtime' && { hours })
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="glass-effect rounded-2xl p-6 w-full max-w-md mx-4">
        <h3 className="text-xl font-bold mb-4">
          Request {type === 'overtime' ? 'Overtime' : 'Vacation'}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
              required
            />
          </div>

          {type === 'overtime' && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Hours Requested
              </label>
              <input
                type="number"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                placeholder="e.g., 2"
                min="0.5"
                step="0.5"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Reason
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-indigo-500 resize-none"
              rows={3}
              placeholder={type === 'overtime' ? 'Project deadline, client meeting...' : 'Family vacation, personal time...'}
              required
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-lg font-medium transition-all"
            >
              Submit Request
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}