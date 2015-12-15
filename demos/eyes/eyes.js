window.addEventListener("load", function(){
    var mousePosition = tie({x: 0, y: 0});
    document.addEventListener("mousemove", function(evt){
        mousePosition.set({ x: evt.pageX, y: evt.pageY });
    });

    var eyeSizeSlider = document.querySelector("#eyes-size");
    var pupilSizeSlider = document.querySelector("#pupil-size");
    var eyeBorder = tie(function(){
        var eye = document.querySelector(".eye");
        return parseInt(getComputedStyle(eye)["border-width"]);
    });

    var eyeSliderVal = tie(function(){ return eyeSizeSlider.value });
    var pupilSliderVal = tie(function(){ return pupilSizeSlider.value });
    eyeSizeSlider.addEventListener("input", eyeSliderVal.invalidate.bind(eyeSliderVal));
    pupilSizeSlider.addEventListener("input", pupilSliderVal.invalidate.bind(pupilSliderVal));

    var eyeRadius = tie(eyeSliderVal).parseFloat();
    var pupilRadius = tie.min(
        pupilSliderVal.parseFloat(), eyeRadius
    );
    var pupilClass = eyeRadius.lte(pupilRadius).ifElse("red");

    ['left', 'right'].forEach(function(side){
        var eye = document.querySelector(".eye." + side);
        var pupil  = eye.querySelector(".pupil");
        var eyePos = tie(function() { return { left: eye.offsetLeft, top: eye.offsetTop }; });
        eyeRadius.onMayHaveChanged(eyePos.invalidate.bind(eyePos));
        var dx = eyePos.prop("left").add(eyeRadius).sub(mousePosition.prop('x'));
        var dy = eyePos.prop("top").add(eyeRadius).sub(mousePosition.prop('y'));
        var d  = tie.min(
            eyeRadius.sub(pupilRadius),
            tie.sum(dx.pow(2), dy.pow(2)).sqrt()
        );
        var angle   = tie.atan2(dy, dx);
        var eyeLeft = eyeRadius.sub(pupilRadius, d.mul(angle.cos()));
        var eyeTop  = eyeRadius.sub(pupilRadius, d.mul(angle.sin()));
        tie.bindStyle(eye, {
            height: eyeRadius.mul(2).add("px"),
            width: eyeRadius.mul(2).add("px")
        });
        tie.bindStyle(pupil, {
            left: eyeLeft.add("px"),
            top: eyeTop.add("px"),
            height: pupilRadius.mul(2).add("px"),
            width: pupilRadius.mul(2).add("px")
        });
        tie.bindClass(pupil, pupilClass);
    });
});
