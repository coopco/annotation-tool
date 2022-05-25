// TODO disable selection box while drag-adding a box
// http://jsfiddle.net/a7mad24/aPLq5/
import {Annotator} from "./annotator.js"

let num_frames = 50;

let is_down, mouse_x, mouse_y;
let drag_rect, orig_x, orig_y; // For when drag-creating new boxes

let new_track_id = 0;

let annotator = new Annotator('canvas', num_frames);

updateUI();

annotator.canvas.on('mouse:down', (o) => {
  if (o.target) {
    return;
  }

  is_down = true;
  let pointer = annotator.canvas.getPointer(o.e);
  orig_x = pointer.x;
  orig_y = pointer.y;
  new_track_id += 1;
  drag_rect = annotator.new_box(annotator.current_frame, new_track_id, {
    left: orig_x,
    top: orig_y,
    width: pointer.x-orig_x,
    height: pointer.y-orig_y
  })
})

annotator.canvas.on('mouse:move', (o) => {
  let pointer = annotator.canvas.getPointer(o.e);
  mouse_x = pointer.x
  mouse_y = pointer.y

  if (!is_down) return;

  drag_rect.set({left: Math.min(orig_x, mouse_x),
                 top: Math.min(orig_y, mouse_y),
                 width: Math.abs(orig_x - pointer.x),
                 height: Math.abs(orig_y - pointer.y),
                 stroke: 'red'
  });

  annotator.canvas.renderAll();
})

annotator.canvas.on('mouse:up', (o) => {
  is_down = false;
})

function updateUI() {
  document.getElementById('current_frame').textContent = `Frame index: ${annotator.current_frame}/${annotator.num_frames-1}`
}

function nextFrame() {
  if (current_frame >= num_frames) return;
  annotator.set_frame(annotator.current_frame + 1);
  // Seek ahead in video
  // Load current frame data
  annotator.canvas.renderAll();
  updateUI();
}

function prevFrame() {
  if (current_frame <= 0) return;
  annotator.set_frame(annotator.current_frame - 1);
  // Seek ahead in video
  // Load current frame data
  annotator.canvas.renderAll();
  updateUI();
}

document.getElementById('btn_next_frame').addEventListener('click', (e) => {
  nextFrame()
})

document.getElementById('btn_prev_frame').addEventListener('click', (e) => {
  prevFrame()
})
