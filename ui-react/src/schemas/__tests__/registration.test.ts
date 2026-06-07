import { describe, expect, it } from 'vitest';
import { createModelSchema, emptyCreateModel, SOFTWARE_TYPE_MODEL } from '@/schemas/registration';

describe('createModelSchema', () => {
  it('accepts a minimal standalone model (name only)', () => {
    const parsed = createModelSchema.safeParse({
      ...emptyCreateModel(),
      label: 'Modflow · Barton Springs',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.modelFamily.mode).toBe('none');
    }
  });

  it('rejects a model with no name', () => {
    const parsed = createModelSchema.safeParse({ ...emptyCreateModel(), label: '' });
    expect(parsed.success).toBe(false);
  });

  it('requires a versionId when linking an existing family', () => {
    const parsed = createModelSchema.safeParse({
      ...emptyCreateModel(),
      label: 'M',
      modelFamily: { mode: 'existing', softwareId: 's1', softwareLabel: 'Modflow' },
    });
    expect(parsed.success).toBe(false);
  });

  it('accepts an existing family with a version pair', () => {
    const parsed = createModelSchema.safeParse({
      ...emptyCreateModel(),
      label: 'M',
      modelFamily: {
        mode: 'existing',
        softwareId: 's1',
        softwareLabel: 'Modflow',
        versionId: 'v2013',
        versionLabel: '2013',
      },
    });
    expect(parsed.success).toBe(true);
  });

  it('requires a family name when creating a new family', () => {
    const parsed = createModelSchema.safeParse({
      ...emptyCreateModel(),
      label: 'M',
      modelFamily: { mode: 'new', familyName: '' },
    });
    expect(parsed.success).toBe(false);
  });

  it('keeps SOFTWARE_TYPE_MODEL exported', () => {
    expect(SOFTWARE_TYPE_MODEL).toBe('https://w3id.org/okn/o/sdm#Model');
  });
});
