/*
 * Algorithm's principle:
 * - When a constraint switches to the "invalid" or "unsettled" state, its children get the state
 * "unsettled".
 * - When a constraint is evaluated and its value has changed, its children get the state "invalid".
 * - When an "invalid" constraint is retrieved, it is (re)-evaluated.
 * - When an "unsettled" constraint is requested, its "invalid" and "unsettled" parents are updated
 *   - as soon as one "unsettled" or "invalid" parent changes after its evaluation, the constraint
 *       is re-evaluated. Because the dependencies are called in order of use, stopping as soon as
 *       one changed dependency is found ensure that we do not trigger the evaluation of a
 *       dependency that may not be used anymore.
 *   - if no parent changed (or all are already valid), the constraint switches to the "valid" state
 *   without being re-evaluated.
 */

// Constraint's states:

/*
 * Means the constraint must be re-evaluated, at least one of the constraints it currently directly
 * depends on is known to have changed.
 */
const INVALID = Symbol("invalid");

/*
 * The constraint does not need to be re-evaluated.
 */
const VALID = Symbol("valid");

/*
 * It is not sure if the constraint must be re-evaluated. One of its ancestor has been invalidated
 * but it is not sure yet that one of its parents has actually changed. A constraint may still be
 * in the "unsettled" state when all of its parent has been re-evaluated without change but must
 * not be in this state if we know (for sure) that one of its parent has changed.
 */
const UNSETTLED = Symbol("unsettled");

/*
 * The constraint is currently being evaluated. If its value is fetched again (i.e. in the of cyclic
 * dependencies), the cached value will be provided.
 * Because self-invalidating evaluation is forbidden it is not possible to invalidate or set the
 * constraint value when it is in this state (may change in the future).
 */
const PROCESSED = Symbol("processed");

/*
 * The constraint has been untied so that it can be garbaged collected.  Any link to its
 * dependencies and the constraint that depends on its has been cut. If fetched, it will now
 * always return `undefined`.
 */
const UNTIED = Symbol("untied");

const DEFAULT_SETTINGS = {
  equals: (a, b) => a === b || (Number.isNaN(a) && Number.isNaN(b)),
  untieable: true
};

let getCtVal;

export default class Constraint {
  // Static members: _callingConstraint, _pendingNotifications and _notifier (see below).

  /**
   * Create a constraint and set its value to *getter*.
   * See set.
   * @param {fun|*} getter A getter to set the constraint (a value or a
   * function).
   * @param {object} [settings] Settings of the constraint constraint.
   */
  constructor(getter, settings) {
    this._settings = Object.assign({}, DEFAULT_SETTINGS, settings);
    // Default read-only depends of the provided getter: function or Constraint -> readOnly
    // else, writable.
    if (this._settings.readOnly == null) {
      this._settings.readOnly =
        typeof getter === "function" || getter instanceof Constraint;
    }
    this._getter = null;
    this._value = null;
    this._state = INVALID;
    this._dependencies = new Set();
    this._dependentConstraints = new Set();
    // Registers handlers to be called when the constraint is unsettled.
    this._listeners = [];
    this._set(getter);
  }

  /**
   * Set the constraint value.
   * If it is a function, this function will be used as a getter.
   * If it is another constraint, this constraint will be constrained to this
   * other constraint.
   * If it is any other value, the constraint will be set to this value.
   * Read-only constraints can only be set while created.
   *
   * @param {func|*} getter A getter to set the constraint (a value or a
   * function).
   * @returns {undefined}
   */
  set(getter) {
    if (this.readOnly) {
      throw new Error("Cannot set a read-only constraint.");
    }
    this._set(getter);
  }

  _set(getter) {
    if (this._state === PROCESSED) {
      // self invalidating evaluation is forbidden for now.
      throw new Error(
        "Cannot re-set a constraint that is still being evaluated."
      );
    }
    this._getter = Constraint._createGetter(getter);
    this.invalidate();
  }

  /*
   * Invalidate the constraint.
   * As a result, the next its value is fetched, it will be re-evaluated.
   */
  invalidate() {
    if (this._state === PROCESSED) {
      // self invalidating evaluation is forbidden for now.
      throw new Error("Cannot invalidate a constraint still being evaluated.");
    }
    this._unsettle(true);
  }

