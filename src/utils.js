export const zeroPad = (num, places) => String(num).padStart(places, '0')

export function getRandomColor() {
  var letters = '0123456789ABCDEF';
  var color = '#';
  for (var i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

// https://www.30secondsofcode.org/js/s/cartesian-product
export const cartesian_product = (a, b) => {
  a = typeof(a) == 'object' ? a : [a];
  b = typeof(b) == 'object' ? b : [b];
  return a.reduce((p, x) => [...p, ...b.map(y => [x, y])], []);
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/from#sequence_generator_range
export const range = (start, stop, step) => 
  Array.from({ length: (stop - start) / step + 1}, (_, i) => start + (i * step))

export function parse_csv_data(raw_data) {
  let lines = raw_data.split('\n')
  let csv = lines.filter(line => line.length > 0 && !line.includes('image_id')).map(line => {
    let e = line.split(',');
    // image_id, track_id, x, y, w, h, angle?
    return [Number(e[0]), Number(e[1]), Number(e[2]), Number(e[3]), Number(e[4]), Number(e[5]), Number(e[6]) || 0];
  })

  return csv
}

function csv_record(box, rotation) {
  if (rotation) {
    return [box.frame_id, box.track_id, box.left, box.top,
      box.width, box.height, box.angle]
  } else {
    if (box.angle == 0) {
      return [box.frame_id, box.track_id, box.left,
        box.top, box.width, box.height];
    } else {
      let bbox = box.getBoundingRect();
      return [box.frame_id, box.track_id, bbox.left,
        bbox.top, bbox.width-box.strokeWidth, bbox.height-box.strokeWidth];
    }
  }
}

export function export_csv_data(annotator, only_marked = false, rotation = false) {
  let csv_records = []
  if (rotation) {
    csv_records = [["image_id", "track_id", "x", "y", "w", "h", "angle"]]
  } else {
    csv_records = [["image_id", "track_id", "x", "y", "w", "h"]]
  }
  let track_ids = annotator.get_track_ids();

  for (let frame of annotator.frames) {
    for (let track_id of track_ids) {
      let box = frame[track_id];
      if (box && (!only_marked || box.marked)) {
        csv_records.push(csv_record(box, rotation));
      }
    }
  }

  let csv_data = csv_records.map(e => e.join(',')).join('\n');
  saveFile("export.csv", "data:text/csv", new Blob([csv_data],{type:""}));

  function saveFile (name, type, data) {
    if (data != null && navigator.msSaveBlob)
      return navigator.msSaveBlob(new Blob([data], { type: type }), name);

    var a = $("<a style='display: none;'/>");
    var url = window.URL.createObjectURL(new Blob([data], {type: type}));
    a.attr("href", url);
    a.attr("download", name);
    $("body").append(a);
    a[0].click();
    setTimeout(function(){  // fixes firefox html removal bug
      window.URL.revokeObjectURL(url);
      a.remove();
    }, 500);
  }
}

