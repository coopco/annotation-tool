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
  marked: false,
}

let HISTORY_LENGTH = 30;

let is_down, mouse_x, mouse_y, dragged;
let drag_rect, orig_x, orig_y, default_dim; // For when drag-creating new boxes
let field_width = document.getElementById('field_width');
let field_height = document.getElementById('field_height');
let field_id = document.getElementById('field_id');
let p_state = document.getElementById('p_state');
let p_state_bold = document.getElementById('p_state_bold');

// Plotting options
let dot_mode = false;
let nearby_mode = false;
let nearby_distance = 50;
let mark_mode = false;
let interpolation = false;

var Box = fabric.util.createClass(fabric.Rect, {
  type: 'box',
  initialize: function(options) {
    options || (options = { });

    this.callSuper('initialize', options);
    this.set('track_id', options.track_id || 0);
    this.set('frame_id', options.frame_id || 0);
    this.set('marked', options.marked || false);
  },

  // For serialization
  toObject: function() {
    return fabric.util.object.extend(this.callSuper('toObject'), {
      track_id: this.get('track_id'),
      frame_id: this.get('frame_id'),
      marked: this.get('marked')
    });
  },

  // For deserialization
  fromObject: function(object, callback) {
    return fabric.Object._fromObject('box', object, callback);
  },

  _render: function(ctx) {
    let zoom = this.canvas.getZoom();
    // Make stroke width independent of zoom
    this.set({strokeWidth: defaults['strokeWidth']/zoom});

    // Only draw marked boxes in mark_mode
    if (mark_mode && !this.marked) {
      return;
    }

    if (dot_mode) {
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, 2*Math.PI, false);
      ctx.fillStyle = this.stroke;
      ctx.fill();

      // Indicate if box is marked
      if (this.marked) {
        ctx.beginPath();
        ctx.arc(0, 0, 2, 0, 2*Math.PI, false);
        ctx.fillStyle = "red";
        ctx.fill();
      }
    } else if (!dot_mode || this.selected) {
      // Draw rect
      this.callSuper('_render', ctx);

      // Indicate if box is marked
      if (this.marked) {
        ctx.beginPath();
        ctx.lineWidth = 2/zoom;
        ctx.strokeStyle = "red";
        ctx.moveTo(this.width*4/10, -this.height/2);
        ctx.lineTo(this.width/2, -this.height/2);
        ctx.lineTo(this.width/2, -this.height*4/10);
        ctx.stroke()
      }

      // TODO default font size in config somehwere
      // Draw label
      // Make font_size independent of zoom
      let font_size = 24/zoom;
      ctx.font = font_size + 'px Arial';
      ctx.fillStyle = '#00f';
      ctx.fillText(this.track_id, -this.width/2, -this.height/2);
    }
  }
});

export class Annotator {
  constructor(canvas) {
    this.canvas = new fabric.Canvas(canvas, canvas_defaults);
    this.num_frames = 1;
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
    for (let i = 0; i < this.num_frames; i++) {
      this.frames.push({})
    }
    this.states = new Array(HISTORY_LENGTH);
    this.states_pointer = 0; // Points to current state in states
    this.states_time = 0; // Tracks how far behind newest state we are
    this.prev_selected_track = -1;

    this.canvas.on('mouse:down', (o) => this.mouse_down(o));
    this.canvas.on('mouse:move', (o) => this.mouse_move(o));
    this.canvas.on('mouse:up', (o) => this.mouse_up(o));
    this.canvas.on('mouse:wheel', (o) => this.mouse_wheel(o));
    this.canvas.on('selection:cleared', (o) => this.selection_cleared(o));
    this.canvas.on('selection:created', (o) => this.selection_created(o));
    this.canvas.on('selection:updated', (o) => this.selection_updated(o));

    this.save_state();
  }

  reinit() {
    let range = utils.range(0, this.num_frames-1, 1);
    this.delete_objects_by(range, this.get_track_ids());
    this.tracks = [];
    this.frames = [];
    for (let i = 0; i < this.num_frames; i++) {
      this.frames.push({})
    }
    //this.states = new Array(HISTORY_LENGTH);
    //this.save_state();
    this.prev_selected_track = -1;
    this.canvas.clear();
    this.canvas.setBackgroundImage(this.video)
  }

