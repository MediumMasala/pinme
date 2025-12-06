// src/services/giphy.ts
import { GiphyFetch } from '@giphy/js-fetch-api';
import { config } from '../config.js';

// Initialize GIPHY client (uses API key if provided)
const gf = config.giphy.apiKey ? new GiphyFetch(config.giphy.apiKey) : null;

// Curated money/finance GIF search terms - STRICTLY money related
const MONEY_SEARCH_TERMS = [
  'money cash dollars',
  'raining money cash',
  'counting cash bills',
  'throwing cash money',
  'rich money flex',
  'billionaire money',
];

// Keywords that MUST appear in GIF title to be considered valid
const MONEY_KEYWORDS = ['money', 'cash', 'dollar', 'rich', 'bills', 'pay', 'coin', 'bank', 'wealth'];

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
 * Check if GIF title contains money-related keywords
 */
function isMoneyRelated(title: string): boolean {
  const lowerTitle = title.toLowerCase();
  return MONEY_KEYWORDS.some(keyword => lowerTitle.includes(keyword));
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
        limit: 50, // Get more results to filter
        rating: 'g', // Keep it family-friendly
      });

      // Filter to only money-related GIFs
      const moneyGifs = data.filter(gif => isMoneyRelated(gif.title));

      if (moneyGifs.length > 0) {
        const randomGif = moneyGifs[Math.floor(Math.random() * moneyGifs.length)];
        return {
          mp4Url: randomGif.images.original_mp4?.mp4 || randomGif.images.fixed_height.mp4 || '',
          gifUrl: randomGif.images.original.url,
          title: randomGif.title,
        };
      }

      // If no filtered results, use first result (search term should be money-specific)
      if (data.length > 0) {
        const randomGif = data[Math.floor(Math.random() * Math.min(data.length, 5))];
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

  // Fallback to curated GIFs (guaranteed money-related)
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
    welcome: ['money rain cash', 'rich money celebration', 'cash money success'],
    expense: ['spending cash money', 'money wallet', 'paying cash'],
    summary: ['counting money cash', 'money stack bills', 'rich cash pile'],
    split: ['sharing money cash', 'money split bills', 'dividing cash'],
  };

  if (gf) {
    try {
      const terms = categoryTerms[category] || MONEY_SEARCH_TERMS;
      const searchTerm = terms[Math.floor(Math.random() * terms.length)];
      const { data } = await gf.search(searchTerm, {
        limit: 50,
        rating: 'g',
      });

      // Filter to only money-related GIFs
      const moneyGifs = data.filter(gif => isMoneyRelated(gif.title));

      if (moneyGifs.length > 0) {
        const randomGif = moneyGifs[Math.floor(Math.random() * moneyGifs.length)];
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

  // Fallback to curated GIFs (guaranteed money-related)
  const randomFallback = FALLBACK_GIFS[Math.floor(Math.random() * FALLBACK_GIFS.length)];
  return {
    mp4Url: randomFallback,
    gifUrl: randomFallback.replace('.mp4', '.gif'),
    title: 'Money GIF',
  };
}
