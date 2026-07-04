import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
  Alert,
  Dimensions,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useScanStore } from '../store/scanStore';
import BoundingBoxOverlay from '../components/BoundingBoxOverlay';
import { Detection, DETECTION_COLORS, DetectionType } from '../types';

const { width, height } = Dimensions.get('window');
const IMAGE_HEIGHT = height * 0.44;

const TYPE_EMOJI: Record<DetectionType, string> = {
  barcode: '▐▌',
  qrcode: '⊞',
  seal: '◉',
  text_region: 'T',
  logo: '◈',
  date: '◷',
  serial: '#',
  batch: '⊕',
  other: '◆',
};

function MetaRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

export default function ResultScreen() {
  const { scanId } = useLocalSearchParams<{ scanId: string }>();
  const getScan = useScanStore((s) => s.getScan);
  // Subscribe to scans array so the component re-renders when a scan updates
  useScanStore((s) => s.scans);

  const scan = getScan(scanId ?? '');
  const [highlightedIdx, setHighlightedIdx] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'detections' | 'text' | 'info'>(
    'detections'
  );
  const [copied, setCopied] = useState(false);
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  // Pulse animation while scanning
  useEffect(() => {
    if (scan?.status !== 'scanning') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.5, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [scan?.status]);

  const handleCopyText = useCallback(async () => {
    if (!scan?.result?.extracted_text) return;
    await Clipboard.setStringAsync(scan.result.extracted_text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [scan?.result?.extracted_text]);

  const handleShareText = useCallback(async () => {
    if (!scan?.result) return;
    const { result } = scan;

    const lines: string[] = ['── TrackEase Scan Result ──', ''];
    if (result.summary) lines.push(`Summary: ${result.summary}`, '');
    if (result.product_name) lines.push(`Product: ${result.product_name}`);
    if (result.tracking_number) lines.push(`Tracking #: ${result.tracking_number}`);
    if (result.serial_number) lines.push(`Serial #: ${result.serial_number}`);
    if (result.batch_number) lines.push(`Batch #: ${result.batch_number}`);
    if (result.expiry_date) lines.push(`Expiry: ${result.expiry_date}`);
    if (result.manufacture_date) lines.push(`Manufactured: ${result.manufacture_date}`);
    if (result.manufacturer) lines.push(`Manufacturer: ${result.manufacturer}`);
    if (result.origin_country) lines.push(`Origin: ${result.origin_country}`);
    if (result.extracted_text) {
      lines.push('', '── Extracted Text ──', result.extracted_text);
    }

    await Share.share({ message: lines.join('\n') });
  }, [scan?.result]);

  const handleShareTracking = useCallback(async () => {
    const num = scan?.result?.tracking_number;
    if (!num) return;
    await Share.share({ message: `Tracking Number: ${num}` });
  }, [scan?.result?.tracking_number]);

  const handleRetry = useCallback(() => {
    router.back();
  }, []);

  if (!scan) {
    return (
      <LinearGradient colors={['#0A0E1A', '#0F1829']} style={styles.container}>
        <Text style={styles.errorText}>Scan not found.</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backLink}>← Go Back</Text>
        </TouchableOpacity>
      </LinearGradient>
    );
  }

  const detections: Detection[] = scan.result?.detections ?? [];
  const result = scan.result;

  return (
    <View style={styles.container}>
      {/* Image with bounding box overlay */}
      <View style={styles.imageContainer}>
        <BoundingBoxOverlay
          photoUri={scan.photoUri}
          detections={detections}
          highlighted={highlightedIdx}
          onDetectionPress={(idx) =>
            setHighlightedIdx((prev) => (prev === idx ? null : idx))
          }
        />

        {/* Scanning overlay */}
        {scan.status === 'scanning' && (
          <View style={styles.scanningOverlay}>
            <Animated.View style={[styles.scanLine, { opacity: pulseAnim }]} />
            <View style={styles.scanningBadge}>
              <ActivityIndicator size="small" color="#00D4AA" />
              <Text style={styles.scanningText}>Analyzing with AI…</Text>
            </View>
          </View>
        )}

        {/* Error overlay */}
        {scan.status === 'error' && (
          <View style={styles.errorOverlay}>
            <Text style={styles.errorOverlayIcon}>⚠</Text>
            <Text style={styles.errorOverlayText}>Analysis failed</Text>
            <TouchableOpacity onPress={handleRetry} style={styles.retryButton}>
              <Text style={styles.retryText}>Retry Scan</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Header buttons */}
        <View style={styles.imageHeader}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
            <Text style={styles.iconBtnText}>←</Text>
          </TouchableOpacity>
          <View style={styles.statusBadge}>
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor:
                    scan.status === 'done'
                      ? '#00D4AA'
                      : scan.status === 'error'
                      ? '#EF4444'
                      : '#F59E0B',
                },
              ]}
            />
            <Text style={styles.statusText}>
              {scan.status === 'done'
                ? `${detections.length} items found`
                : scan.status === 'error'
                ? 'Error'
                : 'Scanning…'}
            </Text>
          </View>
          {result && (
            <TouchableOpacity style={styles.iconBtn} onPress={handleShareText}>
              <Text style={styles.iconBtnText}>↑</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Results panel */}
      <View style={styles.panel}>
        {/* Summary */}
        {result?.summary && (
          <View style={styles.summaryBar}>
            <Text style={styles.summaryText} numberOfLines={2}>
              {result.summary}
            </Text>
          </View>
        )}

        {/* Tab switcher */}
        <View style={styles.tabs}>
          {(['detections', 'text', 'info'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === 'detections'
                  ? `Detections (${detections.length})`
                  : tab === 'text'
                  ? 'Extracted Text'
                  : 'Product Info'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
          {/* DETECTIONS TAB */}
          {activeTab === 'detections' && (
            <View style={styles.detectionList}>
              {scan.status === 'scanning' && (
                <View style={styles.loadingState}>
                  <ActivityIndicator color="#00D4AA" />
                  <Text style={styles.loadingText}>Detecting objects…</Text>
                </View>
              )}
              {detections.length === 0 && scan.status === 'done' && (
                <Text style={styles.emptyText}>No detections found.</Text>
              )}
              {detections.map((det, idx) => {
                const color = DETECTION_COLORS[det.type] ?? '#00D4AA';
                const isActive = highlightedIdx === idx;
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.detectionCard,
                      isActive && { borderColor: color, borderWidth: 1.5 },
                    ]}
                    onPress={() =>
                      setHighlightedIdx((prev) => (prev === idx ? null : idx))
                    }
                  >
                    <View style={[styles.detectionIcon, { backgroundColor: `${color}25` }]}>
                      <Text style={[styles.detectionIconText, { color }]}>
                        {TYPE_EMOJI[det.type] ?? '◆'}
                      </Text>
                    </View>
                    <View style={styles.detectionInfo}>
                      <View style={styles.detectionHeader}>
                        <Text style={styles.detectionLabel}>{det.label}</Text>
                        <View style={[styles.typePill, { backgroundColor: `${color}20` }]}>
                          <Text style={[styles.typeText, { color }]}>{det.type}</Text>
                        </View>
                      </View>
                      {det.value ? (
                        <Text style={styles.detectionValue} numberOfLines={2}>
                          {det.value}
                        </Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* TEXT TAB */}
          {activeTab === 'text' && (
            <View style={styles.textTab}>
              {scan.status === 'scanning' && (
                <View style={styles.loadingState}>
                  <ActivityIndicator color="#00D4AA" />
                  <Text style={styles.loadingText}>Extracting text…</Text>
                </View>
              )}
              {result?.extracted_text ? (
                <>
                  <View style={styles.textActions}>
                    <TouchableOpacity style={styles.actionBtn} onPress={handleCopyText}>
                      <Text style={styles.actionBtnText}>
                        {copied ? '✓ Copied!' : '⎘  Copy'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn} onPress={handleShareText}>
                      <Text style={styles.actionBtnText}>↑  Share</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.textBox}>
                    <Text style={styles.extractedText}>{result.extracted_text}</Text>
                  </View>
                </>
              ) : scan.status === 'done' ? (
                <Text style={styles.emptyText}>No text extracted.</Text>
              ) : null}
            </View>
          )}

          {/* INFO TAB */}
          {activeTab === 'info' && (
            <View style={styles.infoTab}>
              {scan.status === 'scanning' && (
                <View style={styles.loadingState}>
                  <ActivityIndicator color="#00D4AA" />
                  <Text style={styles.loadingText}>Parsing product info…</Text>
                </View>
              )}
              {result && (
                <>
                  <View style={styles.metaCard}>
                    <MetaRow label="Product" value={result.product_name} />
                    <MetaRow label="Tracking #" value={result.tracking_number} />
                    <MetaRow label="Serial #" value={result.serial_number} />
                    <MetaRow label="Batch #" value={result.batch_number} />
                    <MetaRow label="Expiry" value={result.expiry_date} />
                    <MetaRow label="Manufactured" value={result.manufacture_date} />
                    <MetaRow label="Manufacturer" value={result.manufacturer} />
                    <MetaRow label="Origin" value={result.origin_country} />
                  </View>

                  {result.tracking_number && (
                    <TouchableOpacity
                      style={styles.shareTrackingBtn}
                      onPress={handleShareTracking}
                    >
                      <LinearGradient
                        colors={['#00D4AA', '#0066FF']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.shareTrackingGradient}
                      >
                        <Text style={styles.shareTrackingText}>
                          ↑  Share Tracking Number
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={styles.shareTrackingBtn}
                    onPress={handleShareText}
                  >
                    <View style={styles.shareAllBtn}>
                      <Text style={styles.shareAllText}>↑  Share Full Report</Text>
                    </View>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}

          <View style={{ height: 48 }} />
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E1A',
  },
  imageContainer: {
    height: IMAGE_HEIGHT,
    backgroundColor: '#000',
    position: 'relative',
  },
  imageHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 52,
    paddingHorizontal: 16,
    zIndex: 30,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '700',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  scanningOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#00D4AA',
    shadowColor: '#00D4AA',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
    top: '50%',
  },
  scanningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  scanningText: {
    color: '#00D4AA',
    fontSize: 14,
    fontWeight: '600',
  },
  errorOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  errorOverlayIcon: {
    fontSize: 40,
    color: '#EF4444',
    marginBottom: 8,
  },
  errorOverlayText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#EF4444',
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  retryText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
  panel: {
    flex: 1,
    backgroundColor: '#0A0E1A',
  },
  summaryBar: {
    backgroundColor: '#131929',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#00D4AA',
  },
  summaryText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#131929',
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 9,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#1E2D3D',
  },
  tabText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#00D4AA',
  },
  tabContent: {
    flex: 1,
    marginTop: 8,
  },
  detectionList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  detectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#131929',
    borderRadius: 12,
    padding: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  detectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detectionIconText: {
    fontSize: 18,
    fontWeight: '700',
  },
  detectionInfo: {
    flex: 1,
  },
  detectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  detectionLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  typePill: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  typeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detectionValue: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    lineHeight: 17,
  },
  textTab: {
    paddingHorizontal: 16,
  },
  textActions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: '#131929',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,212,170,0.3)',
  },
  actionBtnText: {
    color: '#00D4AA',
    fontSize: 14,
    fontWeight: '700',
  },
  textBox: {
    backgroundColor: '#0F1829',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  extractedText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    lineHeight: 20,
    fontFamily: 'monospace',
  },
  infoTab: {
    paddingHorizontal: 16,
  },
  metaCard: {
    backgroundColor: '#131929',
    borderRadius: 16,
    padding: 4,
    marginBottom: 16,
    overflow: 'hidden',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  metaLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flex: 0.4,
  },
  metaValue: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    flex: 0.6,
    textAlign: 'right',
  },
  shareTrackingBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
  },
  shareTrackingGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  shareTrackingText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '800',
  },
  shareAllBtn: {
    backgroundColor: '#131929',
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,212,170,0.3)',
  },
  shareAllText: {
    color: '#00D4AA',
    fontSize: 15,
    fontWeight: '700',
  },
  loadingState: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 20,
  },
  loadingText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 14,
    textAlign: 'center',
    padding: 24,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 40,
  },
  backLink: {
    color: '#00D4AA',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 16,
  },
});
