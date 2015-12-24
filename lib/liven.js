import Constraint from "./constraint";


//TODO: find a better name
export default class Liven {

    constructor(f){
        this._callback = f;
        // This is add and removed as a callback for the constraint
        // on change (with check = true which forces the constraint
        // to be re-evaluated when it changes).
        this._onChangeCallback = function(){};
        this.resume();
    }

    get running(){
        return this._constraint != null;
    }

    stop(){
        this._constraint.offUnsettled(this._onChangeCallback);
        this._constraint.untie();
        this._constraint = null;
    }

    resume(){
        this._constraint = new Constraint(this.call.bind(this));
        this._constraint.onUnsettled(this._onChangeCallback, true);
    }

    call(){
        this._callback.call();
    }

}
