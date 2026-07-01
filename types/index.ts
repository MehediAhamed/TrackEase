export interface BoundingBox {
  /** Normalized 0–1 relative to image width */
  x: number;
  /** Normalized 0–1 relative to image height */
  y: number;
  /** Normalized 0–1 width */
  w: number;
  /** Normalized 0–1 height */
  h: number;
}

export type DetectionType =
  | 'barcode'
  | 'qrcode'
  | 'seal'
  | 'text_region'
  | 'logo'
  | 'date'
  | 'serial'
  | 'batch'
  | 'other';

export interface Detection {
  label: string;
  type: DetectionType;
  /** Decoded or extracted value for this region */
  value: string;
  bbox: BoundingBox;
}

export interface ScanResult {
  detections: Detection[];
  /** Full OCR text extracted from the image */
  extracted_text: string;
  product_name: string | null;
  tracking_number: string | null;
  serial_number: string | null;
  expiry_date: string | null;
  manufacture_date: string | null;
  batch_number: string | null;
  manufacturer: string | null;
  origin_country: string | null;
  /** One-sentence summary of what was scanned */
  summary: string;
}

export type ScanStatus = 'scanning' | 'done' | 'error';

export interface Scan {
  id: string;
  photoUri: string;
  timestamp: number;
  status: ScanStatus;
  result?: ScanResult;
  error?: string;
  /** User-added tags for quick filtering */
  tags: string[];
}

/** Color mapping for each detection type */
export const DETECTION_COLORS: Record<DetectionType, string> = {
  barcode: '#00D4AA',
  qrcode: '#0066FF',
  seal: '#FF6B35',
  text_region: '#A855F7',
  logo: '#F59E0B',
  date: '#EF4444',
  serial: '#10B981',
  batch: '#06B6D4',
  other: '#6B7280',
};

export const DETECTION_ICONS: Record<DetectionType, string> = {
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
