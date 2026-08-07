import { Immutable } from "immer"

export type Identifiable<I = PropertyKey> = {lookupId: I}    

export type Identified<T extends Identifiable> = T["lookupId"]

export type LookupDb<T extends Identifiable<I>, I = T["lookupId"]> = Map<I, T>

export function registerInDb<I extends Identifiable>(db: LookupDb<I>, item: I) {
    db.set(item.lookupId, item)
}

export function clearDb<I extends Identifiable>(db: LookupDb<I>) {
    db.clear()
}

export function lookupInDb<I extends Identifiable>(db: LookupDb<I>, key: I["lookupId"]): I;
export function lookupInDb<I extends Identifiable>(db: Immutable<LookupDb<I>>, key: Immutable<I["lookupId"]>): Immutable<I>;
export function lookupInDb<I extends Identifiable>(
    db: LookupDb<I> | Immutable<LookupDb<I>>, 
    key: I["lookupId"] | Immutable<I["lookupId"]>
): I | Immutable<I> {
    const value = db.get(key as any);
    if (!value) {
        throw new Error(`Tried to lookup key (${key.toString()}) not in db`);
    }
    return value;
}