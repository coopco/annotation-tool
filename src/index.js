// TODO disable selection box while drag-adding a box
// http://jsfiddle.net/a7mad24/aPLq5/
import {Annotator, defaults} from "./annotator.js"

let num_frames = 50;

let is_down, mouse_x, mouse_y;
let drag_rect, orig_x, orig_y, default_dim; // For when drag-creating new boxes

let new_track_id = 0;

let annotator = new Annotator('canvas', num_frames);
let current_tool = "pan"

updateUI();

annotator.canvas.on('mouse:down', (o) => {
  if (o.target) {
    return;
  }

  is_down = true;
  let current_tool = document.querySelector('input[name="tool"]:checked')?.value;

  if (current_tool == "add") {
    default_dim = true
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
    console.log(pointer.x-orig_x);
  }
})

annotator.canvas.on('mouse:move', (o) => {
  let pointer = annotator.canvas.getPointer(o.e);
  mouse_x = pointer.x
  mouse_y = pointer.y

  if (!is_down) return;

  let current_tool = document.querySelector('input[name="tool"]:checked')?.value;

  if (current_tool == "add") {
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

    annotator.canvas.renderAll();
  }
})

annotator.canvas.on('mouse:up', (o) => {
  is_down = false;

  let current_tool = document.querySelector('input[name="tool"]:checked')?.value;
  if (current_tool == "add" && default_dim) {
    let w = defaults['width']
    let h = defaults['height']
    drag_rect.set({left: orig_x - w/2,
                   top: orig_y - h/2,
                   width: w,
                   height: h,
    });

    annotator.canvas.renderAll();
  }
})

function updateUI() {
  document.getElementById('current_frame').textContent = `Frame index: ${annotator.current_frame}/${annotator.num_frames-1}`
}

async function nextFrame() {
  if (annotator.current_frame >= annotator.num_frames) return;
  await annotator.set_frame(annotator.current_frame + 1);
  // Seek ahead in video
  // Load current frame data
  annotator.canvas.renderAll();
  updateUI();
}

async function prevFrame() {
  if (annotator.current_frame <= 0) return;
  await annotator.set_frame(annotator.current_frame - 1);
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
  annotator.canvas.setWidth(videoWidth);
  annotator.canvas.setHeight(videoHeight);
  annotator.video.set({width: videoWidth, height: videoHeight});

  //timerCallback();
  updateUI();

  //annotator.frameCount = Math.round(annotator.videoEl.duration * annotator.FRAMERATE)
  //document.getElementById("range_scroll").max = annotator.frameCount - 1
  //document.getElementById("range_scroll").style.width = `${videoWidth}px`

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
        annotator.num_frames = result.media.track[1].FrameCount
        //document.getElementById("range_scroll").max = annotator.frameCount - 1
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
