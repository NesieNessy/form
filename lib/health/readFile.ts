import type { DocumentPickerAsset } from 'expo-document-picker';
import { File } from 'expo-file-system';

/** The bytes of a file the athlete picked. On the web the picker hands over a browser File. */
export async function readPickedFile(asset: DocumentPickerAsset): Promise<Uint8Array> {
  if (asset.file) return new Uint8Array(await asset.file.arrayBuffer());
  return new File(asset.uri).bytes();
}
