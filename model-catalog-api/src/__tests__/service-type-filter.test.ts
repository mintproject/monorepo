import { describe, it, expect } from 'vitest'
import { getSoftwareTypeFilter } from '../service.js'

describe('getSoftwareTypeFilter', () => {
  it('returns array of 6 URIs for models (all Model subclass types)', () => {
    const result = getSoftwareTypeFilter('models')
    expect(Array.isArray(result)).toBe(true)
    expect(result).toHaveLength(6)
    expect(result).toContain('https://w3id.org/okn/o/sdm#Model')
    expect(result).toContain('https://w3id.org/okn/o/sdm#EmpiricalModel')
    expect(result).toContain('https://w3id.org/okn/o/sdm#CoupledModel')
    expect(result).toContain('https://w3id.org/okn/o/sdm#Emulator')
    expect(result).toContain('https://w3id.org/okn/o/sdm#HybridModel')
    expect(result).toContain('https://w3id.org/okn/o/sdm#Theory-GuidedModel')
  })

  it('returns single string for empiricalmodels', () => {
    const result = getSoftwareTypeFilter('empiricalmodels')
    expect(typeof result).toBe('string')
    expect(result).toBe('https://w3id.org/okn/o/sdm#EmpiricalModel')
  })

  it('returns single string for hybridmodels', () => {
    const result = getSoftwareTypeFilter('hybridmodels')
    expect(typeof result).toBe('string')
    expect(result).toBe('https://w3id.org/okn/o/sdm#HybridModel')
  })

  it('returns single string for coupledmodels', () => {
    const result = getSoftwareTypeFilter('coupledmodels')
    expect(typeof result).toBe('string')
    expect(result).toBe('https://w3id.org/okn/o/sdm#CoupledModel')
  })

  it('returns single string for emulators', () => {
    const result = getSoftwareTypeFilter('emulators')
    expect(typeof result).toBe('string')
    expect(result).toBe('https://w3id.org/okn/o/sdm#Emulator')
  })

  it('returns single string for theory_guidedmodels (underscore alias)', () => {
    const result = getSoftwareTypeFilter('theory_guidedmodels')
    expect(typeof result).toBe('string')
    expect(result).toBe('https://w3id.org/okn/o/sdm#Theory-GuidedModel')
  })

  it('returns single string for theory-guidedmodels (hyphen variant)', () => {
    const result = getSoftwareTypeFilter('theory-guidedmodels')
    expect(typeof result).toBe('string')
    expect(result).toBe('https://w3id.org/okn/o/sdm#Theory-GuidedModel')
  })

  it('returns null for softwares (no type filter)', () => {
    const result = getSoftwareTypeFilter('softwares')
    expect(result).toBeNull()
  })

  it('returns null for persons (non-software type)', () => {
    const result = getSoftwareTypeFilter('persons')
    expect(result).toBeNull()
  })
})
