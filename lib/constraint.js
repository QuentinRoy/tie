import { entries } from "./utils"

/**
 * Algorythm's principle:
 * - When a constraint switches to the "invalid" or "uncertain" state, its children get the state "uncertain"
 * - When a constraint is evaluated and its value has changed, its children get the state "invalid"
 * - When an "invalid" constraint is retrieved, it is (re)-evaluated
 * - When an "uncertain" constraint is requested, its "invalid" and "uncertain" parents are udpated
 *   - as soon as one "uncertain" or "invalid" parent changed after its evaluation the constraint is
 *       re-evaluated. Because the dependencies are called in order of used, stopping as soon as one changed
 *       dependency is found ensure that we do not trigger the evaluation of a dependency that may
 *       not be used anymore.
 *   - if no parent changed (or all are already valid), the constraint switches to the "valid" state
 *       without being re-evaluated
 */


// Constraint's states:

/*
 * Means the constraint must be re-evaluated, at least one of the constraints it currently
 * depends own is known to have changed.
 */
const INVALID = Symbol("invalid");

/*
 * The constraint does not need to be re-evaluated.
 */
const VALID = Symbol("valid");

/*
 * It is not sure if the constraint must be re-evaluated. One of its ancestor
 * has been invalidated but it is not sure yet that one of its parents has actually changed. A constraint
 * may still be in the "uncertain" state when all of its parent has been re-evaluated without change
 * but must not be in this state if we know (for sure) that one of its parent has changed.
*/
const UNCERTAIN = Symbol("uncertain");

/*
 * The constraint is currently being evaluated. If its value is fetched again (i.e. in the
 * of cyclic dependencies), the cached value will be provided.
 * Because self-invalidating evaluation is forbidden it is not possible to invalidate or
 * set the constraint value when it is in this state (may change in the future).
 */
const EVALUATION = Symbol("evaluation");

/*
 * The constraint has been detached so that it can be garbaged collected.
 * Any link to its dependencies and the constraint that depends on its has been cut.
 * If fetched, it will now always return `undefined`.
 */
const DETACHED = Symbol("detached");

// true for (NaN, NaN), false otherwise
const bothNaN = (a, b) => isNaN(a) && isNaN(b) && typeof a === "number" && typeof b === "number";

const DEFAULT_SETTINGS = {
    equals: (a, b) => a === b || bothNaN(a, b),
    detachable: true
}

/*
 * Golden rule: nothing gets out of an instance of this class without registering
 * itself as a dependency of the potential calling's constraint
 * (except if specified otherwise in arguments).
 */
export default class Constraint {

    /*
     * Create a constraint and set its value to *getter*.
     * See set.
     */
    constructor (getter, settings) {
        this._settings = Object.assign({}, DEFAULT_SETTINGS, settings);
        // default read-only depends of the provided getter
        if(this._settings.readOnly == null){
            this._settings.readOnly = typeof getter === 'function'
                                    || getter instanceof Constraint;
        }
        this._getter = null;
        this._value = null;
        this._state = INVALID;
        this._dependencies = new Set();
        this._dependentConstraints = new Set();
        // Registers handlers to be called when the constraint may have changed.
        // Contains an object (see onMayHaveChanged).
        this._mayHaveChangedListeners = [];
        this._set(getter);
    }

    /*
     * Set the constraint value.
     * If it is a function, this function will be used as a getter.
     * If it is another constraint, this constraint will be constrained
     * to this other constraint.
     * If it is any other value, the constraint will be set to this value.
     *
     * Read-only constraints can only be set while created.
     */
    set(getter){
        if(this.readOnly){
            // TODO: use a real exception instead of a string.
            throw "Cannot set a read-only constraint."
        }
        this._set(getter);
    }

    _set(getter){
        this._getter = Constraint._createGetter(getter);
        this.invalidate();
    }

    /*
     * Invalidate the constraint.
     * As a result, the next its value is fetched, it will be
     * re-evaluated.
     */
    invalidate(){
        if(this._state === EVALUATION){
            // self invalidating evaluation is forbidden for now.
            // TODO: use a real exception
            throw "Cannot invalidate a constraint still being evaluated."
        }

        this._setState(INVALID);
        this._mayHaveChanged();
    }

    /*
     * Notify this constraint that it may have changed.
     * @param alreadyNotified the constraints that have already
     * been notified of this potential change and that should not
     * be notified again.
     */
    _mayHaveChanged(alreadyNotified=new Set()){
        // JS default arguments' evaluation is on method call
        // so default alreadyNotified will be a new set each
        // time _mayHaveChanged() is called without args.

        if(this._state === VALID){
            this._setState(UNCERTAIN);
        }
        // Notify the on may have change listeners
        this._notifyListeners();
        // Specify that this constraint has been notified
        alreadyNotified.add(this);
        // Notify this constraint's dependent constraint
        // if they have not been yet notified.
        this._dependentConstraints.forEach((dc) => {
            if(!alreadyNotified.has(dc)){
                dc._mayHaveChanged(alreadyNotified);
            }
        });
    }


