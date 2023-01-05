// TODO disable selection box while drag-adding a box
// http://jsfiddle.net/a7mad24/aPLq5/
import {Annotator, defaults} from "./annotator.js"
import * as utils from "./utils.js"

let annotator = new Annotator('canvas');

let range = document.getElementById('range_scroll');
let field_fps = document.getElementById('field_fps');
field_fps.value = annotator.FRAMERATE;
let btn_play = document.getElementById('btn_play');
let increment = 50;
let paused = true;
let field_id = document.getElementById('field_id');
let field_color = document.getElementById('field_color');
let field_width = document.getElementById('field_width');
let field_height = document.getElementById('field_height');
document.getElementById('chkbox_dot_mode').checked = false;
document.getElementById('chkbox_mark_mode').checked = false;
document.getElementById('chkbox_show_mode').checked = false;
document.getElementById('chkbox_inter_mode').checked = false;

updateUI();

function updateUI() {
  document.getElementById('current_frame').textContent = `Frame index: ${annotator.current_frame}/${annotator.num_frames-1}`
  range.value = annotator.current_frame;
  annotator.canvas.renderAll();
  
  // Disable/renable undo/redo buttons
  document.getElementById('btn_undo').disabled = !annotator.can_undo();
  document.getElementById('btn_redo').disabled = !annotator.can_redo();
}

async function set_frame(frame_id) {
  await annotator.set_frame(frame_id);
  updateUI();
}

async function play_video_callback() {
  // calculate id of current frame
  let frame_id = Math.min((annotator.videoEl.currentTime * annotator.framerate) | 0, annotator.num_frames-1)
  // TODO race
  //await annotator.set_frame(frame_id, false);
  let frame = annotator.frames[annotator.current_frame]
  Object.keys(frame).forEach((id) => {
    frame[id].set({visible: false})
  })
  annotator.current_frame = frame_id
  frame = annotator.frames[annotator.current_frame]
  Object.keys(frame).forEach((id) => {
    frame[id].set({visible: true})
  })

  updateUI();

  if (frame_id >= annotator.num_frames - 1) {
    paused = true;
    if (btn_play.innerHTML == "Play") {
      btn_play.innerHTML = "Pause"
    } else {
      btn_play.innerHTML = "Play"
    }
  }

  if (paused) {
    // Are there left over threads?
    annotator.videoEl.pause();

    // set_frame just to make sure annotator is in good state
    // maybe isn't strictly necessary
    annotator.videoEl.currentTime = frame_id / annotator.framerate + 0.0001
    await new Promise((resolve) => {
      annotator.videoEl.onseeked = () => {
        resolve(video);
      };
    });

    annotator.canvas.renderAll();
    annotator.update_UI();
    return;
  } else {
    requestAnimationFrame(play_video_callback);
  }
}

async function play_video() {
  if (annotator.current_frame >= annotator.num_frames - 1) {
    paused = true;
    return;
  }

  // If first call
  annotator.videoEl.play();
  annotator.canvas.discardActiveObject();
  // TODO disable selection, adding boxes, etc. while playing
  //
  requestAnimationFrame(play_video_callback);
}

/*
* Player controls
*/

document.getElementById('btn_next_frame').addEventListener('click', (e) => {
  if (annotator.current_frame >= annotator.num_frames - 1) return;
  set_frame(annotator.current_frame + 1);
})

document.getElementById('btn_prev_frame').addEventListener('click', (e) => {
  if (annotator.current_frame <= 0) return;
  set_frame(annotator.current_frame - 1);
})

document.getElementById('btn_decrement').addEventListener('click', (e) => {
  let frame = Math.max(0, annotator.current_frame-increment);
  set_frame(frame);
})

document.getElementById('btn_increment').addEventListener('click', (e) => {
  let frame = Math.min(annotator.num_frames-1, annotator.current_frame+increment);
  set_frame(frame);
})

document.getElementById('field_increment').addEventListener('input', (e) => {
  increment = Number(document.getElementById('field_increment').value);
});


document.getElementById('text_field_frame').addEventListener('keydown', function (e) {
  if(e.key === 'Enter') {
    let frame_id = Number(document.getElementById('text_field_frame').value)
    set_frame(frame_id)
  }
})

document.getElementById('btn_play').addEventListener('click', (e) => {
  paused = !paused;

  if (btn_play.innerHTML == "Play") {
    btn_play.innerHTML = "Pause"
  } else {
    btn_play.innerHTML = "Play"
  }

  play_video();
})

