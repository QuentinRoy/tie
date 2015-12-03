/**
 * Algorthme's principe:
 * - When a constraint switch to the "invalid" or "uncertain" state, its children get the state "uncertain"
 * - When a constraint is evaluated and its value has changed, its children get the state "invalid"
 * - When an "invalid" constraint is retrieved, it is (re)-evaluated
 * - When an "uncertain" contraint is requested its "invalid" and "uncertain" parents are udpated
 *   - as soon as one "uncertain" or "invalid" parent changed after its evaluation the constraint is
 *       re-evaluated. Because the dependencies are called in order of used, stopping as soon as one changed
 *       dependency is found ensure that we do not trigger the evaluation of a dependency that may
 *       not be used anymore.
 *   - if no parent changed (or all are already valid), the constraint switches to the "valid" state
 *       without being re-evaluated
 */


// Constraint's states:

/*
 * Means the constraint must be re-evaluated, at least one of the constraint it currently
 * depends own is known to have changed
 */
const invalid = Symbol("invalid");

/*
 * The constraint does not need to be re-evaluated.
 */
const valid = Symbol("valid");

/*
 * It is not sure if the constraint must be re-evaluated. One of its ancestor
 * has been invalidated but it is not sure yet that one of its parents has actually changed. A constraint
 * may still be in the "uncertain" state when all of its parent has been re-evaluated without change
 * but must not be in this state if we know (for sure) that one of its parent has changed.
*/
const uncertain = Symbol("uncertain");

/*
 * The constraint is currently being evaluated. If its value is fetched again (i.e. in the
 * of cyclic dependencies), the cached value will be provided.
 * Because self-invalidating evaluation is forbidden it is not possible to invalidate or
 * set the constraint value when it is in this state (may change in the future).
 */
const evaluation = Symbol("evaluation");

/*
 * The constraint has been detached so that it can be garbaged collected.
 * Any link to its dependencies and the constraint that depends on its has been cut.
 * If fetched, it will now always return `undefined`.
 */
const detached = Symbol("detached");



/*
 * Golden rule: nothing gets out of an instance of this class without registerings
 * itself as a dependency of the potential calling's constraint
 * (except if specified otherwise in arguments).
 */
export default class Constraint {

    /*
     * Create a constraint and set its value to *getter*.
     * See set.
     */
    constructor (getter) {
        this._getter = null;
        this._value = null;
        this._state = invalid;
        this._dependencies = new Set();
        this._dependentConstraints = new Set();
        // Registers handlers to be called when the constraint may have changed.
        // Contains an object (see onMayHaveChanged).
        this._mayHaveChangedListeners = [];
        this.set(getter);
    }

    /*
     * Set the constraint value.
     * If it is a function, this function will be used as a getter.
     * If it is another constraint, this constraint will be constrained
     * to this other constraint.
     */
    set(getter) {
        this._getter = Constraint._createGetter(getter);
        this.invalidate();
    }

    /*
     * Invalidate the constraint.
     * As a result, the next its value is fetched, it will be
     * re-evaluated.
     */
    invalidate(){
        if(this._state === evaluation){
            // self invalidating evaluation is forbidden for now.
            // TODO: use a real exception
            throw "Cannot invalidate a constraint still being evaluated."
        }

        this._setState(invalid);
        this._mayHaveChanged();
    }

    /*
     * Notify this constraint that it may have changed.
     * @param alreadyNotified the constraint that has already
     * been notified of this potential change and that should not
     * be notified again.
     */
    _mayHaveChanged(alreadyNotified=new Set()){
        if(this._state === valid){
            this._setState(uncertain);
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
        if(this._state === detached) return;
        // If there is a caller, register this constraint as dependency
        // of this caller, and add the caller to the dependent
        // constraints.
        if(regAsCallersDependency){
            this._regAsCallersDependency();
        }

        if(this._state !== valid && this._state !== evaluation){
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
     * Settle the constraint state between valid or invlaid if its state is uncertain.
     * This does not update the constraint itself but is likely to update
     * some of its dependencies.
     */
    _settle(){
        if(this._state === uncertain){
            // Update the dependencies (in order) until it finds one that
            // changes.
            let someParentChanged = false;
            for(let p of this._dependencies){
                someParentChanged = p._update();
                if(someParentChanged) break;
            }
            if(!someParentChanged){
                // If no dependency has changed, the present constraint (this) is valid.
                this._setState(valid);
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
        if(this._state === invalid){
            return this._evaluate();
        }
        return false;
    }

    _evaluate(){
        this._setState(evaluation);
        const oldValue = this._value;
        // Reset the dependencies (so that dependencies that are not used anymore are removed).
        const previousDependencies = this._dependencies;
        this._dependencies = new Set();
        this._value = this._stackCall(() => this._getter());
        // Remove this as a dependent constraint from all the previous dependencies
        // that are not used anymore
        previousDependencies.forEach((pd) => {
            if(!this._dependencies.has(pd)){
                pd._dependentConstraints.delete(this);
            }
        });

        const changed = oldValue !== this._value;
        // If the constraint value has changed, all dependent constraint are invalidated
        // except if they are still being evaluated (self invalidating evaluation if forbidden
        // for now).
        if(changed){
            this._dependentConstraints.forEach((dc) => {
                if(dc._state !== evaluation){
                    dc._setState(invalid);
                }
            });
        }
        this._setState(valid);
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
        if(this._state !== detached){
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
                if(this._state !== valid){
                    this._update();
                }
                if(this._value !== initialValue){
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
        this._setState(detached);
    }

    static _createGetter(getter){
        if(typeof getter === "function"){
            return getter;
        } else if(getter instanceof Constraint){
            return () => getter.get();
        } else {
            return () => getter;
        }
    }
}

Constraint._constraintStack = [];
