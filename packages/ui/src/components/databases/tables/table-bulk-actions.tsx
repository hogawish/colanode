// Modified: explicit bulk edit/delete for the rows selected in the current table.
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import type { LocalRecordNode } from '@colanode/client/types';
import { extractNodeRole, hasNodeRole } from '@colanode/core';
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
import { useDatabase } from '@colanode/ui/contexts/database';
import { useWorkspace } from '@colanode/ui/contexts/workspace';
import {
  bulkEditableField,
  bulkFieldValue,
} from '@colanode/ui/lib/record-bulk';

export const TableBulkActions = ({
  records,
  clearSelection,
  request,
}: {
  records: LocalRecordNode[];
  clearSelection: (completed?: Set<string>) => void;
  request?: { action: 'edit' | 'delete'; serial: number } | null;
}) => {
  const workspace = useWorkspace();
  const database = useDatabase();
  const [dialog, setDialog] = useState<'edit' | 'delete' | null>(null);
  const [fieldId, setFieldId] = useState('');
  const [value, setValue] = useState('');
  const [clear, setClear] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (request) {
      setError('');
      setDialog(request.action);
    }
  }, [request]);
  const fields = database.fields.filter(bulkEditableField);
  const field = fields.find((field) => field.id === fieldId);
  const canEdit = records.every(
    (record) =>
      record.createdBy === workspace.userId ||
      hasNodeRole(
        extractNodeRole(record, workspace.userId) ?? database.role,
        'editor'
      )
  );
  const canDelete = records.every(
    (record) =>
      record.createdBy === workspace.userId ||
      hasNodeRole(
        extractNodeRole(record, workspace.userId) ?? database.role,
        'admin'
      )
  );

  const run = async () => {
    if (
      busy ||
      records.length === 0 ||
      (dialog === 'edit' ? !canEdit : !canDelete)
    )
      return;
    const targets = [...records];
    const completed = new Set<string>();
    const failures: string[] = [];
    setError('');
    let nextValue;
    try {
      if (dialog === 'edit') {
        if (!field) throw new Error('Choose a field.');
        nextValue = bulkFieldValue(field, value, clear);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Invalid value.');
      return;
    }
    setBusy(true);
    for (const record of targets) {
      try {
        const result =
          dialog === 'delete'
            ? await window.colanode.executeMutation({
                type: 'node.delete',
                userId: workspace.userId,
                nodeId: record.id,
              })
            : await window.colanode.executeMutation({
                type: 'record.field.set',
                userId: workspace.userId,
                recordId: record.id,
                databaseId: database.id,
                fieldId,
                value: nextValue!,
              });
        if (!result.success) throw new Error(result.error.message);
        completed.add(record.id);
      } catch (error) {
        failures.push(
          `${record.name || 'Untitled'}: ${error instanceof Error ? error.message : 'Operation failed'}`
        );
      }
    }
    setBusy(false);
    clearSelection(completed);
    if (failures.length) {
      setError(
        `${completed.size} succeeded; ${failures.length} failed.\n${failures.join('\n')}`
      );
      toast.error(`${failures.length} row(s) could not be changed.`);
    } else {
      setDialog(null);
      toast.success(
        `${completed.size} row(s) ${dialog === 'delete' ? 'deleted' : 'updated'}.`
      );
    }
  };

  if (records.length === 0 && !dialog) return null;
  return (
    <>
      <div
        className="flex items-center gap-2 border-b bg-accent/40 px-2 py-2"
        role="toolbar"
        aria-label="Selected rows"
      >
        <span className="text-sm">{records.length} selected</span>
        <Button
          size="sm"
          variant="outline"
          disabled={busy || !canEdit || fields.length === 0}
          onClick={() => {
            setError('');
            setDialog('edit');
          }}
        >
          Edit selected
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy || !canDelete}
          onClick={() => {
            setError('');
            setDialog('delete');
          }}
        >
          Delete selected
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => clearSelection()}
        >
          Clear selection
        </Button>
      </div>
      <Dialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!busy && !open) {
            setDialog(null);
            setError('');
          }
        }}
      >
        <DialogContent
          onInteractOutside={(event) => {
            if (busy) event.preventDefault();
          }}
          onEscapeKeyDown={(event) => {
            if (busy) event.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {dialog === 'delete'
                ? 'Delete selected rows'
                : 'Edit selected rows'}
            </DialogTitle>
            <DialogDescription>
              {dialog === 'delete'
                ? 'These records and their contents will be deleted. This cannot be undone from this table.'
                : 'Set one field to the same value for every selected row. Other fields and page contents stay as they are.'}
            </DialogDescription>
          </DialogHeader>
          <div
            className="max-h-28 overflow-auto rounded border p-2 text-sm"
            aria-label="Rows to change"
          >
            {records.map((record) => (
              <div key={record.id}>{record.name || 'Untitled'}</div>
            ))}
          </div>
          {dialog === 'edit' && (
            <div className="flex flex-col gap-3">
              <label className="text-sm">
                Field
                <select
                  className="mt-1 h-9 w-full rounded border bg-background px-2"
                  aria-label="Field to edit"
                  value={fieldId}
                  disabled={busy}
                  onChange={(event) => {
                    setFieldId(event.target.value);
                    setValue('');
                    setClear(false);
                  }}
                >
                  <option value="">Choose a field</option>
                  {fields.map((field) => (
                    <option key={field.id} value={field.id}>
                      {field.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={clear}
                  disabled={busy}
                  onChange={(event) => setClear(event.target.checked)}
                />
                Clear this field
              </label>
              {field &&
                !clear &&
                (field.type === 'select' || field.type === 'multi_select' ? (
                  <label className="text-sm">
                    {field.type === 'multi_select'
                      ? 'Values (replaces the existing selection)'
                      : 'Value'}
                    <select
                      className="mt-1 w-full rounded border bg-background p-2"
                      aria-label="New value"
                      multiple={field.type === 'multi_select'}
                      disabled={busy}
                      value={
                        field.type === 'multi_select'
                          ? value
                            ? value.split(',')
                            : []
                          : value
                      }
                      onChange={(event) =>
                        setValue(
                          field.type === 'multi_select'
                            ? Array.from(
                                event.target.selectedOptions,
                                (option) => option.value
                              ).join(',')
                            : event.target.value
                        )
                      }
                    >
                      {field.type === 'select' && (
                        <option value="">Choose an option</option>
                      )}
                      {Object.values(field.options ?? {})
                        .sort((a, b) => a.index.localeCompare(b.index))
                        .map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.name}
                          </option>
                        ))}
                    </select>
                  </label>
                ) : field.type === 'boolean' ? (
                  <select
                    className="h-9 rounded border bg-background px-2"
                    aria-label="New value"
                    value={value || 'false'}
                    disabled={busy}
                    onChange={(event) => setValue(event.target.value)}
                  >
                    <option value="false">Unchecked</option>
                    <option value="true">Checked</option>
                  </select>
                ) : (
                  <Input
                    aria-label="New value"
                    disabled={busy}
                    value={value}
                    type={
                      field.type === 'number'
                        ? 'number'
                        : field.type === 'date'
                          ? 'date'
                          : 'text'
                    }
                    onChange={(event) => setValue(event.target.value)}
                  />
                ))}
            </div>
          )}
          {error && (
            <p
              role="alert"
              className="max-h-32 overflow-auto whitespace-pre-wrap text-sm text-destructive"
            >
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setDialog(null)}
            >
              Cancel
            </Button>
            <Button
              variant={dialog === 'delete' ? 'destructive' : 'default'}
              disabled={
                busy ||
                records.length === 0 ||
                (dialog === 'edit' ? !field || !canEdit : !canDelete)
              }
              onClick={run}
            >
              {busy
                ? 'Working…'
                : dialog === 'delete'
                  ? `Delete ${records.length} rows`
                  : `Apply to ${records.length} rows`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