  /**
   * Notify this constraint that it may have changed.
   * @param {boolean} invalid if true, the constraint is invalidated instead of
   * being only unsettled.
   * @param {boolean} alreadyNotified the constraints that have already been
   * notified of this potential change and that should not be notified again.
   * @returns {undefined}
   */
  _unsettle(invalid = false, alreadyNotified = new Set()) {
    // JS default arguments' evaluation is on method call so default
    // alreadyNotified will be a new set each time _unsettle() is called without
    // args.

    // Specify that this constraint has been notified
    alreadyNotified.add(this);

    if (this._state === VALID) {
      this._setState(invalid ? INVALID : UNSETTLED);
    } else if (this._state === UNSETTLED && invalid) {
      this._setState(INVALID);
    }

    // If no process is currently in charge of the notification: take the token.
    const notifyListeners = !Constraint._notifier;
    Constraint._notifier = true;
    if (this._listeners.length) {
      Constraint._pendingNotifications.push(this);
    }

    // Notify this constraint's dependent constraint if they have not been yet
    // notified.
    this._dependentConstraints.forEach(dc => {
      if (!alreadyNotified.has(dc)) {
        dc._unsettle(false, alreadyNotified);
      }
    });

    // The listener notifications are sent only once all dependent constraints
    // have been unsettled. Using a global pending list of notifications also
    // ensure that the notifications added following constraint invalidation
    // during a notifications are inserted in the same list, and called in the
    // invalidation order.
    if (notifyListeners) {
      while (Constraint._pendingNotifications.length > 0) {
        const currentNotif = Constraint._pendingNotifications;
        Constraint._pendingNotifications = [];
        currentNotif.forEach(constraint => constraint._notifyListeners());
      }
      Constraint._notifier = false;
    }
  }

  /**
   * Get the constraint value, evaluating it if necessary (i.e. if it is
   * invalid).
   * @param {boolean} [regAsCallersDependency=true] register the constraint as a
   * dependency to its caller (if it is another constraint).
   * @return {*} the constraint value
   */
  get(regAsCallersDependency = true) {
    if (this._state === UNTIED) return undefined;
    // If there is a caller, register this constraint as dependency of this
    // caller, and add the caller to the dependent constraints.
    if (regAsCallersDependency) {
      this._regAsCallersDependency();
    }

    if (this._state !== VALID && this._state !== PROCESSED) {
      this._update();
    }
    return this._value;
  }

  // Add the constraint as dependency of the calling constraint (if any).
  _regAsCallersDependency() {
    if (Constraint._callingConstraint) {
      Constraint._callingConstraint._registerDependency(this);
    }
  }

  // Register a new constraint on which depends this constraint.
  _registerDependency(dep) {
    // This must (and should) not be called if the constraint has been untied.
    this._dependencies.add(dep);
    dep._dependentConstraints.add(this);
  }

  // Settle the constraint state between valid or invalid if its state is
  // unsettled. This does not update the constraint itself but is likely to
  // update some of its dependencies.
  _settle() {
    if (this._state === UNSETTLED) {
      // Update the dependencies (in order) until it finds one that has changed.
      let someParentChanged = false;
      // eslint-disable-next-line no-restricted-syntax
      for (const p of this._dependencies) {
        someParentChanged = p._update();
        if (someParentChanged) break;
      }
      if (!someParentChanged) {
        // If no dependency has changed, the present constraint (this) is valid.
        this._setState(VALID);
      }
      // If one dependency has changed it should have invalidated the present
      // constraint so this._state should be "invalid" now.
    }
    return this._state;
  }

  // Update the constraint's value.
  _update() {
    // If the state is unsettled, settle it between valid or invalid.
    this._settle();
    if (this._state === INVALID) {
      return this._evaluate();
    }
    return false;
  }

  _evaluate() {
    this._setState(PROCESSED);
    const oldValue = this._value;
    // Reset the dependencies (so that dependencies that are not used anymore
    // are removed).
    const previousDependencies = this._dependencies;
    this._dependencies = new Set();
    this._value = this._stackCall(() => this._getter());
    // Remove this as a dependent constraint from all the previous dependencies
    // that are not used anymore.
    previousDependencies.forEach(pd => {
      if (!this._dependencies.has(pd)) {
        pd._dependentConstraints.delete(this);
      }
    });

    const changed = !this._settings.equals(oldValue, this._value);
    // If the constraint value has changed, all dependent constraints are
    // invalidated except if they are still being evaluated (self invalidating
    // evaluation if forbidden for now).
    if (changed) {
      this._dependentConstraints.forEach(dc => {
        if (dc._state !== PROCESSED) {
          dc._setState(INVALID);
        }
      });
    }
    this._setState(VALID);
    return changed;
  }

