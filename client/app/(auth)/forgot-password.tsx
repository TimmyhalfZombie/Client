import React, { useState } from "react";
import { StyleSheet, View, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Typo from "@/components/Typo";
import Button from "@/components/Button";
import BackButton from "@/components/BackButton";
import { forgotPassword } from "@/services/authService";
import { colors, spacingX, spacingY } from "@/constants/theme";
import { logger } from "@/utils/logger";

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    setMessage("");
    if (!email.trim()) {
      setMessage("Please enter your email address");
      return;
    }
    setLoading(true);
    try {
      logger.info("Attempting to send forgot password request", { email });
      const { pin } = await forgotPassword(email.trim());
      logger.info("Forgot password successful, received pin", { pin });
      setMessage("6-digit code sent! Please check your email.");
      // Navigate to verify-email with the code
      setTimeout(() => {
        router.push({
          pathname: "/(auth)/verify-email",
          params: { code: pin },
        });
      }, 1500);
    } catch (err: unknown) {
      logger.error("Forgot password error", err);
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setMessage(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Back Button */}
        <BackButton style={styles.backButton} />
        
        {/* Logo */}
        <Typo size={35} style={styles.logo} fontFamily="Candal">
          <Typo size={35} fontFamily="Candal" color={colors.green}>
            patch
          </Typo>
          <Typo size={35} fontFamily="Candal" color={colors.white}>
            {" "}up
          </Typo>
        </Typo>

        {/* Subtitle below logo */}
        <Typo
          size={14}
          fontFamily="InterLight"
          color={colors.white}
          style={styles.subLogo}
        >
          Forgot Password
        </Typo>

        {/* Instruction text */}
        <Typo
          size={16}
          fontFamily="InterLight"
          color={colors.neutral200}
          style={styles.subtitle}
        >
          Enter your email address and we'll automatically send the 6 digit code next to reset your password.
        </Typo>

        {/* Input with green border only */}
        <View style={styles.inputWrapper}>
          <Typo
            size={14}
            fontFamily="InterLight"
            color={colors.neutral200}
            style={styles.inputLabel}
          >
            Email Address
          </Typo>
          <TextInput
            style={styles.input}
            placeholder="Enter your email"
            placeholderTextColor={colors.neutral500}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
          />
        </View>

        {/* Button */}
        <Button loading={loading} onPress={handleSend} style={styles.button}>
          <Typo
            size={16}
            fontWeight="800"
            fontFamily="InterLight"
            color={colors.black}
            style={{ textAlign: "center" }}
          >
            Send Reset Code
          </Typo>
        </Button>

      

        {message ? (
          <Typo
            size={14}
            fontFamily="InterLight"
            color={colors.white}
            style={styles.message}
          >
            {message}
          </Typo>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.black,
  },
  container: {
    flex: 1,
    justifyContent: "center", 
    paddingHorizontal: spacingX._25,
    marginBottom: 120,
  },
  backButton: {
    position: "absolute",
    top: 50,
    left: spacingX._25,
    zIndex: 1,
  },
  logo: {
    textAlign: "center",
    marginBottom: spacingY._10,
    flexDirection: "row",
    justifyContent: "center",
  },
  subLogo: {
    textAlign: "center",
    marginBottom: spacingY._25,
    marginTop: -10,
  },
  subtitle: {
    textAlign: "left",
    marginBottom: spacingY._20,
    lineHeight: 20,
  },
  inputWrapper: {
    marginBottom: spacingY._20,
  },
  inputLabel: {
    textAlign: "left",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.neutral500,   
    borderRadius: 8,
    paddingVertical: spacingY._12,
    paddingHorizontal: spacingX._15,
    color: colors.white,
    fontSize: 16,
    fontFamily: "InterLight",
    backgroundColor: "transparent", 
  },

  button: {
    backgroundColor: colors.green,
    paddingVertical: spacingY._15,
    borderRadius: 8,
    marginTop: spacingY._10,
  },
  message: {
    marginTop: spacingY._15,
    textAlign: "center",
  },
});
