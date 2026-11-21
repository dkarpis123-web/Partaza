import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/** Where a label is on a photo (fractions of its width and height) and how far it must be turned to read upright. */
export interface LabelArea {
  photo: number;
  x: number;
  y: number;
  w: number;
  h: number;
  turn: number;
}

/**
 * Cuts a label out of the original, full-size photo, turns it upright and enlarges it.
 * Small or upside-down print is misread from the whole photo; from a close-up it is not.
 * Returns null when the photo cannot be cut (then the whole photo is used as before).
 */
export async function cutLabel(uri: string, area: LabelArea): Promise<string | null> {
  try {
    const image = await ImageManipulator.manipulate(uri).renderAsync();
    // A wide margin: the position is only roughly known.
    const padX = Math.max(area.w * 0.35, 0.04);
    const padY = Math.max(area.h * 0.35, 0.04);
    const left = Math.max(0, area.x - padX);
    const top = Math.max(0, area.y - padY);
    const right = Math.min(1, area.x + area.w + padX);
    const bottom = Math.min(1, area.y + area.h + padY);
    const width = Math.round((right - left) * image.width);
    const height = Math.round((bottom - top) * image.height);
    if (width < 40 || height < 40) return null;
    let work = ImageManipulator.manipulate(image).crop({ originX: Math.round(left * image.width), originY: Math.round(top * image.height), width, height });
    if (area.turn) work = work.rotate(area.turn);
    const cut = await work.renderAsync();
    const longest = Math.max(cut.width, cut.height);
    const sized = longest < 1500
      ? await ImageManipulator.manipulate(cut).resize(cut.width >= cut.height ? { width: 1500 } : { height: 1500 }).renderAsync()
      : cut;
    return (await sized.saveAsync({ compress: 0.9, format: SaveFormat.JPEG })).uri;
  } catch {
    return null;
  }
}
