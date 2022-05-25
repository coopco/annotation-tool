// TODO disable selection box while drag-adding a box
// http://jsfiddle.net/a7mad24/aPLq5/
import * as annotator from "./annotator.js"

let num_frames = 50;
let current_frame = 0;

let is_down, mouse_x, mouse_y;
let drag_rect, orig_x, orig_y; // For when drag-creating new boxes

let new_track_id = 0;

let canvas_defaults = {
  uniformScaling: false
}

let defaults = {
  fill: 'rgba(0,0,0,0)',
  originX: 'left',
  originY: 'top',
  width: 75,
  height: 75,
  strokeWidth: 2,
  strokeUniform: true,
}

let canvas = new fabric.Canvas('canvas', canvas_defaults);

let frames = []
for (let i = 0; i < num_frames; i++) {
  frames.push({})
}

let tracks = {}

function setFrame(frame_id) {
  console.log(current_frame)
  let frame = frames[current_frame]
  Object.keys(frame).forEach((id) => {
    frame[id].set({visible: false})
  })
  current_frame = frame_id
  frame = frames[current_frame]
  Object.keys(frame).forEach((id) => {
    frame[id].set({visible: true})
  })
  console.log(current_frame)
  console.log(frame)
}

function newBox(frame_id, track_id, properties={}) {
  Object.assign(properties, defaults);
  let rect = new fabric.Rect(properties);

  if (!(track_id in tracks)) {
    tracks[track_id] = {};
  }
  tracks[track_id][frame_id] = rect
  frames[frame_id][track_id] = rect

  canvas.add(rect)
  return rect
}

updateUI();

canvas.on('mouse:down', (o) => {
  if (o.target) {
    return;
  }

  is_down = true;
  let pointer = canvas.getPointer(o.e);
  orig_x = pointer.x;
  orig_y = pointer.y;
  new_track_id += 1;
  drag_rect = newBox(current_frame, new_track_id, {
    left: orig_x,
    top: orig_y,
    width: pointer.x-orig_x,
    height: pointer.y-orig_y
  })
})

canvas.on('mouse:move', (o) => {
  let pointer = canvas.getPointer(o.e);
  mouse_x = pointer.x
  mouse_y = pointer.y

  if (!is_down) return;

  drag_rect.set({left: Math.min(orig_x, mouse_x),
                 top: Math.min(orig_y, mouse_y),
                 width: Math.abs(orig_x - pointer.x),
                 height: Math.abs(orig_y - pointer.y),
                 stroke: 'red'
  });

  canvas.renderAll();
})

canvas.on('mouse:up', (o) => {
  is_down = false;
})

function updateUI() {
  document.getElementById('current_frame').textContent = `Frame index: ${current_frame}/${num_frames-1}`
}

function nextFrame() {
  if (current_frame >= num_frames) return;
  setFrame(current_frame + 1);
  // Seek ahead in video
  // Load current frame data
  canvas.renderAll();
  updateUI();
}

function prevFrame() {
  if (current_frame <= 0) return;
  setFrame(current_frame - 1);
  // Seek ahead in video
  // Load current frame data
  canvas.renderAll();
  updateUI();
}

document.getElementById('btn_next_frame').addEventListener('click', (e) => {
  nextFrame()
})

document.getElementById('btn_prev_frame').addEventListener('click', (e) => {
  prevFrame()
})
