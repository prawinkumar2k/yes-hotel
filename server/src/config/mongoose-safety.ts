import mongoose from "mongoose";

/**
 * Permanent guard against an unscoped bulk write — installed once, globally,
 * regardless of environment. This exists because of a real incident during
 * this project's own QA: an unscoped `Payment.deleteMany({})` intended as
 * scoped test cleanup instead wiped the live collection. A README warning
 * doesn't prevent that from happening again; this does, at the point where
 * it would actually occur.
 *
 * Patches mongoose.Query.prototype directly (rather than a per-schema
 * plugin) so it applies to every model regardless of import order — a
 * schema-level plugin only affects schemas compiled AFTER the plugin is
 * registered, which is fragile given Node's module import ordering. This
 * only needs to run once, before the app starts handling any requests.
 */
let installed = false;

function isEmptyFilter(filter: unknown): boolean {
  // undefined/null (a bare deleteMany() call) is exactly as dangerous as an
  // explicit {} — Mongoose itself treats both as "match everything".
  if (filter == null) return true;
  return typeof filter === "object" && !Array.isArray(filter) && Object.keys(filter as object).length === 0;
}

export function installUnscopedWriteGuard(): void {
  if (installed) return;
  installed = true;

  (["deleteMany", "updateMany"] as const).forEach((methodName) => {
    const original = (mongoose.Query.prototype as any)[methodName];
    (mongoose.Query.prototype as any)[methodName] = function (this: mongoose.Query<any, any>, ...args: any[]) {
      // Must check the filter ARGUMENT being passed to this call, not
      // this.getFilter() — at this point in Mongoose's internals the
      // argument hasn't been merged onto the Query's own conditions yet, so
      // getFilter() would still reflect the query's pre-call state (usually
      // {}) regardless of what filter was actually passed in, causing false
      // positives on legitimately scoped calls.
      const filter = args[0];
      if (isEmptyFilter(filter)) {
        const modelName = (this as any).model?.modelName ?? "UnknownModel";
        const error = new Error(
          `Refused unscoped ${methodName}() on ${modelName}: an empty filter ({}) would affect every ` +
            `document in the collection. This guard exists specifically because of a prior incident where an ` +
            `unscoped deleteMany({}) wiped a live collection. If a full-collection operation is genuinely intended ` +
            `(e.g. a one-off, human-reviewed migration script), bypass this guard explicitly via ` +
            `${modelName}.collection.${methodName}(...) rather than removing this check.`
        );
        const callback = args[args.length - 1];
        if (typeof callback === "function") {
          return callback(error);
        }
        return Promise.reject(error);
      }
      return original.apply(this, args);
    };
  });
}
