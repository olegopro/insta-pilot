type CompactParams<TParams extends Record<string, unknown>> = {
  [TKey in keyof TParams as Exclude<TParams[TKey], false | 0 | '' | null | undefined> extends never ? never : TKey]?:
  Exclude<TParams[TKey], false | 0 | '' | null | undefined>
}

export const compactParams = <TParams extends Record<string, unknown>>(params: TParams): CompactParams<TParams> =>
  Object.fromEntries(Object.entries(params).filter(([, value]) => Boolean(value))) as CompactParams<TParams>
