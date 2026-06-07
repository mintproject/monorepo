import { describe, expect, it } from 'vitest';
import { buildCreateModelFamilyVariables, resolveSubmitPlan } from '@/lib/create-model';
import { SOFTWARE_TYPE_MODEL } from '@/schemas/registration';
import { emptyCreateModel } from '@/schemas/registration';

describe('buildCreateModelFamilyVariables', () => {
  it('generates ids and defaults the version label to the family name', () => {
    const vars = buildCreateModelFamilyVariables('PIHM', '');
    expect(vars.softwareLabel).toBe('PIHM');
    expect(vars.softwareType).toBe(SOFTWARE_TYPE_MODEL);
    expect(vars.versionLabel).toBe('PIHM'); // falls back to family name when blank
    expect(vars.softwareId).toMatch(/^https?:\/\//);
    expect(vars.versionId).toMatch(/^https?:\/\//);
    expect(vars.versionId).not.toBe(vars.softwareId);
  });

  it('uses the supplied version label when present', () => {
    const vars = buildCreateModelFamilyVariables('PIHM', '2024.1');
    expect(vars.versionLabel).toBe('2024.1');
  });
});

describe('resolveSubmitPlan', () => {
  it('standalone: no family create, null software_version_id', () => {
    const plan = resolveSubmitPlan({ ...emptyCreateModel(), label: 'M' });
    expect(plan.createFamily).toBeNull();
    expect(plan.softwareVersionId).toBeNull();
  });

  it('existing: links to the chosen version, no family create', () => {
    const plan = resolveSubmitPlan({
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
    expect(plan.createFamily).toBeNull();
    expect(plan.softwareVersionId).toBe('v2013');
  });

  it('new: schedules a family create and links to its new version', () => {
    const plan = resolveSubmitPlan({
      ...emptyCreateModel(),
      label: 'M',
      modelFamily: { mode: 'new', familyName: 'PIHM', versionName: '2024.1' },
    });
    expect(plan.createFamily).not.toBeNull();
    expect(plan.softwareVersionId).toBe(plan.createFamily!.versionId);
  });
});
