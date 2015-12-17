import test from "tape";
import tie from "../lib";


test("Alter", (assert) => {
    const a = tie(5);
    const b = a.alter(x => x + 4);
    assert.equal(b.get(), 9,
        "Simple alter has the proper value."
    );
    a.set(6);
    assert.equal(b.get(), 10,
        "It is updated when the source constraint changes."
    );
    const c = tie(1);
    const d = b.alter(x => x + c.get());
    assert.equal(d.get(), 11,
        "Alter works if the alter body fetches another constraint."
    );
    c.set(2);
    assert.equal(d.get(), 12,
        "It is updated if this other constraint changes."
    );
    a.set(0);
    assert.equal(d.get(), 6,
        "And continues to be updated if the source constraint changes."
    );
    assert.end();
});

test("IfElse", (assert) => {
    const a = tie('a');
    const b = tie('b');
    const cond = tie(false);
    const res = cond.ifElse(a, b);
    assert.equal(res.get(), 'b',
        "IfElse constriant gets the proper value."
    );
    cond.set(true);
    assert.equal(res.get(), 'a',
        "It is updated when the conditional constraint changes."
    );
    a.set('a2')
    assert.equal(res.get(), 'a2',
        "It is updated when the \"result\" constraint on which it depends changes."
    );
    let called = false;
    res.onMayHaveChanged(() => {
        called = true;
    });
    b.set('b3');
    res.get();
    assert.notOk(called,
        "It is not updated if the \"result\" on which it does not depends change."
    );
    assert.end();
});

test("Parse Numbers", (assert) => {
    const a = tie("3");
    const b = tie("3.6");
    const c = tie("3.1px");
    const af = a.parseFloat();
    const bf = b.parseFloat();
    const cf = c.parseFloat();
    const ai = a.parseInt();
    const bi = b.parseInt();
    const ci = c.parseInt();

    assert.equal(af.get(), 3.0,
        "parseFloat is working for integer strings."
    );
    assert.equal(ai.get(), 3,
        "parseInt is working for integer strings."
    );
    a.set("7");
    assert.equal(af.get(), 7.0,
        "parseFloat is properly updated for integer strings."
    );
    assert.equal(ai.get(), 7,
        "parseInt is properly updated for integer strings."
    );

    assert.equal(bf.get(), 3.6,
        "parseFloat is working for float strings."
    );
    assert.equal(bi.get(), 3,
        "parseInt is working for float strings."
    );
    b.set("49.1020");
    assert.equal(bf.get(), 49.102,
        "parseFloat is properly updated for float strings."
    );
    assert.equal(bi.get(), 49,
        "parseInt is properly updated for float strings."
    );

    assert.equal(cf.get(), 3.1,
        "parseFloat is working for float strings with letters."
    );
    assert.equal(ci.get(), 3,
        "parseInt is working for float strings with letters."
    );
    c.set("32.100001 tie tie tie");
    assert.equal(cf.get(), 32.100001,
        "parseFloat is properly updated for float strings with letters."
    );
    assert.equal(ci.get(), 32,
        "parseInt is properly updated for float strings with letters."
    );
    assert.end();
});

test("Prop", (assert) => {
    const a = tie({
        p1: 'p1-val',
        p2: {
            p21: 'p21-val',
            p22: 'p22-val'
        },
        p3: 'p3-val'
    });

    const b = a.prop('p1');
    assert.equal(b.get(), 'p1-val',
        "Simple prop modifier gets the proper value."
    );

    const prop = tie('p1');
    const c = a.prop(prop);
    assert.equal(c.get(), 'p1-val',
        "Prop can be defined by a constraint."
    );
    prop.set('p3');
    assert.equal(c.get(), 'p3-val',
        "It is updated when this constraint changes."
    );

    assert.equal(a.prop('p2', 'p21').get(), 'p21-val',
        "Multi-level prop works."
    );

    const subPropNum = tie(1);
    const subPropName = tie(() => 'p2' + subPropNum.get());
    const d = a.prop('p2', subPropName);
    assert.equal(d.get(), 'p21-val',
        "Multi-level prop modifier with one level depending of a constraint works."
    );
    subPropNum.set(2);
    assert.equal(d.get(), 'p22-val',
        "It is updated if this constraint changes."
    );
    assert.end();
});

