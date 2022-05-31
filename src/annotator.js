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

let is_down, mouse_x, mouse_y;
let drag_rect, orig_x, orig_y, default_dim; // For when drag-creating new boxes
let field_width = document.getElementById('field_width');
let field_height = document.getElementById('field_height');
let field_id = document.getElementById('field_id');
let field_color = document.getElementById('field_color');

var Box = fabric.util.createClass(fabric.Rect, {
  type: 'box',
  initialize: function(options) {
    options || (options = { });

    this.callSuper('initialize', options);
    this.set('track_id', options.track_id || '');
    this.set('marked', options.marked || false);
  },

  toObject: function() {
    return fabric.util.object.extend(this.callSuper('toObject'), {
      track_id: this.get('track_id'),
      marked: this.get('marked')
    });
  },

  _render: function(ctx) {
    let zoom = this.canvas.getZoom();
    // Make stroke width independent of zoom
    this.set({strokeWidth: defaults['strokeWidth']/zoom});

    this.callSuper('_render', ctx);

    // TODO default font size in config somehwere
    // Make font_size independent of zoom
    let font_size = 24/this.canvas.getZoom();
    ctx.font = font_size + 'px Arial';
    ctx.fillStyle = '#00f';
    ctx.fillText(this.track_id, -this.width/2, -this.height/2);

    // TODO draw marked mode
    // TODO draw dot if dot mode
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
    this.prev_selected_tracks = [];

    this.current_tool = "pan"

    this.canvas.on('mouse:down', (o) => this.mouse_down(o));
    this.canvas.on('mouse:move', (o) => this.mouse_move(o));
    this.canvas.on('mouse:up', (o) => this.mouse_up(o));
    this.canvas.on('mouse:wheel', (o) => this.mouse_wheel(o));
    this.canvas.on('selection:cleared', (o) => this.selection_cleared(o));
    this.canvas.on('selection:created', (o) => this.selection_created(o));
    this.canvas.on('selection:updated', (o) => this.selection_updated(o));
  }

  set_num_frames(num_frames) {
    this.num_frames = num_frames;
    this.frames = [];
    for (let i = 0; i < this.num_frames; i++) {
      this.frames.push({})
    }
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
    // TODO get continued_tracks working properly
    let continued_tracks = this.get_objects_by(this.current_frame, selected)
    let sel = new fabric.ActiveSelection(continued_tracks, {
      canvas: this.canvas,
    });
    this.canvas.setActiveObject(sel);

    // TODO Select those in prev_selected_tracks as well
    this.prev_selected_tracks.push(selected);

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

    //let rect = new fabric.Rect(properties);
    let rect = new Box(properties);

    if (!(track_id in this.tracks)) {
      this.tracks[track_id] = {
        stroke: utils.getRandomColor(),
      };
    }

    rect.set({stroke: this.tracks[track_id]['stroke']});
    this.tracks[track_id][frame_id] = rect;
    this.frames[frame_id][track_id] = rect;

    this.canvas.add(rect);
    return rect;
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

  update_annotations(csv_data) {
    // TODO handle frame_id index out of bounds?
    let track_ids = csv_data.map(e => e[1]).filter((e, index, arr) => arr.indexOf(e) === index);
    this.tracks = {};
    // Reset frames
    this.set_num_frames(this.num_frames);
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
          visible: detection[0] == this.current_frame
        });
      }
    }
  }

  toggle_dot_mode() {
  }

  toggle_nearby_mode() {
  }

  toggle_marked_mode() {
  }

  mouse_down(o) {
    if (o.target) {
      return;
    }

    is_down = true;

    // Must use clientX for panning
    if (o.e.altKey === true) {
      this.canvas.selection = false;
      this.canvas.lastPosX = o.e.clientX;
      this.canvas.lastPosY = o.e.clientY;
      return;
    }

    if (this.current_tool == "add") {
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
    console.log(x);
    console.log(min_x);
    return x > min_x && y > min_y && x <= max_x && y <= max_y;
  }

  mouse_move(o) {
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

    if (this.current_tool == "add") {
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

      this.update_UI();
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
    // TODO weird ass bug where scaling sometimes doesnt work
    // TODO confirmed to be because of below code
    let target = o.target;
    if (target && !is_down && target.type == 'box') {
      if (!target || target.type !== 'box') {
          return;
      }
      console.log(target.width);
      console.log(target.height);
      console.log(target.scaleX);
      console.log(target.scaleY);
      target.flipX = false;
      target.flipY = false;
      target.width = target.width * target.scaleX;
      target.height = target.height * target.scaleY;
      target.scaleX = 1;
      target.scaleY = 1;
      this.canvas.renderAll();
      return;
    }

    is_down = false;

    if (this.current_tool == "add" && default_dim) {
      let w = defaults['width']
      let h = defaults['height']
      drag_rect.set({left: orig_x - w/2,
                     top: orig_y - h/2,
                     width: w,
                     height: h,
      });

      this.canvas.renderAll();
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
    this.prev_selected_tracks = [];
    field_id.disabled = true;
  }

  selection_created(o) {
    this.prev_selected_tracks = [];
    this.update_UI();
  }

  selection_updated(o) {
    this.prev_selected_tracks = [];
    this.update_UI();
  }

  update_UI() {
    let selected = this.get_selected_track_ids();
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
  }
}
