import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  Share,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useScanStore } from '../store/scanStore';
import { Scan } from '../types';

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  const now = Date.now();
  const diff = now - ts;
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function statusColor(status: Scan['status']): string {
  return status === 'done' ? '#00D4AA' : status === 'error' ? '#EF4444' : '#F59E0B';
}

interface ScanCardProps {
  scan: Scan;
  onPress: () => void;
  onDelete: () => void;
  onShare: () => void;
}

function ScanCard({ scan, onPress, onDelete, onShare }: ScanCardProps) {
  const result = scan.result;
  const detectionCount = result?.detections?.length ?? 0;
  const preview =
    result?.tracking_number ??
    result?.product_name ??
    result?.serial_number ??
    result?.summary ??
    (scan.status === 'error' ? scan.error : null) ??
    'Scanning…';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <Image source={{ uri: scan.photoUri }} style={styles.cardThumb} resizeMode="cover" />

      <View style={styles.cardBody}>
        <View style={styles.cardTopRow}>
          <View style={[styles.statusDot, { backgroundColor: statusColor(scan.status) }]} />
          <Text style={styles.cardTime}>{formatTimestamp(scan.timestamp)}</Text>
          {detectionCount > 0 && (
            <View style={styles.detectionBadge}>
              <Text style={styles.detectionBadgeText}>{detectionCount} found</Text>
            </View>
          )}
        </View>

        <Text style={styles.cardPreview} numberOfLines={2}>
          {preview}
        </Text>

        {scan.tags.length > 0 && (
          <View style={styles.tagRow}>
            {scan.tags.map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.cardAction} onPress={onShare}>
          <Text style={styles.cardActionIcon}>↑</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.cardAction, styles.cardActionDelete]} onPress={onDelete}>
          <Text style={styles.cardActionIcon}>✕</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

export default function HistoryScreen() {
  const scans = useScanStore((s) => s.scans);
  const deleteScan = useScanStore((s) => s.deleteScan);
  const [query, setQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'done' | 'error'>('all');

  const filtered = useMemo(() => {
    return scans.filter((s) => {
      if (filterStatus !== 'all' && s.status !== filterStatus) return false;
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      const r = s.result;
      return (
        r?.tracking_number?.toLowerCase().includes(q) ||
        r?.product_name?.toLowerCase().includes(q) ||
        r?.serial_number?.toLowerCase().includes(q) ||
        r?.manufacturer?.toLowerCase().includes(q) ||
        r?.extracted_text?.toLowerCase().includes(q) ||
        r?.summary?.toLowerCase().includes(q) ||
        s.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [scans, query, filterStatus]);

  const handleDelete = (id: string) => {
    Alert.alert('Delete Scan', 'Remove this scan from history?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteScan(id) },
    ]);
  };

  const handleShare = async (scan: Scan) => {
    const r = scan.result;
    if (!r) return;
    const lines: string[] = ['── TrackEase Scan ──', ''];
    if (r.summary) lines.push(r.summary, '');
    if (r.tracking_number) lines.push(`Tracking #: ${r.tracking_number}`);
    if (r.serial_number) lines.push(`Serial #: ${r.serial_number}`);
    if (r.product_name) lines.push(`Product: ${r.product_name}`);
    if (r.expiry_date) lines.push(`Expiry: ${r.expiry_date}`);
    if (r.manufacturer) lines.push(`Manufacturer: ${r.manufacturer}`);
    await Share.share({ message: lines.join('\n') });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#0A0E1A', '#0F1829']} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>←</Text>
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Scan History</Text>
            <Text style={styles.headerSub}>{scans.length} total scans</Text>
          </View>
          <TouchableOpacity
            style={styles.newScanBtn}
            onPress={() => router.back()}
          >
            <Text style={styles.newScanText}>+ Scan</Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchRow}>
          <Text style={styles.searchIcon}>⊙</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by product, tracking #, text…"
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Text style={styles.clearBtn}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Filter chips */}
        <View style={styles.filterRow}>
          {(['all', 'done', 'error'] as const).map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, filterStatus === f && styles.filterChipActive]}
              onPress={() => setFilterStatus(f)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  filterStatus === f && styles.filterChipTextActive,
                ]}
              >
                {f === 'all' ? 'All' : f === 'done' ? '✓ Done' : '⚠ Error'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </LinearGradient>

      {/* Scan list */}
      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📦</Text>
          <Text style={styles.emptyTitle}>
            {scans.length === 0 ? 'No Scans Yet' : 'No Results'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {scans.length === 0
              ? 'Scan a product label, barcode, or seal to get started.'
              : 'Try a different search term or filter.'}
          </Text>
          {scans.length === 0 && (
            <TouchableOpacity style={styles.startScanBtn} onPress={() => router.back()}>
              <LinearGradient
                colors={['#00D4AA', '#0066FF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.startScanGradient}
              >
                <Text style={styles.startScanText}>Start Scanning</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ScanCard
              scan={item}
              onPress={() =>
                router.push({ pathname: '/result', params: { scanId: item.id } })
              }
              onDelete={() => handleDelete(item.id)}
              onShare={() => handleShare(item)}
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E1A',
  },
  header: {
    paddingTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  headerSub: {
    fontSize: 11,
    color: '#00D4AA',
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  newScanBtn: {
    backgroundColor: '#00D4AA',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  newScanText: {
    color: '#000',
    fontWeight: '800',
    fontSize: 13,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#131929',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    gap: 10,
  },
  searchIcon: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 16,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    padding: 0,
  },
  clearBtn: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 14,
    padding: 4,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: '#131929',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  filterChipActive: {
    backgroundColor: 'rgba(0,212,170,0.15)',
    borderColor: '#00D4AA',
  },
  filterChipText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#00D4AA',
  },
  list: {
    padding: 16,
    paddingTop: 12,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#131929',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  cardThumb: {
    width: 80,
    height: 90,
  },
  cardBody: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  cardTime: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontWeight: '500',
    flex: 1,
  },
  detectionBadge: {
    backgroundColor: 'rgba(0,212,170,0.15)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  detectionBadgeText: {
    color: '#00D4AA',
    fontSize: 10,
    fontWeight: '700',
  },
  cardPreview: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    lineHeight: 17,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 6,
  },
  tag: {
    backgroundColor: 'rgba(0,102,255,0.2)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tagText: {
    color: '#5B9CF6',
    fontSize: 10,
    fontWeight: '600',
  },
  cardActions: {
    justifyContent: 'space-around',
    paddingVertical: 8,
    paddingHorizontal: 8,
    gap: 4,
  },
  cardAction: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(0,212,170,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardActionDelete: {
    backgroundColor: 'rgba(239,68,68,0.15)',
  },
  cardActionIcon: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 72,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 10,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  startScanBtn: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  startScanGradient: {
    paddingVertical: 16,
    paddingHorizontal: 40,
  },
  startScanText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '800',
  },
});