test("Other operators that can be applied multiple times.", (assert) => {
    const a = tie(8);
    const b = tie(13);
    const c = tie(0.5);

    const add = a.add(b, c, 1);
    assert.equal(add.get(), 8 + 13 + 0.5 + 1, "Add gets the correct value..." );
    a.set(5); b.set(10)
    assert.equal(add.get(), 5 + 10 + 0.5 + 1, "...And is properly updated." );

    const sub = a.sub(b, c, -5);
    assert.equal(sub.get(), 5 - 10 - 0.5 + 5, "Sub gets the correct value...");
    a.set(7); b.set(-14);
    assert.equal(sub.get(), 7 + 14 - 0.5 + 5, "...And is properly updated.");

    const mul = a.mul(b, c, 3);
    assert.equal(mul.get(), 7 * (-14) * 0.5 * 3, "Mul gets the correct value...");
    b.set(2.6); c.set(0.8);
    assert.equal(mul.get(), 7 * 2.6 * 0.8 * 3, "...And is properly updated.");

    const div = b.div(c, a, 2);
    assert.equal(div.get(), 2.6 / 0.8 / 7 / 2, "Div gets the correct value...");
    c.set(4); a.set(1);
    assert.equal(div.get(), 2.6 / 4 / 1 / 2, "...And is properly updated.");

    assert.end();
});

test("Math", (assert) => {
    const x = tie(0.2);
    ["abs","acos","asin","asinh","atan","atanh","cbrt","ceil","clz32",
     "cos","cosh","exp","expm1","floor","fround","imul","log","log10","log1p",
     "log2","round","sign","sin","sinh","sqrt","tan","tanh","trunc"].forEach((op) => {
        const xop = x[op]();
        assert.equal(xop.get(), Math[op](0.2),
            op + "(constraint) has the expected value."
        );
    });

    // acoshx is NaN if x < 1
    const acoshx = x.acosh();
    x.set(5);
    assert.equal(acoshx.get(), Math.acosh(5),
        "acosh(constraint) has the expected value."
    )
    assert.end();
});

test("Equals and not equals", (assert) => {
    const a = tie(6);
    const b = tie(6);
    const eqStrict = a.eq(b);
    const neqStrict = a.neq(b);
    const eqLoose = a.looseEq(b);
    const neqLoose = a.looseNeq(b);
    assert.ok(eqStrict.get(), "eqStrict is working with a===b.");
    assert.ok(eqLoose.get(), "eqLoose is working with a===b.");
    assert.notOk(neqStrict.get(), "neqStrict is working with a===b.");
    assert.notOk(neqLoose.get(), "neqLoose is working with a===b.");
    b.set(7);
    assert.notOk(eqStrict.get(), "eqStrict is working with a!==b.");
    assert.notOk(eqLoose.get(), "eqLoose is working with a!==b.");
    assert.ok(neqStrict.get(), "neqStrict is working with a!==b.");
    assert.ok(neqLoose.get(), "neqLoose is working with a!==b.");
    a.set("7");
    assert.notOk(eqStrict.get(), "eqStrict is working with a==b but not a===b.");
    assert.ok(eqLoose.get(), "eqLoose is working with a==b but not a===b.");
    assert.ok(neqStrict.get(), "neqStrict is working with a==b but not a===b.");
    assert.notOk(neqLoose.get(), "neqLoose is working with a==b but not a===b.");
    assert.end();
});

