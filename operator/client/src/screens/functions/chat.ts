import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { ActionSheetIOS, Alert, Platform } from 'react-native';
import { tokens } from '../../auth/tokenStore';
import { sendMessage } from '../../features/messages/api';
import { ensureConversationId } from '../../features/messages/ensureConvId';
import { uploadImageFromUri } from '../../lib/uploads';

// Types
export type LocalMessage = {
  id: string;
  conversationId: string;
  from: string;
  text: string;
  createdAt: string;
  pending?: boolean;
  failed?: boolean;
  imageUri?: string | null;
};

// JWT utilities
export function decodeJwtSubFromAccess(): string | null {
  try {
    const t = tokens.getAccess();
    if (!t) return null;
    const part = t.split('.')[1];
    if (!part) return null;
    const padded = (part + '===').slice(0, Math.ceil((part.length + 3) / 4) * 4)
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    let json = '';
    try {
      // @ts-ignore atob may exist in RN/Expo
      if (typeof atob === 'function') {
        // @ts-ignore atob global
        const bin = atob(padded);
        try { json = decodeURIComponent(escape(bin)); } catch { json = bin; }
      } else if (typeof (globalThis as any).Buffer !== 'undefined') {
        json = (globalThis as any).Buffer.from(padded, 'base64').toString('utf8');
      }
    } catch { /* ignore */ }
    if (!json) return null;
    const payload = JSON.parse(json);
    const id = payload?.sub ?? payload?.id ?? payload?.userId ?? null;
    return id ? String(id) : null;
  } catch { return null; }
}

export function getMyIdSync(): string {
  const decoded = decodeJwtSubFromAccess();
  return decoded || 'me';
}

export function isMyMessage(from: string, myId: string): boolean {
  const decoded = decodeJwtSubFromAccess();
  return from === myId || (!!decoded && from === decoded);
}

export function useResolvedConversationId(
  idParam?: string,
  requestId?: string,
  peer?: string
): string | undefined {
  const [convId, setConvId] = useState<string | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    (async () => {
      const resolved = await ensureConversationId(
        typeof idParam === 'string' ? idParam : undefined,
        { requestId: typeof requestId === 'string' ? requestId : undefined, peerUserId: typeof peer === 'string' ? peer : undefined }
      );
      if (!alive) return;
      setConvId(resolved);
    })();
    return () => { alive = false; };
  }, [idParam, requestId, peer]);

  return convId;
}

// Attachment utilities
export function attachmentsKey(conversationId: string): string {
  return `attachments:${conversationId}`;
}

export async function loadAttachmentsMap(conversationId: string): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(attachmentsKey(conversationId));
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch { return {}; }
}

export async function saveAttachment(conversationId: string, messageId: string, uri: string): Promise<void> {
  const key = attachmentsKey(conversationId);
  const current = await loadAttachmentsMap(conversationId);
  current[messageId] = uri;
  await AsyncStorage.setItem(key, JSON.stringify(current));
}

// Permission functions
export async function ensureCameraPermission(): Promise<boolean> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permission needed', 'Camera access is required to take a photo.');
    return false;
  }
  return true;
}

export async function ensureLibraryPermission(): Promise<boolean> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permission needed', 'Photo library access is required to choose a picture.');
    return false;
  }
  return true;
}

// Image picker functions
export async function pickFromCamera(): Promise<string | null> {
  if (!(await ensureCameraPermission())) return null;
  const res = await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 0.8 });
  return res.canceled ? null : (res.assets?.[0]?.uri || null);
}

export async function pickFromLibrary(): Promise<string | null> {
  if (!(await ensureLibraryPermission())) return null;
  const res = await ImagePicker.launchImageLibraryAsync({
    allowsEditing: false,
    quality: 0.8,
    selectionLimit: 1,
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
  });
  return res.canceled ? null : (res.assets?.[0]?.uri || null);
}

// Attachment picker
export function openAttachmentPicker(
  onCamera: () => void,
  onLibrary: () => void
): void {
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      { options: ['Cancel', 'Gallery', 'Camera'], cancelButtonIndex: 0 },
      async (idx) => { 
        if (idx === 1) onLibrary(); 
        if (idx === 2) onCamera(); 
      }
    );
  } else {
    Alert.alert('Add attachment', 'Choose a source', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Gallery', onPress: onLibrary },
      { text: 'Camera', onPress: onCamera },
    ]);
  }
}

// Send image function
export async function sendImageMessage(
  conversationId: string,
  meId: string,
  uri: string,
  onTempMessage: (msg: LocalMessage) => void,
  onUpdateMessage: (tmpId: string, saved: any, uri: string) => void,
  onError: (tmpId: string) => void
): Promise<void> {
  const tmpId = `img-${Date.now()}`;
  const tmp: LocalMessage = {
    id: tmpId,
    conversationId,
    from: meId,
    text: '',
    imageUri: uri,
    createdAt: new Date().toISOString(),
    pending: true,
  };
  onTempMessage(tmp);

  try {
    const remoteUrl = await uploadImageFromUri(uri, 'app/messages');
    const saved = await sendMessage(conversationId, '', meId, remoteUrl);
    const realId = (saved?.id ?? '').toString();

    if (realId) {
      await saveAttachment(conversationId, realId, remoteUrl);
    }

    onUpdateMessage(tmpId, saved, remoteUrl);
  } catch (error) {
    console.error('Failed to send image message:', error);
    onError(tmpId);
  }
}

// Send text message function
export async function sendTextMessage(
  conversationId: string,
  meId: string,
  text: string,
  onTempMessage: (msg: LocalMessage) => void,
  onUpdateMessage: (tmpId: string, saved: any) => void,
  onError: (tmpId: string) => void
): Promise<void> {
  const tmpId = `tmp-${Date.now()}`;
  const tmp: LocalMessage = {
    id: tmpId,
    conversationId,
    from: meId,
    text,
    createdAt: new Date().toISOString(),
    pending: true,
  };
  onTempMessage(tmp);

  try {
    console.log('Sending message to conversation:', conversationId, 'text:', text);
    
    // Test API connectivity first
    try {
      const baseUrl = await import('../../lib/serverDiscovery').then(m => m.resolveApiBaseUrl());
      console.log('API base URL resolved:', baseUrl);
    } catch (urlError) {
      console.error('Failed to resolve API base URL:', urlError);
      throw new Error('Cannot connect to server. Please check your network connection.');
    }
    
    const saved = await sendMessage(conversationId, text, meId);
    console.log('Message sent successfully:', saved);
    onUpdateMessage(tmpId, saved);
  } catch (error) {
    console.error('Failed to send message:', error);
    console.error('Error details:', {
      message: error.message,
      status: error.status,
      data: error.data,
      conversationId,
      text
    });
    onError(tmpId);
  }
}


