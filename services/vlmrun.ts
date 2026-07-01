import * as FileSystem from 'expo-file-system/legacy';
import { ScanResult, Detection, DetectionType } from '../types';

const DEFAULT_BASE_URL = 'https://api.vlm.run/v1';
const DEFAULT_MODEL = 'vlmrun-orion-1:pro';
const FALLBACK_API_KEY = 'sk-zuAieRhJ42MXy919LWZZlV6Y00rp3_';

const API_KEY = process.env.EXPO_PUBLIC_VLMRUN_API_KEY || FALLBACK_API_KEY;
const BASE_URL = (process.env.EXPO_PUBLIC_VLMRUN_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, '');

/**
 * Structured JSON schema for product/label scanning.
 * Instructs VLM Run to return bounding boxes, OCR text, and product metadata.
 */
const SCAN_JSON_SCHEMA = {
  type: 'object',
  properties: {
    detections: {
      type: 'array',
      description: 'Array of all detected elements with their bounding boxes',
      items: {
        type: 'object',
        properties: {
          label: {
            type: 'string',
            description: 'Human-readable label for this detection (e.g. "Barcode", "QR Code", "Expiry Date", "Serial Number", "Product Seal", "Brand Logo")',
          },
          type: {
            type: 'string',
            enum: ['barcode', 'qrcode', 'seal', 'text_region', 'logo', 'date', 'serial', 'batch', 'other'],
            description: 'Category of this detection',
          },
          value: {
            type: 'string',
            description: 'The decoded barcode number, extracted text, date string, or other value for this region',
          },
          bbox: {
            type: 'object',
            description: 'Normalized bounding box (0.0 to 1.0) relative to image dimensions',
            properties: {
              x: { type: 'number', description: 'Left edge as fraction of image width' },
              y: { type: 'number', description: 'Top edge as fraction of image height' },
              w: { type: 'number', description: 'Width as fraction of image width' },
              h: { type: 'number', description: 'Height as fraction of image height' },
            },
            required: ['x', 'y', 'w', 'h'],
            additionalProperties: false,
          },
        },
        required: ['label', 'type', 'value', 'bbox'],
        additionalProperties: false,
      },
    },
    extracted_text: {
      type: 'string',
      description: 'Complete OCR text extracted from the entire image, preserving layout as much as possible',
    },
    product_name: {
      type: ['string', 'null'],
      description: 'Product name or brand name if identifiable',
    },
    tracking_number: {
      type: ['string', 'null'],
      description: 'Primary tracking number, barcode value, or shipment ID',
    },
    serial_number: {
      type: ['string', 'null'],
      description: 'Serial number or unique product identifier',
    },
    expiry_date: {
      type: ['string', 'null'],
      description: 'Expiry or best-before date in ISO format if found',
    },
    manufacture_date: {
      type: ['string', 'null'],
      description: 'Manufacturing or production date if found',
    },
    batch_number: {
      type: ['string', 'null'],
      description: 'Batch or lot number if found',
    },
    manufacturer: {
      type: ['string', 'null'],
      description: 'Manufacturer or company name',
    },
    origin_country: {
      type: ['string', 'null'],
      description: 'Country of origin if mentioned',
    },
    summary: {
      type: 'string',
      description: 'One-sentence summary describing what was scanned and the key information found',
    },
  },
  required: [
    'detections',
    'extracted_text',
    'product_name',
    'tracking_number',
    'serial_number',
    'expiry_date',
    'manufacture_date',
    'batch_number',
    'manufacturer',
    'origin_country',
    'summary',
  ],
  additionalProperties: false,
};

function responseFormat(schema: object) {
  return { type: 'json_schema', schema };
}

const SCAN_PROMPT = `You are a product label and barcode scanning AI.

Analyze this image of a product, package, seal, or label. Your task:

1. DETECT all trackable elements: barcodes (1D/2D), QR codes, product seals, serial numbers, batch numbers, expiry dates, manufacture dates, logos, and text regions containing important data. For each detection provide a precise normalized bounding box (x, y, w, h as fractions 0.0–1.0 of the image dimensions).

2. EXTRACT all visible text via OCR — preserve the full content.

3. IDENTIFY key product metadata: product name, tracking/barcode numbers, serial numbers, dates, manufacturer, and country of origin.

4. SUMMARIZE what you found in one clear sentence.

Be thorough — detect every barcode, label region, and text block that could be useful for product tracking.`;

export class VlmRunService {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey?: string, baseUrl?: string) {
    this.apiKey = apiKey ?? API_KEY;
    this.baseUrl = (baseUrl ?? BASE_URL).replace(/\/$/, '');
  }

  private headers() {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  /** Convert a local file URI to a base64 data URI for the API. */
  private async toBase64DataUri(localUri: string): Promise<string> {
    if (localUri.startsWith('data:')) return localUri;
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return `data:image/jpeg;base64,${base64}`;
  }

  /**
   * Scan a product image: detect bounding boxes, extract OCR text, and parse
   * product metadata using VLM Run's /openai/chat/completions endpoint.
   */
  async scanProduct(photoUri: string): Promise<ScanResult> {
    const imageData = await this.toBase64DataUri(photoUri);

    const body = {
      model: DEFAULT_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: SCAN_PROMPT },
            { type: 'image_url', image_url: { url: imageData } },
          ],
        },
      ],
      toolsets: ['image'],
      response_format: responseFormat(SCAN_JSON_SCHEMA),
    };

    const response = await fetch(`${this.baseUrl}/openai/chat/completions`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`VLM Run API error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const rawContent: string = data?.choices?.[0]?.message?.content ?? '';

    let parsed: ScanResult;
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      throw new Error(`Failed to parse VLM Run response: ${rawContent.slice(0, 300)}`);
    }

    // Validate and clamp bounding box values to [0, 1]
    if (Array.isArray(parsed.detections)) {
      parsed.detections = parsed.detections
        .filter((d) => d.bbox)
        .map((d) => ({
          ...d,
          bbox: {
            x: Math.max(0, Math.min(1, d.bbox.x)),
            y: Math.max(0, Math.min(1, d.bbox.y)),
            w: Math.max(0, Math.min(1, d.bbox.w)),
            h: Math.max(0, Math.min(1, d.bbox.h)),
          },
        }));
    }

    return parsed;
  }
}

export const vlmRunService = new VlmRunService();
