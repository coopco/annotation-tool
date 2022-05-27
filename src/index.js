// TODO disable selection box while drag-adding a box
// http://jsfiddle.net/a7mad24/aPLq5/
import {Annotator, defaults} from "./annotator.js"
import * as utils from "./utils.js"

let num_frames = 50;

let annotator = new Annotator('canvas', num_frames);

updateUI();

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

Array.from(document.getElementsByClassName("tool")).forEach((el) => {
  el.addEventListener('click', () => {
    annotator.current_tool = el.value;

    let selection = annotator.current_tool == "add" ? false : true;
    annotator.canvas.set({ selection: selection });

    annotator.canvas.discardActiveObject();
    annotator.canvas.renderAll();
  });
});

document.getElementById('btn_next_frame').addEventListener('click', (e) => {
  nextFrame()
})

document.getElementById('btn_prev_frame').addEventListener('click', (e) => {
  prevFrame()
})

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
