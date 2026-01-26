import * as Icons from 'phosphor-react-native';
import React from 'react';
import {
    Animated,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useImmersiveMode } from '../hooks/useImmersiveMode';
import { formatWhen, resolveRequestId, useActivityScreen } from './functions/activity';

// helpers moved to ./functions/activity

const BG = '#121212';
const TEXT = '#EDEDED';
const SUBTEXT = '#bababaff';
const DIVIDER = '#1F1F1F';
const GREEN = '#6EFF87';
const INTER_BLACK = 'Inter-Black';
const INTER_MEDIUM = 'Inter-Medium';
const INTER_REGULAR = 'Inter-Regular';

type ActivityItemProps = {
  title: string;
  subtitle?: string;
  isNew?: boolean;
  isOngoing?: boolean;
  onPress?: () => void;
};

const ActivityItem: React.FC<ActivityItemProps> = ({
  title,
  subtitle,
  isNew,
  isOngoing,
  onPress,
}) => {
  // Animation for ongoing jobs
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    if (isOngoing) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [isOngoing, pulseAnim]);
  const Content = (
    <View style={styles.itemRow}>
      <View style={styles.itemLeft}>
        {isOngoing ? (
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <Icons.Clock size={18} color="#FFA500" weight="bold" />
          </Animated.View>
        ) : isNew ? (
          <Icons.Wrench size={20} color={GREEN} weight="fill" />
        ) : (
          <View style={styles.checkWrap}>
            <Icons.Check size={16} color="#0A0A0A" weight="bold" />
          </View>
        )}
        <View style={styles.itemTextWrap}>
          {isNew && <Text style={styles.badgeNew}>Request assistance</Text>}
          <Text numberOfLines={1} style={isNew ? styles.itemTitleNewBold : styles.itemTitle}>{title}</Text>
          {!!subtitle && (
            <Text style={isNew ? styles.itemSubtitleNew : styles.itemSubtitle}>
              {subtitle.split('\n').map((line, index, arr) => (
                <Text
                  key={index}
                  style={isNew ? styles.itemSubtitleNew : (index === 0 ? styles.vehicleModel : styles.itemSubtitle)}
                >
                  {line}{index < arr.length - 1 ? '\n' : ''}
                </Text>
              ))}
            </Text>
          )}
        </View>
      </View>
      <View style={styles.itemRight}>
        {isNew ? (
          <View style={styles.newDot} />
        ) : null}
      </View>
    </View>
  );

  return onPress ? (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
      {Content}
    </TouchableOpacity>
  ) : (
    Content
  );
};

// formatWhen moved to ./functions/activity

