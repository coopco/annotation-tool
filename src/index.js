// TODO disable selection box while drag-adding a box
// http://jsfiddle.net/a7mad24/aPLq5/
import {Annotator, defaults} from "./annotator.js"
import * as utils from "./utils.js"

let annotator = new Annotator('canvas');

let range = document.getElementById('range_scroll');
let field_fps = document.getElementById('field_fps');
field_fps.value = annotator.FRAMERATE;
let btn_play = document.getElementById('btn_play');
let paused = true;
let field_id = document.getElementById('field_id');
let field_color = document.getElementById('field_color');

updateUI();

function updateUI() {
  document.getElementById('current_frame').textContent = `Frame index: ${annotator.current_frame}/${annotator.num_frames-1}`
  range.value = annotator.current_frame;
  annotator.canvas.renderAll();
}

async function set_frame(frame_id) {
  await annotator.set_frame(frame_id);
  // Seek ahead in video
  // Load current frame data
  updateUI();
}

async function play_video() {
  // get time
  let start_time = performance.now();

  if (annotator.current_frame >= annotator.num_frames - 1) return;
  set_frame(annotator.current_frame + 1);

  let end_time = performance.now();

  //minus get time
  let diff = end_time - start_time
  await new Promise(r => setTimeout(r, 2000/annotator.framerate - diff));

  if (paused) {
    return;
  } else {
    await play_video();
  }
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

document.getElementById('btn_first_frame').addEventListener('click', (e) => {
  set_frame(0);
})

document.getElementById('btn_last_frame').addEventListener('click', (e) => {
  set_frame(annotator.num_frames - 1);
})

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
  let frame_ids = utils.range(0, annotator.num_frames-1, 1)
  annotator.delete_objects_by(frame_ids, annotator.get_selected_track_ids());
})

document.getElementById('btn_delete_boxes').addEventListener('click', (e) => {
  annotator.delete_objects_by(annotator.current_frame,
    annotator.get_selected_track_ids());
})

document.getElementById('btn_delete_prev').addEventListener('click', (e) => {
  let frame_ids = utils.range(0, annotator.current_frame-1, 1)
  annotator.delete_objects_by(frame_ids, annotator.get_selected_track_ids());
})

document.getElementById('btn_delete_next').addEventListener('click', (e) => {
  let frame_ids = utils.range(annotator.current_frame, annotator.num_frames-1, 1)
  annotator.delete_objects_by(frame_ids, annotator.get_selected_track_ids());
})

/*
* Options for track properties
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
      r.set({track_id: track_id});
      r.dirty = true; // To update box label
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
})

/*
* Upload annotations
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
* Download annotations
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
      //annotator.mergeSelected()
      break;
    case 82: // r
      let frame_ids = utils.range(0, annotator.num_frames-1, 1)
      annotator.delete_objects_by(frame_ids, annotator.get_selected_track_ids());
      break;
    case 87: // w
      set_frame(annotator.num_frames - 1);
      break;
    case 83: // s
      set_frame(0);
      break;
    case 88: // x
      annotator.delete_objects_by(annotator.current_frame,
        annotator.get_selected_track_ids());
      break;
    case 80: // p
      paused = !paused;
      await play_video();
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

MediaInfo({ format: 'object' }, (mediainfo) => {
  document.getElementById("videofile").addEventListener('change', () => onChangeFile(mediainfo))
})
