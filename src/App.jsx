import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Login from './components/Login'
import OverviewBoard from './components/OverviewBoard'
import EmployeeProfile from './components/EmployeeProfile'

export default function App() {
  const [session, setSession] = useState(null)
  const [currentEmployee, setCurrentEmployee] = useState(null)
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchEmployee(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) fetchEmployee(session.user.id)
      else { setCurrentEmployee(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchEmployee(authId) {
    setLoading(true)
    const { data } = await supabase.from('employees').select('*').eq('auth_id', authId).single()
    setCurrentEmployee(data || null)
    setLoading(false)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    setSelectedEmployee(null)
    setCurrentEmployee(null)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--navy)' }}>
      <div className="spinner" style={{ borderTopColor: 'white', borderColor: 'rgba(255,255,255,0.2)' }} />
    </div>
  )

  if (!session) return <Login />

  if (!currentEmployee) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: '1rem' }}>
      <div style={{ fontSize: 36 }}>⚠️</div>
      <div style={{ fontWeight: 600 }}>Account not linked</div>
      <div style={{ color: 'var(--muted)', textAlign: 'center', maxWidth: 320 }}>
        Your account exists but is not linked to an employee record. Contact your supervisor.
      </div>
      <button className="btn btn-ghost" onClick={handleSignOut}>Sign out</button>
    </div>
  )

  const isManager = ['supervisor', 'director'].includes(currentEmployee.role)
  const showingOwnProfile = currentEmployee.role === 'employee' || (!selectedEmployee && !isManager)

  function getView() {
    if (selectedEmployee) return 'profile'
    if (isManager || currentEmployee.role === 'trainer') return 'board'
    return 'profile'
  }

  const view = getView()

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-brand">
          <span className="topbar-logo">✈️</span>
          <div>
            <div className="topbar-title">AKS Ramp Training</div>
          </div>
        </div>
        <div className="topbar-right">
          <span className="topbar-user">{currentEmployee.name}</span>
          {selectedEmployee && isManager && (
            <button className="btn btn-ghost btn-sm" style={{ color: 'rgba(255,255,255,0.7)', borderColor: 'rgba(255,255,255,0.2)' }}
              onClick={() => setSelectedEmployee(null)}>
              ← Team
            </button>
          )}
          <button className="btn btn-ghost btn-sm"
            style={{ color: 'rgba(255,255,255,0.7)', borderColor: 'rgba(255,255,255,0.2)' }}
            onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      </header>

      <main className="main-content">
        {view === 'board' && !selectedEmployee && (
          <OverviewBoard
            currentEmployee={currentEmployee}
            onSelectEmployee={setSelectedEmployee}
          />
        )}

        {view === 'profile' && !selectedEmployee && (
          <EmployeeProfile
            employee={currentEmployee}
            currentEmployee={currentEmployee}
            onBack={null}
          />
        )}

        {selectedEmployee && (
          <EmployeeProfile
            employee={selectedEmployee}
            currentEmployee={currentEmployee}
            onBack={() => setSelectedEmployee(null)}
          />
        )}
      </main>
    </div>
  )
}
