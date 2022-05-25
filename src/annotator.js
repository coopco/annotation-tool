import * as utils from './utils.js'

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

export class Annotator {
  constructor(canvas, num_frames) {
    this.canvas = new fabric.Canvas(canvas, canvas_defaults);
    this.num_frames = num_frames
    this.current_frame = 0;

    this.tracks = {};
    this.frames = [];
    for (let i = 0; i < num_frames; i++) {
      this.frames.push({})
    }
  }

  set_frame(frame_id) {
    let frame = this.frames[this.current_frame]
    Object.keys(frame).forEach((id) => {
      frame[id].set({visible: false})
    })
    this.current_frame = frame_id
    frame = this.frames[this.current_frame]
    Object.keys(frame).forEach((id) => {
      frame[id].set({visible: true})
    })
  }

  new_box(frame_id, track_id, properties={}) {
    Object.assign(properties, defaults);
    let rect = new fabric.Rect(properties);

    if (!(track_id in this.tracks)) {
      this.tracks[track_id] = {};
    }
    this.tracks[track_id][frame_id] = rect
    this.frames[frame_id][track_id] = rect

    this.canvas.add(rect)
    return rect
  }
}
