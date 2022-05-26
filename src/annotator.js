import * as utils from './utils.js'

let canvas_defaults = {
  uniformScaling: false,
  backgroundColor: 'black',
}

export let defaults = {
  fill: 'rgba(0,0,0,0)',
  originX: 'left',
  originY: 'top',
  width: 75,
  height: 75,
  strokeWidth: 3,
  strokeUniform: true,
  selectable: true,
}

export class Annotator {
  constructor(canvas, num_frames) {
    this.canvas = new fabric.Canvas(canvas, canvas_defaults);
    this.num_frames = num_frames;
    this.current_frame = 0;

    this.videoEl = document.getElementById('video');
    this.source = document.getElementById('currentVid');
    this.framerate = 15;
    this.video = new fabric.Image(this.videoEl, {
      originX: 'left',
      originY: 'top',
      objectCaching: false,
      width: this.canvas.width,
      height: this.canvas.height,
    })
    //this.canvas.add(this.video);
    this.canvas.setBackgroundImage(this.video)

    this.tracks = {};
    this.frames = [];
    for (let i = 0; i < num_frames; i++) {
      this.frames.push({})
    }
    this.prev_selected_tracks = [];

    this.canvas.on('selection:cleared', (o) => this.selection_cleared(o));
    this.canvas.on('selection:created', (o) => this.selection_created(o));
    this.canvas.on('selection:updated', (o) => this.selection_updated(o));
  }

  async set_frame(frame_id) {
    // Need to clear selection
    let selected = this.get_selected_track_ids()
    this.canvas.discardActiveObject()

    let frame = this.frames[this.current_frame]
    Object.keys(frame).forEach((id) => {
      frame[id].set({visible: false})
    })
    this.current_frame = frame_id
    frame = this.frames[this.current_frame]
    Object.keys(frame).forEach((id) => {
      frame[id].set({visible: true})
    })

    // Select all tracks in current frame that were previously selected
    let continued_tracks = this.get_objects_by(this.current_frame, selected)
    let sel = new fabric.ActiveSelection(continued_tracks, {
      canvas: this.canvas,
    });
    this.canvas.setActiveObject(sel);

    // TODO Select those in prev_selected_tracks as well
    this.prev_selected_tracks.push(selected);
    console.log(this.prev_selected_tracks);


    // Adding 0.0001 seems to avoid rounding errors
    this.videoEl.currentTime = this.current_frame / this.framerate + 0.0001
    await new Promise((resolve) => {
      this.videoEl.onseeked = () => {
        resolve(video);
      };
    });
  }

  new_box(frame_id, track_id, properties={}) {
    properties = {...defaults, ...properties,
                  track_id: track_id, frame_id: frame_id};

    let rect = new fabric.Rect(properties);

    if (!(track_id in this.tracks)) {
      this.tracks[track_id] = {
        stroke: utils.getRandomColor(),
      };
    }

    rect.set({stroke: this.tracks[track_id]['stroke']});
    this.tracks[track_id][frame_id] = rect;
    this.frames[frame_id][track_id] = rect;

    this.canvas.add(rect);
    this.canvas.setActiveObject(rect);
    return rect;
  }

  get_selected_track_ids() {
    let active_objects = this.canvas.getActiveObject();
    if (!active_objects) {
      return []
    } else if (active_objects.hasOwnProperty('track_id')) {
      return [active_objects.track_id]
    } else {
      let track_ids = this.canvas.getActiveObject()._objects.map(o => o.track_id);
      return track_ids;
    }
  }
  
  get_track_ids() {
    return Object.keys(this.tracks);
  }

  get_new_track_id() {
    if (this.prev_selected_tracks.length == 1) {
      return this.prev_selected_tracks[0];
    }

    let track_ids = this.get_track_ids();
    return track_ids.length > 0 ? Math.max(...track_ids)+1 : 1;
  }

  get_objects_by(frame_ids, track_ids) {
    let combos = utils.cartesian_product(frame_ids, track_ids);
    return combos.map(id => this.frames[id[0]][id[1]])
                 .filter(Boolean); // Filters undefined
  }

  delete_objects_by(frame_ids, track_ids) {
    let combos = utils.cartesian_product(frame_ids, track_ids);
    // Fabric.js has drouble removing objects that are selected
    this.canvas.discardActiveObject();
    combos.map(id => {
      this.canvas.remove(this.frames[id[0]][id[1]]);
      delete this.frames[id[0]][id[1]];
      delete this.tracks[id[1]][id[0]];
    });
  }

  selection_cleared(o) {
    this.prev_selected_tracks = [];
  }

  selection_created(o) {
    this.prev_selected_tracks = [];
  }

  selection_updated(o) {
    this.prev_selected_tracks = [];
  }
}
