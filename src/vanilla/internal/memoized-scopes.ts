import type { AnyMoleculeScope, AnyScopeTuple, ScopeTuple } from "../internal/internal-types";
import type { DeepCache } from "./weakCache";

export type TupleAndReferences = {
    references: Set<Symbol>;
    tuple: AnyScopeTuple;
};

export type PrimitiveScopeMap = WeakMap<
    AnyMoleculeScope,
    Map<unknown, TupleAndReferences>
>;


/**
 * Creates a memoized tuple of `[scope,value]`
 *
 * Registers primitive `value`s in the primitive scope cache. This has side-effects
 * and needs to be cleaned up with `deregisterScopeTuple`
 *
 */
export function registerMemoizedScopeTuple<T>(
    tuple: ScopeTuple<T>,
    id: Symbol,
    primitiveMap: PrimitiveScopeMap,
    memoize: DeepCache
): ScopeTuple<T> {
    const [scope, value] = tuple;
    if (typeof value === "object") {
        // If we have an object, we can safely weak cache it.
        // Equivalent to `cache.get(scope).get(value)`
        return memoize.deepCache(() => tuple, [scope, value as unknown as object]);
    }

    // Not an object, so we can't safely cache it in a WeakMap
    let valuesForScope = primitiveMap.get(scope);
    if (!valuesForScope) {
        valuesForScope = new Map();
        primitiveMap.set(scope, valuesForScope);
    }

    let cached = valuesForScope.get(value);
    if (cached) {
        // Increment references
        cached.references.add(id);
        return cached.tuple as ScopeTuple<T>;
    }

    const references = new Set<Symbol>();
    references.add(id);
    valuesForScope.set(value, {
        references,
        tuple,
    });

    return tuple;
}

/**
 * For values that are "primitive" (not an object),
 * deregisters them from the primitive scope
 * cache to ensure no memory leaks


    // Clean up scope value, if cached
    // Deleting the scope tuple should cascade a cleanup
    // 1 - it is deleted from this map
    // 2 - it should be garbage collected from the Molecule injector WeakMap
    // 3 - any atoms created in the molecule should be garbage collected
    // 4 - any atom values in the jotai store should be garbage collected from it's WeakMap

*/
export function deregisterScopeTuple<T>(
    tuple: ScopeTuple<T>,
    id: Symbol,
    primitiveScopeMap: PrimitiveScopeMap,
) {
    const [scope, value] = tuple;
    // No scope cleanup needed for non-primitives
    if (typeof value === "object") return;

    const scopeMap = primitiveScopeMap.get(scope);
    const cached = scopeMap?.get(value);

    const references = cached?.references;
    references?.delete(id);

    if (references && references.size <= 0) {
        scopeMap?.delete(value);
    }
}
