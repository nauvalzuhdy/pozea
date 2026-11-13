import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Asset, requestPermissionsAsync } from 'expo-media-library';

import type { CropRect } from './layout';

export interface ViewGeometry {
  width: number;
  height: number;
  crop: CropRect;
}

/**
 * Crops the photo to what the corner brackets showed and saves it to the gallery. The preview
 * fills the view with a center crop ("cover"), so a view point maps to the photo by undoing that
 * scale around the centers. Returns the saved file's URI for the gallery thumbnail.
 */
export async function cropAndSave(filePath: string, view: ViewGeometry): Promise<string> {
  const uri = filePath.startsWith('file://') ? filePath : `file://${filePath}`;
  // Loading applies the EXIF rotation, so width and height are those of the upright photo.
  const loaded = await ImageManipulator.manipulate(uri).renderAsync();
  const W = loaded.width;
  const H = loaded.height;
  const scale = Math.max(view.width / W, view.height / H);
  const toPhotoX = (x: number) => W / 2 + (x - view.width / 2) / scale;
  const toPhotoY = (y: number) => H / 2 + (y - view.height / 2) / scale;
  const originX = Math.max(0, Math.round(toPhotoX(view.crop.x)));
  const originY = Math.max(0, Math.round(toPhotoY(view.crop.y)));
  const width = Math.min(W - originX, Math.round(view.crop.width / scale));
  const height = Math.min(H - originY, Math.round(view.crop.height / scale));

  const cropped = await ImageManipulator.manipulate(loaded)
    .crop({ originX, originY, width, height })
    .renderAsync();
  const saved = await cropped.saveAsync({ format: SaveFormat.JPEG, compress: 0.92 });
  loaded.release();
  cropped.release();

  // Write-only access: saving needs no permission to read the user's photos.
  const permission = await requestPermissionsAsync(true, ['photo']);
  if (permission.status !== 'granted') throw new Error('Izin menyimpan foto ditolak');
  await Asset.create(saved.uri);
  return saved.uri;
}
