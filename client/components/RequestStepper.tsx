// client/components/RequestStepper.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Keyboard,
  Animated,
  Platform,
  TouchableWithoutFeedback,
  Modal,
  Pressable,
  FlatList,
  PanResponder,
} from "react-native";
import Typo from "@/components/Typo";
import * as Icons from "phosphor-react-native";

type Props = {
  vehicleModel: string;
  setVehicleModel: (v: string) => void;
  plateNumber: string;
  setPlateNumber: (v: string) => void;
  otherInfo: string;
  setOtherInfo: (v: string) => void;
  onRecenter: () => void;
  bottomInset: number;
  onRequest: () => void;
  isRequesting: boolean;
  requestStatus?: "idle" | "requesting" | "accepted";
};

const COOLDOWN_MS = 30_000;
const KB_LIFT_FACTOR_IOS = 0.7;
const KB_LIFT_FACTOR_ANDROID = 0.7;
const KB_SAFE_GAP = 4;

type FieldKey = "vehicle" | "plate" | "other";
type Step = 0 | 1 | 2 | 3;

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

/* ----------------------------- PH Moto Catalog ---------------------------- */
const MOTORCYCLES: Record<string, string[]> = {
  Honda: [
    "ADV 160",
    "Airblade 160",
    "BeAT",
    "CB150X",
    "CBR150R",
    "Click 125i",
    "CRF150L",
    "CRF300L",
    "PCX160",
    "TMX125 Alpha",
    "XRM125",
  ],
  Yamaha: [
    "Aerox 155",
    "FZi 150",
    "Mio Gear",
    "Mio i 125",
    "Mio Soul i",
    "MT-15",
    "NMAX 155",
    "Sniper 155",
    "XSR155",
    "YZF-R15M",
  ],
  Suzuki: [
    "Avenis",
    "Burgman Street",
    "Gixxer 150",
    "Raider R150 Fi",
    "Skydrive Sport",
    "Smash 115",
    "V-Strom 250SX",
  ],
  Kawasaki: [
    "Barako II",
    "Dominar 400",
    "KLX 150",
    "Ninja 400",
    "Rouser NS160",
    "Rouser RS200",
    "W175",
  ],
  Kymco: ["KRV 180i TCS", "Like 125", "Super 8", "X-Town 300i"],
  TVS: ["Apache RTR 200 4V", "Dazz Prime", "Rockz 125"],
  SYM: ["Husky 150", "Jet 14", "NHX 125"],
  Keeway: ["RKS 150 Sport", "Superlight 200"],
};

// ✅ Allowed: NON-TUBELESS? No — these are tube-type models only.
// List uses the flattened "<Brand> <Model>" format.
const TUBE_TYPE_MODELS = [
  "Honda CRF150L",
  "Honda CRF300L",
  "Honda TMX125 Alpha",
  "Honda XRM125",
  "Kawasaki Barako II",
  "Kawasaki KLX 150",
  "Kawasaki W175",
  "Suzuki Smash 115",
  "Keeway Superlight 200",
];
const ALLOWED_VEHICLES = new Set<string>(TUBE_TYPE_MODELS);

// Plate presets (user can also type freely)
const PLATE_PRESETS = [
  "Damaged plate",
  "Lost plate",
  "No plate",
  "Plate on delivery",
  "Temporary plate",
  "Unreadable plate",
];

// Other presets (user can also type freely)
const OTHER_PRESETS = [
  "Black",
  "Blue",
  "Delivery box",
  "Gray",
  "Matte Black",
  "Red",
  "White",
  "With crash guard",
  "With side bags",
  "With top box",
  "With windshield",
].sort((a, b) => a.localeCompare(b));

const DARK = "#1111118e";

// Minimal dropdown palette
const MENU_BG = "#FAFAFA";
const MENU_BORDER = "#474747ff";
const MENU_TEXT = "#0D0D0D";
const MENU_PLACEHOLDER = "#9CA3AF";
const ITEM_PRESSED = "#e6e6e6a2";
const BACKDROP = "rgba(0,0,0,0.20)";

