import { describe, it, expect } from 'vitest'
import { PLAN_TEMPLATES, buildTemplate, templateExerciseIds } from './plans.js'
import { EXIDX } from './exercises.js'

describe('suggested plans', () => {
  it('references only real, non-cardio exercises in the shipped catalogue', () => {
    for (const tpl of PLAN_TEMPLATES) {
      for (const id of templateExerciseIds(tpl)) {
        const ex = EXIDX[id]
        expect(ex, `${tpl.key} references missing exercise ${id}`).toBeTruthy()
        expect(ex.bp, `${tpl.key} → ${id} is cardio`).not.toBe('cardio')
      }
    }
  })

  it('builds fresh routines (unique ids) with a valid whole-week schedule', () => {
    for (const tpl of PLAN_TEMPLATES) {
      const { routines, week } = buildTemplate(tpl)
      expect(routines).toHaveLength(tpl.routines.length)
      expect(new Set(routines.map(r => r.id)).size).toBe(routines.length)
      for (const r of routines) {
        expect(r.ex.length).toBeGreaterThan(0)
        expect(r.ex.every(e => e.id && e.sets > 0 && e.reps > 0)).toBe(true)
      }
      const ids = new Set(routines.map(r => r.id))
      const days = Object.keys(week)
      expect(days.length).toBeGreaterThan(0)
      expect(days.every(d => +d >= 0 && +d <= 6)).toBe(true)
      expect(Object.values(week).every(v => ids.has(v))).toBe(true)
    }
  })
})
