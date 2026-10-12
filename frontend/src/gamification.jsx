import { useState } from 'react'
import { useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { t } from './lib/i18n.js'
import { fmtDate, uid } from './lib/format.js'
import Icon from './components/Icon.jsx'
import { Button, Switch, TextField, NumberField } from './components/ui.jsx'
import { confirmSheet } from './sheets.jsx'
import {
  balance, applyEvents, tryRedeem, canRedeem,
  rewardsCatalog, redemptionHistory
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
    ) : <div className="muted small">{t('No rewards yet — add one to give those points somewhere to go.')}</div>}

    <div style={{ height: 12 }} />
    <Button variant="primary" icon="plus" onClick={() => rewardEditSheet(null)}>{t('Add reward')}</Button>

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
      const res = tryRedeem(useStore.getState().S, reward.id, id)
      if (!res.ok) { toast(t('Not enough points')); return }
      editGam(g => { g.ledger = applyEvents(g.ledger, res.events, Date.now()) })
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
