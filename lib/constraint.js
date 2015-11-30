const invalid = Symbol("invalid");
const valid = Symbol("valid");
const uncertain = Symbol("uncertain");
const evaluation = Symbol("evaluation");

/*
    "invalid" state: the constraint must be re-evaluated, at least one of the constraint it currently
        depends own is known to have changed
    "uncertain" state: it is not sure if the constraint must be re-evaluated. One of its ancestor
        has been invalidated but it is not sure yet that one of its parents has actually changed. A constraint
        may still be in the "uncertain" state when all of its parent has been re-evaluated without change
        but must not be in this state if we know (for sure) that one of its parent has changed.
    "valid" state: the constraint does not need to be re-evaluated.

    Algorthme basics:
    * When a constraint switch to the "invalid" or "uncertain" state, its children get the state "uncertain"
    * When a constraint is evaluated and its value has changed, its children get the state "invalid"
    * When an "invalid" constraint is retrieved, it is (re)-evaluated
    * When an "uncertain" contraint is requested its "invalid" and "uncertain" parents are udpated
        - as soon as one "uncertain" or "invalid" parent changed after its evaluation the constraint is
            in order (without requesting the other parents that may not be requested at all in the
            following). Because the dependencies are called in order of used, stopping as soon as one changed
            dependency is found ensure that we do not trigger the evaluation of a dependency that may
            not be used anymore.
        - if no parent changed (or all are already valid), the constraint switches to the "valid" state
            without being re-evaluated
*/
export default class Constraint {

    constructor (getter) {
        this._getter = null;
        this._value = null;
        this._state = invalid;
        this._dependencies = [];
        this._dependentConstraints = [];
        this.set(getter);
    }

    set(getter) {
        this._getter = Constraint._createGetter(getter);
        this.invalidate();
    }

    invalidate(){
        // if this._state === uncertain, dependent constriants
        // should be already uncertain too
        if(this._state === valid){
            this._dependentConstraints.forEach((dc) => dc._setuncertain());
        } else if(this._state === evaluation){
            // self invalidating evaluation is forbidden for now.
            // TODO: use a real exception
            throw "Cannot invalidate a constraint still being evaluated."
        }
        this._state = invalid;
    }

    onStateChange(){
        // TODO
        throw "Not yet implemented."
    }

    _setuncertain(){
        this._state = uncertain;
        this._dependentConstraints.forEach((dc) => {
            if(dc._state === valid){
                dc._setuncertain()
            }
        });
    }

    get(updateCallersDeps){
        this._update(updateCallersDeps);
        return this._value;
    }

    /**
     * Update the constraint value.
     * This also manages the constraint's dependency and the constraints that depend on this
     * constraint.
     * @param updateCallersDeps Whether to automatically add a dependency from this constraint to
     *      ones that depend on it.
     * @returns true if the constraint value has changed, false otherwise.
     */
    _update(updateCallersDeps){
        // If there is a caller, register this as dependency
        // of this caller, and add the caller to the dependent
        // constraints.
        updateCallersDeps = updateCallersDeps == null ? true
                                                      : updateCallersDeps;
        if(updateCallersDeps && Constraint._constraintStack.length > 0){
            const caller = Constraint._constraintStack[Constraint._constraintStack.length - 1]
            caller._dependencies.push(this);
            this._dependentConstraints.push(caller);
        }

        // if the constraint's state is uncertain, evaluate its dependencies (in order)
        // and evaluate itself if one has changed.
        if(this._state === uncertain){
            this._dependencies.some((d) => d._update(false));
            // if one dependency has changed, this._state should be invalid now.
        }
        let valueChanged = false;
        if(this._state === invalid){
            this._state = evaluation;
            const oldValue = this._value;
            // reset the dependencies
            this._clearDependencies();
            // push this constraint to the stack before evaluating it
            Constraint._constraintStack.push(this);
            this._value = this._getter();
            // Removes this constraint from the stack once the evaluation is terminated.
            // It should be at the top of it.
            if(Constraint._constraintStack.pop() !== this){
                //TODO: use a real exception
                throw "Constraint stack error";
            }
            valueChanged = oldValue !== this._value;

            // If the constraint value has changed, all dependent constraint are invalidated
            // except if they are still being evaluated (self invalidating evaluation if forbidden
            // for now).
            if(valueChanged){
                this._dependentConstraints.forEach((dc) => {
                    if(dc._state !== evaluation){
                        dc.invalidate();
                    }
                });
            }
        }
        this._state = valid;
        return valueChanged;
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

    _clearDependencies(){
        this._dependencies.forEach((d) => {
            // remove this from dependencies' dependent constraints
            const dx = d._dependentConstraints.indexOf(this);
            if(dx >= 0) {
                d._dependentConstraints.splice(dx, 1)
            }
        });
        // clear the dependencies
        this._dependencies = [];

    }

    destroy(){
        this._clearDependencies();
    }
}

Constraint._constraintStack = [];
