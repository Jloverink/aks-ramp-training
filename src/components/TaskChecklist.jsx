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

export default function TaskChecklist({ employee, currentEmployee, onAdvancement }) {
  const [completions, setCompletions] = useState({})
  const [openModules, setOpenModules] = useState({})
  const [pendingTask, setPendingTask] = useState(null)
  const [saving, setSaving] = useState(false)
  const [activeLevel, setActiveLevel] = useState(employee.current_level)

  const canSignOff = ['trainer','supervisor','director'].includes(currentEmployee.role)
    && currentEmployee.id !== employee.id

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
    }])
    await fetchCompletions()
    setSaving(false)
    setPendingTask(null)
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

  return (
    <div>
      {/* Level selector tabs */}
      <div className="tab-bar" style={{ marginBottom: 12 }}>
        {levels.map(l => {
          const { done, total } = levelProgress(l)
          return (
            <button key={l} className={`tab-btn ${activeLevel === l ? 'active' : ''}`}
              onClick={() => setActiveLevel(l)}>
              L{l} {done === total && total > 0 ? '✓' : `${done}/${total}`}
            </button>
          )
        })}
      </div>

      {/* Level header */}
      <div style={{ background: levelBg(activeLevel), borderRadius: 10, padding: '12px 14px', marginBottom: 12, border: `1px solid ${levelColor(activeLevel)}22` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, color: levelColor(activeLevel), fontSize: 15 }}>
              {meta?.label} — {meta?.pay}
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{meta?.gate}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: levelColor(activeLevel) }}>{lvlDone}/{lvlTotal}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>tasks</div>
          </div>
        </div>
        <div className="progress-bar" style={{ marginTop: 10 }}>
          <div className="progress-fill" style={{ width: `${lvlTotal > 0 ? Math.round((lvlDone/lvlTotal)*100) : 0}%`, background: levelColor(activeLevel) }} />
        </div>
      </div>

      {/* Advancement ready banner */}
      {allDone && activeLevel === employee.current_level && activeLevel < 5 && (currentEmployee.role === 'supervisor' || currentEmployee.role === 'director') && (
        <div style={{ background: 'var(--greenbg)', border: '1px solid var(--green)', borderRadius: 10, padding: '12px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--green)', fontSize: 14 }}>All tasks complete</div>
            <div style={{ fontSize: 12, color: 'var(--green)', opacity: 0.8 }}>Ready to advance to Level {activeLevel + 1}</div>
          </div>
          <button className="btn btn-sm" style={{ background: 'var(--green)', color: 'white' }} onClick={() => onAdvancement(employee, activeLevel)}>
            Advance
          </button>
        </div>
      )}

      {/* Module list */}
      {TRAINING_DATA[activeLevel]?.modules.map(mod => {
        const modKey = `${activeLevel}-${mod.id}`
        const isOpen = openModules[modKey] !== false
        const modDone = mod.tasks.filter(t => completions[taskKey(activeLevel, mod.name, t)]).length
        const modPct = Math.round((modDone / mod.tasks.length) * 100)

        return (
          <div key={mod.id} className="module-block">
            <div className="module-hdr" onClick={() => toggleModule(modKey)}>
              <div className="module-hdr-left">
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: modDone === mod.tasks.length ? 'var(--greenbg)' : levelBg(activeLevel), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: modDone === mod.tasks.length ? 'var(--green)' : levelColor(activeLevel), fontWeight: 700 }}>
                  {modDone === mod.tasks.length ? '✓' : `${modDone}`}
                </div>
                <div>
                  <div className="module-name">{mod.name}</div>
                  <div className="module-count">{modDone}/{mod.tasks.length} tasks — {modPct}%</div>
                </div>
              </div>
              <span style={{ fontSize: 12, color: 'var(--muted)', transform: isOpen ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.15s' }}>▼</span>
            </div>

            {isOpen && (
              <div className="module-body">
                {mod.tasks.map(task => {
                  const key = taskKey(activeLevel, mod.name, task)
                  const completion = completions[key]
                  const isPending = pendingTask === key

                  return (
                    <div key={task} className="task-row">
                      <div
                        className={`task-check ${completion ? 'done' : 'pending'}`}
                        onClick={() => {
                          if (!completion && canSignOff) {
                            setPendingTask(isPending ? null : key)
                          }
                        }}
                        title={completion ? `Signed off by ${completion.signed_off_by_name}` : canSignOff ? 'Click to sign off' : ''}
                      >
                        {completion && <span style={{ color: 'white', fontSize: 11 }}>✓</span>}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div className="task-text" style={{ textDecoration: completion ? 'line-through' : 'none', opacity: completion ? 0.6 : 1 }}>
                          {task}
                        </div>
                        {completion && (
                          <div className="task-meta">
                            Signed off by {completion.signed_off_by_name} · {new Date(completion.completed_at).toLocaleDateString()}
                          </div>
                        )}
                        {isPending && !completion && (
                          <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
                            <button className="btn btn-sm btn-primary" disabled={saving} onClick={() => signOffTask(activeLevel, mod.name, task)}>
                              {saving ? '...' : 'Confirm sign-off'}
                            </button>
                            <button className="btn btn-sm btn-ghost" onClick={() => setPendingTask(null)}>Cancel</button>
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
    </div>
  )
}
