import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import * as Icons from 'phosphor-react-native';
import { BackHandler } from 'react-native'; // ← added

type Props = {
  visible: boolean;
  stage: 'confirm' | 'success';
  onCancel: () => void;
  onConfirm: () => void;
  onGoToLogin: () => void;
};

export default function LogoutFlowModal({
  visible, stage, onCancel, onConfirm, onGoToLogin,
}: Props) {
  const isConfirm = stage === 'confirm';
  
  React.useEffect(() => {
    if (!visible) return;

    const onBack = () => {
      if (stage === 'confirm') {
        onCancel(); // back = cancel
      }
      return true;  // always consume while modal is visible
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, [visible, stage, onCancel]);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      // Back button/gesture: cancel only during "confirm"; block during "success"
      onRequestClose={() => {
        if (stage === 'confirm') {
          onCancel(); // back = cancel in confirm
        }
        // in success: do nothing → block back
      }}
    >
      {/* Dimmer backdrop that BLOCKS all touches but does nothing on tap */}
      <View style={styles.backdrop} pointerEvents="auto" />

      {/* Foreground layer with centered card */}
      <View style={styles.centerWrap} pointerEvents="box-none">
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            {isConfirm ? (
              <Icons.SignOut size={64} color={palette.ink} weight="bold" />
            ) : (
              <Icons.Check size={64} color={palette.ink} weight="bold" />
            )}
          </View>

          {isConfirm ? (
            <>
              <Text style={styles.title}>You’re about to Logout…</Text>
              <Text style={[styles.title, styles.titleSub]}>Are you sure?</Text>

              <View style={styles.actionsCol}>
                <PillButton
                  label="No, Don’t Log Me Out"
                  variant="outline"
                  onPress={onCancel}
                />
                <PillButton
                  label="Yes, Log Me Out"
                  variant="solid"
                  onPress={onConfirm}
                />
              </View>
            </>
          ) : (
            <>
              <Text style={styles.title}>You have successfully</Text>
              <Text style={[styles.title, styles.titleSub]}>Logged out</Text>

              <View style={styles.actionsCol}>
                {/* Make this match the 'No' button → outline */}
                <PillButton
                  label="Return to Login"
                  variant="outline"
                  onPress={onGoToLogin}
                />
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

/* ---------------- UI bits ---------------- */

function PillButton({
  label, onPress, variant,
}: { label: string; onPress: () => void; variant: 'solid' | 'outline' }) {
  const isSolid = variant === 'solid';
  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={onPress}
      style={[btnStyles.base, isSolid ? btnStyles.solid : btnStyles.outline]}
    >
      <Text style={[btnStyles.text, isSolid ? btnStyles.textSolid : btnStyles.textOutline]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

/* ---------------- Styling ---------------- */

const palette = {
  backdrop: 'rgba(0,0,0,0.68)',  // dimmer background
  card: '#CCFFE5',               // pale mint
  cardEdge: '#BFF6DB',
  btnSolid: '#C0FFCB',           // solid button fill
  btnOutlineBg: '#6EFF87',       // outline-look fill
  ink: '#0B0B0B',                // near-black text & borders
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: palette.backdrop,
  },
  centerWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: palette.card,
    borderRadius: 18,
    paddingVertical: 20,
    paddingHorizontal: 18,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    borderWidth: 2,
    borderColor: palette.ink,
  },
  iconWrap: {
    alignSelf: 'center',
    marginBottom: 10,
  },
  title: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 24,
  },
  titleSub: {
    marginTop: 2,
    marginBottom: 12,
  },
  actionsCol: {
    marginTop: 6,
    gap: 10,
    alignItems: 'center',
  },
});

const btnStyles = StyleSheet.create({
  base: {
    minWidth: 220,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: palette.ink,
    alignItems: 'center',
  },
  solid: {
    backgroundColor: palette.btnSolid,
  },
  outline: {
    backgroundColor: palette.btnOutlineBg,
  },
  text: {
    fontSize: 13,
    fontWeight: '900',
  },
  textSolid: {
    color: palette.ink,
  },
  textOutline: {
    color: palette.ink,
  },
});
