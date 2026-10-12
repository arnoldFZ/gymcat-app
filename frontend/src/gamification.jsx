import { useRef, useState } from 'react'
import { useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { t } from './lib/i18n.js'
import { fmtDate, uid } from './lib/format.js'
import { MOBILE, shareExport } from './lib/mobile.js'
import Icon from './components/Icon.jsx'
import { Button, Switch, TextField, NumberField, SelectRow, Stepper } from './components/ui.jsx'
import { confirmSheet } from './sheets.jsx'
import {
  balance, redeem, canRedeem,
  rewardsCatalog, redemptionHistory,
  rulesOf, targetForWeek, DEFAULT_RULES, entries, pointsByType
} from './lib/gamification/index.js'

const ui = () => useUI.getState()
const toast = m => ui().toast(m)

// Ensure the gamification container exists, then run a mutation on it.
function editGam(fn) {
  useStore.getState().update(s => {
    if (!s.gam) s.gam = { rules: null, ledger: [], rewards: [] }
    if (!s.gam.ledger) s.gam.ledger = []
    if (!s.gam.rewards) s.gam.rewards = []
    fn(s.gam)
  })
}

/* ============================== rewards catalog ============================== */

export const rewardsSheet = () => ui().openSheet(close => <RewardsSheet close={close} />, { kind: 'center' })

function RewardsSheet({ close }) {
  const S = useStore(s => s.S)
  const fileRef = useRef(null)
  const bal = balance(S.gam && S.gam.ledger)
  const rewards = rewardsCatalog(S)
  const history = redemptionHistory(S).slice().reverse()

  return <>
    <h3>{t('Rewards')}</h3>
    <div className="row between" style={{ marginBottom: 12 }}>
      <span className="muted small">{t('Available points')}</span>
      <span style={{ fontWeight: 600, fontSize: 18 }}>{bal}</span>
    </div>

    {rewards.length ? (
      <div className="list">
        {rewards.map(r => {
          const off = r.active === false
          const afford = !off && bal >= (+r.cost || 0)
          return (
            <div key={r.id} className={'item' + (off ? ' dim' : '')} onClick={() => rewardDetailSheet(r)}>
              <span className="lrow-i" style={afford ? { background: 'var(--acc-soft)', color: 'var(--acc)' } : undefined}><Icon name="medal" /></span>
              <div className="grow">
                <div className="tt">{r.name}</div>
                <div className="ss">{(r.desc ? r.desc + ' · ' : '') + t('{0} points', r.cost)}</div>
              </div>
              {off ? <span className="tag">{t('Off')}</span>
                : afford ? <span className="tag acc">{t('Redeem')}</span>
                  : <span className="dim small">{t('{0} to go', (+r.cost || 0) - bal)}</span>}
            </div>
          )
        })}
      </div>
    ) : <>
      <div className="muted small" style={{ marginBottom: 10 }}>{t('No rewards yet — add one to give those points somewhere to go.')}</div>
      <Button icon="sparkles" onClick={addExampleRewards}>{t('Add example rewards')}</Button>
    </>}

    <div style={{ height: 12 }} />
    <Button variant="primary" icon="plus" onClick={() => rewardEditSheet(null)}>{t('Add reward')}</Button>
    <div style={{ height: 8 }} />
    <div className="row" style={{ gap: 8 }}>
      <Button icon="download" style={{ flex: 1 }} onClick={() => exportRewards(rewards)}>{t('Export')}</Button>
      <Button icon="upload" style={{ flex: 1 }} onClick={() => fileRef.current?.click()}>{t('Import')}</Button>
    </div>
    <input ref={fileRef} type="file" accept="application/json,.json" style={{ display: 'none' }}
      onChange={e => { const f = e.target.files[0]; e.target.value = ''; if (f) importRewardsFile(f) }} />

    {history.length > 0 && <>
      <h4 className="sec" style={{ marginTop: 18 }}>{t('Redeemed')}</h4>
      <div className="list">
        {history.map(e => (
          <div key={e.id} className="item">
            <span className="lrow-i" style={{ background: 'var(--surface-2)' }}><Icon name="check" /></span>
            <div className="grow"><div className="tt">{e.name || t('Reward')}</div><div className="ss">{fmtDate(e.date.slice(0, 10), true)}</div></div>
            <span className="dim">{e.delta}</span>
          </div>
        ))}
      </div>
    </>}
  </>
}

/* ============================== reward detail ============================== */

function rewardDetailSheet(reward) {
  ui().openSheet(close => {
    const S = useStore.getState().S
    const bal = balance(S.gam && S.gam.ledger)
    const afford = canRedeem(S, reward)
    return <>
      <h3>{reward.name}</h3>
      {reward.desc && <div className="muted small" style={{ marginBottom: 8 }}>{reward.desc}</div>}
      <div className="row between" style={{ marginBottom: 14 }}>
        <span className="muted small">{t('Cost')}</span><span style={{ fontWeight: 600 }}>{t('{0} points', reward.cost)}</span>
      </div>
      {afford
        ? <Button variant="primary" icon="medal" onClick={() => { close(); redeemReward(reward) }}>{t('Redeem')}</Button>
        : <div className="muted small" style={{ marginBottom: 6 }}>{t('Not enough points yet — {0} to go.', Math.max(0, (+reward.cost || 0) - bal))}</div>}
      <div style={{ height: 8 }} />
      <Button icon="pencil" onClick={() => { close(); rewardEditSheet(reward) }}>{t('Edit')}</Button>
      <div style={{ height: 8 }} />
      <Button variant="ghost" className="dim" onClick={close}>{t('Close')}</Button>
    </>
  })
}

/* ============================== redeem ============================== */

function redeemReward(reward) {
  const id = uid()   // one id per confirmation — a retry reuses it and is a no-op
  confirmSheet({
    title: t('Redeem {0}?', reward.name),
    message: t('This spends {0} points.', reward.cost),
    confirmText: t('Redeem'),
    onConfirm: () => {
      const res = redeem(useStore.getState().S, reward.id, id)
      if (!res.ok) { toast(t('Not enough points')); return }
      editGam(g => { g.ledger = res.ledger })
      toast(t('Redeemed {0}', reward.name))
    }
  })
}

/* ============================== add / edit ============================== */

function rewardEditSheet(reward) {
  ui().openSheet(close => <RewardEdit reward={reward} close={close} />, { kind: 'center' })
}

function RewardEdit({ reward, close }) {
  const [name, setName] = useState(reward ? reward.name : '')
  const [desc, setDesc] = useState(reward ? (reward.desc || '') : '')
  const [cost, setCost] = useState(reward ? Number(reward.cost) || 0 : 100)
  const [active, setActive] = useState(reward ? reward.active !== false : true)
  const canSave = name.trim().length > 0 && (+cost || 0) > 0

  const save = () => {
    if (!canSave) return
    const rec = { id: reward ? reward.id : uid(), name: name.trim(), desc: desc.trim(), cost: Math.max(1, Math.round(+cost || 0)), active }
    editGam(g => {
      const i = g.rewards.findIndex(r => r.id === rec.id)
      if (i >= 0) g.rewards[i] = rec; else g.rewards.push(rec)
    })
    close()
    toast(reward ? t('Reward updated') : t('Reward added'))
  }
  const remove = () => confirmSheet({
    title: t('Delete {0}?', reward.name),
    message: t('Past redemptions stay in your history.'),
    confirmText: t('Delete'), danger: true,
    onConfirm: () => { editGam(g => { g.rewards = g.rewards.filter(r => r.id !== reward.id) }); close(); toast(t('Reward deleted')) }
  })

  return <>
    <h3>{reward ? t('Edit reward') : t('New reward')}</h3>
    <label className="sect-t" htmlFor="rw-name">{t('Name')}</label>
    <TextField id="rw-name" value={name} onChange={e => setName(e.target.value)} maxLength={40} placeholder={t('e.g. a good coffee')} />
    <div style={{ height: 10 }} />
    <label className="sect-t" htmlFor="rw-desc">{t('Description')}</label>
    <TextField id="rw-desc" value={desc} onChange={e => setDesc(e.target.value)} maxLength={80} placeholder={t('optional')} />
    <div style={{ height: 10 }} />
    <label className="sect-t" htmlFor="rw-cost">{t('Cost (points)')}</label>
    <NumberField id="rw-cost" value={cost} onChange={setCost} decimal={false} />
    <div className="row between" style={{ marginTop: 12 }}>
      <span>{t('Active')}</span>
      <Switch checked={active} onChange={setActive} />
    </div>
    <div style={{ height: 12 }} />
    <Button variant="primary" disabled={!canSave} icon="check" onClick={save}>{t('Save')}</Button>
    {reward && <><div style={{ height: 8 }} /><Button variant="danger" icon="trash" onClick={remove}>{t('Delete')}</Button></>}
    <div style={{ height: 8 }} />
    <Button variant="ghost" className="dim" onClick={close}>{t('Cancel')}</Button>
  </>
}

/* ============================== example rewards ============================== */

// Opt-in only: the brief says not to impose rigid personal prizes, so these are
// clearly labelled examples the user can edit or delete.
function addExampleRewards() {
  editGam(g => {
    const ex = [
      { id: uid(), name: t('A good coffee'), desc: '', cost: 150, active: true },
      { id: uid(), name: t('A rest day'), desc: '', cost: 400, active: true },
      { id: uid(), name: t('New gear'), desc: '', cost: 1000, active: true }
    ]
    const have = new Set(g.rewards.map(r => (r.name || '').toLowerCase()))
    for (const r of ex) if (!have.has(r.name.toLowerCase())) g.rewards.push(r)
  })
  toast(t('Example rewards added'))
}

/* ============================== import / export ============================== */

// Export ONLY the reward catalogue (small, shareable) — points and history stay in
// the full backup. Mobile uses the OS share sheet; the web downloads a file.
async function exportRewards(rewards) {
  const day = new Date().toISOString().slice(0, 10)
  const json = JSON.stringify({ gymcat_rewards: 1, exported: day, rewards }, null, 2)
  const name = 'gymcat-rewards-' + day + '.json'
  if (MOBILE) {
    try { await shareExport(json, name); toast(t('Rewards exported')) } catch { /* dismissed */ }
    return
  }
  try {
    const blob = new Blob([json], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href)
    toast(t('Rewards exported'))
  } catch { toast(t('Export failed')) }
}

// Merge an imported catalogue into the current one: never overwrites, skips rewards
// that already exist by name, and validates each record.
function importRewardsFile(file) {
  const rd = new FileReader()
  rd.onload = () => {
    try {
      const data = JSON.parse(rd.result)
      const list = Array.isArray(data) ? data : (data && data.rewards)
      if (!Array.isArray(list)) throw new Error(t('not a GymCat rewards file'))
      let added = 0
      editGam(g => {
        const have = new Set(g.rewards.map(r => (r.name || '').toLowerCase()))
        for (const r of list) {
          const name = String(r && r.name || '').trim().slice(0, 40)
          if (!name || have.has(name.toLowerCase())) continue
          g.rewards.push({
            id: uid(), name,
            desc: String((r && r.desc) || '').slice(0, 80),
            cost: Math.max(1, Math.round(+(r && r.cost) || 0)) || 100,
            active: !r || r.active !== false
          })
          have.add(name.toLowerCase()); added++
        }
      })
      toast(t('{0} rewards imported', added))
    } catch (e) { toast(t('Import failed: {0}', e.message)) }
  }
  rd.readAsText(file)
}

/* ============================== points import / export ============================== */

async function exportLedger(ledger) {
  const day = new Date().toISOString().slice(0, 10)
  const json = JSON.stringify({ gymcat_ledger: 1, exported: day, ledger }, null, 2)
  const name = 'gymcat-points-' + day + '.json'
  if (MOBILE) {
    try { await shareExport(json, name); toast(t('Points exported')) } catch { /* dismissed */ }
    return
  }
  try {
    const blob = new Blob([json], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href)
    toast(t('Points exported'))
  } catch { toast(t('Export failed')) }
}

// Merge by idempotency key: the ledger is append-only and keyed, so importing an
// overlapping file can only ADD missing movements, never duplicate points.
function importLedgerFile(file) {
  const rd = new FileReader()
  rd.onload = () => {
    try {
      const data = JSON.parse(rd.result)
      const list = Array.isArray(data) ? data : (data && data.ledger)
      if (!Array.isArray(list)) throw new Error(t('not a GymCat points file'))
      let added = 0
      editGam(g => {
        const have = new Set((g.ledger || []).map(e => e.key))
        for (const e of list) {
          if (!e || !e.key || have.has(e.key)) continue
          g.ledger.push({
            id: e.id || uid(), type: e.type || 'movement', delta: +e.delta || 0, key: e.key,
            ref: e.ref || {}, meta: e.meta || {}, date: e.date || new Date().toISOString()
          })
          have.add(e.key); added++
        }
      })
      toast(t('{0} movements imported', added))
    } catch (e) { toast(t('Import failed: {0}', e.message)) }
  }
  rd.readAsText(file)
}

/* ============================== scoring rules ============================== */

const TZ_OPTIONS = [
  'America/Lima', 'America/Bogota', 'America/Mexico_City', 'America/Santiago',
  'America/Argentina/Buenos_Aires', 'America/New_York', 'Europe/Madrid',
  'Europe/Lisbon', 'Europe/London', 'UTC'
]

export const rulesSheet = () => ui().openSheet(close => <RulesEdit close={close} />, { kind: 'center' })

function RulesEdit({ close }) {
  const S = useStore(s => s.S)
  const r = rulesOf(S)
  const [target, setTarget] = useState(r.weeklyTarget)
  const [pts, setPts] = useState(r.sessionPoints)
  const [wkBonus, setWkBonus] = useState(r.weeklyBonus)
  const [cycWeeks, setCycWeeks] = useState(r.cycleWeeks)
  const [cycBonus, setCycBonus] = useState(r.cycleBonus)
  const [tz, setTz] = useState(r.tz)

  const save = () => {
    editGam(g => {
      g.rules = {
        weeklyTarget: Math.max(1, Math.round(+target || 1)),
        sessionPoints: Math.max(0, Math.round(+pts || 0)),
        weeklyBonus: Math.max(0, Math.round(+wkBonus || 0)),
        cycleWeeks: Math.max(2, Math.round(+cycWeeks || 4)),
        cycleBonus: Math.max(0, Math.round(+cycBonus || 0)),
        tz,
        ruleVersion: DEFAULT_RULES.ruleVersion
      }
    })
    close()
    toast(t('Rules saved'))
  }
  const reset = () => {
    editGam(g => { g.rules = null })
    close()
    toast(t('Rules reset to defaults'))
  }

  return <>
    <h3>{t('Scoring rules')}</h3>
    <div className="muted small" style={{ marginBottom: 12 }}>{t('Changes apply to future points. Past movements keep the rule version they were scored with.')}</div>

    <label className="sect-t" htmlFor="rw-target">{t('Sessions per week (goal)')}</label>
    <NumberField id="rw-target" value={target} onChange={setTarget} decimal={false} />
    <div style={{ height: 10 }} />
    <label className="sect-t" htmlFor="rw-pts">{t('Points per session')}</label>
    <NumberField id="rw-pts" value={pts} onChange={setPts} decimal={false} />
    <div style={{ height: 10 }} />
    <label className="sect-t" htmlFor="rw-wkbonus">{t('Weekly goal bonus')}</label>
    <NumberField id="rw-wkbonus" value={wkBonus} onChange={setWkBonus} decimal={false} />
    <div style={{ height: 10 }} />
    <label className="sect-t" htmlFor="rw-cycweeks">{t('Weeks per cycle')}</label>
    <NumberField id="rw-cycweeks" value={cycWeeks} onChange={setCycWeeks} decimal={false} />
    <div style={{ height: 10 }} />
    <label className="sect-t" htmlFor="rw-cycbonus">{t('Cycle bonus')}</label>
    <NumberField id="rw-cycbonus" value={cycBonus} onChange={setCycBonus} decimal={false} />
    <div style={{ height: 12 }} />

    <div className="sect-b" style={{ marginBottom: 12 }}>
      <SelectRow icon="globe" iconTint="var(--blue)" title={t('Week timezone')} value={tz} onChange={setTz} sheetTitle={t('Week timezone')}
        options={[...new Set([tz, ...TZ_OPTIONS])].map(z => ({ value: z, label: z }))} />
    </div>

    <Button variant="primary" icon="check" onClick={save}>{t('Save')}</Button>
    <div style={{ height: 8 }} />
    <Button variant="ghost" className="dim" onClick={reset}>{t('Reset to defaults')}</Button>
    <div style={{ height: 8 }} />
    <Button variant="ghost" className="dim" onClick={close}>{t('Cancel')}</Button>
  </>
}

/* ============================== per-week goal ============================== */

// Override the weekly target for a single week, straight from the dashboard.
export const weekGoalSheet = weekKey => ui().openSheet(close => <WeekGoal weekKey={weekKey} close={close} />, { kind: 'center' })

function WeekGoal({ weekKey, close }) {
  const S = useStore(s => s.S)
  const base = rulesOf(S).weeklyTarget
  const [n, setN] = useState(targetForWeek(S, weekKey))
  const custom = targetForWeek(S, weekKey) !== base
  const save = () => {
    editGam(g => { g.weekTargets = { ...(g.weekTargets || {}), [weekKey]: Math.max(1, Math.round(+n || 1)) } })
    close(); toast(t('Goal updated'))
  }
  const clear = () => {
    editGam(g => { if (g.weekTargets) delete g.weekTargets[weekKey] })
    close(); toast(t('Using your general goal'))
  }
  return <>
    <h3>{t('This week’s goal')}</h3>
    <div className="muted small" style={{ marginBottom: 10 }}>{t('General goal: {0} sessions.', base)}</div>
    <Stepper value={n} step={1} decimal={false} label={t('Sessions')} unit={t('this week')} onChange={setN} />
    <div style={{ height: 12 }} />
    <Button variant="primary" icon="check" onClick={save}>{t('Save')}</Button>
    {custom && <><div style={{ height: 8 }} /><Button variant="ghost" className="dim" onClick={clear}>{t('Use the general goal')}</Button></>}
    <div style={{ height: 8 }} />
    <Button variant="ghost" className="dim" onClick={close}>{t('Cancel')}</Button>
  </>
}

/* ============================== points history ============================== */

const MOVE_ICON = { session: 'dumbbell', week_bonus: 'flame', cycle_bonus: 'crown', redeem: 'medal', compensation: 'reset' }
function moveLabel(e) {
  switch (e.type) {
    case 'session': return t('Session')
    case 'week_bonus': return t('Weekly bonus')
    case 'cycle_bonus': return t('Cycle bonus')
    case 'redeem': return (e.meta && e.meta.name) || t('Reward')
    case 'compensation': return t('Adjustment')
    default: return e.type || t('Movement')
  }
}
function moveHint(e) {
  const d = e.date ? fmtDate(String(e.date).slice(0, 10), true) : ''
  if (e.type === 'week_bonus' || e.type === 'cycle_bonus') return [d, e.ref && e.ref.weekKey].filter(Boolean).join(' · ')
  if (e.type === 'session' && e.meta && e.meta.d) return [d, e.meta.d].filter(Boolean).join(' · ')
  return d
}

export const ledgerSheet = () => ui().openSheet(close => <LedgerSheet close={close} />, { kind: 'center' })

function LedgerSheet({ close }) {
  const S = useStore(s => s.S)
  const fileRef = useRef(null)
  const ledger = S.gam && S.gam.ledger
  const rows = entries(ledger).slice().reverse()
  const byt = pointsByType(ledger)
  const parts = [
    byt.session ? t('{0} from sessions', byt.session) : null,
    (byt.week_bonus || byt.cycle_bonus) ? t('{0} from bonuses', (byt.week_bonus || 0) + (byt.cycle_bonus || 0)) : null,
    byt.redeem ? t('{0} spent', Math.abs(byt.redeem)) : null
  ].filter(Boolean)

  return <>
    <h3>{t('Points history')}</h3>
    <div className="row between" style={{ marginBottom: 6 }}>
      <span className="muted small">{t('Available points')}</span>
      <span style={{ fontWeight: 600, fontSize: 18 }}>{balance(ledger)}</span>
    </div>
    {parts.length > 0 && <div className="dim small" style={{ marginBottom: 12 }}>{parts.join(' · ')}</div>}

    {rows.length ? (
      <div className="list">
        {rows.map(e => (
          <div key={e.id} className="item">
            <span className="lrow-i" style={{ background: 'var(--surface-2)' }}><Icon name={MOVE_ICON[e.type] || 'dot'} /></span>
            <div className="grow"><div className="tt">{moveLabel(e)}</div><div className="ss">{moveHint(e)}</div></div>
            <span style={{ fontWeight: 600, color: (+e.delta || 0) >= 0 ? 'var(--acc)' : 'var(--label-2)' }}>{(+e.delta || 0) >= 0 ? '+' : ''}{e.delta}</span>
          </div>
        ))}
      </div>
    ) : <div className="muted small">{t('No movements yet.')}</div>}

    <div style={{ height: 10 }} />
    <div className="row" style={{ gap: 8 }}>
      <Button icon="download" style={{ flex: 1 }} onClick={() => exportLedger(ledger)}>{t('Export')}</Button>
      <Button icon="upload" style={{ flex: 1 }} onClick={() => fileRef.current?.click()}>{t('Import')}</Button>
    </div>
    <input ref={fileRef} type="file" accept="application/json,.json" style={{ display: 'none' }}
      onChange={e => { const f = e.target.files[0]; e.target.value = ''; if (f) importLedgerFile(f) }} />
    <div style={{ height: 10 }} />
    <Button variant="ghost" className="dim" onClick={close}>{t('Close')}</Button>
  </>
}