const RequestStepper: React.FC<Props> = ({
  vehicleModel,
  setVehicleModel,
  plateNumber,
  setPlateNumber,
  otherInfo,
  setOtherInfo,
  bottomInset,
  onRequest,
  isRequesting,
  requestStatus = "idle",
}) => {
  const [step, setStep] = useState<Step>(0);
  const [openMenu, setOpenMenu] = useState<FieldKey | null>(null);

  // queries for dropdown search / use
  const [vehicleQuery, setVehicleQuery] = useState(vehicleModel);
  const [plateQuery, setPlateQuery] = useState(plateNumber);
  const [otherQuery, setOtherQuery] = useState(otherInfo);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const collapseTranslateY = useRef(new Animated.Value(0)).current;
  const [cardHeight, setCardHeight] = useState(0);

  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState<number>(Date.now());
  const prevRequestingRef = useRef(isRequesting);

  // Base panel keyboard lift
  const sheetTranslateY = useRef(new Animated.Value(0)).current;
  const [androidKbLift, setAndroidKbLift] = useState(0);

  // Dropdown keyboard lift
  const [dropdownKbLift, setDropdownKbLift] = useState(0);

  const btnOpacity = useRef(new Animated.Value(1)).current;

  /* ------------------------------ Cooldown ------------------------------ */
  useEffect(() => {
    const prev = prevRequestingRef.current;
    if (prev && !isRequesting) setCooldownUntil(Date.now() + COOLDOWN_MS);
    prevRequestingRef.current = isRequesting;
  }, [isRequesting]);

  useEffect(() => {
    if (!cooldownUntil) return;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [cooldownUntil]);

  const msLeft = cooldownUntil ? Math.max(0, cooldownUntil - nowTick) : 0;
  const cooldownActive = !!cooldownUntil && msLeft > 0;
  const secondsLeft = Math.ceil(msLeft / 1000);
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  useEffect(() => {
    if (cooldownUntil && msLeft <= 0) setCooldownUntil(null);
  }, [msLeft, cooldownUntil]);

  /* --------------------------- Keyboard lifting -------------------------- */
  useEffect(() => {
    if (Platform.OS === "ios") {
      const onShow = (e: any) => {
        const h = Math.max(
          0,
          (e?.endCoordinates?.height ?? 0) * KB_LIFT_FACTOR_IOS - KB_SAFE_GAP,
        );
        Animated.timing(sheetTranslateY, {
          toValue: -h,
          duration: e?.duration ?? 250,
          useNativeDriver: true,
        }).start();
      };
      const onHide = (e?: any) => {
        Animated.timing(sheetTranslateY, {
          toValue: 0,
          duration: e?.duration ?? 200,
          useNativeDriver: true,
        }).start();
      };
      const s1 = Keyboard.addListener("keyboardWillShow", onShow);
      const s2 = Keyboard.addListener("keyboardWillHide", onHide);
      return () => {
        s1.remove();
        s2.remove();
      };
    } else {
      const onShow = (e: any) => {
        const lift = Math.max(
          0,
          Math.round(
            (e?.endCoordinates?.height ?? 0) * KB_LIFT_FACTOR_ANDROID,
          ) - KB_SAFE_GAP,
        );
        setAndroidKbLift(lift);
      };
      const onHide = () => setAndroidKbLift(0);
      const s1 = Keyboard.addListener("keyboardDidShow", onShow);
      const s2 = Keyboard.addListener("keyboardDidHide", onHide);
      return () => {
        s1.remove();
        s2.remove();
      };
    }
  }, [sheetTranslateY]);

  // Dropdown lift (modals)
  useEffect(() => {
    const showEvt =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const onShow = (e: any) =>
      setDropdownKbLift(e?.endCoordinates?.height ?? 0);
    const onHide = () => setDropdownKbLift(0);
    const s1 = Keyboard.addListener(showEvt, onShow);
    const s2 = Keyboard.addListener(hideEvt, onHide);
    return () => {
      s1.remove();
      s2.remove();
    };
  }, []);

  /* ------------------------------- Buttons ------------------------------- */
  const isAllowedVehicle = useMemo(
    () => ALLOWED_VEHICLES.has((vehicleModel || "").trim()),
    [vehicleModel],
  );

  const allFilled =
    !!vehicleModel.trim() && !!plateNumber.trim() && !!otherInfo.trim();
  const isAccepted = requestStatus === "accepted";
  const onFinalStep = step === 3;

  const nextDisabled =
    (step === 0 && !vehicleModel.trim()) ||
    (step === 1 && !plateNumber.trim()) ||
    (step === 2 && !otherInfo.trim());

  const buttonDisabled =
    (onFinalStep ? !allFilled : nextDisabled) ||
    isRequesting ||
    cooldownActive ||
    isAccepted;
  const buttonText = isRequesting
    ? "Requesting..."
    : isAccepted
      ? "Accepted!"
      : cooldownActive
        ? `Please wait ${mm}:${ss}`
        : onFinalStep
          ? "Submit"
          : "Next";

  useEffect(() => {
    Animated.timing(btnOpacity, {
      toValue: buttonDisabled ? 0.5 : 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [buttonDisabled]);

  const baseMenuBottom = (bottomInset ?? 110) + 8;
  const menuBottom = baseMenuBottom + dropdownKbLift;

  /* -------------------------- Collapse Logic --------------------------- */
  const HEADER_HEIGHT = 55; // Approximate height of the title area

  const toggleCollapse = () => {
    const nextIsCollapsed = !isCollapsed;
    const nextValue = nextIsCollapsed
      ? Math.max(0, cardHeight - HEADER_HEIGHT)
      : 0;

    Animated.spring(collapseTranslateY, {
      toValue: nextValue,
      useNativeDriver: true,
      friction: 8,
      tension: 40,
    }).start();
    setIsCollapsed(nextIsCollapsed);
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only trigger if vertical swipe is significant
        return Math.abs(gestureState.dy) > 10;
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 50) {
          // Swipe down -> collapse
          if (!isCollapsed) toggleCollapse();
        } else if (gestureState.dy < -50) {
          // Swipe up -> expand
          if (isCollapsed) toggleCollapse();
        }
      },
    }),
  ).current;

  /* ------------------------------ Handlers ------------------------------- */
  const handleNext = () => {
    if (onFinalStep) {
      if (buttonDisabled) return;
      onRequest?.();
    } else if (!nextDisabled) {
      setStep((s) => (s + 1) as Step);
    }
  };
  const handlePrev = () => setStep((s) => (s > 0 ? ((s - 1) as Step) : s));

  // Vehicle flattened + searchable + alphabetical (Tube-type only)
  const vehicleOptions = useMemo(() => {
    const flat = Object.entries(MOTORCYCLES)
      .flatMap(([brand, models]) => models.map((m) => `${brand} ${m}`))
      .filter((full) => ALLOWED_VEHICLES.has(full))
      .sort((a, b) => a.localeCompare(b));
    if (!vehicleQuery?.trim()) return flat;
    const q = vehicleQuery.trim().toLowerCase();
    return flat.filter((s) => s.toLowerCase().includes(q));
  }, [vehicleQuery]);

  const plateOptions = useMemo(
    () => [...PLATE_PRESETS].sort((a, b) => a.localeCompare(b)),
    [],
  );
  const otherOptions = useMemo(
    () => [...OTHER_PRESETS].sort((a, b) => a.localeCompare(b)),
    [],
  );

  const StepTitle = ["Vehicle model", "Plate number", "Other info", "Review"][
    step
  ];

  const renderField = () => {
    if (step === 3) return null;

    const isVehicle = step === 0;
    const isPlate = step === 1;
    const isOther = step === 2;

    const placeholder =
      step === 0
        ? "Brand & model, e.g., Honda XRM125"
        : step === 1
          ? "Type or select (e.g., ABC123 / No plate)"
          : "Type or select (e.g., Black / With top box)";

    return (
      <View style={styles.comboWrap}>
        <TextInput
          style={styles.comboInput}
          placeholder={placeholder}
          placeholderTextColor="#6B7280"
          value={
            step === 0 ? vehicleModel : step === 1 ? plateNumber : otherInfo
          }
          onChangeText={(t) => {
            if (isVehicle) {
              setVehicleModel(t);
              setVehicleQuery(t);
            }
            if (isPlate) {
              setPlateNumber(t);
              setPlateQuery(t);
            }
            if (isOther) {
              setOtherInfo(t);
              setOtherQuery(t);
            }
          }}
          editable
          autoCapitalize={isPlate ? "characters" : "sentences"}
          underlineColorAndroid="transparent"
        />
        <TouchableOpacity
          style={styles.comboCaret}
          onPress={() =>
            setOpenMenu(step === 0 ? "vehicle" : step === 1 ? "plate" : "other")
          }
        >
          <Icons.CaretDown size={16} color="#111827" weight="bold" />
        </TouchableOpacity>
      </View>
    );
  };

  const renderReview = () => {
    if (step !== 3) return null;
    return (
      <View style={styles.reviewBox}>
        <Row label="Vehicle" value={vehicleModel} onEdit={() => setStep(0)} />
        <Row label="Plate" value={plateNumber} onEdit={() => setStep(1)} />
        <Row label="Other" value={otherInfo} onEdit={() => setStep(2)} />
      </View>
    );
  };

  const closeMenus = () => {
    setOpenMenu(null);
    Keyboard.dismiss();
  };

  // For "Use" button enable/disable in vehicle modal
  const typedVehicle = (vehicleQuery || "").trim();
  const canUseTypedVehicle = ALLOWED_VEHICLES.has(typedVehicle);

  return (
    <View style={styles.container} pointerEvents="box-none">
      {!!openMenu && (
        <TouchableOpacity
          activeOpacity={1}
          onPress={closeMenus}
          style={styles.touchCatcher}
        />
      )}

      <Animated.View
        style={[
          styles.sheet,
          {
            marginBottom:
              bottomInset + (Platform.OS === "android" ? androidKbLift : 0),
            transform: [
              ...(Platform.OS === "ios"
                ? [{ translateY: sheetTranslateY }]
                : []),
              { translateY: collapseTranslateY },
            ],
          },
        ]}
        pointerEvents="box-none"
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View
            style={styles.card}
            pointerEvents="auto"
            {...panResponder.panHandlers}
            onLayout={(e) => setCardHeight(e.nativeEvent.layout.height)}
          >
            <View style={styles.headerRowMain}>
              <Typo
                size={18}
                color="#fff"
                fontFamily="InterLight"
                fontWeight={800}
                style={{ textAlign: "center", flex: 1 }}
              >
                Request assistance
              </Typo>
              <TouchableOpacity
                onPress={toggleCollapse}
                style={styles.collapseBtn}
                hitSlop={15}
              >
                {isCollapsed ? (
                  <Icons.CaretUp size={24} color="#fff" weight="bold" />
                ) : (
                  <Icons.CaretDown size={24} color="#fff" weight="bold" />
                )}
              </TouchableOpacity>
            </View>

            {/* Friendlier, clearer subheading */}
            <Typo
              size={13}
              color="#ffffffcc"
              fontFamily="InterLight"
              style={{ marginBottom: 10 }}
            >
              Please note: we currently accept motorcycles with tube-type tires
              only (no tubeless).
            </Typo>

            <View style={styles.innerPanel}>
              <Typo
                size={16}
                color="#000000ff"
                fontFamily="InterLight"
                fontWeight="600"
                style={{ marginBottom: 8 }}
              >
                {StepTitle}
              </Typo>

              {renderField()}
              {renderReview()}

              <View style={styles.navRow}>
                <TouchableOpacity
                  style={[styles.navBtn, step === 0 && styles.navDisabled]}
                  disabled={step === 0}
                  onPress={handlePrev}
                >
                  <Icons.CaretLeft size={16} color="#0D0D0D" />
                  <Typo
                    size={14}
                    color="#0D0D0D"
                    fontFamily="InterLight"
                    fontWeight="900"
                  >
                    Prev
                  </Typo>
                </TouchableOpacity>

                <AnimatedTouchable
                  style={[styles.navBtn, { opacity: btnOpacity }]}
                  activeOpacity={0.9}
                  onPress={handleNext}
                  disabled={buttonDisabled}
                >
                  <Typo
                    size={14}
                    color="#0D0D0D"
                    fontFamily="InterLight"
                    fontWeight="900"
                  >
                    {buttonText}
                  </Typo>
                  {step !== 3 && <Icons.CaretRight size={16} color="#0D0D0D" />}
                </AnimatedTouchable>
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Animated.View>

      {/* VEHICLE PICKER (minimal) */}
      <Modal
        visible={openMenu === "vehicle"}
        transparent
        animationType="fade"
        onRequestClose={closeMenus}
      >
        <Pressable style={styles.modalBackdrop} onPress={closeMenus}>
          <View style={[styles.menu, { bottom: menuBottom }]}>
            <Typo
              size={12}
              color={MENU_TEXT}
              fontFamily="InterLight"
              fontWeight="600"
              style={styles.menuTitle}
            >
              Select vehicle model
            </Typo>

            <View style={styles.searchWrap}>
              <Icons.MagnifyingGlass size={16} color={MENU_PLACEHOLDER} />
              <TextInput
                value={vehicleQuery}
                onChangeText={setVehicleQuery}
                placeholder="Search or type (e.g., Honda XRM125)"
                placeholderTextColor={MENU_PLACEHOLDER}
                style={styles.searchInput}
                underlineColorAndroid="transparent"
              />
              <TouchableOpacity
                disabled={!canUseTypedVehicle}
                onPress={() => {
                  setVehicleModel(typedVehicle);
                  closeMenus();
                }}
              >
                <Typo
                  size={12}
                  color={canUseTypedVehicle ? "#10B981" : "#9CA3AF"}
                  fontFamily="InterLight"
                  fontWeight="800"
                >
                  Use
                </Typo>
              </TouchableOpacity>
            </View>

            <FlatList
              data={vehicleOptions}
              keyExtractor={(s) => s}
              keyboardShouldPersistTaps="handled"
              ItemSeparatorComponent={() => <View style={styles.sep} />}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    setVehicleModel(item);
                    setVehicleQuery(item);
                    closeMenus();
                  }}
                  style={({ pressed }) => [
                    styles.menuItem,
                    pressed && { backgroundColor: ITEM_PRESSED },
                  ]}
                >
                  <Typo size={14} color={MENU_TEXT} fontFamily="InterLight">
                    {item}
                  </Typo>
                </Pressable>
              )}
              style={{ maxHeight: 280 }}
            />
          </View>
        </Pressable>
      </Modal>

      {/* PLATE PICKER */}
      <Modal
        visible={openMenu === "plate"}
        transparent
        animationType="fade"
        onRequestClose={closeMenus}
      >
        <Pressable style={styles.modalBackdrop} onPress={closeMenus}>
          <View style={[styles.menu, { bottom: menuBottom }]}>
            <Typo
              size={12}
              color={MENU_TEXT}
              fontFamily="InterLight"
              fontWeight="600"
              style={styles.menuTitle}
            >
              Plate number
            </Typo>

            <FlatList
              data={plateOptions}
              keyExtractor={(s) => s}
              ItemSeparatorComponent={() => <View style={styles.sep} />}
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [
                    styles.menuItem,
                    pressed && { backgroundColor: ITEM_PRESSED },
                  ]}
                  onPress={() => {
                    setPlateNumber(item);
                    setPlateQuery(item);
                    closeMenus();
                  }}
                >
                  <Typo size={14} color={MENU_TEXT} fontFamily="InterLight">
                    {item}
                  </Typo>
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>

      {/* OTHER PICKER */}
      <Modal
        visible={openMenu === "other"}
        transparent
        animationType="fade"
        onRequestClose={closeMenus}
      >
        <Pressable style={styles.modalBackdrop} onPress={closeMenus}>
          <View style={[styles.menu, { bottom: menuBottom }]}>
            <Typo
              size={12}
              color={MENU_TEXT}
              fontFamily="InterLight"
              fontWeight="600"
              style={styles.menuTitle}
            >
              Other info
            </Typo>

            <FlatList
              data={otherOptions}
              keyExtractor={(s) => s}
              ItemSeparatorComponent={() => <View style={styles.sep} />}
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [
                    styles.menuItem,
                    pressed && { backgroundColor: ITEM_PRESSED },
                  ]}
                  onPress={() => {
                    setOtherInfo(item);
                    setOtherQuery(item);
                    closeMenus();
                  }}
                >
                  <Typo size={14} color={MENU_TEXT} fontFamily="InterLight">
                    {item}
                  </Typo>
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
};