  // Add this constraint to the constraint stack, call f, then restore the
  // previous caller.
  _stackCall(f) {
    // Save previous caller.
    const calling = Constraint._callingConstraint;
    // Set this as calling constraint.
    Constraint._callingConstraint = this;
    // Do the call.
    const result = f();
    // Check if this is still the calling constraint.
    if (Constraint._callingConstraint !== this) {
      throw new Error("Constraint stack error");
    }
    // Restore previous caller.
    Constraint._callingConstraint = calling;
    return result;
  }

  _setState(newState) {
    if (this._state !== UNTIED) {
      this._state = newState;
    }
  }

  /**
   * Register a callback that will be called each time the constraint changes.
   * Warning: registering a callback forces the constraint to be re-evaluated
   * each times it is unsettled!
   *
   * @param {func} callback The callback to set.
   * @returns {undefined}
   */
  onChange(callback) {
    if (this._state === UNTIED) {
      throw new Error(
        "Cannot add a listener to a constraint that has been untied."
      );
    }
    this._update();
    this._listeners.push(callback);
  }

  /**
   * Removes a listener.
   *
   * @param {func} callback The callback to set.
   * @returns {undefined}
   */
  offChange(callback) {
    const i = this._listeners.indexOf(callback);
    if (i >= 0) {
      this._listeners.splice(i, 1);
    }
  }

  _notifyListeners(checkChange = true, newValue, oldValue) {
    if (this._listeners.length < 1) return;
    // if checkChange is false, the second arguments must be the  old value.
    oldValue = checkChange ? this._value : newValue; // eslint-disable-line no-param-reassign
    if (!checkChange || this._update()) {
      newValue = this._value; // eslint-disable-line no-param-reassign
      this._listeners.forEach(callback => {
        callback.call(this, newValue, oldValue, this);
      });
    }
  }

  /**
   * Removes this constraint from all its dependencies and removes every change
   * listener. This is useful to make sur the constraint memory can be
   * de-allocated. This also condemn the constraint so that it cannot be fetched
   * anymore.
   *
   * Without calling this method, because JS misses weakrefs, a constraint tree
   * is only guaranteed to be garbage collected as a whole, i.e. the memory
   * allocated for any constraint attached to a constraints tree is only
   * guaranteed de-allocated when there is no outside reference anymore from any
   * constraint of this tree.
   *
   * Fetch, an untied constraint will alway return `undefined`.
   *
   * @returns {undefined}
   */
  untie() {
    if (!this.untieable) {
      throw new Error("This constraint cannot be untied.");
    }
    // Clear dependencies.
    this._dependencies.forEach(d => d._dependentConstraints.delete(this));
    this._dependencies = null;
    // Clear dependent constraints.
    this._dependentConstraints.forEach(d => d._dependencies.delete(this));
    this._dependentConstraints = null;
    // Clear the listeners
    this._listeners = null;
    // Set the state.
    this._setState(UNTIED);
  }

  static _createGetter(getter) {
    if (typeof getter === "function") {
      return getter;
    } else if (getter instanceof Constraint) {
      return getter.get.bind(getter);
    }
    return () => getter;
  }

  /**
   * @returns {boolean} True if the constraint is read-only.
   */
  get readOnly() {
    return !!this._settings.readOnly;
  }

  /**
   * @returns {boolean} True if the constraint is un-tieable.
   */
  get untieable() {
    return !!this._settings.untieable;
  }

  /**
   * @returns {Constraint} A new constraint, read-only and un-tieable.
   */
  view() {
    return new Constraint(this, { readOnly: true, untieable: false });
  }

  /**
   * @param {func} f a function to call with the value of the constraint.
   * @returns {Constraint} A new constraint modified using f.
   */
  alter(f) {
    return new Constraint(() => f(this.get()));
  }

  /**
   * @param {*} trueVal A value to take if the constraint is truethy.
   * @param {*} falseVal A value to take if the constraint is falsy.
   * @returns {Constraint} A new constraint strictly equal to trueVal if the
   * constraint is truethy, and falseVal otherwise.
   */
  ifElse(trueVal, falseVal) {
    return new Constraint(
      () => (this.get() ? getCtVal(trueVal) : getCtVal(falseVal))
    );
  }

  /**
   * Constraint factory (creates a Constraint instance using the same
   * argument as the Constraint constructor).
   *
   * @param {*} args Arguments of the
   * [Constraint constructor]{@link Constraint}.
   * @returns {Activity} The newly created activity.
   */
  static of(...args) {
    return new Constraint(...args);
  }
}

