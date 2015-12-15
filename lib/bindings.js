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
        const classesVal = classes instanceof Constraint ? classes.get()
                                                         : classes;
        if(typeof classesVal === "string"){
            // split the string into words
            return classesVal.match(/\S+/g);
        } else {
            return classesVal ? classesVal : [];
        }
    });
    let previousClassList = [];
    return new Liven(() => {
        const newClassList = classList.get();
        // Add the new class
        newClassList.forEach(function(className){
            node.classList.add(className);
        });
        // Remove the class previously added and that are not
        // present anymore.
        previousClassList.filter(function(className){
            return newClassList.indexOf(className) < 0;
        }).forEach(function(className){
            node.classList.remove(className);
        });
        previousClassList = newClassList;
    });
}
