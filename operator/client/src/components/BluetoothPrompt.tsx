import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FONTS } from '../constants/Fonts';

type Props = {
  visible: boolean;
  onOpenSettings: () => void;
  onDismiss: () => void;
};

export default function BluetoothPrompt({ visible, onOpenSettings, onDismiss }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Bluetooth is Off</Text>
          <Text style={styles.body}>
            Please turn on Bluetooth to scan for nearby devices.
          </Text>
          <View style={styles.row}>
            <TouchableOpacity onPress={onDismiss} style={[styles.btn, styles.btnGhost]}>
              <Text style={styles.btnGhostText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onOpenSettings} style={[styles.btn, styles.btnPrimary]}>
              <Text style={styles.btnPrimaryText}>Open Bluetooth Settings</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
     flex: 1, 
     backgroundColor: 'rgba(0,0,0,0.6)', 
     alignItems: 'center', 
     justifyContent: 'center' 
    },

  card: {
     width: '88%',
      backgroundColor: '#101010', 
      borderRadius: 16, 
      padding: 18, 
      borderWidth: 1, 
      borderColor: '#222' 
    },

  title: {
     color: '#fff', 
     fontSize: 18, 
     fontWeight: 'bold',
     fontFamily: FONTS.INTER_BOLD,
     marginBottom: 6 
    },

  body: { 
    color: '#cfcfcf',
    fontFamily: FONTS.INTER_REGULAR,
    marginBottom: 14, 
    lineHeight: 20 
    },

  row: { 
    flexDirection: 'row', 
    justifyContent: 'flex-end',
    gap: 10 
  },

  btn: { 
    paddingVertical: 10,
     paddingHorizontal: 14, 
     borderRadius: 10 
    },

  btnGhost: { 
    backgroundColor: 'transparent', 
    borderWidth: 1, 
    borderColor: '#333'
   },

  btnGhostText: { 
    color: '#cfcfcf', 
    fontWeight: '600',
    fontFamily: FONTS.INTER_SEMIBOLD
   },
  btnPrimary: {
     backgroundColor: '#44ff75' 
    },
  btnPrimaryText: { 
    color: '#111', 
    fontWeight: '700',
    fontFamily: FONTS.INTER_BOLD
  },
});
