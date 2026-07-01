import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Alert,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useScanStore } from '../store/scanStore';
import { vlmRunService } from '../services/vlmrun';
import * as ImagePicker from 'expo-image-picker';

type CameraType = 'front' | 'back';
const { CameraView, useCameraPermissions } =
  Platform.OS !== 'web'
    ? (require('expo-camera') as typeof import('expo-camera'))
    : {
        CameraView: null as any,
        useCameraPermissions: () =>
          [null, async () => ({ granted: false })] as any,
      };

const { width } = Dimensions.get('window');

export default function CameraScreen() {
  if (Platform.OS === 'web') {
    return (
      <LinearGradient
        colors={['#0A0E1A', '#0F1829']}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}
      >
        <Text style={{ fontSize: 64, marginBottom: 24 }}>📱</Text>
        <Text
          style={{
            fontSize: 26,
            fontWeight: '800',
            color: '#FFFFFF',
            textAlign: 'center',
            marginBottom: 12,
          }}
        >
          Mobile Only
        </Text>
        <Text
          style={{
            fontSize: 15,
            color: 'rgba(255,255,255,0.55)',
            textAlign: 'center',
            lineHeight: 24,
          }}
        >
          TrackEase requires a phone camera.{'\n'}Scan the QR code with Expo Go.
        </Text>
      </LinearGradient>
    );
  }
  return <NativeCameraScreen />;
}

