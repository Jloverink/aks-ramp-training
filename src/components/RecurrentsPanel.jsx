import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000)
}

function statusFor(rec) {
  const today = new Date().toISOString().split('T')[0]
  const soon = new Date(); soon.setDate(soon.getDate() + 60)
  const soonStr = soon.toISOString().split('T')[0]
  if (!rec.last_completed) {
    if (rec.due_date && rec.due_date < today) return 'overdue'
    return 'pending'
  }
  if (rec.due_date < today) return 'overdue'
  if (rec.due_date <= soonStr) return 'due_soon'
  return 'current'
}

const STATUS_LABELS = {
  overdue: { label: 'Overdue', cls: 'tag-red' },
  due_soon: { label: 'Due soon', cls: 'tag-amber' },
  pending: { label: 'Not completed', cls: 'tag-gray' },
  current: { label: 'Current', cls: 'tag-green' },
}

export default function RecurrentsPanel({ employee, currentEmployee }) {
  const [recurrents, setRecurrents] = useState([])
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState(null)

  const canManage = ['supervisor','director'].includes(currentEmployee.role)

  useEffect(() => { fetchRecurrents() }, [employee.id])

  async function fetchRecurrents() {
    setLoading(true)
    const { data } = await supabase.from('recurrents').select('*').eq('employee_id', employee.id).order('due_date')
    setRecurrents(data || [])
    setLoading(false)
  }

  async function markComplete(rec) {
    const today = new Date().toISOString().split('T')[0]
    const nextDue = new Date()
    nextDue.setMonth(nextDue.getMonth() + rec.interval_months)
    const nextDueStr = nextDue.toISOString().split('T')[0]

    await supabase.from('recurrents').update({
      last_completed: today,
      due_date: nextDueStr,
      completed_by: currentEmployee.name,
    }).eq('id', rec.id)

    await fetchRecurrents()
    setCompleting(null)
  }

  if (loading) return <div className="loading"><div className="spinner" /></div>

  if (recurrents.length === 0) return (
    <div className="empty">
      <div className="empty-icon">📋</div>
      <div>No recurrent items found</div>
      <div style={{ fontSize: 13, marginTop: 4 }}>Items are seeded on hire date</div>
    </div>
  )

  return (
    <div>
      {recurrents.map(rec => {
        const status = statusFor(rec)
        const { label, cls } = STATUS_LABELS[status]
        const today = new Date().toISOString().split('T')[0]
        const daysUntil = rec.due_date ? daysBetween(today, rec.due_date) : null

        return (
          <div key={rec.id} className="card card-pad" style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{rec.item_name}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span className={`tag ${cls}`}>{label}</span>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>Every {rec.interval_months} months</span>
                </div>
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>
                  {rec.last_completed && <div>Last completed: <strong>{new Date(rec.last_completed).toLocaleDateString()}</strong>{rec.completed_by ? ` by ${rec.completed_by}` : ''}</div>}
                  {rec.due_date && (
                    <div style={{ marginTop: 2 }}>
                      {status === 'overdue'
                        ? <span style={{ color: 'var(--red)' }}>Overdue by {Math.abs(daysUntil)} days — due {new Date(rec.due_date).toLocaleDateString()}</span>
                        : <span>Due {new Date(rec.due_date).toLocaleDateString()} ({daysUntil > 0 ? `${daysUntil} days` : 'today'})</span>
                      }
                    </div>
                  )}
                </div>
              </div>
              {canManage && status !== 'current' && (
                <div>
                  {completing === rec.id ? (
                    <div style={{ display: 'flex', gap: 6, flexDirection: 'column' }}>
                      <button className="btn btn-sm btn-primary" onClick={() => markComplete(rec)}>Confirm</button>
                      <button className="btn btn-sm btn-ghost" onClick={() => setCompleting(null)}>Cancel</button>
                    </div>
                  ) : (
                    <button className="btn btn-sm" style={{ background: 'var(--greenbg)', color: 'var(--green)', border: '1px solid var(--green)33' }}
                      onClick={() => setCompleting(rec.id)}>
                      Mark complete
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
