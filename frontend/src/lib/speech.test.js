import { describe, it, expect } from 'vitest'
import { speechText, speechLangs, isSpeechSupported } from './speech.js'

describe('speechText', () => {
  it('joins the name and steps into one readable string', () => {
    expect(speechText('Bench press', ['Lie on the bench.', 'Press up.']))
      .toBe('Bench press. Lie on the bench. Press up.')
  })
  it('collapses whitespace and drops empty steps', () => {
    expect(speechText('  Squat ', ['  Brace.  ', '', null])).toBe('Squat. Brace.')
    expect(speechText('', [])).toBe('')
  })
})

describe('speechLangs', () => {
  it('follows the app language by default', () => {
    expect(speechLangs({ lang: 'es' })).toEqual({ code: 'es', tag: 'es-ES' })
    expect(speechLangs({ lang: 'en' })).toEqual({ code: 'en', tag: 'en-US' })
  })
  it('lets an explicit voice choice win', () => {
    expect(speechLangs({ lang: 'en', speakLang: 'es' }).code).toBe('es')
    expect(speechLangs({ lang: 'es', speakLang: 'en' }).tag).toBe('en-US')
  })
  it('falls back to English for an unknown language', () => {
    expect(speechLangs({ lang: 'de' }).code).toBe('en')
    expect(speechLangs({}).code).toBe('en')
  })
  it('reports unsupported outside a browser (the test runs in node)', () => {
    expect(isSpeechSupported()).toBe(false)
  })
})