const ActivityScreen: React.FC = () => {
  useImmersiveMode();
  const { newItems, ongoingItems, recentItems, loading, error, empty, onPressNew, onPressOngoing, onPressRecent } = useActivityScreen();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.headerWrap}>
        <Text style={{ color: '#44ff75', fontWeight: 'normal', fontFamily: 'Candal', fontSize: 25 }}>Activity</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {error ? (
          <View style={{ padding: 16 }}>
            <Text style={[styles.itemSubtitle, { color: '#ffb4b4' }]}>{String(error)}</Text>
          </View>
        ) : null}

        {empty ? (
          <View style={{ padding: 16 }}>
            <Text style={styles.itemSubtitle}>No activity yet.</Text>
          </View>
        ) : (
          <>
            {newItems.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>New</Text>
                <View style={styles.card}>
                  {newItems.map((it, idx) => {
                    const title =
                      it?.location?.address || it?.vehicle?.model || 'Assistance request';
                    return (
                      <React.Fragment key={it.id}>
                        <ActivityItem
                          isNew
                          title={title}
                          subtitle={formatWhen(it.createdAt)}
                          onPress={onPressNew}
                        />
                        {idx < newItems.length - 1 && <View style={styles.divider} />}
                      </React.Fragment>
                    );
                  })}
                </View>
                <View style={styles.sectionSpacer} />
              </>
            )}

            {ongoingItems.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Ongoing</Text>
                <View style={styles.card}>
                  {ongoingItems.map((it, idx) => {
                    const clientName = it?.clientName || it?.customerName || it?.contactName || 'Client';
                    const vehicleModel = it?.vehicle?.model || (it as any)?.vehicleType || 'Vehicle';
                    const clientLocation =
                      it?.location?.address ||
                      it?.location?.formatted_address ||
                      it?.location?.display_name ||
                      (it as any)?.address ||
                      'Location';
                    const date = formatWhen(it.createdAt);

                    const title = clientName;
                    const subtitle = `${vehicleModel}\n${clientLocation}\n${date}`;

                    const onPress = () => onPressOngoing(it);

                    return (
                      <React.Fragment key={resolveRequestId(it) ?? it.id ?? idx}>
                        <ActivityItem
                          isOngoing
                          title={title}
                          subtitle={subtitle}
                          onPress={onPress}
                        />
                        {idx < ongoingItems.length - 1 && <View style={styles.divider} />}
                      </React.Fragment>
                    );
                  })}
                </View>
                <View style={styles.sectionSpacer} />
              </>
            )}

            <Text style={styles.sectionTitle}>Recent</Text>
            <View style={styles.card}>
              {recentItems.map((it, idx) => {
                const clientName = it?.clientName || it?.customerName || it?.contactName || 'Client';
                const vehicleModel = it?.vehicle?.model || (it as any)?.vehicleType || 'Vehicle';
                const clientLocation =
                  it?.location?.address ||
                  it?.location?.formatted_address ||
                  it?.location?.display_name ||
                  (it as any)?.address ||
                  'Location';
                const date = formatWhen(it.createdAt);

                const title = clientName;
                const subtitle = `${vehicleModel}\n${clientLocation}\n${date}`;

                const onPress = () => onPressRecent(it);


                return (
                  <React.Fragment key={resolveRequestId(it) ?? it.id ?? idx}>
                    <ActivityItem
                      title={title}
                      subtitle={subtitle}
                      onPress={onPress}
                    />
                    {idx < recentItems.length - 1 && <View style={styles.divider} />}
                  </React.Fragment>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default ActivityScreen;

const styles = StyleSheet.create({
  safe: { 
    flex: 1, 
    backgroundColor: BG 
  },

  headerWrap: { 
    paddingHorizontal: 20, 
    paddingTop: 20, 
    paddingBottom: 6
   },

  headerText: { 
    color: '#44ff75', 
    fontSize: 25, 
    fontFamily: INTER_BLACK 
  },

  scroll: { 
    flex: 1, 
    paddingHorizontal: 14 
  },

  sectionTitle: {
    color: TEXT, 
    opacity: 0.9, 
    fontSize: 14, 
    marginLeft: 6, 
    marginBottom: 8,
     marginTop: 12, 
     fontFamily: INTER_BLACK,
  },
  
  card: { 
    borderRadius: 16, 
    paddingVertical: 8
  },

  sectionSpacer: { 
    height: 8 
  },

  itemRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 10, 
    paddingVertical: 12 
  },

  itemLeft: { 
    flexDirection: 'row', 
    flex: 1, 
    alignItems: 'center', 
    gap: 12 as any 
  },


  itemTextWrap: { 
    flex: 1 
  },

  badgeNew: { 
    color: GREEN, 
    fontSize: 15,
    marginBottom: 2, 
    fontFamily: INTER_BLACK 
  },

  itemTitle: { 
    color: TEXT, 
    fontSize: 18, 
    fontFamily: INTER_BLACK 
  },

  itemTitleNew: { 
    color: TEXT, 
    fontSize: 12, 
    fontFamily: INTER_MEDIUM 
  },

  itemTitleNewBold: { 
    color: TEXT, 
    fontSize: 17, 
    fontFamily: INTER_BLACK 
  },

  itemSubtitleNew: { 
    color: SUBTEXT, 
    fontSize: 14, 
    fontFamily: INTER_REGULAR 
  },

  itemSubtitle: { 
    color: SUBTEXT, 
    fontSize: 14, 
    fontFamily: INTER_MEDIUM 
  },

  vehicleModel: { 
    fontSize: 16, 
    fontFamily: INTER_BLACK, 
    color: '#F0F0F0', 
    marginTop: 2 
  },

  itemRight: { 
    width: 28, 
    alignItems: 'flex-end' 
  },

  newDot: { 
    width: 10, 
    height: 10, 
    borderRadius: 6, 
    backgroundColor: GREEN 
  },

  checkWrap: {
    width: 18, 
    height: 18, 
    borderRadius: 13, 
    backgroundColor: '#50FF80',
    alignItems: 'center', 
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },

  clockWrap: {
    width: 18, 
    height: 18, 
    borderRadius: 13, 
    backgroundColor: '#FFA500',
    alignItems: 'center', 
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },

  divider: { 
    height: 1, 
    marginLeft: 54, 
    marginVertical: 12, 
    backgroundColor: DIVIDER 
  },
});
