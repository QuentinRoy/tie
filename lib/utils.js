// This is used in place of Object.entries. It is a bite less efficient as it does not make use
// of iterators but the weight of the polyfill may not be worth the tiny performance gain at the
// initialization of the module.
export function entries(obj){
    return Object.keys(obj).map((k) => [k, obj[k]]);
}