export default RequestStepper;

/* --------------------------------- Helpers -------------------------------- */
const Row = ({
  label,
  value,
  onEdit,
}: {
  label: string;
  value?: string;
  onEdit?: () => void;
}) => (
  <View style={styles.reviewRow}>
    <Typo size={14} color="#000000ff" fontFamily="InterLight" fontWeight="600">
      {label}
    </Typo>
    <View style={styles.reviewValueWrap}>
      <Typo size={14} color="#000000ff" fontFamily="InterLight">
        {value || "—"}
      </Typo>
      <Pressable onPress={onEdit} hitSlop={8}>
        <Icons.PencilSimple size={14} color="#000000ff" />
      </Pressable>
    </View>
  </View>
);

/* ---------------------------------- Styles -------------------------------- */
const styles = StyleSheet.create({
  container: { ...StyleSheet.absoluteFillObject, zIndex: 16 },
  touchCatcher: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 17,
    backgroundColor: "transparent",
  },

  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "transparent",
    zIndex: 18,
  },

  // Square bottom; rounded top
  card: {
    backgroundColor: DARK,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingTop: 20,
    paddingHorizontal: 18,
    paddingBottom: 42,
    marginHorizontal: 0,
    marginBottom: -10,
  },
  headerRowMain: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
    position: "relative",
  },
  collapseBtn: {
    position: "absolute",
    right: 0,
    padding: 4,
  },

  innerPanel: {
    borderWidth: 1,
    borderColor: "#1f2328",
    borderRadius: 12,
    padding: 14,
    backgroundColor: "#C0FFCB",
  },

  // INPUT WRAP
  comboWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2F2F33",
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 6,
  },

  // INPUT
  comboInput: {
    flex: 1,
    color: "#111827",
    fontSize: 14,
    lineHeight: 20,
    paddingVertical: Platform.select({ ios: 6, android: 6 }) as number,
    paddingRight: 6,
    fontFamily: "Inter",
    textAlignVertical: "center",
    includeFontPadding: false,
  },
  comboCaret: { padding: 4, marginLeft: 6 },

  navRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 12,
  },
  navBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#6EFF87",
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 0.5,
    borderColor: "#000",
  },
  navDisabled: { opacity: 0.45 },

  reviewBox: {
    marginTop: 4,
    padding: 12,
    backgroundColor: "#ffffffff",
    borderRadius: 8,
  },
  reviewRow: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  reviewValueWrap: { flexDirection: "row", alignItems: "center", gap: 8 },

  // Minimal modal backdrop
  modalBackdrop: { flex: 1, backgroundColor: BACKDROP },

  // Minimal dropdown menu
  menu: {
    position: "absolute",
    left: 10,
    right: 10,
    backgroundColor: MENU_BG,
    borderRadius: 12,
    padding: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: MENU_BORDER,
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  menuTitle: {
    marginBottom: 6,
    opacity: 0.85,
    textTransform: "none",
  },
  sep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: MENU_BORDER,
    marginLeft: 8,
    marginRight: 8,
  },
  menuItem: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    minHeight: 44,
    justifyContent: "center",
  },

  // Minimal search (vehicle menu)
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: MENU_BORDER,
    backgroundColor: "#5f5f5f1f",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    color: MENU_TEXT,
    fontSize: 14,
    lineHeight: 20,
    paddingVertical: 2,
    fontFamily: "Inter",
    textAlignVertical: "center",
    includeFontPadding: false,
  },
});
