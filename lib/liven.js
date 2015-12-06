import Constraint from "./constraint";

export default class Liven {

    constructor(f){
        this._callback = f;
        this._constraint = new Constraint(this.call.bind(this));
        // This is add and removed as a callback for the constraint
        // on change (with check = true which forces the constraint
        // to be re-evaluated when it changes).
        this._onChangeCallback = function(){};
        this._running = false;
        this.resume();
    }

    get running(){
        return this._running;
    }

    stop(){
        this._constraint.offMayHaveChanged(this._onChangeCallback);
        this._running = false;
    }

    resume(){
        this._constraint.onMayHaveChanged(this._onChangeCallback, true);
        this._running = true;
    }

    call(){
        this._callback.call();
    }

}