  async set_frame(frame_id) {
    this.set_dirty();
    let old_frame = this.current_frame;

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

    // TODO simplify
    // Choose prev_selected_track
    if (selected.length == 1 && continued_tracks.length == 0) {
      this.prev_selected_track = selected[0];
    } else if (selected.length == 1 && continued_tracks.length > 0) {
      this.prev_selected_track = this.prev_selected_track;
    } else if (selected.length > 1 && continued_tracks.length == 0) {
      this.prev_selected_track = -1;
    } else if (selected.length > 1 && continued_tracks.length > 0) {
      if (selected.length > continued_tracks.length) {
        this.prev_selected_track = -1;
      } else {
        this.prev_selected_track = this.prev_selected_track
      }
    } else if (selected.length == 0 && this.prev_selected_track != -1 &&
               this.frames[old_frame][this.prev_selected_track]) {
      this.prev_selected_track = -1;
    }

    let box = this.frames[this.current_frame][this.prev_selected_track];
    let left, top;
    if (box) {
      continued_tracks.push(box);
      // Needed for weird fabric.js bug where selected box gets moved
      let left = box.left;
      let top = box.top;
    }

    if (continued_tracks.length > 0) {
      let sel = new fabric.ActiveSelection(continued_tracks, {
        canvas: this.canvas,
      });
      this.canvas.setActiveObject(sel);
    }

    // Needed for weird fabric.js bug where selected box gets moved
    if (box) {
      box.dirty = true;
      box.left = left;
      box.top = top;
    }

    // Adding 0.0001 seems to avoid rounding errors
    this.videoEl.currentTime = this.current_frame / this.framerate + 0.0001
    await new Promise((resolve) => {
      this.videoEl.onseeked = () => {
        resolve(video);
      };
    });

    this.canvas.renderAll();
    this.update_UI();
  }

  new_box(frame_id, track_id, properties={}) {
    properties = {...defaults, ...properties,
                  track_id: track_id, frame_id: frame_id};

    //let rect = new fabric.Rect(properties);
    let rect = new Box(properties);

    if (!(track_id in this.tracks)) {
      let stroke = properties.stroke || utils.getRandomColor();
      this.tracks[track_id] = {
        stroke: stroke,
      };
    }

    rect.set({stroke: this.tracks[track_id]['stroke']});
    this.tracks[track_id][frame_id] = rect;
    this.frames[frame_id][track_id] = rect;

    this.canvas.add(rect);
    return rect;
  }

  interpolate(box1, box2) {
    let d_frames = box2.frame_id - box1.frame_id;
    if (d_frames < 2) {
      return;
    }
    let step_left = (box2.left - box1.left) / d_frames;
    let step_top = (box2.top - box1.top) / d_frames;
    let step_width = (box2.width - box1.width) / d_frames;
    let step_height = (box2.height - box1.height) / d_frames;
    for (let i = 1; i < d_frames; i++) {
      this.new_box(box1.frame_id+i, box1.track_id, {
        left: box1.left + step_left*i,
        top: box1.top + step_top*i,
        width: box1.width + step_width*i,
        height: box1.height + step_height*i,
        visible: false,
      });
    }
  }

  interpolate_track(track_id) {
    let track = this.tracks[track_id];
    let frame_ids = Object.keys(track).filter(key => !isNaN(key));
    for (let i = 1; i < frame_ids.length; i++) {
      this.interpolate(track[frame_ids[i-1]], track[frame_ids[i]]);
    }
    this.set_dirty();
    this.set_frame(this.current_frame);
  }

  merge_selected() {
    let selected = this.get_selected_track_ids();
    if (selected.length == 2) {
      this.merge_tracks(selected[0], selected[1]);
    } else if (selected.length == 1 && this.prev_selected_track != -1) {
      this.merge_tracks(this.prev_selected_track, selected[0]);
    } else {
      alert("Must select exactly 2 tracks in current frame to merge, or have 1 track selected with another selected in a previous frame.")
    }
  }

  merge_tracks(id1, id2) {
    // TODO change alert to visual indicator on canvas?
    // Needed to avoid bug with deleted track still being selected
    this.canvas.discardActiveObject()

    // Prioritise lower track_id
    let tmp = Math.min(id1, id2);
    let tmp2 = Math.max(id1, id2);
    id1 = tmp;
    id2 = tmp2;
    //[id1, id2] = [Math.min(id1, id2), Math.max(id1, id2)];

    let range = utils.range(0, this.num_frames-1, 1);
    let id2_boxes = this.get_objects_by(range, id2);
    // Don't need to do anything to id1_boxes

    // Merge track2 into track1
    for (let frame_id of range) {
      let frame = this.frames[frame_id];
      if (!frame[id1] && frame[id2]) {
        this.new_box(frame_id, id1, frame[id2]);
      }
    }

    // Delete track2
    this.delete_objects_by(range, id2);

    this.set_dirty();
    this.canvas.renderAll();
    this.save_state();
    console.log("MERGE");
  }

