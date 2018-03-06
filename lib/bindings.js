import Activity from "./activity";
import Constraint from "./constraint";

export function bindStyle(node, properties) {
  return new Activity(() => {
    Object.entries(properties).forEach(([prop, value]) => {
      // eslint-disable-next-line no-param-reassign
      node.style[prop] = value instanceof Constraint ? value.get() : value;
    });
  });
}

export function bindClass(node, classes) {
  // convert classes into an array
  const classList = new Constraint(() => {
    const classesVal = classes instanceof Constraint ? classes.get() : classes;
    if (typeof classesVal === "string") {
      // split the string into words
      return classesVal.match(/\S+/g);
    }
    return classesVal || [];
  });
  let previousClassList = [];
  return new Activity(() => {
    const newClassList = classList.get();
    // Add the new class
    newClassList.forEach(className => {
      node.classList.add(className);
    });
    // Remove the class previously added and that are not present anymore.
    previousClassList
      .filter(className => newClassList.indexOf(className) < 0)
      .forEach(className => {
        node.classList.remove(className);
      });
    previousClassList = newClassList;
  });
}