function NativeCameraScreen() {
  const [facing, setFacing] = useState<CameraType>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [isCapturing, setIsCapturing] = useState(false);
  const [flash, setFlash] = useState<'off' | 'on'>('off');
  const cameraRef = useRef<any>(null);

  const createScan = useScanStore((s) => s.createScan);
  const updateScan = useScanStore((s) => s.updateScan);

  const startAnalysis = useCallback(
    async (scanId: string, photoUri: string) => {
      try {
        const result = await vlmRunService.scanProduct(photoUri);
        updateScan(scanId, 'done', result);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Analysis failed';
        updateScan(scanId, 'error', undefined, message);
      }
    },
    [updateScan]
  );

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || isCapturing) return;
    setIsCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        base64: false,
        skipProcessing: false,
      });
      if (!photo?.uri) {
        Alert.alert('Error', 'Failed to capture photo. Please try again.');
        return;
      }
      const scan = createScan(photo.uri);
      router.push({ pathname: '/result', params: { scanId: scan.id } });
      startAnalysis(scan.id, photo.uri);
    } catch {
      Alert.alert('Error', 'Could not take photo. Please try again.');
    } finally {
      setIsCapturing(false);
    }
  }, [isCapturing, createScan, startAnalysis]);

  const handlePickFromGallery = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets[0]?.uri) return;
    const uri = result.assets[0].uri;
    const scan = createScan(uri);
    router.push({ pathname: '/result', params: { scanId: scan.id } });
    startAnalysis(scan.id, uri);
  }, [createScan, startAnalysis]);

  if (!permission) {
    return (
      <LinearGradient colors={['#0A0E1A', '#0F1829']} style={styles.container}>
        <Text style={styles.permissionText}>Checking camera permissions…</Text>
      </LinearGradient>
    );
  }

  if (!permission.granted) {
    return (
      <LinearGradient colors={['#0A0E1A', '#0F1829']} style={styles.container}>
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionEmoji}>📷</Text>
          <Text style={styles.permissionTitle}>Camera Access Needed</Text>
          <Text style={styles.permissionSubtitle}>
            TrackEase needs camera access to scan product labels, barcodes, and seals.
          </Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={requestPermission}
          >
            <LinearGradient
              colors={['#00D4AA', '#0066FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.permissionButtonGradient}
            >
              <Text style={styles.permissionButtonText}>Grant Access</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        flash={flash}
      />

      {/* Top gradient + header */}
      <LinearGradient
        colors={['rgba(10,14,26,0.9)', 'transparent']}
        style={styles.topOverlay}
        pointerEvents="none"
      />
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.push('/history')}
        >
          <Text style={styles.headerButtonIcon}>🗂</Text>
          <Text style={styles.headerButtonLabel}>History</Text>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>TrackEase</Text>
          <Text style={styles.headerSubtitle}>Scan • Identify • Track</Text>
        </View>

        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => setFlash((f) => (f === 'off' ? 'on' : 'off'))}
        >
          <Text style={styles.headerButtonIcon}>{flash === 'on' ? '⚡' : '🔦'}</Text>
          <Text style={styles.headerButtonLabel}>
            {flash === 'on' ? 'Flash On' : 'Flash Off'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Scanner guide frame */}
      <View style={styles.guideContainer} pointerEvents="none">
        <View style={styles.guideFrame}>
          {/* Corner markers */}
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </View>
        <Text style={styles.guideText}>Position label or barcode in frame</Text>

        {/* Scan type hints */}
        <View style={styles.hintRow}>
          {['Barcode', 'QR Code', 'Product Seal', 'Label'].map((hint) => (
            <View key={hint} style={styles.hintPill}>
              <Text style={styles.hintText}>{hint}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Bottom gradient + controls */}
      <LinearGradient
        colors={['transparent', 'rgba(10,14,26,0.97)']}
        style={styles.bottomOverlay}
        pointerEvents="none"
      />
      <View style={styles.bottomControls}>
        <TouchableOpacity
          style={styles.sideButton}
          onPress={handlePickFromGallery}
        >
          <Text style={styles.sideButtonIcon}>🖼</Text>
          <Text style={styles.sideButtonLabel}>Gallery</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.captureButton, isCapturing && styles.captureButtonActive]}
          onPress={handleCapture}
          disabled={isCapturing}
        >
          <LinearGradient
            colors={isCapturing ? ['#1A2A3A', '#2A3A4A'] : ['#00D4AA', '#0066FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.captureButtonInner}
          >
            <Text style={styles.captureIcon}>{isCapturing ? '⏳' : '⊙'}</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.sideButton}
          onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
        >
          <Text style={styles.sideButtonIcon}>{facing === 'back' ? '📷' : '🤳'}</Text>
          <Text style={styles.sideButtonLabel}>
            {facing === 'back' ? 'Rear' : 'Front'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const GUIDE_SIZE = width * 0.78;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E1A',
  },
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 140,
    zIndex: 10,
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 220,
    zIndex: 10,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 12,
    zIndex: 20,
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 10,
    color: '#00D4AA',
    fontWeight: '600',
    letterSpacing: 1.5,
    marginTop: 2,
  },
  headerButton: {
    alignItems: 'center',
    padding: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    minWidth: 62,
  },
  headerButtonIcon: {
    fontSize: 18,
  },
  headerButtonLabel: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  guideContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  guideFrame: {
    width: GUIDE_SIZE,
    height: GUIDE_SIZE * 0.65,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: '#00D4AA',
    borderWidth: 3,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 6,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 6,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 6,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 6,
  },
  guideText: {
    marginTop: 20,
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  hintRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginTop: 14,
    paddingHorizontal: 24,
  },
  hintPill: {
    backgroundColor: 'rgba(0,212,170,0.15)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,212,170,0.4)',
  },
  hintText: {
    color: '#00D4AA',
    fontSize: 11,
    fontWeight: '600',
  },
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: 52,
    paddingHorizontal: 28,
    zIndex: 20,
  },
  captureButton: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 4,
    borderColor: 'rgba(0,212,170,0.4)',
    overflow: 'hidden',
  },
  captureButtonActive: {
    borderColor: 'rgba(255,255,255,0.3)',
    opacity: 0.7,
  },
  captureButtonInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureIcon: {
    fontSize: 38,
    color: '#FFF',
    fontWeight: '900',
  },
  sideButton: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideButtonIcon: {
    fontSize: 22,
  },
  sideButtonLabel: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '600',
    marginTop: 2,
  },
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  permissionEmoji: {
    fontSize: 80,
    marginBottom: 24,
  },
  permissionTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  permissionSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
  },
  permissionButton: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  permissionButtonGradient: {
    paddingVertical: 18,
    paddingHorizontal: 48,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  permissionText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
    textAlign: 'center',
  },
});
