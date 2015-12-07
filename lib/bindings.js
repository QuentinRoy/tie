import Liven from "./liven";
import Constraint from "./constraint";

export function bindStyle(node, properties){
    return new Liven(() => {
        for(const prop in properties){
            const value = properties[prop];
            node.style[prop] = value instanceof Constraint ? value.get()
                                                           : value;
        }
    });
}

export function bindClass(node, classes){
    // convert classes into an array
    const classList = new Constraint(() => {
        const classesVal = classes.get();
        if(typeof classesVal === "string"){
            // split the string into words
            return classesVal.match(/\S+/g);
        } else {
            // must be an array
            return classesVal;
        }
    });
    let previousClassList;
    return new Liven(() => {
        const newClassList = classList.get();
        for(const newClass of classList){
            node.classList.add(newClass)
        }
        for(const oldClass of previousClassList){
            if(newClassList.indexOf(oldClass) < 0){
                node.classList.remove(oldClass);
            }
        }
        previousClassList = newClassList;
    });
}
