export function isDefined<T>(arg: T | undefined): arg is T {
  return arg !== undefined;
}
