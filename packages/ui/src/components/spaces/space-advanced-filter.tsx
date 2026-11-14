import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@colanode/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@colanode/ui/components/ui/dialog';
import { Input } from '@colanode/ui/components/ui/input';
import {
  spaceFilterFields,
  type SpaceFilterGroup,
  type SpaceFilterRule,
} from '@colanode/ui/lib/space-views';

type FilterOptions = { id: string; label: string }[];

const selectClass = 'h-8 min-w-0 rounded-md border bg-background px-2 text-sm';

const newRule: SpaceFilterRule = {
  field: 'name',
  operator: 'contains',
  value: '',
};

const emptyGroup: SpaceFilterGroup = { mode: 'all', conditions: [] };

const isComplete = (group: SpaceFilterGroup): boolean =>
  group.conditions.length > 0 &&
  group.conditions.every((condition) =>
    'conditions' in condition
      ? isComplete(condition)
      : condition.value.trim().length > 0
  );

const FilterRule = ({
  rule,
  memberOptions,
  tagOptions,
  onChange,
}: {
  rule: SpaceFilterRule;
  memberOptions: FilterOptions;
  tagOptions: FilterOptions;
  onChange: (rule: SpaceFilterRule) => void;
}) => {
  const isName = rule.field === 'name';
  const options = rule.field === 'member' ? memberOptions : tagOptions;
  const missingValue =
    rule.value && !options.some(({ id }) => id === rule.value);
  return (
    <div className="grid min-w-0 flex-1 gap-1.5 sm:grid-cols-[8rem_9rem_minmax(0,1fr)]">
      <select
        className={selectClass}
        aria-label="Filter field"
        value={rule.field}
        onChange={(event) => {
          const field = event.target.value as SpaceFilterRule['field'];
          onChange({
            field,
            operator: field === 'name' ? 'contains' : 'is',
            value: '',
          });
        }}
      >
        {Object.entries(spaceFilterFields).map(([field, label]) => (
          <option key={field} value={field}>
            {label}
          </option>
        ))}
      </select>
      <select
        className={selectClass}
        aria-label="Filter operator"
        value={rule.operator}
        onChange={(event) =>
          onChange({
            ...rule,
            operator: event.target.value as SpaceFilterRule['operator'],
          })
        }
      >
        {isName && <option value="contains">Contains</option>}
        {isName && <option value="does_not_contain">Does not contain</option>}
        <option value="is">{isName ? 'Is' : 'Includes'}</option>
        <option value="is_not">{isName ? 'Is not' : 'Excludes'}</option>
      </select>
      {isName ? (
        <Input
          className="h-8 text-sm"
          aria-label="Filter value"
          placeholder="Space name"
          value={rule.value}
          onChange={(event) => onChange({ ...rule, value: event.target.value })}
        />
      ) : (
        <select
          className={selectClass}
          aria-label="Filter value"
          value={rule.value}
          onChange={(event) => onChange({ ...rule, value: event.target.value })}
        >
          <option value="">Select a {rule.field}</option>
          {missingValue && (
            <option value={rule.value}>Unavailable {rule.field}</option>
          )}
          {options.map(({ id, label }) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
};

const FilterGroup = ({
  group,
  memberOptions,
  tagOptions,
  onChange,
  onRemove,
}: {
  group: SpaceFilterGroup;
  memberOptions: FilterOptions;
  tagOptions: FilterOptions;
  onChange: (group: SpaceFilterGroup) => void;
  onRemove?: () => void;
}) => (
  <fieldset className="min-w-0 space-y-2 rounded-md border p-2">
    <legend className="px-1 text-sm font-medium">
      {onRemove ? 'Group' : 'Conditions'}
    </legend>
    <div className="flex flex-wrap items-center justify-between gap-1">
      <select
        className={selectClass}
        aria-label="Group match mode"
        value={group.mode}
        onChange={(event) =>
          onChange({
            ...group,
            mode: event.target.value === 'any' ? 'any' : 'all',
          })
        }
      >
        <option value="all">Match all (AND)</option>
        <option value="any">Match any (OR)</option>
      </select>
      {onRemove && (
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label="Remove group"
          onClick={onRemove}
        >
          <Trash2 />
        </Button>
      )}
    </div>
    {group.conditions.map((condition, index) => {
      const update = (replacement: SpaceFilterGroup | SpaceFilterRule) =>
        onChange({
          ...group,
          conditions: group.conditions.map((item, i) =>
            i === index ? replacement : item
          ),
        });
      const remove = () =>
        onChange({
          ...group,
          conditions: group.conditions.filter((_, i) => i !== index),
        });
      return 'conditions' in condition ? (
        <FilterGroup
          key={index}
          group={condition}
          memberOptions={memberOptions}
          tagOptions={tagOptions}
          onChange={update}
          onRemove={remove}
        />
      ) : (
        <div key={index} className="flex min-w-0 items-start gap-1">
          <FilterRule
            rule={condition}
            memberOptions={memberOptions}
            tagOptions={tagOptions}
            onChange={update}
          />
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="Remove condition"
            onClick={remove}
          >
            <Trash2 />
          </Button>
        </div>
      );
    })}
    <div className="flex flex-wrap gap-1">
      <Button
        size="sm"
        variant="ghost"
        onClick={() =>
          onChange({ ...group, conditions: [...group.conditions, newRule] })
        }
      >
        <Plus /> Add condition
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() =>
          onChange({
            ...group,
            conditions: [
              ...group.conditions,
              { ...emptyGroup, conditions: [newRule] },
            ],
          })
        }
      >
        <Plus /> Add group
      </Button>
    </div>
  </fieldset>
);

export const SpaceAdvancedFilter = ({
  filter,
  memberOptions,
  tagOptions,
  onApply,
  onClose,
}: {
  filter?: SpaceFilterGroup;
  memberOptions: FilterOptions;
  tagOptions: FilterOptions;
  onApply: (filter: SpaceFilterGroup | undefined) => void;
  onClose: () => void;
}) => {
  const [draft, setDraft] = useState(filter ?? emptyGroup);
  const hasConditions = draft.conditions.length > 0;
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] grid-rows-[auto_minmax(0,1fr)_auto] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Advanced Space filter</DialogTitle>
          <DialogDescription>
            Spaces must match both this filter and the quick filters.
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-auto px-1 py-0.5">
          <FilterGroup
            group={draft}
            memberOptions={memberOptions}
            tagOptions={tagOptions}
            onChange={setDraft}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={hasConditions && !isComplete(draft)}
            onClick={() => onApply(hasConditions ? draft : undefined)}
          >
            Apply filter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
