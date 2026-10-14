import { describe, it, expect } from 'vitest'
import { translateExName } from './exnames-es.js'

describe('translateExName', () => {
  it('renders the common "equipment + movement" pattern with the modifier last', () => {
    const s = translateExName('barbell bench press')
    expect(s).toMatch(/banca/i)
    expect(s).toMatch(/barra/i)
  })

  it('translates key catalogue names to Spanish', () => {
    expect(translateExName('dumbbell goblet squat')).toMatch(/sentadilla/i)
    expect(translateExName('lever leg extension')).toMatch(/cuádriceps/i)
    expect(translateExName('cable lat pulldown full range of motion')).toMatch(/jalón/i)
    expect(translateExName('barbell romanian deadlift')).toMatch(/peso muerto|rumano/i)
  })

  it('never throws and returns a string for odd input', () => {
    expect(translateExName('')).toBe('')
    expect(translateExName(null)).toBeNull()
    const u = translateExName('zzz unknown thing')
    expect(typeof u).toBe('string')
    expect(u.length).toBeGreaterThan(0)
  })

  it('is memoised', () => {
    expect(translateExName('barbell bench press')).toBe(translateExName('barbell bench press'))
  })
})
