/** Convert an authored focal point to CSS cover-image positioning percentages. */
export function focalPosition(imageWidth, imageHeight, boxWidth, boxHeight, focalX, focalY) {
  if (![imageWidth, imageHeight, boxWidth, boxHeight].every(value => Number.isFinite(value) && value > 0)) return null;
  const scale = Math.max(boxWidth / imageWidth, boxHeight / imageHeight);
  return [[imageWidth, boxWidth, focalX], [imageHeight, boxHeight, focalY]].map(([image, box, focal]) => {
    const scaled = image * scale;
    const excess = scaled - box;
    if (excess < 0.001) return 0;
    return Math.min(excess, Math.max(0, scaled * focal / 100 - box / 2)) / excess * 100;
  });
}

/** Recompute known background crops whenever a responsive container changes size. */
export function observeBackgrounds(root, Observer) {
  const images = [...root.querySelectorAll('img[data-deedee-background]')];
  const update = image => {
    const { width, height, x, y } = JSON.parse(image.dataset.deedeeBackground);
    const rect = image.parentElement.getBoundingClientRect();
    const position = focalPosition(width, height, rect.width, rect.height, x, y);
    if (position) image.style.objectPosition = `${position[0]}% ${position[1]}%`;
  };
  const observer = new Observer(entries => {
    for (const entry of entries) {
      for (const image of images.filter(item => item.parentElement === entry.target)) update(image);
    }
  });
  for (const image of images) {
    observer.observe(image.parentElement);
    update(image);
  }
  return observer;
}

if (typeof document !== 'undefined') observeBackgrounds(document, ResizeObserver);
