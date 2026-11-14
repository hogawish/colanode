import { z } from 'zod/v4';

const matchMode = z.enum(['all', 'any']);

export const spaceFilterFields = {
  name: 'Space name',
  member: 'Member',
  tag: 'Tag',
} as const;

const spaceFilterRuleSchema = z.object({
  field: z.enum(['name', 'member', 'tag']),
  operator: z.enum(['contains', 'does_not_contain', 'is', 'is_not']),
  value: z.string().refine((value) => value.trim().length > 0),
});

export type SpaceFilterRule = z.infer<typeof spaceFilterRuleSchema>;
export type SpaceFilterGroup = {
  mode: SpaceMatchMode;
  conditions: (SpaceFilterRule | SpaceFilterGroup)[];
};

const spaceFilterGroupSchema: z.ZodType<SpaceFilterGroup> = z.object({
  mode: matchMode,
  conditions: z
    .array(
      z.union([spaceFilterRuleSchema, z.lazy(() => spaceFilterGroupSchema)])
    )
    .min(1),
});

const spaceViewSchema = z.object({
  name: z.string().trim().min(1),
  search: z.string(),
  members: z.array(z.string()),
  tags: z.array(z.string()),
  memberMatch: matchMode.optional(),
  tagMatch: matchMode.optional(),
  advancedFilter: spaceFilterGroupSchema.optional(),
  sort: z.enum(['created', 'name', 'recent']),
});

export type SpaceView = z.infer<typeof spaceViewSchema>;
export type SpaceMatchMode = z.infer<typeof matchMode>;

export const matchesSpaceFilter = <T>(
  selected: T[],
  mode: SpaceMatchMode,
  hasValue: (value: T) => boolean
) =>
  selected.length === 0 ||
  (mode === 'any' ? selected.some(hasValue) : selected.every(hasValue));

export const normalizeSpaceName = (name: string) =>
  name.trim().normalize('NFKC').toLocaleLowerCase();

export const matchesAdvancedSpaceFilter = (
  group: SpaceFilterGroup,
  space: {
    name: string;
    collaborators: Record<string, unknown>;
    tags?: readonly string[];
  }
): boolean =>
  matchesSpaceFilter(group.conditions, group.mode, (condition) => {
    if ('conditions' in condition) {
      return matchesAdvancedSpaceFilter(condition, space);
    }

    const { field, operator, value } = condition;
    if (field === 'name') {
      const name = normalizeSpaceName(space.name);
      const term = normalizeSpaceName(value);
      switch (operator) {
        case 'is':
          return name === term;
        case 'is_not':
          return name !== term;
        case 'contains':
          return name.includes(term);
        case 'does_not_contain':
          return !name.includes(term);
      }
    }

    const includes =
      field === 'member'
        ? Object.hasOwn(space.collaborators, value)
        : (space.tags ?? []).includes(value);
    return operator === 'is_not' || operator === 'does_not_contain'
      ? !includes
      : includes;
  });

const prefix = 'space-view=';

export const buildSpaceViewLink = (
  origin: string,
  workspaceId: string,
  view: SpaceView
) => {
  const url = new URL('/' + encodeURIComponent(workspaceId) + '/home', origin);
  const bytes = new TextEncoder().encode(JSON.stringify(view));
  const data = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
  url.hash =
    prefix +
    btoa(data).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return url.href;
};

export const readSpaceViewHash = (hash: string): SpaceView | null => {
  const fragment = hash.replace(/^#/, '');
  if (!fragment.startsWith(prefix)) return null;

  try {
    const data = atob(
      fragment.slice(prefix.length).replace(/-/g, '+').replace(/_/g, '/')
    );
    const bytes = Uint8Array.from(data, (char) => char.charCodeAt(0));
    const parsed = spaceViewSchema.safeParse(
      JSON.parse(new TextDecoder().decode(bytes))
    );
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};
