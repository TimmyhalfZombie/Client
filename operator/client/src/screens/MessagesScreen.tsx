import { router, useFocusEffect } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Alert, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { deleteConversation } from '../features/messages/api';
import { useConversations } from '../features/messages/useConversations';

const BG = '#0E0E0E';
const CARD = '#161616';
const GREEN = '#44ff75';
const TEXT = '#EDEDED';
const SUB = '#9FA0A4';

function timeAgo(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = Math.max(0, Date.now() - d.getTime());
  const h = Math.floor(diff / 3600000);
  if (h < 1) {
    const m = Math.floor(diff / 60000);
    return m <= 1 ? 'now' : `${m} min`;
  }
  if (h < 24) return `${h} hrs`;
  const days = Math.floor(h / 24);
  return `${days} d`;
}

export default function MessagesScreen() {
  const { items, loading, error, reload } = useConversations();

  useFocusEffect(
    React.useCallback(() => {
      reload();
    }, [reload])
  );

  const handleConversationPress = (item: any) => {
    const displayName = item.title || item.name || 'Conversation';
    router.push({ pathname: '/chat/[id]', params: { id: item.id, name: displayName } });
  };

  const handleConversationLongPress = (item: any) => {
    Alert.alert(
      'Delete',
      undefined,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteConversation(item.id);
              await reload();
            } catch (e) {
              Alert.alert('Delete failed', String((e as any)?.message || e));
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.safe}>
      <View style={styles.header}>
        <Text style={{ color: '#44ff75', fontFamily: 'Candal', fontSize: 28 }}>Messages</Text>
      </View>

      {loading ? (
        <View style={{ paddingTop: 30 }}><ActivityIndicator /></View>
      ) : error ? (
        <View style={{ padding: 16 }}><Text style={{ color: '#ff9d9d' }}>{String(error)}</Text></View>
      ) : items.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No conversations yet</Text>
          <Text style={styles.emptySubtext}>Start a conversation from an assistance request</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => handleConversationPress(item)} onLongPress={() => handleConversationLongPress(item)} style={styles.row} activeOpacity={0.8}>
              <View style={styles.avatarWrap}>
                {item.avatarUrl ? (
                  <Image source={{ uri: item.avatarUrl }} style={styles.avatarImg} />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarFallbackText} numberOfLines={1}>
                      {(item.title || 'C').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={styles.name} numberOfLines={1}>{item.title || 'Conversation'}</Text>
                  <Text style={styles.time}>{timeAgo(item.lastMessageAt || undefined)}</Text>
                </View>
                {item.lastMessage ? (
                  <Text style={styles.preview} numberOfLines={1}>{item.lastMessage}</Text>
                ) : (
                  <Text style={styles.preview} numberOfLines={1}>No messages yet</Text>
                )}
              </View>
              {item.unread ? <View style={styles.unreadDot} /> : null}
            </TouchableOpacity>
          )}
          onRefresh={reload}
          refreshing={loading}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { 
    flex: 1, 
    backgroundColor: BG
   },
   
  header: { paddingHorizontal: 16, paddingTop: 35, paddingBottom: 8 },
  row: { backgroundColor: CARD, borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center' },
  avatarWrap: { width: 44, height: 44, borderRadius: 22, marginRight: 12, overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },
  avatarFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2d2d2d' },
  avatarFallbackText: { color: '#FFFFFF', fontFamily: 'Inter-Black', fontSize: 16 },
  name: { color: TEXT, fontSize: 16, fontFamily: 'Inter-Black', flex: 1 },
  time: { color: SUB, marginLeft: 8, fontSize: 12 },
  preview: { color: SUB, marginTop: 4 },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: GREEN, marginLeft: 8 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyText: { color: TEXT, fontSize: 18, fontWeight: '600', marginBottom: 8 },
  emptySubtext: { color: SUB, fontSize: 14, textAlign: 'center' },
});
