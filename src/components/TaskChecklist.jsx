import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { TRAINING_DATA, LEVEL_META } from '../data/training'

function levelColor(l) {
  const map = { 1: 'var(--l1)', 2: 'var(--l2)', 3: 'var(--l3)', 4: 'var(--l4)', 5: 'var(--l5)' }
  return map[l] || 'var(--muted)'
}
function levelBg(l) {
  const map = { 1: 'var(--l1bg)', 2: 'var(--l2bg)', 3: 'var(--l3bg)', 4: 'var(--l4bg)', 5: 'var(--l5bg)' }
  return map[l] || 'var(--bg)'
}

function BulkModal({ title, onConfirm, onClose, saving }) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{title}</div>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>
          This will mark all incomplete tasks as signed off by you. Pick the completion date — you can backdate for existing staff.
        </p>
        <div className="form-group">
          <label className="form-label">Date completed</label>
          <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{ flex: 1, background: 'var(--green)' }} disabled={saving}
            onClick={() => onConfirm(date)}>
            {saving ? 'Saving...' : 'Mark all complete'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function TaskChecklist({ employee, currentEmployee, onAdvancement }) {
  const [completions, setCompletions] = useState({})
  const [openModules, setOpenModules] = useState({})
  const [pendingTask, setPendingTask] = useState(null)
  const [undoTask, setUndoTask] = useState(null)
  const [signoffDate, setSignoffDate] = useState(new Date().toISOString().split('T')[0])
  const [signoffDuration, setSignoffDuration] = useState('')
  const [saving, setSaving] = useState(false)
  const [activeLevel, setActiveLevel] = useState(employee.current_level)
  const [bulkModal, setBulkModal] = useState(null)

  const canSignOff = ['trainer', 'supervisor', 'director'].includes(currentEmployee.role)

  useEffect(() => { fetchCompletions() }, [employee.id])

  async function fetchCompletions() {
    const { data } = await supabase.from('task_completions')
      .select('*').eq('employee_id', employee.id)
    const map = {}
    data?.forEach(c => { map[`${c.level}::${c.module_name}::${c.task_text}`] = c })
    setCompletions(map)
  }

  function taskKey(level, moduleName, taskText) {
    return `${level}::${moduleName}::${taskText}`
  }

  async function signOffTask(level, moduleName, taskText) {
    setSaving(true)
    await supabase.from('task_completions').insert([{
      employee_id: employee.id,
      level,
      module_name: moduleName,
      task_text: taskText,
      signed_off_by_id: currentEmployee.id,
      signed_off_by_name: currentEmployee.name,
      completed_date: signoffDate,
      duration_minutes: signoffDuration ? parseInt(signoffDuration) : null,
    }])
    await fetchCompletions()
    setSaving(false)
    setPendingTask(null)
    setSignoffDate(new Date().toISOString().split('T')[0])
    setSignoffDuration('')
  }

  async function undoSignOff(completionId) {
    setSaving(true)
    await supabase.from('task_completions').delete().eq('id', completionId)
    await fetchCompletions()
    setSaving(false)
    setUndoTask(null)
  }

  async function bulkSignOff(date) {
    setSaving(true)
    const rows = []
    if (bulkModal === 'level') {
      const lvl = TRAINING_DATA[activeLevel]
      if (lvl) {
        lvl.modules.forEach(mod => {
          mod.tasks.forEach(task => {
            if (!completions[taskKey(activeLevel, mod.name, task)]) {
              rows.push({
                employee_id: employee.id,
                level: activeLevel,
                module_name: mod.name,
                task_text: task,
                signed_off_by_id: currentEmployee.id,
                signed_off_by_name: currentEmployee.name,
                completed_date: date,
              })
            }
          })
        })
      }
    } else if (bulkModal?.moduleId) {
      const lvl = TRAINING_DATA[activeLevel]
      const mod = lvl?.modules.find(m => m.id === bulkModal.moduleId)
      if (mod) {
        mod.tasks.forEach(task => {
          if (!completions[taskKey(activeLevel, mod.name, task)]) {
            rows.push({
              employee_id: employee.id,
              level: activeLevel,
              module_name: mod.name,
              task_text: task,
              signed_off_by_id: currentEmployee.id,
              signed_off_by_name: currentEmployee.name,
              completed_date: date,
            })
          }
        })
      }
    }
    if (rows.length > 0) {
      await supabase.from('task_completions').insert(rows)
    }
    await fetchCompletions()
    setSaving(false)
    setBulkModal(null)
  }

  function toggleModule(key) {
    setOpenModules(prev => ({ ...prev, [key]: !prev[key] }))
  }

  function levelProgress(level) {
    const lvl = TRAINING_DATA[level]
    if (!lvl) return { done: 0, total: 0 }
    let done = 0, total = 0
    lvl.modules.forEach(m => {
      m.tasks.forEach(t => {
        total++
        if (completions[taskKey(level, m.name, t)]) done++
      })
    })
    return { done, total }
  }

  const maxLevel = employee.current_level
  const levels = Array.from({ length: maxLevel }, (_, i) => i + 1)
  const { done: lvlDone, total: lvlTotal } = levelProgress(activeLevel)
  const allDone = lvlDone === lvlTotal && lvlTotal > 0
  const meta = LEVEL_META[activeLevel]
  const lvlIncomplete = lvlTotal - lvlDone

  return (
    <div>
      <div className="tab-bar" style={{ marginBottom: 12 }}>
        {levels.map(l => {
          const { done, total } = levelProgress(l)
          const complete = done === total && total > 0
          return (
            <button key={l} className={`tab-btn ${activeLevel === l ? 'active' : ''}`}
              onClick={() => setActiveLevel(l)}
              style={complete ? { color: 'var(--green)', fontWeight: 600 } : {}}>
              L{l} {complete ? '✓ Done' : `${done}/${total}`}
            </button>
          )
        })}
      </div>

      <div style={{ background: levelBg(activeLevel), borderRadius: 10, padding: '12px 14px', marginBottom: 12, border: `1px solid ${levelColor(activeLevel)}22` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, color: levelColor(activeLevel), fontSize: 15 }}>
              {meta?.label} — {meta?.pay}
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{meta?.gate}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {canSignOff && lvlIncomplete > 0 && (
              <button className="btn btn-sm"
                style={{ background: levelColor(activeLevel), color: 'white', fontSize: 12 }}
                onClick={() => setBulkModal('level')}>
                Sign off all {lvlIncomplete} remaining
              </button>
            )}
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: allDone ? 'var(--green)' : levelColor(activeLevel) }}>
                {allDone ? 'Complete' : `${lvlDone}/${lvlTotal}`}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{allDone ? '🎉 all tasks done' : 'tasks'}</div>
            </div>
          </div>
        </div>
        <div className="progress-bar" style={{ marginTop: 10 }}>
          <div className="progress-fill" style={{ width: `${lvlTotal > 0 ? Math.round((lvlDone / lvlTotal) * 100) : 0}%`, background: allDone ? 'var(--green)' : levelColor(activeLevel) }} />
        </div>
      </div>

      {allDone && activeLevel === employee.current_level && activeLevel < 5 && (currentEmployee.role === 'supervisor' || currentEmployee.role === 'director') && (
        <div style={{ background: 'var(--greenbg)', border: '1px solid var(--green)', borderRadius: 10, padding: '12px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--green)', fontSize: 14 }}>All tasks complete — ready to advance</div>
            <div style={{ fontSize: 12, color: 'var(--green)', opacity: 0.8 }}>{employee.name} is ready for Level {activeLevel + 1} ({LEVEL_META[activeLevel + 1]?.pay})</div>
          </div>
          <button className="btn btn-sm" style={{ background: 'var(--green)', color: 'white' }} onClick={() => onAdvancement(employee, activeLevel)}>
            Advance to L{activeLevel + 1}
          </button>
        </div>
      )}

      {TRAINING_DATA[activeLevel]?.modules.map(mod => {
        const modKey = `${activeLevel}-${mod.id}`
        const isOpen = openModules[modKey] !== false
        const modDone = mod.tasks.filter(t => completions[taskKey(activeLevel, mod.name, t)]).length
        const modIncomplete = mod.tasks.length - modDone
        const modPct = Math.round((modDone / mod.tasks.length) * 100)
        const modComplete = modDone === mod.tasks.length

        return (
          <div key={mod.id} className="module-block">
            <div className="module-hdr" onClick={() => toggleModule(modKey)}>
              <div className="module-hdr-left">
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: modComplete ? 'var(--greenbg)' : levelBg(activeLevel), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: modComplete ? 'var(--green)' : levelColor(activeLevel), fontWeight: 700 }}>
                  {modComplete ? '✓' : `${modDone}`}
                </div>
                <div>
                  <div className="module-name" style={{ color: modComplete ? 'var(--green)' : 'var(--text)' }}>{mod.name}</div>
                  <div className="module-count">{modComplete ? 'Complete' : `${modDone}/${mod.tasks.length} tasks — ${modPct}%`}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={e => e.stopPropagation()}>
                {canSignOff && modIncomplete > 0 && (
                  <button className="btn btn-sm"
                    style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--muted)', fontSize: 11 }}
                    onClick={() => setBulkModal({ moduleId: mod.id, moduleName: mod.name })}>
                    Sign off all
                  </button>
                )}
                <span style={{ fontSize: 12, color: 'var(--muted)', transform: isOpen ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.15s' }}>▼</span>
              </div>
            </div>

            {isOpen && (
              <div className="module-body">
                {mod.tasks.map(task => {
                  const key = taskKey(activeLevel, mod.name, task)
                  const completion = completions[key]
                  const isPending = pendingTask === key
                  const isUndo = undoTask === key

                  return (
                    <div key={task} className="task-row">
                      <div
                        className={`task-check ${completion ? 'done' : 'pending'}`}
                        onClick={() => {
                          if (completion && canSignOff) {
                            setUndoTask(isUndo ? null : key)
                            setPendingTask(null)
                          } else if (!completion && canSignOff) {
                            setPendingTask(isPending ? null : key)
                            setUndoTask(null)
                          }
                        }}
                        title={completion ? 'Click to undo sign-off' : canSignOff ? 'Click to sign off' : ''}
                      >
                        {completion && <span style={{ color: 'white', fontSize: 11 }}>✓</span>}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div className="task-text" style={{ textDecoration: completion ? 'line-through' : 'none', opacity: completion ? 0.6 : 1 }}>
                          {task}
                        </div>
                        {completion && !isUndo && (
                          <div className="task-meta">
                            Signed off by {completion.signed_off_by_name} · {completion.completed_date ? new Date(completion.completed_date).toLocaleDateString() : new Date(completion.completed_at).toLocaleDateString()}{completion.duration_minutes ? ` · ${completion.duration_minutes} min` : ''}
                          </div>
                        )}
                        {completion && isUndo && (
                          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 12, color: 'var(--red)' }}>Undo this sign-off?</span>
                            <button className="btn btn-sm btn-danger" disabled={saving}
                              onClick={() => undoSignOff(completion.id)}>
                              {saving ? '...' : 'Yes, remove it'}
                            </button>
                            <button className="btn btn-sm btn-ghost" onClick={() => setUndoTask(null)}>Cancel</button>
                          </div>
                        )}
                        {isPending && !completion && (
                          <div style={{ marginTop: 8, background: 'var(--bg)', borderRadius: 8, padding: '10px 12px' }}>
                            <div style={{ display: 'flex', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                              <div style={{ flex: 1, minWidth: 140 }}>
                                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 3 }}>Date completed</div>
                                <input type="date" className="form-input" value={signoffDate}
                                  onChange={e => setSignoffDate(e.target.value)}
                                  style={{ padding: '5px 8px', fontSize: 13 }} />
                              </div>
                              <div style={{ flex: 1, minWidth: 120 }}>
                                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 3 }}>Training time (minutes)</div>
                                <input type="number" className="form-input" value={signoffDuration}
                                  onChange={e => setSignoffDuration(e.target.value)}
                                  placeholder="e.g. 30" min="1"
                                  style={{ padding: '5px 8px', fontSize: 13 }} />
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button className="btn btn-sm btn-primary" disabled={saving}
                                onClick={() => signOffTask(activeLevel, mod.name, task)}>
                                {saving ? '...' : 'Confirm sign-off'}
                              </button>
                              <button className="btn btn-sm btn-ghost" onClick={() => setPendingTask(null)}>Cancel</button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {bulkModal && (
        <BulkModal
          title={bulkModal === 'level'
            ? `Sign off all remaining — Level ${activeLevel}`
            : `Sign off all — ${bulkModal.moduleName}`}
          onConfirm={bulkSignOff}
          onClose={() => setBulkModal(null)}
          saving={saving}
        />
      )}
    </div>
  )
}
