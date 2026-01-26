import * as FileSystem from 'expo-file-system';
import { api } from './http';

export async function uploadImageFromUri(uri: string, folder = 'app/messages') {
  if (!uri) throw new Error('missing_uri');

  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  if (!base64) throw new Error('file_read_failed');

  const extension = uri.split('.').pop()?.toLowerCase();
  const mime = extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : 'image/jpeg';
  const dataUri = `data:${mime};base64,${base64}`;

  const res = await api('/api/uploads/image', {
    method: 'POST',
    auth: true,
    body: { dataUri, folder },
  });

  const url = res?.url;
  if (!url) throw new Error('cloudinary_upload_failed');
  return url as string;
}

