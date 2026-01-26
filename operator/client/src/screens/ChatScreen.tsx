import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Icons from 'phosphor-react-native';
import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Text as RNText,
  TextInput as RNTextInput,
  StyleSheet,
  TouchableOpacity,
  View,
  type TextInputProps,
  type TextProps,
} from 'react-native';
import ImageViewing from 'react-native-image-viewing';

import { tokens } from '../auth/tokenStore';
import { SocketContext } from '../contexts/SocketProvider';
import { deleteMessage, fetchMessages, getConversation } from '../features/messages/api';
import { ensureConversationId } from '../features/messages/ensureConvId';
import { fetchMe } from '../lib/api';
import {
  LocalMessage,
  getMyIdSync,
  isMyMessage,
  loadAttachmentsMap,
  openAttachmentPicker,
  pickFromCamera,
  pickFromLibrary,
  sendImageMessage,
  sendTextMessage,
} from './functions/chat';

const BG = '#E7FFE9';
const CONTROL_BG = '#DAFFD1';
const MINE_BG = '#6EFF87';
const HEADER_BG = '#0C0C0C';
const TEXT_DARK = '#0C0C0C';
const TEXT_LIGHT = '#EDEDED';
const BORDER = '#262626';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BUBBLE_MAX_WIDTH = SCREEN_WIDTH * 0.9;
const BUBBLE_MIN_WIDTH_BASE = 36;
const BUBBLE_MIN_WIDTH_PER_CHAR = 6;

// Local wrappers to default all text on this screen to Inter (boldy)
function Text(props: TextProps) {
  return <RNText {...props} style={[{ fontFamily: 'Inter-Bold' }, props.style]} />;
}
function TextInput(props: TextInputProps) {
  return <RNTextInput {...props} style={[{ fontFamily: 'Inter-Bold' }, props.style]} />;
}

function normalizeMessageText(val: string): string {
  const collapsed = String(val ?? '').replace(/[\s\u00A0]+/g, ' ').trim();
  if (!collapsed) return '';
  const lower = collapsed.toLowerCase();
  if (lower === '[photo]' || lower === '[attachment]') {
    return '';
  }
  const tokens = collapsed.split(' ');
  if (tokens.length > 1 && tokens.every((tok) => tok.length === 1)) {
    return tokens.join('');
  }
  return collapsed;
}

function computeBubbleMinWidth(text?: string | null, hasImage?: boolean): number {
  if (hasImage) return BUBBLE_MIN_WIDTH_BASE;
  const trimmed = String(text ?? '').trim();
  const len = trimmed.length;
  if (!len) return BUBBLE_MIN_WIDTH_BASE;
  const estimate = BUBBLE_MIN_WIDTH_BASE + len * BUBBLE_MIN_WIDTH_PER_CHAR;
  const clamped = Math.min(BUBBLE_MAX_WIDTH, Math.max(BUBBLE_MIN_WIDTH_BASE, estimate));
  return clamped;
}

