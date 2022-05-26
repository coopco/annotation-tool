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
