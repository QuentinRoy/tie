const invalid = Symbol("invalid");
const valid = Symbol("valid");
const uncertain = Symbol("uncertain");
const evaluation = Symbol("evaluation");
const destroyed = Symbol("destroyed");


/**
 * Algorthme basics:
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
 *
 * Golden rule: nothing gets out of this class without registerings itself
 * as a dependency of the caller (except if specified otherwise in arguments).
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
        // Set the dependent constraint as uncertain.
        // If this._state === uncertain, dependent constraints
        // should be already uncertain too.
        if(this._state === valid){
            this._setDepsUncertain();
        } else if(this._state === evaluation){
            // self invalidating evaluation is forbidden for now.
            // TODO: use a real exception
            throw "Cannot invalidate a constraint still being evaluated."
        }
        // Because the constraint will need to be re-evaluated anyway,
        // there is no need to keep its dependencies until then.
        // Clearing the constraint's dependencies gives an invalid
        // constraint the opportunity to be garbage collected if it
        // is not used anymore.
        this._clearDependencies();
        this._setState(invalid);
    }

    onStateChange(){
        // TODO
        throw "Not yet implemented."
    }

    _setDepsUncertain(){
        this._dependentConstraints.forEach((dc) => {
            if(dc._state === valid){
                dc._setState(uncertain);
                dc._setDepsUncertain();
            }
        });
    }

    /**
     * Get the constraint value, evaluating it if necessary
     * (i.e. if it is invalid).
     */
    get(updateCallersDeps=true){
        if(this._state === destroyed) return;
        // If there is a caller, register this constraint as dependency
        // of this caller, and add the caller to the dependent
        // constraints.
        if(updateCallersDeps){
            this._updateCallersDeps();
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
    _updateCallersDeps(){
        if(Constraint._constraintStack.length > 0){
            const caller = Constraint._constraintStack[Constraint._constraintStack.length - 1]
            caller._addDependency(this);
        }
    }

    _addDependency(dep){
        // This must (and should) not be called if the constraint has been destroyed.
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
     *
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
        this._clearDependencies();
        this._value = this._stackCall(() => this._getter());

        const changed = oldValue !== this._value;
        // If the constraint value has changed, all dependent constraint are invalidated
        // except if they are still being evaluated (self invalidating evaluation if forbidden
        // for now).
        if(changed){
            this._dependentConstraints.forEach((dc) => {
                if(dc._state !== evaluation){
                    dc.invalidate()
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

    _clearDependencies(){
        this._dependencies.forEach(
            (d) => d._dependentConstraints.delete(this)
        );
        this._dependencies.clear();
    }

    _clearDependentConstraints(){
        this._dependentConstraints.forEach(
            (d) => d._dependencies.delete(this)
        );
        this._dependentConstraints.clear();
    }

    _setState(newState){
        if(this._state !== destroyed){
            this._state = newState;
        }
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
        this._clearDependencies();
        this._clearDependentConstraints();
        this._setState(destroyed);
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