export default function ChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; peerUserId?: string; requestId?: string; name?: string }>();
  const initialId = String(params?.id ?? '');
  const initialTitle = typeof params?.name === 'string' && params.name.trim() ? params.name.trim() : 'Chat';
  const insets = useSafeAreaInsets();
  const { socket } = React.useContext(SocketContext);

  const [conversationId, setConversationId] = React.useState<string>(initialId);
  const [title, setTitle] = React.useState<string>(initialTitle);
  const [myId, setMyId] = React.useState<string>(getMyIdSync() || 'me');
  const [loading, setLoading] = React.useState(true);

  // NEWEST first (DESC) for inverted FlatList
  const [messages, setMessages] = React.useState<LocalMessage[]>([]);
  const [input, setInput] = React.useState('');

  // Persisted local attachments (messageId -> uri)
  const [attachMap, setAttachMap] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (typeof params?.name === 'string' && params.name.trim()) {
      setTitle(params.name.trim());
    }
  }, [params?.name]);

  React.useEffect(() => {
    if (!conversationId || conversationId === 'new') return;
    let cancelled = false;
    (async () => {
      try {
        const info = await getConversation(conversationId);
        const resolvedTitle = info?.title?.trim?.();
        if (
          !cancelled &&
          resolvedTitle &&
          resolvedTitle.toLowerCase() !== 'conversation' &&
          resolvedTitle.toLowerCase() !== 'chat'
        ) {
          setTitle(resolvedTitle);
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  // Lightbox (zoomable) state
  const [viewerUri, setViewerUri] = React.useState<string | null>(null);

  const messagesRef = React.useRef<LocalMessage[]>([]);
  const attachRef = React.useRef<Record<string, string>>({});

  React.useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  React.useEffect(() => {
    attachRef.current = attachMap;
  }, [attachMap]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const meInfo = await fetchMe();
        if (!cancelled && meInfo?.id) {
          setMyId(String(meInfo.id));
        }
      } catch {}
      try {
        if ((tokens as any)?.waitUntilReady) {
          await (tokens as any).waitUntilReady();
        }
        const asyncId = await tokens.getUserIdAsync?.();
        if (!cancelled && asyncId) {
          setMyId(String(asyncId));
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 0) Resolve/ensure a real conversation id if we arrived as "new"
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const rawId = initialId?.trim();
      if (!rawId || rawId === 'new') {
        const resolved = await ensureConversationId(undefined, {
          peerUserId: typeof params?.peerUserId === 'string' ? params.peerUserId : undefined,
          requestId: typeof params?.requestId === 'string' ? params.requestId : undefined,
        });
        if (!cancelled && resolved) {
          setConversationId(resolved);
          try {
            const nameParam = typeof params?.name === 'string' && params.name.trim() ? params.name.trim() : undefined;
            const nextParams: Record<string, string> = { id: resolved };
            if (nameParam) nextParams.name = nameParam;
            router.replace({ pathname: '/(tabs)/chat/[id]', params: nextParams });
          } catch {}
        }
      } else {
        setConversationId(rawId);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialId, params?.peerUserId, params?.requestId]);

  // 1) Derive title via socket: verifyConversationParticipants → pick the "other" name
  React.useEffect(() => {
    if (!socket || !conversationId || conversationId === 'new') return;
    const onReply = (res: any) => {
      if (!res?.success) return;
      try {
        const myCandidate = myId && myId !== 'me' ? String(myId) : String((socket as any).user?.id ?? '');
        const me = myCandidate || '';
        const others = (res.data?.participants || []).filter((p: any) => String(p._id) !== me);
        const peer = others[0];
        const t = peer?.name || peer?.username || peer?.email || 'Conversation';
        if (t && t.toLowerCase() !== 'conversation' && t.toLowerCase() !== 'chat') {
          setTitle(String(t));
        }
      } catch {}
    };
    socket.once('verifyConversationParticipants', onReply);
    socket.emit('verifyConversationParticipants', conversationId);
    return () => {
      socket.off('verifyConversationParticipants', onReply);
    };
  }, [socket, conversationId, myId]);

  // Android hardware back: go to Messages tab
  React.useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      router.replace('/(tabs)/messages');
      return true;
    });
    return () => sub.remove();
  }, [router]);

  // 2) Real-time: listen for newMessage broadcasts (server sends newest first)
  React.useEffect(() => {
    if (!socket || !conversationId || conversationId === 'new') return;

    const handleNewMessage = (evt: any) => {
      if (!evt?.success || !evt?.data) return;
      const m = evt.data;
      if (String(m?.conversationId) !== String(conversationId)) return;

      const fromMe = isMyMessage(String(m?.senderId?._id || m?.senderId), myId || 'me');
      if (fromMe) {
        return;
      }

      const createdAt = new Date(m.createdAt ?? Date.now()).toISOString();
      const local: LocalMessage = {
        id: String(m._id),
        conversationId: String(m.conversationId),
        from: String(m.senderId?._id || m.senderId),
        text: normalizeMessageText(String(m.content ?? '')),
        imageUri: attachMap[String(m._id)] || (m.attachment ? String(m.attachment) : null),
        createdAt,
      };

      setMessages((prev) => {
        const exists = prev.some((x) => x.id === local.id);
        if (exists) {
          return prev.map((x) => (x.id === local.id ? { ...local, pending: false, failed: false } : x));
        }

        return [local, ...prev].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
      });
    };

    const handleDeletedMessage = (evt: any) => {
      if (!evt?.success) return;
      const msgId = String(evt?.messageId || evt?.id || '');
      const convId = String(evt?.conversationId || evt?.conversation_id || '');
      if (!msgId || convId !== String(conversationId)) return;
      setMessages((prev) => prev.filter((m) => m.id !== msgId));
      setAttachMap((prev) => {
        if (!prev[msgId]) return prev;
        const next = { ...prev };
        delete next[msgId];
        return next;
      });
    };

    socket.on('newMessage', handleNewMessage);
    socket.on('message:deleted', handleDeletedMessage);
    return () => {
      socket.off('newMessage', handleNewMessage);
      socket.off('message:deleted', handleDeletedMessage);
    };
  }, [socket, conversationId, attachMap, myId]);

  // 3) Load attachments first, then messages
  React.useEffect(() => {
    if (!conversationId || conversationId === 'new') return;
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const map = await loadAttachmentsMap(conversationId);
        if (!mounted) return;
        setAttachMap(map);

        const items = await fetchMessages(conversationId);
        if (!mounted) return;

        const sortedDesc = [...items].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
        const enriched: LocalMessage[] = sortedDesc.map((m) => ({
          id: m.id,
          conversationId: m.conversationId,
          from: String(m.from),
          text: m.text,
          createdAt: m.createdAt,
          imageUri: map[m.id] ?? m.attachment ?? null,
        }));
        setMessages(enriched);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [conversationId]);

  React.useEffect(() => {
    if (!conversationId || conversationId === 'new') return;
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout>;

    const poll = async () => {
      try {
        const items = await fetchMessages(conversationId);
        if (cancelled) return;
        const normalized = items.map((m) => {
          const mine = isMyMessage(String(m.from), myId || 'me');
          return {
            id: m.id,
            conversationId: m.conversationId,
            from: mine ? myId || 'me' : String(m.from),
            text: normalizeMessageText(m.text ?? ''),
            createdAt: m.createdAt,
            imageUri: attachMap[m.id] ?? m.attachment ?? null,
            pending: false,
            failed: false,
          } as LocalMessage;
        });

        normalized.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
        setMessages((prev) => {
          const fetchedIds = new Set(normalized.map((m) => m.id));
          const pending = prev.filter((m) => m.pending || m.failed);
          const combined = [...normalized];
          pending.forEach((msg) => {
            if (!fetchedIds.has(msg.id)) combined.push(msg);
          });
          return combined.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
        });
      } catch {}

      if (!cancelled) timeout = setTimeout(poll, 500);
    };

    timeout = setTimeout(poll, 500);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [conversationId, attachMap, myId]);

  async function handleSend() {
    const raw = input.trim();
    if (!raw || !conversationId || conversationId === 'new') return;
    const text = normalizeMessageText(raw);
    setInput('');
    await sendTextMessage(
      conversationId,
      myId || 'me',
      text,
      (msg) => setMessages((prev) => [
        { ...msg, from: myId || 'me', text },
        ...prev,
      ]),
      (tmpId, saved) => {
        setMessages((prev) => {
          const idx = prev.findIndex((m) => m.id === tmpId);
          const normalized = {
            ...(saved as LocalMessage),
            from: myId || 'me',
            text,
            pending: false,
            failed: false,
          };
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = normalized;
            return next.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
          }
          return [normalized, ...prev].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
        });
      },
      (tmpId) => {
        setMessages((prev) => prev.map((m) => (m.id === tmpId ? { ...m, pending: false, failed: true } : m)));
      }
    );
  }

  // ---- Attachments ----
  async function handleCamera() {
    if (!conversationId || conversationId === 'new') return;
    const uri = await pickFromCamera();
    if (uri) {
      await sendImageMessage(
        conversationId,
        myId || 'me',
        uri,
        (msg) => setMessages((prev) => [
          { ...msg, from: myId || 'me' },
          ...prev,
        ]),
        (tmpId, saved, imageUri) => {
          setAttachMap((m) => ({ ...m, [saved.id]: imageUri }));
          setMessages((prev) => {
            const idx = prev.findIndex((m) => m.id === tmpId);
            const normalized = {
              ...(saved as LocalMessage),
              from: myId || 'me',
              text: saved.text,
              imageUri,
              pending: false,
              failed: false,
            };
            if (idx < 0) return prev;
            const next = [...prev];
            next[idx] = normalized;
            next.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
            return next;
          });
        },
        (tmpId) => {
          setMessages((prev) => prev.map((m) => (m.id === tmpId ? { ...m, pending: false, failed: true } : m)));
        }
      );
    }
  }

  async function handleLibrary() {
    if (!conversationId || conversationId === 'new') return;
    const uri = await pickFromLibrary();
    if (uri) {
      await sendImageMessage(
        conversationId,
        myId || 'me',
        uri,
        (msg) => setMessages((prev) => [
          { ...msg, from: myId || 'me' },
          ...prev,
        ]),
        (tmpId, saved, imageUri) => {
          setAttachMap((m) => ({ ...m, [saved.id]: imageUri }));
          setMessages((prev) => {
            const idx = prev.findIndex((m) => m.id === tmpId);
            const normalized = {
              ...(saved as LocalMessage),
              from: myId || 'me',
              text: saved.text,
              imageUri,
              pending: false,
              failed: false,
            };
            if (idx < 0) return prev;
            const next = [...prev];
            next[idx] = normalized;
            next.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
            return next;
          });
        },
        (tmpId) => {
          setMessages((prev) => prev.map((m) => (m.id === tmpId ? { ...m, pending: false, failed: true } : m)));
        }
      );
    }
  }

  const handleMessageLongPress = React.useCallback(
    (msg: LocalMessage) => {
      if (!conversationId || conversationId === 'new') return;
      Alert.alert('Delete message', 'Remove this message?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const prevMessages = messagesRef.current;
            const prevAttach = attachRef.current;

            setMessages((current) => current.filter((m) => m.id !== msg.id));
            setAttachMap((current) => {
              if (!current[msg.id]) return current;
              const next = { ...current };
              delete next[msg.id];
              return next;
            });

            if (msg.pending || msg.failed || msg.id.startsWith('tmp_')) return;

            try {
              await deleteMessage(conversationId, msg.id);
            } catch (err) {
              console.warn('deleteMessage failed', err);
              setMessages(prevMessages);
              setAttachMap(prevAttach);
              Alert.alert('Delete failed', 'Unable to delete message.');
            }
          },
        },
      ]);
    },
    [conversationId]
  );

  const renderItem = ({ item }: { item: LocalMessage }) => {
    const mine = isMyMessage(String(item.from), myId || 'me');
    return (
      <MessageBubble
        msg={item}
        isMine={!!mine}
        onImagePress={(uri) => setViewerUri(uri)}
        onLongPress={mine ? () => handleMessageLongPress(item) : undefined}
      />
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
    >
      <StatusBar style="light" translucent backgroundColor="transparent" />

      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerBar}>
          <TouchableOpacity
            onPress={() => router.replace('/(tabs)/messages')}
            accessibilityRole="button"
            accessibilityLabel="Go back to messages"
            style={styles.backBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Icons.ArrowLeft size={22} color={MINE_BG} weight="bold" />
          </TouchableOpacity>

          <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
          <View style={styles.rightSpacer} />
        </View>
      </View>

      <View style={styles.listWrap}>
        {loading ? (
          <View style={styles.center}><ActivityIndicator /></View>
        ) : (
          <FlatList
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={renderItem}
            inverted
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      <View style={styles.inputBar}>
        <TouchableOpacity
          onPress={() => openAttachmentPicker(handleCamera, handleLibrary)}
          style={styles.attachBtn}
          accessibilityLabel="Add attachment"
        >
          <Icons.Plus size={20} color={TEXT_DARK} weight="bold" />
        </TouchableOpacity>

        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Type a message"
          placeholderTextColor="#8A8A8A"
          style={styles.input}
          multiline
        />
        <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
          <Icons.PaperPlaneRight size={22} color={TEXT_DARK} weight="fill" />
        </TouchableOpacity>
      </View>

      <ImageViewing
        images={viewerUri ? [{ uri: viewerUri }] : []}
        imageIndex={0}
        visible={!!viewerUri}
        onRequestClose={() => setViewerUri(null)}
        presentationStyle="fullScreen"
        backgroundColor="rgba(0,0,0,0.95)"
      />
    </KeyboardAvoidingView>
  );
}

function MessageBubble({
  msg,
  isMine,
  onImagePress,
  onLongPress,
}: {
  msg: LocalMessage;
  isMine: boolean;
  onImagePress: (uri: string) => void;
  onLongPress?: () => void;
}) {
  const hasImage = !!msg.imageUri;
  const minWidth = computeBubbleMinWidth(msg.text, hasImage);

  return (
    <View style={[styles.row, isMine ? styles.rowMine : styles.rowTheirs]}>
      <TouchableOpacity
        activeOpacity={0.8}
        onLongPress={onLongPress}
        delayLongPress={250}
      >
        <View
          style={[
            styles.bubble,
            isMine ? styles.bubbleMine : styles.bubbleTheirs,
            hasImage && styles.bubbleImage,
            { minWidth },
          ]}
        >
        {hasImage ? (
          <TouchableOpacity activeOpacity={0.9} onPress={() => msg.imageUri && onImagePress(msg.imageUri)}>
            <View style={styles.imageContainer}>
              <Image source={{ uri: msg.imageUri! }} style={styles.image} resizeMode="cover" />
            </View>
          </TouchableOpacity>
        ) : null}

        {msg.text ? (
          <Text style={[styles.msgText, isMine ? styles.msgMine : styles.msgTheirs]}>
            {msg.text}
          </Text>
        ) : null}

        {msg.pending ? (
          <Text style={[styles.meta, isMine ? styles.metaMine : styles.metaTheirs]}>Sending…</Text>
        ) : msg.failed ? (
          <Text style={[styles.meta, { color: '#ff6b6b' }]}>Failed</Text>
        ) : null}
        </View>
      </TouchableOpacity>
    </View>
  );
}

const HEADER_CONTENT_HEIGHT = 64;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  header: {
    backgroundColor: HEADER_BG,
  },
  headerBar: {
    height: HEADER_CONTENT_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#6EFF87',
    fontSize: 18,
    fontFamily: 'Inter-Black',
    marginTop: 2,
  },
  rightSpacer: { width: 44 },

  listWrap: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { padding: 12, paddingBottom: 16 },

  row: { width: '100%', marginVertical: 4, flexDirection: 'row' },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },

  bubble: {
    maxWidth: BUBBLE_MAX_WIDTH,
    minWidth: BUBBLE_MIN_WIDTH_BASE,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
  },
  bubbleMine: {
    backgroundColor: MINE_BG,
    borderTopRightRadius: 4,
    alignSelf: 'flex-end',
    borderWidth: 0.5,
    borderColor: '#000000',
  },
  bubbleTheirs: {
    backgroundColor: '#222020ff',
    borderTopLeftRadius: 4,
    borderWidth: 0.5,
    borderColor: '#000000',
  },

  bubbleImage: {
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderRadius: 0,
    borderWidth: 0,
    alignItems: 'flex-end',
  },

  imageContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    maxWidth: BUBBLE_MAX_WIDTH * 0.6,
  },

  image: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: 'transparent',
  },

  msgText: {
    fontSize: 17,
    lineHeight: 22,
    fontFamily: 'Inter-Regular',
  },

  msgMine: {
    color: TEXT_DARK,
    textAlign: 'left',
  },

  msgTheirs: {
    color: '#FFFFFF',
    textAlign: 'left',
  },

  meta: { marginTop: 4, fontSize: 11, opacity: 0.8, fontFamily: 'Inter-Bold' },
  metaMine: { color: '#124e1f' },
  metaTheirs: { color: '#9AA09C' },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 10,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
    marginBottom: 10,
    paddingBottom: 20,
  },
  attachBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: CONTROL_BG,
    borderWidth: 1,
    borderColor: '#000000ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: CONTROL_BG,
    color: TEXT_DARK,
    fontSize: 15,
    fontFamily: 'Inter-Bold',
    borderWidth: 1,
    borderColor: '#000000ff',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: CONTROL_BG,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#000000',
    marginBottom: 3,
  },
});