  get_selected_track_ids() {
    let active_objects = this.canvas.getActiveObjects();
    if (!active_objects) {
      return []
    } else if (active_objects.hasOwnProperty('track_id')) {
      return [active_objects.track_id]
    } else {
      let track_ids = active_objects.map(o => o.track_id);
      return track_ids;
    }
  }
  
  get_track_ids() {
    return Object.keys(this.tracks);
  }

  get_new_track_id() {
    if (this.prev_selected_track != -1 && !this.frames[this.current_frame][this.prev_selected_track]) {
      return this.prev_selected_track;
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

  update_annotations(csv_data) {
    this.reinit();
    // TODO handle frame_id index out of bounds?
    let track_ids = csv_data.map(e => e[1]).filter((e, index, arr) => arr.indexOf(e) === index);
    for (let track_id of track_ids) {
      let detections = csv_data.filter(e => e[1] === track_id).sort((a, b) => {
        return (a[0] > b[0]) ? 1 : ((b[0] > a[0]) ? -1 : 0)
      });
      for (let detection of detections) {
        if (detection[0] > this.num_frames-1) continue;
        this.new_box(detection[0], detection[1], {
          left:   detection[2],
          top:    detection[3],
          width:  detection[4],
          height: detection[5],
          angle: detection[6] || 0,
          visible: detection[0] == this.current_frame
        });
      }
    }
    this.save_state();
    console.log("UPDATE ANNOTATIONS");
  }

  set_dirty() {
    let range = utils.range(0, this.num_frames-1, 1);
    let track_ids = this.get_track_ids();

    this.get_objects_by(range, track_ids).forEach(box => {
      box.dirty = true;
    });
    //this.video.set({ dirty: true });
  }

  /*
  *  History functions
  */
  save_state() {
    this.states_pointer = (this.states_pointer + 1) % HISTORY_LENGTH
    this.states_time = 0;
    this.states[this.states_pointer] = {
      canvas: this.canvas.toObject(),
      frame_id: this.current_frame,
      viewport: this.canvas.viewportTransform,
    }
  }

  load_state(state) {
    // Not sure why this is required
    let old_sp = this.states_pointer;
    let old_st = this.states_time;

    // Reinitialization
    this.reinit();
    // Add all objects
    state.canvas.objects.forEach((o) => {
      if (o.type == 'box') {
        this.new_box(o.frame_id, o.track_id, o);
      }
    });
    // Set frame
    this.set_frame(state.frame_id);
    this.update_UI();

    // Restore viewport
    this.canvas.viewportTransform = state.viewport;

    // Not sure why this is required
    this.states_pointer = old_sp;
    this.states_time = old_st;
  }

  can_undo() {
    let states_pointer = (this.states_pointer + this.states.length - 1) % HISTORY_LENGTH;
    let states_time = this.states_time - 1;
    // If previous state is not in the future, and exists
    return states_time > -HISTORY_LENGTH + 1 && this.states[states_pointer];
  }

  can_redo() {
    let states_pointer = (this.states_pointer + 1) % HISTORY_LENGTH;
    let states_time = this.states_time + 1;
    // If previous state is in the future, or doesn't exist
    return states_time <= 0 && this.states[states_pointer];
  }

  undo() {
    if (this.can_undo()) {
      // + 99 avoids need for proper negative modulo
      this.states_pointer = (this.states_pointer + this.states.length - 1) % HISTORY_LENGTH;
      this.states_time -= 1;
      this.load_state(this.states[this.states_pointer]);
    } else {
      console.log("CAN'T UNDO");
    }
  }

  redo() {
    if (this.can_redo()) {
      this.states_pointer = (this.states_pointer + 1) % HISTORY_LENGTH;
      this.states_time += 1;
      this.load_state(this.states[this.states_pointer]);
    } else {
      console.log("CAN'T REDO");
    }
  }

  // TODO call when moving, resizing, etc.
  // maybe make a annotator.renderAll function?
  set_nearby_visibility() {
    let frame = this.frames[this.current_frame];
    let selected = this.get_selected_track_ids();
    let selected_boxes = this.get_objects_by(this.current_frame, selected);
    Object.keys(frame).forEach((id) => {
      // Get box
      let box = this.frames[this.current_frame][id];
      let distance2 = Infinity;
      for (let box2 of selected_boxes) {
        // Get distance to box
        let dx = (box.left + box.width/2) - (box2.left + box2.width/2);
        let dy = (box.top + box.height/2) - (box2.top + box2.height/2);
        console.log(box.left);
        console.log(box2.left);
        console.log(dx**2 + dy**2);
        distance2 = Math.min(distance2, dx**2 + dy**2);
      }

      // If min distance > nearby_distance
      if (distance2 > nearby_distance**2) {
        frame[id].set({visible: false});
      } else {
        // TODO hmm didn't work
        frame[id].set({visible: true}); // Needed for when toggling nearby_mode
      }
      // Must also call when changing frame
    })
  }

  toggle_dot_mode() {
    dot_mode = !dot_mode;
    this.set_dirty();
    this.canvas.renderAll();
  }

  toggle_nearby_mode() {
    nearby_mode = !nearby_mode;
    if (nearby_mode) this.set_nearby_visibility();
    this.set_dirty();
    this.canvas.renderAll();
  }

  toggle_mark_mode() {
    mark_mode = !mark_mode;
    this.set_dirty();
    this.canvas.renderAll();
  }

  toggle_interpolation() {
    interpolation = !interpolation;
  }

  mouse_down(o) {
    dragged = false
    if (o.target) {
      return;
    }

    // TODO should rename this variable
    is_down = true;

    // Must use clientX for panning
    if (o.e.altKey) {
      this.canvas.selection = false;
      this.canvas.lastPosX = o.e.clientX;
      this.canvas.lastPosY = o.e.clientY;
      return;
    }

    if (o.e.ctrlKey || o.e.shiftKey) {
      this.canvas.selection = false;
      default_dim = true
      let pointer = this.canvas.getPointer(o.e);
      orig_x = pointer.x;
      orig_y = pointer.y;
      drag_rect = this.new_box(this.current_frame,
        this.get_new_track_id(), {
        left: orig_x,
        top: orig_y,
        width: pointer.x-orig_x,
        height: pointer.y-orig_y
      })
      this.canvas.setActiveObject(drag_rect);
    }
  }

  is_camera_in_bounds(vpt) {
    let x = vpt[4];
    let y = vpt[5];
    let max_x = 0;
    let max_y = 0;
    let min_x = -this.video.width * vpt[0] + this.canvas.width
    let min_y = -this.video.height * vpt[3] + this.canvas.height
    // TODO >= or > ?
    return x > min_x && y > min_y && x <= max_x && y <= max_y;
  }

  mouse_move(o) {
    dragged = true;
    if (!is_down) return;

    // Must use clientX for panning
    if (o.e.altKey == true) {
      let vpt = this.canvas.viewportTransform
      let dx = o.e.clientX - this.canvas.lastPosX;
      let dy = o.e.clientY - this.canvas.lastPosY;

      vpt[4] += dx
      vpt[5] += dy

      // If panning out of bounds
      if (!this.is_camera_in_bounds(vpt)) {
        vpt[4] -= dx
        vpt[5] -= dy
      }

      this.canvas.requestRenderAll();
      this.canvas.lastPosX = o.e.clientX;
      this.canvas.lastPosY = o.e.clientY;
      return;
    }

    let pointer = this.canvas.getPointer(o.e);
    mouse_x = pointer.x
    mouse_y = pointer.y

    if (o.e.ctrlKey || o.e.shiftKey) {
      let distance2 = Math.abs(orig_x - mouse_x)**2 + Math.abs(orig_y - mouse_y)**2
      if (distance2 > 200) {
        default_dim = false
      }

      if (!default_dim) {
        drag_rect.set({left: Math.min(orig_x, mouse_x),
                       top: Math.min(orig_y, mouse_y),
                       width: Math.abs(orig_x - pointer.x),
                       height: Math.abs(orig_y - pointer.y)
        });
      }
      this.canvas.renderAll();
    }
  }

  mouse_up(o) {
    // on mouse up we want to recalculate new interaction
    // for all objects, so we call setViewportTransform
    this.canvas.setViewportTransform(this.canvas.viewportTransform);
    this.canvas.selection = true;

    // Must update width, height, and flip after scaling since
    // fabric.js resizing only affects target.scaleX and target.scaleY
    let target = o.target;
    if (target && !is_down && target.type == 'box') {
      if (!target || target.type !== 'box') {
          return;
      }
      target.flipX = false;
      target.flipY = false;
      target.width = target.width * target.scaleX;
      target.height = target.height * target.scaleY;
      target.scaleX = 1;
      target.scaleY = 1;

      this.set_dirty();
      this.canvas.renderAll();
      if (dragged) this.save_state();
      if (dragged) console.log("TRANSFORMING");
      return;
    }

    is_down = false;

    if ((o.e.ctrlKey || o.e.shiftKey)) {
      if (default_dim) {
        let w = defaults['width']
        let h = defaults['height']
        drag_rect.set({left: orig_x - w/2,
                       top: orig_y - h/2,
                       width: w,
                       height: h
        });
      }

      // Interpolate
      if (interpolation) {
        let id = drag_rect.track_id;
        let frame_ids = Object.keys(this.tracks[id])
                              .filter(key => !isNaN(key) && key != drag_rect.frame_id);
        let last_frame = Math.max(...frame_ids);
        let first_frame = Math.min(...frame_ids);

        if (frame_ids.length > 0 && this.current_frame > last_frame) {
          this.interpolate(this.tracks[id][last_frame], drag_rect);
        } else if (frame_ids.length > 0 && this.current_frame < first_frame) {
          this.interpolate(drag_rect, this.tracks[id][first_frame]);
        }
      }

      this.canvas.renderAll();
      this.save_state();
      console.log("DEFAULT_DIM");
    }
    this.update_UI();
  }

  mouse_wheel(o) {
    let delta = o.e.deltaY;
    let zoom = this.canvas.getZoom();
    zoom *= 0.99 ** delta;
    let min_zoom = this.canvas.width / this.video.width
    if (zoom > 20) zoom = 20;
    if (zoom < min_zoom) zoom = min_zoom;

    // If video smaller than canvas, cap zoom
    // TODO make sure zoom increments are restore when zooming back in
    if (this.canvas.width <= this.video.width * zoom && 
        this.canvas.height <= this.video.height * zoom) {
    }

    this.canvas.zoomToPoint({ x: o.e.offsetX, y: o.e.offsetY }, zoom);

    // Pan if zooming out of bounds
    let vpt = this.canvas.viewportTransform
    if (!this.is_camera_in_bounds(vpt)) {
      let max_x = 0;
      let max_y = 0;
      let min_x = -this.video.width * vpt[0] + this.canvas.width
      let min_y = -this.video.height * vpt[3] + this.canvas.height
      let x = Math.min(max_x, Math.max(vpt[4], min_x));
      let y = Math.min(max_y, Math.max(vpt[5], min_y));
      vpt[4] = x
      vpt[5] = y
    }

    o.e.preventDefault();
    o.e.stopPropagation();
  }

  selection_cleared(o) {
    this.update_UI();
    field_id.disabled = true;
    //if (nearby_mode) this.set_nearby_visibility();
  }

  selection_created(o) {
    this.update_UI();
    //if (nearby_mode) this.set_nearby_visibility();
  }

  selection_updated(o) {
    this.update_UI();
    //if (nearby_mode) this.set_nearby_visibility();
  }

  update_UI() {
    let selected = this.get_selected_track_ids();
    // Update width and height text fields
    if (selected.length == 1) {
      let id = selected[0];
      field_id.value = id;
      field_id.disabled = false;
      field_width.value = this.tracks[id][this.current_frame]['width']
      field_height.value = this.tracks[id][this.current_frame]['height']
    } else {
      // Disable track ID field
      field_id.disabled = true;
    }

    // Update text
    let p_state_text = ''
    if (this.prev_selected_track != -1) {
      //p_state_text = `Previously selected track ID: ${this.prev_selected_track}\n\n`
      p_state_bold.textContent = `Previously selected track: ${this.prev_selected_track}`
    } else {
      //p_state_text = 'No previously selected track\n\n';
      p_state_bold.textContent = "Previously selected track: None"
    }
    let track_text = selected.map(id => {
      // For some reason, isNaN checks if a string is (not) a number
      let frame_ids = Object.keys(this.tracks[id]).filter(key => !isNaN(key));
      let first_frame = Math.min(...frame_ids);
      let last_frame = Math.max(...frame_ids);
      return `ID: ${id}, Frames ${first_frame}-${last_frame}`
    })
    p_state_text = p_state_text + `Selected Tracks:\n ${track_text.join('\n ')}`
    let marked = this.get_track_ids().filter(e => this.tracks[e].marked)
    p_state_text += `\n\nMarked Tracks:\n ${marked.join(', ')}`
    p_state.textContent = p_state_text;

    // Disable/renable undo/redo buttons
    document.getElementById('btn_undo').disabled = !this.can_undo();
    document.getElementById('btn_redo').disabled = !this.can_redo();
  }
}
