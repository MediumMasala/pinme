// src/services/giphy.ts
import { GiphyFetch } from '@giphy/js-fetch-api';
import { config } from '../config.js';

// Initialize GIPHY client (uses API key if provided)
const gf = config.giphy.apiKey ? new GiphyFetch(config.giphy.apiKey) : null;

// Curated money/finance GIF search terms - STRICTLY money related
const MONEY_SEARCH_TERMS = [
  'money rain',
  'make it rain money',
  'cash money',
  'counting money',
  'dollar bills',
  'rupees money',
  'throwing money',
  'money flying',
  'cash register money',
  'payday money',
];

// Fallback GIFs (direct GIPHY MP4 URLs) - ALL strictly money/cash related
const FALLBACK_GIFS = [
  'https://media.giphy.com/media/LdOyjZ7io5Msw/giphy.mp4', // Money rain
  'https://media.giphy.com/media/l0HFkA6omUyjVYqw8/giphy.mp4', // Make it rain dollars
  'https://media.giphy.com/media/67ThRZlYBvibtdF9JH/giphy.mp4', // Dollar bills
  'https://media.giphy.com/media/xTiTnqUxyWbsAXq7Ju/giphy.mp4', // Cash flying
  'https://media.giphy.com/media/3oKIPdGYRGEby6jQwE/giphy.mp4', // Money flying
  'https://media.giphy.com/media/n94fyy6LYDQ2Q/giphy.mp4', // Counting money
  'https://media.giphy.com/media/JpG2A9P3dPHXaTYrwu/giphy.mp4', // Money rain
  'https://media.giphy.com/media/3o6gDWzmAzrpi5DQU8/giphy.mp4', // Cash money
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
 * Get a specific category GIF - ALL categories return money GIFs
 */
export async function getGifByCategory(category: 'welcome' | 'expense' | 'summary' | 'split'): Promise<GifResult | null> {
  // ALL categories use strictly money-related search terms
  const categoryTerms: Record<string, string[]> = {
    welcome: ['money rain', 'make it rain money', 'cash money'],
    expense: ['spending money', 'money flying', 'cash register money'],
    summary: ['counting money', 'money stack', 'cash pile'],
    split: ['money split', 'cash divide', 'money sharing'],
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
