import Constraint from "./constraint";


//TODO: find a better name
export default class Liven {

    constructor(f){
        this._callback = f;
        // This callback is added and removed as a callback for the constraint's onChange handler
        // so that it is forced to be constantly updated.
        this._onChangeCallback = function(){};
        this.resume();
    }

    get running(){
        return this._constraint != null;
    }

    stop(){
        this._constraint.offChange(this._onChangeCallback);
        this._constraint.untie();
        this._constraint = null;
    }

    resume(){
        this._constraint = new Constraint(this.call.bind(this));
        this._constraint.onChange(this._onChangeCallback);
    }

    call(){
        this._callback.call();
    }

}