test("Greaters and Lessers", (assert) => {
    const a = tie(6);
    const b = tie("6");
    const gt = a.gt(b);
    const gte = a.gte(b);
    const lt = a.lt(b);
    const lte = a.lte(b);
    assert.notOk(gt.get(), "gt is working with a===b.");
    assert.ok(gte.get(), "gte is working with a===b.");
    assert.notOk(lt.get(), "lt is working with a===b.");
    assert.ok(lte.get(), "lte is working with a===b.");
    b.set("7");
    assert.notOk(gt.get(), "gt is working with a > b.");
    assert.notOk(gte.get(), "gte is working with a > b.");
    assert.ok(lt.get(), "lt is working with a > b.");
    assert.ok(lte.get(), "lte is working with a > b.");
    a.set(10);
    assert.ok(gt.get(), "gt is working with a < b.");
    assert.ok(gte.get(), "gte is working with a < b.");
    assert.notOk(lt.get(), "lt is working with a < b.");
    assert.notOk(lte.get(), "lte is working with a < b.");
    assert.end();
});

test("Pow", (assert) => {
    const a = tie(5);
    const b = tie(3);

    const pow = a.pow(b);
    assert.equal(pow.get(), 125, "Pow is working...");
    a.set(2); b.set(8);
    assert.equal(pow.get(), 256, "...And is propertly updated.");

    assert.end();
});

test("Static constraint combination", (assert) => {
    const a = tie(5);
    const b = tie(2);

    const sum = tie.sum(a, b, 6);
    assert.equal(sum.get(), 5+2+6,
        "Constraint sum is working."
    );
    a.set(3);
    assert.equal(sum.get(), 3+2+6,
        "It is updated when one of the constraints changes."
    );

    const product = tie.product(a, b, 2);
    assert.equal(product.get(), 3*2*2,
        "Constraint product is working."
    );
    b.set(10);
    assert.equal(product.get(), 3*10*2,
        "It is updated when one of the constraints changes."
    );

    const max = tie.max(a, b, 11);
    assert.equal(max.get(), 11,
        "Constraint max is working."
    );
    a.set(20);
    assert.equal(max.get(), 20,
        "It is updated when one of the constraint changes."
    );

    const min = tie.min(a, b, 0);
    assert.equal(min.get(), 0,
        "Constraint min is working."
    );
    b.set(-4);
    assert.equal(min.get(), -4,
        "It is updated when one of the constraint changes."
    );

    const hypot = tie.hypot(a, 8, b);
    assert.equal(hypot.get(), Math.hypot(20, -4, 8),
        "Constraint hypot is working."
    );
    a.set(2);
    assert.equal(hypot.get(), Math.hypot(2, -4, 8),
        "It is updated when one of the constraint changes."
    );

    a.set(90); b.set(15);
    const atan2 = tie.atan2(a, b);
    assert.equal(atan2.get(), Math.atan2(90, 15),
        "Constraint atan2 is working."
    );
    b.set(30);
    assert.equal(atan2.get(), Math.atan2(90, 30),
        "It is properly updated."
    );

    assert.end();
});

test("Unary operator", (assert) => {

    assert.notOk(tie(true).not().get(),
        "Not true is not ok."
    );
    assert.ok(tie(false).not().get(),
        "Not false is ok."
    );
    assert.notOk(tie("thing").not().get(),
        "Not truthy is not ok."
    );
    assert.ok(tie("").not().get(),
        "Not not truthy is ok."
    );

    assert.equal(tie(5).neg().get(), -5,
        "Positive neg is correct."
    );
    assert.equal(tie(-5).neg().get(), 5,
        "Negative neg is correct."
    );


    assert.equal(tie(5).pos().get(), 5,
        "Pos is working with numbers."
    );
    assert.equal(tie("-28").pos().get(), -28,
        "Pos is working with strings."
    );

    assert.equal(tie(2).bitwiseNot().get(), ~2,
        "bitwiseNot is working with positive values."
    );

    assert.equal(tie(-2).bitwiseNot().get(), ~(-2),
        "bitwiseNot is working with negative values."
    );


    assert.equal(tie("6").pos().get(), 6,
        "Pos is working for a string."
    );

    assert.equal(tie([12]).pos().get(), 12,
        "Pos is working for an array."
    );

    assert.end();
});