// Static members:
// Stack of the constraint being evaluated.
Constraint._callingConstraint = null;
// List of constraints with listeners whose notification is pending.
Constraint._pendingNotifications = [];
// Register if the notification is currently being taken care of.
Constraint._notifier = false;

/*
 * Unary operators.
 */
Object.entries({
  not: x => !x,
  neg: x => -x,
  bitwiseNot: x => ~x, // eslint-disable-line no-bitwise
  pos: x => +x,
  parseFloat,
  isNaN: (...args) => Number.isNaN(...args),
  isFinite: (...args) => Number.isFinite(...args),
  // Avoid overwriting the toString special method.
  toStringConstraint: String,
  toNumber: Number,
  toBoolean: Boolean
}).forEach(([key, op]) => {
  // eslint-disable-next-line func-names
  Constraint.prototype[key] = function() {
    return this.alter(x => op(x));
  };
});

/*
 * Operators that can be applied multiple times:
 * e.g constraint.add(x, y, z, ...), constraint.prop('p1', 'p2').
 */
Object.entries({
  add: (x, y) => x + y,
  sub: (x, y) => x - y,
  mul: (x, y) => x * y,
  div: (x, y) => x / y,
  prop: (x, y) => x[y]
}).forEach(([key, op]) => {
  // eslint-disable-next-line func-names
  Constraint.prototype[key] = function(...args) {
    return new Constraint(() =>
      args.reduce((res, x) => op(res, getCtVal(x)), this.get())
    );
  };
});

/*
 * Binary operators.
 */
Object.entries({
  eq: (x, y) => x === y,
  neq: (x, y) => x !== y,
  looseEq: (x, y) => x == y, // eslint-disable-line eqeqeq
  looseNeq: (x, y) => x != y, // eslint-disable-line eqeqeq
  gt: (x, y) => x > y,
  gte: (x, y) => x >= y,
  lt: (x, y) => x < y,
  lte: (x, y) => x <= y,
  xor: (x, y) => x ^ y, // eslint-disable-line no-bitwise
  bitwiseAnd: (x, y) => x & y, // eslint-disable-line no-bitwise
  bitwiseOr: (x, y) => x | y, // eslint-disable-line no-bitwise
  mod: (x, y) => x % y,
  rightShift: (x, y) => x >> y, // eslint-disable-line no-bitwise
  leftShift: (x, y) => x << y, // eslint-disable-line no-bitwise
  unsignedRightShift: (x, y) => x >>> y, // eslint-disable-line no-bitwise
  pow: (x, y) => x ** y,
  parseInt: (x, y) => parseInt(x, y)
}).forEach(([key, op]) => {
  // eslint-disable-next-line func-names
  Constraint.prototype[key] = function(y) {
    return new Constraint(() => op(this.get(), getCtVal(y)));
  };
});

/*
 * Unary Math functions.
 */
[
  "abs",
  "acos",
  "acosh",
  "asin",
  "asinh",
  "atan",
  "atanh",
  "cbrt",
  "ceil",
  "clz32",
  "cos",
  "cosh",
  "exp",
  "expm1",
  "floor",
  "fround",
  "imul",
  "log",
  "log10",
  "log1p",
  "log2",
  "round",
  "sign",
  "sin",
  "sinh",
  "sqrt",
  "tan",
  "tanh",
  "trunc"
].forEach(opName => {
  // eslint-disable-next-line func-names
  Constraint.prototype[opName] = function() {
    return this.alter(x => Math[opName].call(Math, x));
  };
});

/*
 * Multi args Math functions (added as static methods).
 */
["hypot", "max", "min"].forEach(opName => {
  Constraint[opName] = (...args) =>
    new Constraint(() => Math[opName](...args.map(arg => getCtVal(arg))));
});

/*
 * Static constraint combinations.
 */
Constraint.sum = (first, ...rest) =>
  new Constraint(() =>
    rest.reduce((acc, x) => acc + getCtVal(x), getCtVal(first))
  );
Constraint.product = (first, ...rest) =>
  new Constraint(() =>
    rest.reduce((acc, x) => acc * getCtVal(x), getCtVal(first))
  );
Constraint.atan2 = (x, y) =>
  new Constraint(() => Math.atan2(getCtVal(x), getCtVal(y)));

getCtVal = x => Constraint._createGetter(x).call();
