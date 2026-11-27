// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { preparedArchetypeDetail } from '../../src/lib/catalog/imported-archetype';
import { importedArchetypeDetailSchema } from '../../src/lib/catalog/imported-entry-schema';

// rotation-3: an imported archetype that changes the class skills says so
// with `changesClassSkills: true`, also where no added or removed skill is
// recorded, and the release converter carries it to the stored definition,
// where the sheet gives it the class skills' feature identity.

const detail = {
  kind: 'archetype' as const,
  classKeys: ['pf1/fighter'],
  replaces: [],
  adds: [],
};
const resolve = (key: string) => ({ id: `id:${key}`, ruleIdentity: key });

describe('an imported archetype that changes the class skills', () => {
  it('accepts only true for changesClassSkills', () => {
    expect(
      importedArchetypeDetailSchema.parse({
        ...detail,
        changesClassSkills: true,
      }),
    ).toMatchObject({ changesClassSkills: true });
    for (const value of [false, 'yes', 1])
      expect(
        importedArchetypeDetailSchema.safeParse({
          ...detail,
          changesClassSkills: value,
        }).success,
        String(value),
      ).toBe(false);
  });

  it('is carried to the prepared definition, and absent when not set', () => {
    expect(
      preparedArchetypeDetail({ ...detail, changesClassSkills: true }, resolve),
    ).toEqual({
      kind: 'archetype',
      classEntryIds: ['id:pf1/fighter'],
      replaces: [],
      adds: [],
      changesClassSkills: true,
    });
    expect(preparedArchetypeDetail(detail, resolve)).not.toHaveProperty(
      'changesClassSkills',
    );
  });
});
