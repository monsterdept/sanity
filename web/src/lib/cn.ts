/** Tiny classnames joiner — the app needs exactly this much of `clsx`. */
export function clsx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}
