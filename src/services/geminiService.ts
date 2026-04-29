/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";
import { ExtractedReceipt } from "../types";

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || '' 
});

const receiptSchema = {
  type: Type.OBJECT,
  properties: {
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "Detailed name of the item" },
          quantity: { type: Type.NUMBER, description: "Quantity of the item" },
          price: { type: Type.NUMBER, description: "Total price for this line item (e.g. 11.92)" },
          category: { type: Type.STRING, description: "One of: Grocery, Electronics, Household, Clothing, Personal Care, Pet, Pharmacy, Kitchen, Entertainment, Other" }
        },
        required: ["name", "quantity", "price", "category"]
      }
    },
    subtotal: { type: Type.NUMBER, description: "The subtotal before taxes and fees" },
    tax: { type: Type.NUMBER, description: "Total tax amount" },
    merchantName: { type: Type.STRING, description: "Name of the store or merchant" },
    tip: { type: Type.NUMBER, description: "Driver tip or service tip" },
    fees: { type: Type.NUMBER, description: "Total of other fees like bag fees or delivery fees" },
    total: { type: Type.NUMBER, description: "The final total amount charged" },
    date: { type: Type.STRING, description: "ISO format date if possible, otherwise as seen on receipt" },
    orderNumber: { type: Type.STRING },
    currency: { type: Type.STRING, description: "Three letter currency code, e.g. USD" }
  },
  required: ["items", "subtotal", "tax", "total", "date", "currency"]
};

export async function processReceipt(file: File): Promise<ExtractedReceipt> {
  const base64Data = await fileToBase64(file);
  
  const prompt = `
    Extract all information from this receipt. 
    Focus on merchant name, items, quantities, prices, and totals. 
    Categorize each item into one of the provided categories based on its name.
    IMPORTANT: If any items have "Unavailable" or similar written next to them, completely ignore and exclude them from the extracted items list. Do not include them in the bill.
    If multiple people are intended to share items (not visible on receipt but common sense), just extract the raw data for now.
    Return the data in a structured JSON format.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: file.type,
                data: base64Data,
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: receiptSchema as any,
      },
    });

    const result = JSON.parse(response.text || '{}');
    
    // Add unique IDs to items
    if (result.items) {
      result.items = result.items.map((item: any) => ({
        ...item,
        id: crypto.randomUUID(),
        splitWith: [], // Initially not split
      }));
    }

    return result as ExtractedReceipt;
  } catch (error) {
    console.error("Error processing receipt:", error);
    throw new Error("Failed to process receipt with AI. Please try again.");
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64String = reader.result?.toString().split(',')[1];
      if (base64String) resolve(base64String);
      else reject(new Error("Failed to convert file to base64"));
    };
    reader.onerror = (error) => reject(error);
  });
}
