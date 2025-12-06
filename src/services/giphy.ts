// src/services/giphy.ts
import { GiphyFetch } from '@giphy/js-fetch-api';
import { config } from '../config.js';

// Initialize GIPHY client (uses API key if provided)
const gf = config.giphy.apiKey ? new GiphyFetch(config.giphy.apiKey) : null;

// Curated money/finance GIF search terms
const MONEY_SEARCH_TERMS = [
  'money rain',
  'cash money',
  'counting money',
  'rich',
  'payday',
  'saving money',
  'piggy bank',
  'wallet',
];

// Fallback GIFs (direct GIPHY MP4 URLs) in case API is not configured
const FALLBACK_GIFS = [
  'https://media.giphy.com/media/LdOyjZ7io5Msw/giphy.mp4', // Money rain
  'https://media.giphy.com/media/l0HFkA6omUyjVYqw8/giphy.mp4', // Make it rain
  'https://media.giphy.com/media/67ThRZlYBvibtdF9JH/giphy.mp4', // Money
  'https://media.giphy.com/media/xTiTnqUxyWbsAXq7Ju/giphy.mp4', // Cash
  'https://media.giphy.com/media/3oKIPdGYRGEby6jQwE/giphy.mp4', // Money flying
];

export interface GifResult {
  mp4Url: string;
  gifUrl: string;
  title: string;
}

/**
 * Get a random money-related GIF
 */
export async function getRandomMoneyGif(): Promise<GifResult | null> {
  // If GIPHY API key is configured, use the API
  if (gf) {
    try {
      const searchTerm = MONEY_SEARCH_TERMS[Math.floor(Math.random() * MONEY_SEARCH_TERMS.length)];
      const { data } = await gf.search(searchTerm, {
        limit: 25,
        rating: 'g', // Keep it family-friendly
      });

      if (data.length > 0) {
        const randomGif = data[Math.floor(Math.random() * data.length)];
        return {
          mp4Url: randomGif.images.original_mp4?.mp4 || randomGif.images.fixed_height.mp4 || '',
          gifUrl: randomGif.images.original.url,
          title: randomGif.title,
        };
      }
    } catch (error) {
      console.error('GIPHY API error:', error);
    }
  }

  // Fallback to curated GIFs
  const randomFallback = FALLBACK_GIFS[Math.floor(Math.random() * FALLBACK_GIFS.length)];
  return {
    mp4Url: randomFallback,
    gifUrl: randomFallback.replace('.mp4', '.gif'),
    title: 'Money GIF',
  };
}

/**
 * Get a specific category GIF
 */
export async function getGifByCategory(category: 'welcome' | 'expense' | 'summary' | 'split'): Promise<GifResult | null> {
  const categoryTerms: Record<string, string[]> = {
    welcome: ['welcome money', 'hello money', 'money wave'],
    expense: ['spending money', 'cash register', 'shopping'],
    summary: ['calculator', 'accounting', 'ledger'],
    split: ['sharing', 'split bill', 'friends money'],
  };

  if (gf) {
    try {
      const terms = categoryTerms[category] || MONEY_SEARCH_TERMS;
      const searchTerm = terms[Math.floor(Math.random() * terms.length)];
      const { data } = await gf.search(searchTerm, {
        limit: 10,
        rating: 'g',
      });

      if (data.length > 0) {
        const randomGif = data[Math.floor(Math.random() * data.length)];
        return {
          mp4Url: randomGif.images.original_mp4?.mp4 || randomGif.images.fixed_height.mp4 || '',
          gifUrl: randomGif.images.original.url,
          title: randomGif.title,
        };
      }
    } catch (error) {
      console.error('GIPHY API error:', error);
    }
  }

  // Fallback
  return getRandomMoneyGif();
}
