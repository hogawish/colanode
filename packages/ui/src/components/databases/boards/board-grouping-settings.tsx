import { ArrowDown, ArrowUp } from 'lucide-react';
import { useState } from 'react';

import { generateFractionalIndex } from '@colanode/core';
import { FieldCreatePopover } from '@colanode/ui/components/databases/fields/field-create-popover';
import { FieldSelect } from '@colanode/ui/components/databases/fields/field-select';
import { SelectOptionBadge } from '@colanode/ui/components/databases/fields/select-option-badge';
import { SelectOptionSettingsPopover } from '@colanode/ui/components/databases/fields/select-option-settings-popover';
import { Button } from '@colanode/ui/components/ui/button';
import { Input } from '@colanode/ui/components/ui/input';
import { useDatabase } from '@colanode/ui/contexts/database';
import { useDatabaseView } from '@colanode/ui/contexts/database-view';
import { useWorkspace } from '@colanode/ui/contexts/workspace';
import { boardGroupFields } from '@colanode/ui/lib/board-drag';
import {
  createSelectOption,
  getOrderedSelectOptions,
  getRandomSelectOptionColor,
} from '@colanode/ui/lib/databases';

export const BoardGroupingSettings = () => {
  const workspace = useWorkspace();
  const database = useDatabase();
  const view = useDatabaseView();
  const [name, setName] = useState('');
  const groupFields = database.fields.filter((field) =>
    boardGroupFields.includes(field.type)
  );
  const group = groupFields.find((field) => field.id === view.groupBy);
  const options =
    group?.type === 'select' || group?.type === 'multi_select'
      ? getOrderedSelectOptions(group)
      : null;

  const setGroup = (id: string) => {
    setName('');
    workspace.collections.nodes.update(view.id, (draft) => {
      if (draft.type === 'database_view') draft.groupBy = id;
    });
  };

  const addOption = () => {
    if (!group || !name.trim()) return;
    const label = name.trim();
    workspace.collections.nodes.update(database.id, (draft) => {
      if (draft.type !== 'database') return;
      const field = draft.fields[group.id];
      if (field?.type !== 'select' && field?.type !== 'multi_select') return;
      if (
        getOrderedSelectOptions(field).some((option) => option.name === label)
      )
        return;
      const option = createSelectOption(
        field,
        label,
        getRandomSelectOptionColor()
      );
      field.options = { ...field.options, [option.id]: option };
    });
    setName('');
  };

  const moveOption = (id: string, direction: -1 | 1) => {
    if (!group) return;
    workspace.collections.nodes.update(database.id, (draft) => {
      if (draft.type !== 'database') return;
      const field = draft.fields[group.id];
      if (field?.type !== 'select' && field?.type !== 'multi_select') return;
      const sorted = getOrderedSelectOptions(field);
      const index = sorted.findIndex((option) => option.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= sorted.length) return;
      const [option] = sorted.splice(index, 1);
      option!.index = generateFractionalIndex(
        sorted[nextIndex - 1]?.index,
        sorted[nextIndex]?.index
      );
    });
  };

  return (
    <div className="space-y-2 p-1 text-sm">
      <div className="font-medium">Group by</div>
      <FieldSelect
        fields={groupFields}
        value={group?.id ?? null}
        onChange={setGroup}
      />
      <FieldCreatePopover
        button={
          <Button variant="outline" size="sm">
            Add property
          </Button>
        }
        types={boardGroupFields}
        onSuccess={setGroup}
      />
      {group && options && (
        <>
          <div className="font-medium">Column options</div>
          <p className="text-xs text-muted-foreground">
            Option order is shared by views using this property.
          </p>
          <ul className="max-h-48 space-y-1 overflow-auto">
            {options.map((option, index) => (
              <li key={option.id} className="flex items-center gap-1">
                <div className="min-w-0 flex-1 truncate">
                  <SelectOptionBadge name={option.name} color={option.color} />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  disabled={index === 0}
                  aria-label={`Move ${option.name} left`}
                  onClick={() => moveOption(option.id, -1)}
                >
                  <ArrowUp className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  disabled={index === options.length - 1}
                  aria-label={`Move ${option.name} right`}
                  onClick={() => moveOption(option.id, 1)}
                >
                  <ArrowDown className="size-4" />
                </Button>
                <SelectOptionSettingsPopover
                  fieldId={group.id}
                  option={option}
                />
              </li>
            ))}
          </ul>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              addOption();
            }}
          >
            <Input
              aria-label="New column name"
              placeholder="New column name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <Button
              type="submit"
              size="sm"
              disabled={
                !name.trim() ||
                options.some((option) => option.name === name.trim())
              }
            >
              Add column
            </Button>
          </form>
        </>
      )}
      {Object.keys(view.boardCardOrder ?? {}).length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            workspace.collections.nodes.update(view.id, (draft) => {
              if (draft.type === 'database_view') delete draft.boardCardOrder;
            })
          }
        >
          Reset manual card order
        </Button>
      )}
    </div>
  );
};
