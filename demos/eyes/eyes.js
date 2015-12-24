/*global tie*/

function createEye(mainDiv, eyeRadius, pupilRadius, focusPosition, bigPupilColor){
    // create the DOM
    var eyeDiv = document.createElement("div");
    var pupilDiv = document.createElement("pupil");
    eyeDiv.appendChild(pupilDiv);
    mainDiv.appendChild(eyeDiv);

    var eyeBorderWidth = tie(2);

    // make sure the pupil cannot be bigger than the eye
    pupilRadius = tie.min(pupilRadius, eyeRadius);

    // calculate pupil position
    var dx = eyeRadius.add(eyeBorderWidth).sub(focusPosition.prop("x")).alter(function(x){
        return x + eyeDiv.offsetLeft;
    });
    var dy = eyeRadius.add(eyeBorderWidth).sub(focusPosition.prop("y")).alter(function(y){
        return y + eyeDiv.offsetTop;
    });
    var d  = tie.min(
        eyeRadius.sub(pupilRadius),
        tie.sum(dx.pow(2), dy.pow(2)).sqrt()
    );
    var angle = tie.atan2(dy, dx);
    var pupilLeft = eyeRadius.sub(pupilRadius, d.mul(angle.cos()));
    var pupilTop  = eyeRadius.sub(pupilRadius, d.mul(angle.sin()));

    var pupilColor = eyeRadius.lte(pupilRadius).ifElse(bigPupilColor, "black");

    // set the style
    tie.bindStyle(eyeDiv, {
        "position": "relative",
        "display": "inline-block",
        "margin": "5px 4px",
        "border-radius": "100%",
        "border-width": eyeBorderWidth.add("px"),
        "border-color": "black",
        "border-style": "solid",
        "height": eyeRadius.mul(2).add("px"),
        "width": eyeRadius.mul(2).add("px")
    });
    tie.bindStyle(pupilDiv, {
        "position": "absolute",
        "border-radius": "100%",
        "background-color": pupilColor,
        "left": pupilLeft.add("px"),
        "top": pupilTop.add("px"),
        "height": pupilRadius.mul(2).add("px"),
        "width": pupilRadius.mul(2).add("px")
    });
}

window.addEventListener("load", function(){

    var mousePosition = tie({x: 0, y: 0});
    document.addEventListener("mousemove", function(evt){
        mousePosition.set({ x: evt.pageX, y: evt.pageY });
    });

    var eyeSizeSlider = document.querySelector("#eyes-size");
    var pupilSizeSlider = document.querySelector("#pupils-size");
    var eyeSliderVal = tie(function(){ return eyeSizeSlider.value; });
    var pupilSliderVal = tie(function(){ return pupilSizeSlider.value; });
    eyeSizeSlider.addEventListener("input", eyeSliderVal.invalidate.bind(eyeSliderVal));
    pupilSizeSlider.addEventListener("input", pupilSliderVal.invalidate.bind(pupilSliderVal));

    var eyeRadius = eyeSliderVal.parseFloat();
    var pupilRadius = pupilSliderVal.parseFloat();

    createEyeEye(document.querySelector("#eyes"),
                 eyeRadius, pupilRadius, mousePosition, "lightgray");
    createEyeEye(document.querySelector("#eyes"),
                 eyeRadius.mul(0.7), pupilRadius.mul(0.8), mousePosition, "lightgray");
});
