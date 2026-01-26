import { v2 as cloudinary } from 'cloudinary';

const cloudinaryUrl = process.env.CLOUDINARY_URL;

if (cloudinaryUrl) {
  cloudinary.config({ url: cloudinaryUrl, secure: true });
} else {
  console.warn('[cloudinary] CLOUDINARY_URL is not defined; uploads will fail.');
}

export async function uploadBase64Image(dataUri: string, folder = 'uploads') {
  if (!cloudinaryUrl) {
    throw new Error('cloudinary_not_configured');
  }

  if (typeof dataUri !== 'string' || !dataUri.startsWith('data:')) {
    throw new Error('invalid_data_uri');
  }

  const result = await cloudinary.uploader.upload(dataUri, {
    folder,
    resource_type: 'image',
    invalidate: false,
  });

  return {
    url: result.secure_url || result.url,
    publicId: result.public_id,
    width: result.width,
    height: result.height,
    bytes: result.bytes,
  };
}