document.getElementById('text_field_frame').addEventListener('input', function (e) {
  let frame_id = Number(document.getElementById('text_field_frame').value)
  if (frame_id >= annotator.num_frames || frame_id < 0) return
  set_frame(frame_id)
})

document.getElementById('range_scroll').addEventListener('input', function (e) {
  let frame_id = Number(document.getElementById('range_scroll').value)
  if (frame_id >= annotator.num_frames || frame_id < 0) return
  set_frame(frame_id)
})

document.getElementById('btn_fps_change').addEventListener('click', (e) => {
  let fps = Number(document.getElementById('field_fps').value)
  if (fps == annotator.framerate || fps == 0) {
    return
  } else {
    annotator.framerate = fps
    annotator.num_frames = Math.round(annotator.videoEl.duration * annotator.framerate)
    annotator.reinit();
    document.getElementById("range_scroll").max = annotator.num_frames - 1
    updateUI();
  }
})

/*
* Delete track options
*/

document.getElementById('btn_delete_tracks').addEventListener('click', (e) => {
  let frame_ids = utils.range(0, annotator.num_frames-1, 1);
  annotator.delete_objects_by(frame_ids, annotator.get_selected_track_ids());
  annotator.save_state();
  console.log("DELETE");
})

document.getElementById('btn_delete_boxes').addEventListener('click', (e) => {
  annotator.delete_objects_by(annotator.current_frame,
    annotator.get_selected_track_ids());
  annotator.save_state();
  console.log("DELETE");
})

document.getElementById('btn_delete_prev').addEventListener('click', (e) => {
  let frame_ids = utils.range(0, annotator.current_frame-1, 1)
  annotator.delete_objects_by(frame_ids, annotator.get_selected_track_ids());
  annotator.save_state();
  console.log("DELETE");
})

document.getElementById('btn_delete_next').addEventListener('click', (e) => {
  let frame_ids = utils.range(annotator.current_frame, annotator.num_frames-1, 1)
  annotator.delete_objects_by(frame_ids, annotator.get_selected_track_ids());
  annotator.save_state();
  console.log("DELETE");
})

/*
*  Merge track
*/

document.getElementById('btn_merge_tracks').addEventListener('click', (e) => {
  annotator.merge_selected();
})

/*
*  Box size options
*/

function update_size(width, height) {
  let selected = annotator.get_selected_track_ids();
  // Update default size
  if (selected.length > 0) {
    let frame_ids = annotator.current_frame;
    if (document.getElementById('chkbox_interpolate_size').checked) {
      frame_ids = utils.range(0, annotator.num_frames-1, 1);
    }

    // Update size of selected
    annotator.get_objects_by(frame_ids, selected).forEach((r) => {
      let dw = r.width - width;
      let dh = r.height - height;
      r.set({
        left: r.left + dw/2,
        top: r.top + dh/2,
        width: width,
        height: height,
        dirty: true,
      })
    });

    annotator.save_state();
    annotator.canvas.renderAll();
    console.log("MANUAL RESIZING");
  }
}

document.getElementById('btn_size_update').addEventListener('click', (e) => {
  // TODO error handling
  let width = Number(field_width.value);
  let height = Number(field_height.value);
  update_size(width, height);
})

field_width.addEventListener('input', (e) => {
  let width = Number(field_width.value);
  let height = Number(field_height.value);
  update_size(width, height);
})

field_height.addEventListener('input', (e) => {
  let width = Number(field_width.value);
  let height = Number(field_height.value);
  update_size(width, height);
})

document.getElementById('btn_copy_size').addEventListener('click', (e) => {
  let selected = annotator.get_selected_track_ids();

  if (selected.length > 0) {
    let width = annotator.tracks[selected[0]][annotator.current_frame]['width']
    let height = annotator.tracks[selected[0]][annotator.current_frame]['height']
    field_width.value = width
    field_height.value = height
  }
})

/*
*  Options for interpolation
*/
document.getElementById('chkbox_inter_mode').addEventListener('change', (e) => {
  annotator.toggle_interpolation()
})

document.getElementById('btn_interpolate').addEventListener('click', (e) => {
  let track_ids = annotator.get_selected_track_ids();
  track_ids.forEach((t) => { annotator.interpolate_track(t) });
  console.log("INTERPOLATE SELECTED");
})

