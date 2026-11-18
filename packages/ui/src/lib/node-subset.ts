import { parseLoadSubsetOptions } from '@tanstack/react-db';

type SubsetOptions = Parameters<typeof parseLoadSubsetOptions>[0];
type Expression = NonNullable<NonNullable<SubsetOptions>['where']>;

// The local SQL adapter accepts a flat AND of simple comparisons. Keep only
// necessary conjuncts here; the live query still evaluates the complete filter.
const supportedOperators = new Set([
  'eq',
  'not_eq',
  'gt',
  'gte',
  'lt',
  'lte',
  'in',
  'isNull',
  'isUndefined',
  'not_isNull',
]);

export const parseNodeSubset = (options: SubsetOptions) => {
  const filters: ReturnType<typeof parseLoadSubsetOptions>['filters'] = [];
  let complete = true;
  const visit = (expression: Expression) => {
    if (expression.type === 'func' && expression.name === 'and') {
      expression.args.forEach((arg) => visit(arg as Expression));
      return;
    }
    try {
      const parsed = parseLoadSubsetOptions({ where: expression }).filters;
      if (parsed.length === 0) complete = false;
      for (const filter of parsed) {
        if (supportedOperators.has(filter.operator)) filters.push(filter);
        else complete = false;
      }
    } catch {
      // Never flatten OR to AND or apply just one of its alternatives.
      complete = false;
    }
  };
  if (options?.where) visit(options.where);
  let sorts: ReturnType<typeof parseLoadSubsetOptions>['sorts'] = [];
  try {
    sorts = parseLoadSubsetOptions({ orderBy: options?.orderBy }).sorts;
  } catch {
    complete = false;
  }
  return {
    filters,
    sorts,
    // Limiting a superset before local evaluation can hide matching records.
    limit: complete ? options?.limit : undefined,
  };
};
