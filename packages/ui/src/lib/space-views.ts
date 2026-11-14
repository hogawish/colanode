import { z } from 'zod/v4';

const matchMode = z.enum(['all', 'any']);

const spaceViewSchema = z.object({
  name: z.string().trim().min(1),
  search: z.string(),
  members: z.array(z.string()),
  tags: z.array(z.string()),
  memberMatch: matchMode.optional(),
  tagMatch: matchMode.optional(),
  sort: z.enum(['created', 'name', 'recent']),
});

export type SpaceView = z.infer<typeof spaceViewSchema>;
export type SpaceMatchMode = z.infer<typeof matchMode>;

export const matchesSpaceFilter = (
  selected: string[],
  mode: SpaceMatchMode,
  hasValue: (value: string) => boolean
) =>
  selected.length === 0 ||
  (mode === 'any' ? selected.some(hasValue) : selected.every(hasValue));

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