document.getElementById('btn_interpolate_all').addEventListener('click', (e) => {
  let track_ids = annotator.get_track_ids();
  track_ids.forEach((t) => { annotator.interpolate_track(t) });
  annotator.save_state();
  console.log("INTERPOLATE ALL");
})

/*
*  Options for track properties
*/

document.getElementById('field_id').addEventListener('input', (e) => {
  let track_id = Number(document.getElementById('field_id').value);
  // We do not want this function to be alternative way to merge tracks
  if (track_id in annotator.tracks &&
      annotator.current_frame in annotator.tracks[track_id]) {
    return;
  }
  let selected = annotator.get_selected_track_ids();

  if (selected.length == 1) {
    let old_id = selected[0]
    annotator.tracks[old_id][annotator.current_frame]['track_id'] = track_id
    let range = utils.range(0, annotator.num_frames-1, 1);

    // Update track_ids of all boxes in track
    // TODO is it necessary for every box to have 'track_id' field?
    annotator.get_objects_by(range, selected[0]).forEach(r => {
      r.set({ track_id: track_id, dirty: true });
    });

    // Update keys in annotator.frames
    annotator.frames.forEach(frame => {
      frame[track_id] = frame[old_id];
      delete frame[old_id];
    });

    // Update key in annotator.tracks
    annotator.tracks[track_id] = annotator.tracks[old_id];
    delete annotator.tracks[old_id];
  }

  annotator.save_state();
  console.log("UPDATE ID");
  annotator.canvas.renderAll();
})

document.getElementById('field_color').addEventListener('input', (e) => {
  let value = String(field_color.value)
  let range = utils.range(0, annotator.num_frames-1, 1)
  let selected = annotator.get_selected_track_ids();

  selected.forEach(t => {
    annotator.tracks[t].stroke = value;
  });
  annotator.get_objects_by(range, selected).forEach(r => {
    r.set({stroke: value});
  });

  annotator.canvas.renderAll();
  annotator.save_state();
  console.log("UPDATE COLOR");
})

/*
* Options for plotting
*/

document.getElementById('btn_mark_tracks').addEventListener('click', (e) => {
  let frame_ids = utils.range(0, annotator.num_frames-1, 1);
  let track_ids = annotator.get_selected_track_ids();
  let boxes = annotator.get_objects_by(frame_ids, track_ids);
  boxes.forEach(b => {
    b.marked = !b.marked; // Works if undefined
  });
  track_ids.forEach(id => {
    annotator.tracks[id].marked = !annotator.tracks[id].marked;
  });

  annotator.set_dirty();
  annotator.canvas.renderAll();
  annotator.update_UI();
  // TODO update text
});

document.getElementById('btn_clear_marked').addEventListener('click', (e) => {
  let track_ids = annotator.get_track_ids();
  // TODO kind of ugly, but is much faster tha annotator.get_objects_by
  annotator.frames.forEach(f => {
    track_ids.forEach(id => {
      if (f[id]) f[id].marked = false;
    });
  });
  track_ids.forEach(id => {
    annotator.tracks[id].marked = false;
  });

  annotator.set_dirty();
  annotator.canvas.renderAll();
  annotator.update_UI();
});

document.getElementById('chkbox_dot_mode').addEventListener('change', (e) => {
  annotator.toggle_dot_mode()
})

document.getElementById('chkbox_show_mode').addEventListener('change', (e) => {
  annotator.toggle_nearby_mode()
})

document.getElementById('range_distance').addEventListener('input', (e) => {
  let dist = Number(document.getElementById('range_distance').value)
  document.getElementById('label_range_distance').innerHTML = `Distance (${dist}):`
  annotator.nearbyDistance = dist
})

document.getElementById('chkbox_mark_mode').addEventListener('change', (e) => {
  annotator.toggle_mark_mode()
})

/*
*  History functions
*/
document.getElementById('btn_undo').addEventListener('click', (e) => {
  annotator.undo();
  updateUI();
});

document.getElementById('btn_redo').addEventListener('click', (e) => {
  annotator.redo();
  updateUI();
});

/*
*  Upload annotations
*/

document.getElementById('annotationfile').addEventListener('change', (e) => {
  let file = event.target.files[0];
  let reader = new FileReader();
  reader.onload = function() {
    annotator.update_annotations(utils.parse_csv_data(reader.result));
  }
  reader.readAsText(file);
})

/*
*  Download annotations
*/

