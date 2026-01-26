import { Router } from 'express';
import { uploadBase64Image } from '../lib/cloudinary';
import { requireAuth } from '../middleware/jwt';

const r = Router();

r.post('/image', requireAuth as any, async (req, res) => {
  try {
    const dataUri = String((req.body as any)?.dataUri || '').trim();
    const folder = String((req.body as any)?.folder || 'app/uploads/messages').trim();

    if (!dataUri || !dataUri.startsWith('data:')) {
      return res.status(400).json({ message: 'Invalid dataUri' });
    }

    const result = await uploadBase64Image(dataUri, folder || undefined);
    res.json({ url: result.url, publicId: result.publicId });
  } catch (err: any) {
    console.error('[uploads:image] failed:', err?.message || err);
    const status = err?.message === 'cloudinary_not_configured' ? 500 : 400;
    res.status(status).json({ message: err?.message || 'upload_failed' });
  }
});

export default r;

