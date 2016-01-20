import test from "tape";
import tie from "../lib";


test("Module content", (assert) => {
    const expectedContent = ["Constraint", "Activity", "liven", "bindStyle", "bindClass",
                             "hypot", "max", "min", "sum", "product", "atan2"];
    const content = Object.keys(tie);
    expectedContent.forEach((k) => {
        assert.notOk(content.indexOf(k) < 0,
            `${k} is integrated.`
        );
    });
    content.filter(k => expectedContent.indexOf(k) < 0).forEach((k) => {
        assert.fail(`${k} is not supposed to be integrated.`);
    });
    assert.end();
});