document.getElementById('btn_track_down').addEventListener('click', (e) => {
  let rotation = document.getElementById('chkbox_rotation').checked;
  utils.export_csv_data(annotator, false, rotation);
})

document.getElementById('btn_ant_track_down').addEventListener('click', (e) => {
  let rotation = document.getElementById('chkbox_rotation').checked;
  utils.export_csv_data(annotator, true, rotation);
})

/*
* Hotkeys
*/

document.addEventListener('keydown', async function (e) {
  let keyCode = event.keyCode
  switch (keyCode) {
    case 68: // d
      if (annotator.current_frame >= annotator.num_frames - 1) return;
      set_frame(annotator.current_frame + 1);
      break;
    case 65: // a
      if (annotator.current_frame <= 0) return;
      set_frame(annotator.current_frame - 1);
      break;
    case 77: // m
      ////annotator.markSelected()
      ////updateText()
      annotator.merge_selected()
      break;
    case 82: // r
      let frame_ids = utils.range(0, annotator.num_frames-1, 1)
      annotator.delete_objects_by(frame_ids, annotator.get_selected_track_ids());
      annotator.save_state();
      console.log("DELETE");
      break;
    case 87: // w
      set_frame(Math.min(annotator.num_frames-1, annotator.current_frame+increment));
      break;
    case 83: // s
      set_frame(Math.max(0, annotator.current_frame-increment));
      break;
    case 88: // x
      annotator.delete_objects_by(annotator.current_frame,
        annotator.get_selected_track_ids());
      annotator.save_state();
      console.log("DELETE");
      break;
    case 80: // p
      paused = !paused;
      if (btn_play.innerHTML == "Play") {
        btn_play.innerHTML = "Pause"
      } else {
        btn_play.innerHTML = "Play"
      }
      play_video();
      break;
    case 89: // y
      if (e.ctrlKey || e.altKey) {
        annotator.redo();
        updateUI();
      }
      break;
    case 90: // z
      if (e.ctrlKey || e.altKey) {
        annotator.undo();
        updateUI();
      }
      break;
    default:
      break;
  }
});

/*
* Upload Video
*/

document.getElementById('videofile').addEventListener('change', async function (e) {
  URL.revokeObjectURL(annotator.source.src)
  const file = event.target.files[0];

  annotator.source.src = URL.createObjectURL(file);

  annotator.videoEl.load();
  await new Promise((resolve) => {
    annotator.videoEl.onloadeddata = () => {
      resolve(video);
    };
  });

  const videoWidth = annotator.videoEl.videoWidth;
  const videoHeight = annotator.videoEl.videoHeight;
  // Must set below two lines, otherwise video element doesn't show.
  annotator.videoEl.width = videoWidth;
  annotator.videoEl.height = videoHeight;
  annotator.video.set({width: videoWidth, height: videoHeight});

  //timerCallback();
  annotator.canvas.setZoom(annotator.canvas.width / annotator.video.width);
  updateUI();

  console.log('Video is loaded.')
})

function timerCallback() {
  requestAnimationFrame(timerCallback);
}

const onChangeFile = (mediainfo) => {
  const file = document.getElementById("videofile").files[0]
  if (file) {
    //pText.value = 'Working…'

    const getSize = () => file.size

    const readChunk = (chunkSize, offset) =>
      new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (event) => {
          if (event.target.error) {
            reject(event.target.error)
          }
          resolve(new Uint8Array(event.target.result))
        }
        reader.readAsArrayBuffer(file.slice(offset, offset + chunkSize))
      })

    mediainfo
      .analyzeData(getSize, readChunk)
      .then((result) => {
        console.log(result.media.track[1].FrameRate)
        console.log(result.media.track[1].FrameCount)

        // TODO Make sure track[1] is always correct
        annotator.framerate = result.media.track[1].FrameRate
        annotator.num_frames = result.media.track[1].FrameCount;
        annotator.reinit();
        document.getElementById("range_scroll").max = annotator.num_frames - 1
        updateUI();
        // Not rounding, in case framerate is non integer
        //field_fps.value = annotator.FRAMERATE
      })
      .catch((error) => {
        // TODO
      })
  }
}

MediaInfo(
  {
    format: 'object',
    locateFile: (path, prefix) => prefix + path, // Make sure WASM file is loaded from CDN location
  }, 
  (mediainfo) => {
    document.getElementById("videofile").addEventListener('change', () => onChangeFile(mediainfo))
})
