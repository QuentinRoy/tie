import Constraint from "./constraint";

export default class Activity {
  constructor(f) {
    this._callback = f;
    // This function is added and removed as a callback for the constraint's onChange handler
    // so that the constraint is forced to be constantly updated.
    this._onChangeCallback = () => {};
    this.resume();
  }

  get running() {
    return this._constraint != null;
  }

  stop() {
    this._constraint.offChange(this._onChangeCallback);
    this._constraint.untie();
    this._constraint = null;
  }

  resume() {
    this._constraint = new Constraint(this.call.bind(this));
    this._constraint.onChange(this._onChangeCallback);
  }

  call() {
    this._callback.call();
  }

  /**
   * Activity factory (creates an Activity instance using the same
   * argument as the Constraint constructor).
   *
   * @param {*} args Arguments of the
   * [Activity constructor]{@link Activity}.
   * @returns {Activity} The newly created activity.
   */
  static of(...args) {
    return new Activity(...args);
  }
}
