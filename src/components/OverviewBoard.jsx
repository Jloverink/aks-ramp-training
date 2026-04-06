import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { LEVEL_META, TRAINING_DATA } from '../data/training'

function totalTasks(level) {
  let count = 0
  for (let l = 1; l <= level; l++) {
    const lvl = TRAINING_DATA[l]
    if (lvl) lvl.modules.forEach(m => { count += m.tasks.length })
  }
  return count
}

function levelColor(l) {
  const map = { 1: '--l1', 2: '--l2', 3: '--l3', 4: '--l4', 5: '--l5' }
  return `var(${map[l] || '--muted'})`
}
function levelBg(l) {
  const map = { 1: '--l1bg', 2: '--l2bg', 3: '--l3bg', 4: '--l4bg', 5: '--l5bg' }
  return `var(${map[l] || '--bg'})`
}

function initials(name) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function RecurrentDot({ overdue, soon }) {
  if (overdue > 0) return <span className="tag tag-red">⚠ {overdue} overdue</span>
  if (soon > 0) return <span className="tag tag-amber">⏰ {soon} due soon</span>
  return <span className="tag tag-green">✓ Current</span>
}

export default function OverviewBoard({ currentEmployee, onSelectEmployee }) {
  const [employees, setEmployees] = useState([])
  const [completions, setCompletions] = useState({})
  const [recurrents, setRecurrents] = useState({})
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('active')
  const [showAdd, setShowAdd] = useState(false)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const { data: emps } = await supabase.from('employees').select('*').order('name')
    if (!emps) { setLoading(false); return }
    setEmployees(emps)

    const { data: comps } = await supabase.from('task_completions').select('employee_id, task_text')
    const compMap = {}
    comps?.forEach(c => { compMap[c.employee_id] = (compMap[c.employee_id] || 0) + 1 })
    setCompletions(compMap)

    const today = new Date().toISOString().split('T')[0]
    const soon = new Date(); soon.setDate(soon.getDate() + 60)
    const soonStr = soon.toISOString().split('T')[0]

    const { data: recs } = await supabase.from('recurrents').select('*')
    const recMap = {}
    recs?.forEach(r => {
      if (!recMap[r.employee_id]) recMap[r.employee_id] = { overdue: 0, soon: 0 }
      const isExpired = !r.last_completed || r.due_date < today
      const isDueSoon = r.due_date >= today && r.due_date <= soonStr
      if (isExpired && r.due_date < today) recMap[r.employee_id].overdue++
      else if (isDueSoon || (!r.last_completed && r.due_date <= soonStr)) recMap[r.employee_id].soon++
    })
    setRecurrents(recMap)
    setLoading(false)
  }

  const filtered = employees.filter(e => filter === 'all' || e.status === filter)

  if (loading) return <div className="loading"><div className="spinner" /></div>

  return (
    <div>
      <div className="section-hdr">
        <div>
          <div className="section-title">Ramp Team</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>{filtered.length} employee{filtered.length !== 1 ? 's' : ''}</div>
        </div>
        {(currentEmployee.role === 'supervisor' || currentEmployee.role === 'director') && (
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>+ Add Employee</button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {['active', 'seasonal', 'inactive', 'all'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="btn btn-sm"
            style={{ background: filter === f ? 'var(--navy)' : 'white', color: filter === f ? 'white' : 'var(--muted)', border: '1px solid var(--border)' }}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="empty"><div className="empty-icon">👥</div><div>No employees found</div></div>
      )}

      <div className="emp-grid">
        {filtered.map(emp => {
          const tasksComplete = completions[emp.id] || 0
          const total = totalTasks(emp.current_level)
          const pct = total > 0 ? Math.min(100, Math.round((tasksComplete / total) * 100)) : 0
          const rec = recurrents[emp.id] || { overdue: 0, soon: 0 }
          const lc = levelColor(emp.current_level)
          const lb = levelBg(emp.current_level)

          const levelComplete = pct === 100

          return (
            <div key={emp.id} className="emp-card" onClick={() => onSelectEmployee(emp)}
              style={ levelComplete ? { borderColor: 'var(--green)', borderWidth: 2 } : {} }>

              {levelComplete && (
                <div style={{ background: 'var(--greenbg)', borderRadius: 6, padding: '4px 10px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: 'var(--green)', fontWeight: 700, fontSize: 12 }}>✓ Level {emp.current_level} Complete</span>
                  {emp.current_level < 5 && <span style={{ color: 'var(--green)', fontSize: 11, opacity: 0.8 }}>— ready to advance</span>}
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                <div className="emp-avatar" style={{ background: levelComplete ? 'var(--green)' : lc }}>{initials(emp.name)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{emp.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>
                    {emp.role.charAt(0).toUpperCase() + emp.role.slice(1)}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span className="level-badge" style={{ background: levelComplete ? 'var(--greenbg)' : lb, color: levelComplete ? 'var(--green)' : lc }}>
                  L{emp.current_level} — {LEVEL_META[emp.current_level]?.pay}
                </span>
                <span style={{ fontSize: 12, color: levelComplete ? 'var(--green)' : 'var(--muted)', fontWeight: levelComplete ? 600 : 400 }}>
                  {levelComplete ? '100% done' : `${pct}%`}
                </span>
              </div>

              <div className="progress-bar" style={{ marginBottom: 10 }}>
                <div className="progress-fill" style={{ width: `${pct}%`, background: levelComplete ? 'var(--green)' : lc }} />
              </div>

              <RecurrentDot overdue={rec.overdue} soon={rec.soon} />
            </div>
          )
        })}
      </div>

      {showAdd && (
        <AddEmployeeModal onClose={() => setShowAdd(false)} onAdded={() => { setShowAdd(false); fetchData() }} />
      )}
    </div>
  )
}

function AddEmployeeModal({ onClose, onAdded }) {
  const [form, setForm] = useState({ name: '', email: '', hire_date: '', role: 'employee', current_level: 1, status: 'active' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data: emp, error: empErr } = await supabase.from('employees').insert([{
      ...form, current_level: parseInt(form.current_level)
    }]).select().single()

    if (empErr) { setError(empErr.message); setLoading(false); return }

    if (form.hire_date) {
      await supabase.rpc('seed_recurrents', { emp_id: emp.id, hire: form.hire_date })
    }

    onAdded()
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="modal-title">Add Employee</div>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} required placeholder="First Last" />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" value={form.email} onChange={e => set('email', e.target.value)} required placeholder="employee@flyalaskaseaplanes.com" />
          </div>
          <div className="form-group">
            <label className="form-label">Hire Date</label>
            <input className="form-input" type="date" value={form.hire_date} onChange={e => set('hire_date', e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
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
              <label className="form-label">Starting Level</label>
              <select className="form-input form-select" value={form.current_level} onChange={e => set('current_level', e.target.value)}>
                {[1,2,3,4,5].map(l => <option key={l} value={l}>Level {l}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-input form-select" value={form.status} onChange={e => set('status', e.target.value)}>
              <option value="active">Active</option>
              <option value="seasonal">Seasonal</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          {error && <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 12 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>
              {loading ? 'Adding...' : 'Add Employee'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
