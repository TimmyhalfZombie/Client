// client/components/ErrorBoundary.tsx
import React, { Component, ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import Typo from './Typo';
import Button from './Button';
import { colors, spacingX, spacingY } from '@/constants/theme';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    // Log error to your error reporting service
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View style={styles.container}>
          <Typo size={24} fontWeight="bold" color={colors.white} style={styles.title}>
            Oops! Something went wrong
          </Typo>
          
          <Typo size={16} color={colors.neutral200} style={styles.message}>
            We're sorry, but something unexpected happened. Please try again.
          </Typo>

          {__DEV__ && this.state.error && (
            <Typo size={12} color={colors.neutral500} style={styles.errorDetails}>
              {this.state.error.message}
            </Typo>
          )}

          <Button onPress={this.handleReset} style={styles.button}>
            <Typo size={16} fontWeight="bold" color={colors.black}>
              Try Again
            </Typo>
          </Button>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacingX._25,
    backgroundColor: colors.black,
  },
  title: {
    textAlign: 'center',
    marginBottom: spacingY._15,
  },
  message: {
    textAlign: 'center',
    marginBottom: spacingY._20,
    lineHeight: 22,
  },
  errorDetails: {
    textAlign: 'center',
    marginBottom: spacingY._20,
    fontFamily: 'monospace',
  },
  button: {
    backgroundColor: colors.green,
    paddingVertical: spacingY._15,
    paddingHorizontal: spacingX._30,
    borderRadius: 8,
  },
});
