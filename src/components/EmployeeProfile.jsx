import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { LEVEL_META } from '../data/training'
import TaskChecklist from './TaskChecklist'
import RecurrentsPanel from './RecurrentsPanel'

function levelColor(l) {
  const map = { 1: 'var(--l1)', 2: 'var(--l2)', 3: 'var(--l3)', 4: 'var(--l4)', 5: 'var(--l5)' }
  return map[l] || 'var(--muted)'
}
function levelBg(l) {
  const map = { 1: 'var(--l1bg)', 2: 'var(--l2bg)', 3: 'var(--l3bg)', 4: 'var(--l4bg)', 5: 'var(--l5bg)' }
  return map[l] || 'var(--bg)'
}
function initials(name) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

export default function EmployeeProfile({ employee: initialEmployee, currentEmployee, onBack }) {
  const [employee, setEmployee] = useState(initialEmployee)
  const [tab, setTab] = useState('tasks')
  const [advancements, setAdvancements] = useState([])
  const [advancingFrom, setAdvancingFrom] = useState(null)
  const [advanceNote, setAdvanceNote] = useState('')
  const [saving, setSaving] = useState(false)

  const isOwnProfile = currentEmployee.id === employee.id
  const canManage = ['supervisor', 'director'].includes(currentEmployee.role)

  useEffect(() => { if (tab === 'history') fetchHistory() }, [tab, employee.id])

  async function fetchHistory() {
    const { data } = await supabase.from('level_advancements').select('*')
      .eq('employee_id', employee.id).order('approved_at', { ascending: false })
    setAdvancements(data || [])
  }

  async function handleAdvancement(emp, fromLevel) {
    setSaving(true)
    const toLevel = fromLevel + 1

    await supabase.from('level_advancements').insert([{
      employee_id: emp.id,
      from_level: fromLevel,
      to_level: toLevel,
      approved_by_id: currentEmployee.id,
      approved_by_name: currentEmployee.name,
      notes: advanceNote,
    }])

    await supabase.from('employees').update({ current_level: toLevel }).eq('id', emp.id)
    setEmployee(prev => ({ ...prev, current_level: toLevel }))
    setAdvancingFrom(null)
    setAdvanceNote('')
    setSaving(false)
  }

  const meta = LEVEL_META[employee.current_level]
  const lc = levelColor(employee.current_level)
  const lb = levelBg(employee.current_level)

  return (
    <div>
      {onBack && (
        <button className="back-btn" onClick={onBack}>
          ← Back to team
        </button>
      )}

      {/* Profile header */}
      <div className="card card-pad" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
          <div className="emp-avatar" style={{ background: lc, width: 52, height: 52, fontSize: 18 }}>
            {initials(employee.name)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{employee.name}</div>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>
              {employee.role.charAt(0).toUpperCase() + employee.role.slice(1)}
              {employee.hire_date && ` · Hired ${new Date(employee.hire_date).toLocaleDateString()}`}
            </div>
          </div>
          {canManage && !isOwnProfile && (
            <EditEmployeeButton employee={employee} onUpdate={setEmployee} />
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="level-badge" style={{ background: lb, color: lc, fontSize: 13, padding: '4px 12px' }}>
            {meta?.label} — {meta?.pay}
          </span>
          <span className={`tag ${employee.status === 'active' ? 'tag-green' : employee.status === 'seasonal' ? 'tag-amber' : 'tag-gray'}`}>
            {employee.status}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-bar">
        <button className={`tab-btn ${tab === 'tasks' ? 'active' : ''}`} onClick={() => setTab('tasks')}>Training</button>
        <button className={`tab-btn ${tab === 'recurrents' ? 'active' : ''}`} onClick={() => setTab('recurrents')}>Recurrents</button>
        <button className={`tab-btn ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>History</button>
      </div>

      {tab === 'tasks' && (
        <TaskChecklist
          employee={employee}
          currentEmployee={currentEmployee}
          onAdvancement={(emp, lvl) => setAdvancingFrom(lvl)}
        />
      )}

      {tab === 'recurrents' && (
        <RecurrentsPanel employee={employee} currentEmployee={currentEmployee} />
      )}

      {tab === 'history' && (
        <HistoryTab advancements={advancements} employee={employee} />
      )}

      {/* Advancement modal */}
      {advancingFrom !== null && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setAdvancingFrom(null)}>
          <div className="modal">
            <div className="modal-title">Confirm Level Advancement</div>
            <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 16 }}>
              You are advancing <strong>{employee.name}</strong> from Level {advancingFrom} to Level {advancingFrom + 1} ({LEVEL_META[advancingFrom + 1]?.pay}/hr).
            </p>
            <div className="form-group">
              <label className="form-label">Notes (optional)</label>
              <textarea className="form-input" rows={3} value={advanceNote}
                onChange={e => setAdvanceNote(e.target.value)}
                placeholder="Any notes about this advancement..." style={{ resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setAdvancingFrom(null)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1, background: 'var(--green)' }} disabled={saving}
                onClick={() => handleAdvancement(employee, advancingFrom)}>
                {saving ? 'Saving...' : 'Confirm Advancement'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function HistoryTab({ advancements, employee }) {
  if (advancements.length === 0) return (
    <div className="empty">
      <div className="empty-icon">📈</div>
      <div>No advancement history yet</div>
    </div>
  )

  return (
    <div>
      {advancements.map(adv => (
        <div key={adv.id} className="card card-pad" style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>
                Level {adv.from_level} → Level {adv.to_level}
                <span style={{ marginLeft: 8, fontSize: 13, color: 'var(--muted)', fontWeight: 400 }}>
                  ({LEVEL_META[adv.from_level]?.pay} → {LEVEL_META[adv.to_level]?.pay})
                </span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
                Approved by {adv.approved_by_name}
              </div>
              {adv.notes && <div style={{ fontSize: 13, marginTop: 4 }}>{adv.notes}</div>}
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'right', flexShrink: 0 }}>
              {new Date(adv.approved_at).toLocaleDateString()}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function EditEmployeeButton({ employee, onUpdate }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ role: employee.role, status: employee.status, current_level: employee.current_level })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    const { data } = await supabase.from('employees').update({
      role: form.role,
      status: form.status,
      current_level: parseInt(form.current_level),
    }).eq('id', employee.id).select().single()
    if (data) onUpdate(data)
    setSaving(false)
    setOpen(false)
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <>
      <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>Edit</button>
      {open && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setOpen(false)}>
          <div className="modal">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <div className="modal-title">Edit Employee</div>
              <button className="btn-icon" onClick={() => setOpen(false)}>✕</button>
            </div>
            <div className="form-group">
              <label className="form-label">Role</label>
              <select className="form-input form-select" value={form.role} onChange={e => set('role', e.target.value)}>
                <option value="employee">Employee</option>
                <option value="trainer">Trainer</option>
                <option value="supervisor">Supervisor</option>
                <option value="director">Director</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Level</label>
              <select className="form-input form-select" value={form.current_level} onChange={e => set('current_level', e.target.value)}>
                {[1,2,3,4,5].map(l => <option key={l} value={l}>Level {l} — {LEVEL_META[l]?.pay}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-input form-select" value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="active">Active</option>
                <option value="seasonal">Seasonal</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1 }} disabled={saving} onClick={handleSave}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
