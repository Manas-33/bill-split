/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Anthropic from '@anthropic-ai/sdk';
import { CATEGORIES, ExtractedReceipt } from '../types';

// SECURITY NOTE: Running the Anthropic SDK in the browser exposes the API key
// to anyone who opens DevTools or downloads the bundle. This mirrors the
// existing Gemini setup, which has the same exposure. For production use,
// proxy these calls through a backend (e.g. a Firebase Function) and remove
// `dangerouslyAllowBrowser`.
const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
  dangerouslyAllowBrowser: true,
});

const MODEL = 'claude-sonnet-4-6';

const SUPPORTED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

const SUPPORTED_DOC_TYPES = new Set(['application/pdf']);

const receiptSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    merchantName: {
      type: 'string',
      description: 'Name of the store or merchant',
    },
    items: {
      type: 'array',
      description: 'Line items extracted from the receipt',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string', description: 'Detailed name of the item' },
          quantity: { type: 'number', description: 'Quantity of the item' },
          price: {
            type: 'number',
            description: 'Total price for this line item (e.g. 11.92)',
          },
          category: {
            type: 'string',
            enum: CATEGORIES,
            description: 'Best-fit category for this item',
          },
        },
        required: ['name', 'quantity', 'price', 'category'],
      },
    },
    subtotal: {
      type: 'number',
      description: 'The subtotal before taxes and fees',
    },
    tax: { type: 'number', description: 'Total tax amount' },
    tip: { type: 'number', description: 'Driver tip or service tip' },
    fees: {
      type: 'number',
      description: 'Total of other fees like bag fees or delivery fees',
    },
    total: { type: 'number', description: 'The final total amount charged' },
    date: {
      type: 'string',
      description: 'ISO format date (YYYY-MM-DD) if possible, otherwise as seen on receipt',
    },
    orderNumber: { type: 'string', description: 'Order number if present' },
    currency: {
      type: 'string',
      description: 'Three letter currency code, e.g. USD',
    },
  },
  required: [
    'merchantName',
    'items',
    'subtotal',
    'tax',
    'tip',
    'fees',
    'total',
    'date',
    'orderNumber',
    'currency',
  ],
} as const;

const SYSTEM_PROMPT = `You extract structured data from retail and restaurant receipts.

Rules:
- Identify merchant name, line items (name, quantity, line total), tax, tip, fees, subtotal, and total.
- If items have "Unavailable" or similar markers, EXCLUDE them entirely.
- Categorize each item into exactly one of: ${CATEGORIES.join(', ')}.
- Use 0 for tax, tip, or fees that are not present on the receipt.
- Use an empty string for orderNumber if not present.
- Prefer ISO format (YYYY-MM-DD) for the date when possible.
- Currency must be a three letter code (e.g. USD, EUR, GBP); default to USD if not visible.
- Return prices as plain numbers (no currency symbols).`;

type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

interface FileSource {
  kind: 'image' | 'document';
  mediaType: ImageMediaType | 'application/pdf';
  data: string;
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result?.toString().split(',')[1];
      if (base64) resolve(base64);
      else reject(new Error('Failed to convert file to base64'));
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

async function fileToSource(file: File): Promise<FileSource> {
  if (SUPPORTED_IMAGE_TYPES.has(file.type)) {
    const data = await fileToBase64(file);
    return { kind: 'image', mediaType: file.type as ImageMediaType, data };
  }
  if (SUPPORTED_DOC_TYPES.has(file.type)) {
    const data = await fileToBase64(file);
    return { kind: 'document', mediaType: 'application/pdf', data };
  }
  throw new Error(
    `Unsupported file type: ${file.type || 'unknown'}. Use JPEG, PNG, GIF, WebP, or PDF.`
  );
}

export async function processReceipt(file: File): Promise<ExtractedReceipt> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      'Missing ANTHROPIC_API_KEY. Add it to .env.local and restart the dev server.'
    );
  }

  const source = await fileToSource(file);
  const fileBlock: Anthropic.ImageBlockParam | Anthropic.DocumentBlockParam =
    source.kind === 'image'
      ? {
          type: 'image',
          source: {
            type: 'base64',
            media_type: source.mediaType as ImageMediaType,
            data: source.data,
          },
        }
      : {
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: source.data,
          },
        };

  let response;
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      thinking: { type: 'adaptive' },
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          // No-op below the cache prefix minimum (4096 tokens for Opus 4.7),
          // but ready if/when the prompt grows.
          cache_control: { type: 'ephemeral' },
        },
      ],
      output_config: {
        format: {
          type: 'json_schema',
          schema: receiptSchema,
        },
      },
      messages: [
        {
          role: 'user',
          content: [
            fileBlock,
            {
              type: 'text',
              text: 'Extract the receipt data. Return JSON matching the provided schema.',
            },
          ],
        },
      ],
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      throw new Error('Invalid Anthropic API key. Check ANTHROPIC_API_KEY.');
    }
    if (err instanceof Anthropic.RateLimitError) {
      throw new Error('Rate limited by Claude API. Please try again shortly.');
    }
    if (err instanceof Anthropic.APIError) {
      throw new Error(`Claude API error (${err.status}): ${err.message}`);
    }
    throw err;
  }

  if (response.stop_reason === 'refusal') {
    throw new Error('Claude declined to process this receipt.');
  }
  if (response.stop_reason === 'max_tokens') {
    throw new Error(
      'Receipt too large to extract in one pass. Try a clearer or smaller image.'
    );
  }

  const textBlock = response.content.find(
    (b): b is Anthropic.TextBlock => b.type === 'text'
  );
  if (!textBlock?.text) {
    throw new Error('Claude returned an empty response.');
  }

  let parsed: any;
  try {
    parsed = JSON.parse(textBlock.text);
  } catch {
    throw new Error('Claude returned invalid JSON. Try a clearer photo.');
  }

  const items = Array.isArray(parsed.items)
    ? parsed.items.map((item: any) => ({
        id: crypto.randomUUID(),
        name: String(item.name ?? ''),
        quantity: Number(item.quantity) || 1,
        price: Number(item.price) || 0,
        category: CATEGORIES.includes(item.category) ? item.category : 'Other',
        splitWith: [] as string[],
      }))
    : [];

  return {
    items,
    subtotal: Number(parsed.subtotal) || 0,
    tax: Number(parsed.tax) || 0,
    tip: Number(parsed.tip) || 0,
    fees: Number(parsed.fees) || 0,
    total: Number(parsed.total) || 0,
    date: String(parsed.date ?? ''),
    merchantName: parsed.merchantName ? String(parsed.merchantName) : undefined,
    orderNumber: parsed.orderNumber ? String(parsed.orderNumber) : undefined,
    currency: String(parsed.currency || 'USD'),
  };
}
