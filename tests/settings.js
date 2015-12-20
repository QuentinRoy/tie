import test from "tape";
import tie from "../lib";
import deepEqual from "deep-equal";

test("Equals setting", (assert) => {
    let changed = 0;
    const stdCon = tie({});
    stdCon.onMayHaveChanged(() => changed++, true);
    stdCon.set({});
    assert.equals(changed, 1,
        "Default equality check uses strict equality...");
    stdCon.set("1");
    stdCon.set("1");
    stdCon.set(1);
    stdCon.set(1);
    assert.equals(changed, 3,
        "...And notifies it listeners each time a different value is set.");


    changed = 0;
    const looseCon = tie("4", { equals: (a, b) => a == b });
    looseCon.onMayHaveChanged(() => changed++, true);
    looseCon.set(4);
    assert.equals(changed, 0,
        "Equality check can be redefined (e.g. with a strict coercive equality...");

    changed = 0;
    const deepCon = tie({ 4: "4 val", prop: "prop val", a: [7, 9, 10]}, { equals: deepEqual });
    deepCon.onMayHaveChanged(() => changed++, true);
    deepCon.set({ 4: "4 val", prop: "prop val", a: [7, 9, 10]});
    assert.equals(changed, 0,
        "... or with a strict deep equal).");

    assert.end();
});

