
export default class Constraint {

    constructor (getter) {
        this._getter = null;
        this._cache = null;
        this._isValid = false;
        this._isCurrentlyEvaluated = false;
        this._dependencies = [];
        this._dependentConstraints = [];
        this.set(getter);
    }

    set(getter) {
        this._getter = Constraint._createGetter(getter);
        this.invalidate();
    }

    invalidate(){
        this._isValid = false;
        this._dependentConstraints.forEach((p) => p.invalidate());
    }

    get isValid(){
        return this._isValid;
    }

    get(){
        // retrieve the constraint caller (if any)
        const caller = Constraint._constraintStack[Constraint._constraintStack.length - 1];
        // if the constraint is already being evaluated
        // return the cached value to avoid infinite loop
        if(!this._isValid && !this._isCurrentlyEvaluated){
            this._isCurrentlyEvaluated = true;
            // reset the dependencies
            this._clearDependencies();
            // push this constraint to the stack before evaluating
            Constraint._constraintStack.push(this);
            this._cache = this._getter();
            // Removes this constraint from the stack once
            // the evaluation is terminated.
            // It should be at the top of it.
            if(Constraint._constraintStack.pop() !== this){
                //TODO: use a real exception
                throw "Constraint stack error";
            }
            this._isCurrentlyEvaluated = false;
            this._isValid = true;
        }
        // If there is a caller, register this as dependency
        // of this caller, and add the caller to the dependent
        // constraints.
        if(caller){
            caller._dependencies.push(this);
            this._dependentConstraints.push(caller);
        }
        return this._cache;
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
