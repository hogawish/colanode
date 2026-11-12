import { render, screen } from '@testing-library/react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { describe, expect, it, vi } from 'vitest';

import {
  SharedDatabaseBlock,
  SharedDatabasesContext,
} from '@colanode/ui/components/pages/shared-database';

vi.mock(import('@tanstack/react-router'), async (original) => ({
  ...(await original()),
  useNavigate: () => vi.fn(),
}));
vi.mock('@colanode/ui/contexts/app', () => ({
  useApp: () => ({ type: 'web' }),
}));
vi.mock('@colanode/ui/hooks/use-metadata', () => ({
  useMetadata: () => [undefined, vi.fn()],
}));

describe('shared database', () => {
  it('uses the database table view to render fields and rows without edit controls', async () => {
    const base = {
      rootId: 'spacesp',
      createdAt: '2026-11-12T00:00:00Z',
      createdBy: 'creatorus',
      updatedAt: null,
      updatedBy: null,
    };
    vi.stubGlobal('colanode', {
      executeMutation: vi.fn().mockResolvedValue({
        success: true,
        output: {
          action: 'read-database',
          database: {
            database: {
              ...base,
              id: 'exampledb',
              type: 'database',
              parentId: 'examplepg',
              name: 'Example database',
              fields: {
                note: {
                  id: 'note',
                  type: 'text',
                  name: 'Comment',
                  index: 'a0',
                },
              },
            },
            nodes: [
              {
                ...base,
                id: 'defaultdv',
                type: 'database_view',
                parentId: 'exampledb',
                name: 'Default',
                layout: 'table',
                index: 'a0',
              },
              {
                ...base,
                id: 'examplecr',
                type: 'record',
                parentId: 'exampledb',
                databaseId: 'exampledb',
                name: 'Example row',
                fields: { note: { type: 'text', value: 'Example note' } },
              },
            ],
          },
        },
      }),
    });

    render(
      <SharedDatabasesContext.Provider
        value={{
          pageId: 'examplepg',
          databases: new Map([
            ['exampledb', { id: 'exampledb', name: 'Example database' }],
          ]),
        }}
      >
        <DndProvider backend={HTML5Backend}>
          <SharedDatabaseBlock id="exampledb" inline />
        </DndProvider>
      </SharedDatabasesContext.Provider>
    );
    expect(await screen.findByText('Example row')).toBeVisible();
    expect(screen.getByText('Default')).toBeVisible();
    expect(screen.getByText('Comment')).toBeVisible();
    expect(screen.getByDisplayValue('Example note')).toHaveAttribute('readonly');
    expect(screen.queryByText('Add record')).toBeNull();
  });
});