    /**
     * Get the constraint value, evaluating it if necessary
     * (i.e. if it is invalid).
     */
    get(regAsCallersDependency=true){
        if(this._state === DETACHED) return;
        // If there is a caller, register this constraint as dependency
        // of this caller, and add the caller to the dependent
        // constraints.
        if(regAsCallersDependency){
            this._regAsCallersDependency();
        }

        if(this._state !== VALID && this._state !== EVALUATION){
            this._update();
        }
        return this._value;
    }

    /*
     * Add the constraint as dependency of the constraint on top of the constraint's
     * stack (if any).
     */
    _regAsCallersDependency(){
        if(Constraint._constraintStack.length > 0){
            const caller = Constraint._constraintStack[Constraint._constraintStack.length - 1]
            caller._registerDependency(this);
        }
    }

    /**
     * Register a new constraint on which depends this constraint.
     */
    _registerDependency(dep){
        // This must (and should) not be called if the constraint has been detached.
        this._dependencies.add(dep);
        dep._dependentConstraints.add(this);
    }

    /**
     * Settle the constraint state between valid or invalid if its state is uncertain.
     * This does not update the constraint itself but is likely to update
     * some of its dependencies.
     */
    _settle(){
        if(this._state === UNCERTAIN){
            // Update the dependencies (in order) until it finds one that
            // changes.
            let someParentChanged = false;
            for(let p of this._dependencies){
                someParentChanged = p._update();
                if(someParentChanged) break;
            }
            if(!someParentChanged){
                // If no dependency has changed, the present constraint (this) is valid.
                this._setState(VALID);
            }
            // If one dependency has changed it should have invalidated this
            // so this._state should be invalid now.
        }
        return this._state;
    }

    /**
     * Update the constraint's value.
     * @returns true if the constraint value has changed, false otherwise.
     */
    _update(){
        // If the state is uncertain, settle it between valid or invalid.
        this._settle();
        if(this._state === INVALID){
            return this._evaluate();
        }
        return false;
    }

    _evaluate(){
        this._setState(EVALUATION);
        const oldValue = this._value;
        // Reset the dependencies (so that dependencies that are not used anymore are removed).
        const previousDependencies = this._dependencies;
        this._dependencies = new Set();
        this._value = this._stackCall(() => this._getter());
        // Remove this as a dependent constraint from all the previous dependencies
        // that are not used anymore.
        previousDependencies.forEach((pd) => {
            if(!this._dependencies.has(pd)){
                pd._dependentConstraints.delete(this);
            }
        });

        const changed = !this._settings.equals(oldValue, this._value);
        // If the constraint value has changed, all dependent constraints are invalidated
        // except if they are still being evaluated (self invalidating evaluation if forbidden
        // for now).
        if(changed){
            this._dependentConstraints.forEach((dc) => {
                if(dc._state !== EVALUATION){
                    dc._setState(INVALID);
                }
            });
        }
        this._setState(VALID);
        return changed;
    }

    /*
     * Add this constraint to the constraint stack, call f, then
     * removes this constraint from the constraint stack.
     */
    _stackCall(f){
        // Push this constraint to the stack before evaluating it.
        Constraint._constraintStack.push(this);
        const result = f();
        // Removes this constraint from the stack once the evaluation is terminated.
        // It should be at the top of it.
        if(Constraint._constraintStack.pop() !== this){
            //TODO: use a real exception
            throw "Constraint stack error";
        }
        return result;
    }

    _setState(newState){
        if(this._state !== DETACHED){
            this._state = newState;
        }
    }

    /*
     * Register a callback that will be called each time the
     * constraint may be invalid (though its value may not have
     * actually changed).
     *
     * @param check: actually check if the constraint has really
     * changed before calling the callback.
     * This forces the constraint to be re-evaluted each time
     * it may have changed.
     */
    onMayHaveChanged(callback, check=false){
        // FIXME: This is currently required to update the dependencies the first time but it
        // is may not be required *each* time a new handler is added.
        this._update();
        this._mayHaveChangedListeners.push({
            callback: callback,
            check: check
        });
    }

    /*
     * Removes a "may have changed" callback.
     */
    offMayHaveChanged(callback, check){
        const i = this._mayHaveChangedListeners.findIndex(
            (entry) => entry.callback === callback && (
                check == null || entry.check === check
            )
        );
        if(i >= 0){
            this._mayHaveChangedListeners.splice(i, 1);
        }
    }

    _notifyListeners(){
        const initialValue = this._value;
        this._mayHaveChangedListeners.forEach((entry) => {
            if(entry.check){
                if(this._state !== VALID){
                    this._update();
                }
                if(!this._settings.equals(this._value, initialValue)){
                    entry.callback.call(null, this);
                }
            } else {
                entry.callback.call(null, this);
            }
        });
    }

