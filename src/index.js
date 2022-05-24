import * as annotator from "./annotator.js"

let num_frames = 50;
let current_frame = 0;

let isDown, mouseX, mouseY;
let dragRect, origX, origY; // For when drag-creating new boxes

let canvas_defaults = {
  uniformScaling: false
}

let defaults = {
  fill: 'rgba(0,0,0,0)',
  originX: 'left',
  originY: 'top',
  width: 75,
  height: 75,
  stroke: 'red',
  strokeWidth: 2,
  strokeUniform: true,
}

function newBox(properties) {
  Object.assign(properties, defaults);
  let rect = new fabric.Rect(properties);
  canvas.add(rect)
  return rect
}

let canvas = new fabric.Canvas('canvas', canvas_defaults);

canvas.on('mouse:down', (o) => {
  if (o.target) {
    return;
  }

  isDown = true;
  let pointer = canvas.getPointer(o.e);
  origX = pointer.x;
  origY = pointer.y;
  dragRect = newBox({
    left: origX,
    top: origY,
    width: pointer.x-origX,
    height: pointer.y-origY
  })
})

canvas.on('mouse:move', (o) => {
  let pointer = canvas.getPointer(o.e);
  mouseX = pointer.x
  mouseY = pointer.y
  console.log(mouseX)
  console.log(origX)
  console.log(origX > mouseX)

  if (!isDown) return;

  dragRect.set({left: Math.min(origX, mouseX),
                top: Math.min(origY, mouseY),
                width: Math.abs(origX - pointer.x),
                height: Math.abs(origY - pointer.y)
  });

  canvas.renderAll();
})

canvas.on('mouse:up', (o) => {
  isDown = false;
})

function nextFrame() {
  if (current_frame >= num_frames) return;

}

function prevFrame() {
  if (current_frame <= 1) return;
}

document.getElementById('btn_next_frame').addEventListener('click', (e) => {
  nextFrame()
})

document.getElementById('btn_prev_frame').addEventListener('click', (e) => {
  prevFrame()
})
