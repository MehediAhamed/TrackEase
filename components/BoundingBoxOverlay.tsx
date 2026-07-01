import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent, Image } from 'react-native';
import { Detection, DETECTION_COLORS } from '../types';

interface ImageLayout {
  containerW: number;
  containerH: number;
  renderedW: number;
  renderedH: number;
  offsetX: number;
  offsetY: number;
}

interface Props {
  photoUri: string;
  detections: Detection[];
  /** Which detection is currently highlighted (index) */
  highlighted?: number | null;
  onDetectionPress?: (index: number) => void;
}

/**
 * Renders the scanned image with colored bounding box overlays for each detection.
 * Correctly handles contain-mode letterboxing by computing the actual rendered image rect.
 */
export default function BoundingBoxOverlay({
  photoUri,
  detections,
  highlighted,
  onDetectionPress,
}: Props) {
  const [layout, setLayout] = useState<ImageLayout | null>(null);

  const handleContainerLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { width: containerW, height: containerH } = e.nativeEvent.layout;
      Image.getSize(
        photoUri,
        (imageW, imageH) => {
          const scale = Math.min(containerW / imageW, containerH / imageH);
          const renderedW = imageW * scale;
          const renderedH = imageH * scale;
          const offsetX = (containerW - renderedW) / 2;
          const offsetY = (containerH - renderedH) / 2;
          setLayout({ containerW, containerH, renderedW, renderedH, offsetX, offsetY });
        },
        () => {
          // Fallback: assume image fills container
          setLayout({
            containerW,
            containerH,
            renderedW: containerW,
            renderedH: containerH,
            offsetX: 0,
            offsetY: 0,
          });
        }
      );
    },
    [photoUri]
  );

  return (
    <View style={styles.container} onLayout={handleContainerLayout}>
      <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} resizeMode="contain" />

      {layout &&
        detections.map((det, idx) => {
          const color = DETECTION_COLORS[det.type] ?? '#00D4AA';
          const isHighlighted = highlighted === idx;

          const left = layout.offsetX + det.bbox.x * layout.renderedW;
          const top = layout.offsetY + det.bbox.y * layout.renderedH;
          const width = det.bbox.w * layout.renderedW;
          const height = det.bbox.h * layout.renderedH;

          return (
            <View
              key={idx}
              style={[
                styles.box,
                {
                  left,
                  top,
                  width,
                  height,
                  borderColor: color,
                  borderWidth: isHighlighted ? 3 : 2,
                  backgroundColor: isHighlighted
                    ? `${color}30`
                    : `${color}15`,
                },
              ]}
              onTouchEnd={() => onDetectionPress?.(idx)}
            >
              <View style={[styles.labelPill, { backgroundColor: color }]}>
                <Text style={styles.labelText} numberOfLines={1}>
                  {det.label}
                </Text>
              </View>
            </View>
          );
        })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  box: {
    position: 'absolute',
    borderRadius: 4,
  },
  labelPill: {
    position: 'absolute',
    top: -20,
    left: 0,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    maxWidth: 160,
  },
  labelText: {
    color: '#000',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