    /*
     * Removes this constraint from all its dependencies and removes every change listener.
     * This is useful to make sur the constraint memory can be deallocated.
     * This also condamn the constraint so that it cannot be fetched anymore.
     *
     * Without calling this method, because JS misses weakrefs, a constraint tree is only
     * guaranteed to be garbage collected as a whole, i.e. the memory allocated for any
     * constraint attached to a constraints tree is only guaranteed dealocated when there
     * is no outside reference anymore from any constraint of this tree.
     *
     * Once the constraint is detached, its behavior is not guaranteed.
     */
    detach(){
        if(!this.detachable){
            // TODO: use a real exception instead of a string.
            throw "This constraint is not detachable.";
        }
        // Clear dependencies.
        this._dependencies.forEach(
            (d) => d._dependentConstraints.delete(this)
        );
        this._dependencies.clear();
        // Clear dependent constraints.
        this._dependentConstraints.forEach(
            (d) => d._dependencies.delete(this)
        );
        this._dependentConstraints.clear();
        // Set the state.
        this._setState(DETACHED);
    }

    static _createGetter(getter){
        if(typeof getter === "function"){
            return getter;
        } else if(getter instanceof Constraint) {
            return getter.get.bind(getter);
        } else {
            return () => getter;
        }
    }

    get readOnly(){
        return !!this._settings.readOnly;
    }

    get detachable(){
        return !!this._settings.detachable;
    }

    view(){
        return new Constraint(this, { readOnly: true, detachable: false });
    }

    alter (f){
        return new Constraint(() => f(this.get()));
    }
    ifElse(trueVal, falseVal){
        return new Constraint(() => this.get() ? getCtVal(trueVal) : getCtVal(falseVal));
    }
    parseInt(radix){
        return this.alter(x => parseInt(x, getCtVal(radix)));
    }
    parseFloat(){
        return this.alter(x => parseFloat(x));
    }
}

/*
 * Unary operators.
 */
entries({
           not: (x) => !x,
           neg: (x) => -x,
    bitwiseNot: (x) => ~x,
           pos: (x) => +x
}).forEach(([key, op]) => {
    Constraint.prototype[key] = function(){
        return this.alter(x => op(x));
    };
});

/*
 * Operators that can be applied multiple times:
 * e.g constraint.add(x, y, z, ...),
 * constraint.prop('p1', 'p2')
 */
entries({
     add: (x, y) => x + y,
     sub: (x, y) => x - y,
     mul: (x, y) => x * y,
     div: (x, y) => x / y,
    prop: (x, y) => x[y]
}).forEach(([key, op]) => {
    Constraint.prototype[key] = function(...args){
        return new Constraint(
            () => args.reduce((res, x) => op(res, getCtVal(x)), this.get())
        );
    };
});

/*
 * Binary operators.
 */
entries({
                    eq: (x, y) => x === y,
                   neq: (x, y) => x !== y,
               looseEq: (x, y) => x ==  y,
              looseNeq: (x, y) => x !=  y,
                    gt: (x, y) => x  >  y,
                   gte: (x, y) => x >=  y,
                    lt: (x, y) => x  <  y,
                   lte: (x, y) => x <=  y,
                   xor: (x, y) => x  ^  y,
            bitwiseAnd: (x, y) => x  &  y,
             bitwiseOr: (x, y) => x  |  y,
                   mod: (x, y) => x  %  y,
            rightShift: (x, y) => x >>  y,
             leftShift: (x, y) => x <<  y,
    unsignedRightShift: (x, y) => x >>> y,
                   pow: (x, y) => Math.pow(x, y)
}).forEach(([key, op]) => {
    Constraint.prototype[key] = function(y){
        return new Constraint(() => op(this.get(), getCtVal(y)));
    };
});

/*
 * Unary Math functions.
 */
["abs","acos","acosh","asin","asinh","atan","atanh","cbrt","ceil","clz32",
 "cos","cosh","exp","expm1","floor","fround","imul","log","log10","log1p",
 "log2","round","sign","sin","sinh","sqrt","tan","tanh","trunc"].forEach((opName) => {
    Constraint.prototype[opName] = function(){
        return this.alter((x) => Math[opName].call(Math, x));
    };
});

/*
 * Multi args Math functions (added as static methods).
 */
["hypot","max","min"].forEach((opName) => {
    Constraint[opName] = (...args) => new Constraint(() => {
        return Math[opName](...args.map((arg) => getCtVal(arg)))
    });
});

/*
 * Static constraint combinations.
 */
Constraint.sum = (first, ...rest) => new Constraint(() => rest.reduce(
    (acc, x) => acc + getCtVal(x), getCtVal(first)
));
Constraint.product = (first, ...rest) => new Constraint(() => rest.reduce(
    (acc, x) => acc * getCtVal(x), getCtVal(first)
));
Constraint.atan2 = (x, y) => new Constraint(() => Math.atan2(getCtVal(x), getCtVal(y)));

Constraint._constraintStack = [];


const getCtVal = (x) => Constraint._createGetter(x).call();
