/**
 * Result type for functional error handling
 */

/**
 * Success result
 */
export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

/**
 * Error result
 */
export interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

/**
 * Result type that can be either Ok or Err
 */
export type Result<T, E = Error> = Ok<T> | Err<E>;

/**
 * Creates a successful result
 */
export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

/**
 * Creates an error result
 */
export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}

/**
 * Type guard for Ok result
 */
export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
  return result.ok === true;
}

/**
 * Type guard for Err result
 */
export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
  return result.ok === false;
}

/**
 * Unwraps a Result, throwing if it's an error
 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (isOk(result)) {
    return result.value;
  }
  throw result.error;
}

/**
 * Unwraps a Result, returning a default value if it's an error
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  if (isOk(result)) {
    return result.value;
  }
  return defaultValue;
}
