export interface Ok<T> {
    readonly ok: true;
    readonly value: T;
}
export interface Err<E> {
    readonly ok: false;
    readonly error: E;
}
export type Result<T, E = Error> = Ok<T> | Err<E>;
export declare function ok<T>(value: T): Ok<T>;
export declare function err<E>(error: E): Err<E>;
export declare function isOk<T, E>(result: Result<T, E>): result is Ok<T>;
export declare function isErr<T, E>(result: Result<T, E>): result is Err<E>;
export declare function unwrap<T, E>(result: Result<T, E>): T;
export declare function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T;
//# sourceMappingURL=result.d.ts.map