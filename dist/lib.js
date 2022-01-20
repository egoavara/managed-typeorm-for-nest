"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsingManagedTransaction = exports.ManagedTransaction = void 0;
require("reflect-metadata");
const TARGET_MANAGED_TRANSACTION = Symbol("TARGET_MANAGED_TRANSACTION");
const ManagedTransaction = (target) => {
    const usingManagedTransaction = Reflect.getMetadata(TARGET_MANAGED_TRANSACTION, target.prototype);
    if (usingManagedTransaction === undefined) {
        console.error("ManagedTransaction이 호출되었음에도 UsingManagedTransaction으로 저장된 필드가 없습니다.");
        return;
    }
    for (const ownKey of Reflect.ownKeys(target.prototype)) {
        const ownDesc = Reflect.getOwnPropertyDescriptor(target.prototype, ownKey);
        if (typeof ownDesc?.value === "function" &&
            ownDesc?.value?.name === ownKey) {
            const metasForInner = Reflect.getMetadataKeys(ownDesc.value).map((v) => [
                v,
                Reflect.getMetadata(v, ownDesc.value),
            ]);
            const inner = async function (...args) {
                const nthis = Object.create(this);
                return await this.em.transaction(async (transem) => {
                    Reflect.defineProperty(nthis, usingManagedTransaction, {
                        value: transem,
                    });
                    const result = await ownDesc?.value.call(nthis, ...args);
                    return result;
                });
            };
            Reflect.defineProperty(inner, "name", {
                configurable: true,
                enumerable: false,
                value: ownDesc?.value?.name,
                writable: false,
            });
            Reflect.defineProperty(inner, "length", {
                configurable: true,
                enumerable: false,
                value: ownDesc?.value?.name,
                writable: false,
            });
            for (const [metak, metav] of metasForInner) {
                Reflect.defineMetadata(metak, metav, inner);
            }
            Reflect.defineProperty(target.prototype, ownKey, {
                configurable: ownDesc?.configurable,
                enumerable: ownDesc?.enumerable,
                value: inner,
                writable: ownDesc?.writable,
            });
        }
    }
};
exports.ManagedTransaction = ManagedTransaction;
const UsingManagedTransaction = (target, key) => {
    Reflect.defineMetadata(TARGET_MANAGED_TRANSACTION, key, target);
};
exports.UsingManagedTransaction = UsingManagedTransaction;
//# sourceMappingURL=lib.js.map