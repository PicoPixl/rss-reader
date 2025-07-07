const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const Parser = require('rss-parser');
const cron = require('node-cron');

const app = express();
const parser = new Parser({
  customFields: {
    item: [
      ['media:content', 'mediaContent'],
      ['media:thumbnail', 'mediaThumbnail'],
      ['enclosure', 'enclosure'],
      ['content:encoded', 'contentEncoded'],
      ['media:group', 'mediaGroup'],
      ['category', 'categories']
    ]
  }
});
const PORT = 3000;
const DATA_DIR = './data';
const FEEDS_FILE = path.join(DATA_DIR, 'feeds.json');
const ARTICLES_FILE = path.join(DATA_DIR, 'articles.json');

app.use(express.json());
app.use(express.static('public'));

// Category detection patterns
const CATEGORY_KEYWORDS = {
  'Technology': ['tech', 'software', 'programming', 'code', 'developer', 'AI', 'machine learning', 'startup', 'silicon valley', 'gadget', 'iPhone', 'android', 'app', 'digital', 'cyber', 'data', 'algorithm'],
  'Sports': ['football', 'basketball', 'baseball', 'soccer', 'tennis', 'golf', 'olympics', 'championship', 'league', 'team', 'player', 'game', 'match', 'score', 'tournament'],
  'Politics': ['election', 'government', 'congress', 'senate', 'president', 'political', 'policy', 'law', 'legislation', 'vote', 'campaign', 'democracy', 'republican', 'democrat'],
  'Business': ['economy', 'market', 'stock', 'finance', 'investment', 'business', 'company', 'corporate', 'profit', 'revenue', 'CEO', 'startup', 'entrepreneur', 'trade', 'commerce'],
  'Health': ['health', 'medical', 'medicine', 'doctor', 'hospital', 'disease', 'treatment', 'vaccine', 'fitness', 'nutrition', 'wellness', 'mental health', 'therapy'],
  'Science': ['research', 'study', 'science', 'scientific', 'discovery', 'experiment', 'climate', 'environment', 'space', 'nasa', 'biology', 'chemistry', 'physics'],
  'Entertainment': ['movie', 'film', 'tv', 'television', 'celebrity', 'music', 'album', 'concert', 'hollywood', 'netflix', 'streaming', 'entertainment', 'show'],
  'World News': ['international', 'world', 'global', 'country', 'nation', 'diplomatic', 'embassy', 'foreign', 'overseas', 'continent', 'refugee', 'conflict', 'peace'],
  'Lifestyle': ['travel', 'food', 'recipe', 'fashion', 'style', 'home', 'garden', 'family', 'relationship', 'culture', 'art', 'hobby', 'lifestyle']
};

// Ensure data directory exists
async function initDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    try {
      await fs.access(FEEDS_FILE);
    } catch {
      await fs.writeFile(FEEDS_FILE, '[]');
    }
    try {
      await fs.access(ARTICLES_FILE);
    } catch {
      await fs.writeFile(ARTICLES_FILE, '[]');
    }
  } catch (err) {
    console.error('Error initializing data directory:', err);
  }
}

async function loadFeeds() {
  try {
    const data = await fs.readFile(FEEDS_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function saveFeeds(feeds) {
  await fs.writeFile(FEEDS_FILE, JSON.stringify(feeds, null, 2));
}

async function loadArticles() {
  try {
    const data = await fs.readFile(ARTICLES_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function saveArticles(articles) {
  await fs.writeFile(ARTICLES_FILE, JSON.stringify(articles, null, 2));
}

// Enhanced image extraction function
function extractImageFromItem(item) {
  // Try different image sources in order of preference
  
  // 1. Media content/thumbnail
  if (item.mediaContent && Array.isArray(item.mediaContent)) {
    const imageMedia = item.mediaContent.find(m => m.$ && m.$.type && m.$.type.startsWith('image/'));
    if (imageMedia && imageMedia.$.url) {
      return imageMedia.$.url;
    }
  }
  
  if (item.mediaThumbnail && item.mediaThumbnail.$ && item.mediaThumbnail.$.url) {
    return item.mediaThumbnail.$.url;
  }
  
  // 2. Enclosure (for podcasts/media)
  if (item.enclosure && item.enclosure.type && item.enclosure.type.startsWith('image/')) {
    return item.enclosure.url;
  }
  
  // 3. Extract from content or contentEncoded
  const content = item.contentEncoded || item.content || item['content:encoded'] || '';
  if (content) {
    const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
    if (imgMatch) {
      return imgMatch[1];
    }
  }
  
  // 4. Extract from description/summary
  const description = item.contentSnippet || item.summary || item.description || '';
  if (description) {
    const imgMatch = description.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
    if (imgMatch) {
      return imgMatch[1];
    }
  }
  
  // 5. Check for iTunes image (for podcasts)
  if (item.itunes && item.itunes.image) {
    return item.itunes.image;
  }
  
  return null;
}

// Enhanced content extraction
function extractContent(item) {
  // Get rich HTML content if available
  const richContent = item.contentEncoded || item.content || item['content:encoded'];
  if (richContent) {
    return {
      html: richContent,
      text: item.contentSnippet || richContent.replace(/<[^>]*>/g, '').substring(0, 500)
    };
  }
  
  // Fallback to description
  const description = item.contentSnippet || item.summary || item.description || '';
  return {
    html: item.description || description,
    text: description
  };
}

// Extract categories from RSS item
function extractCategoriesFromItem(item) {
  const categories = [];
  
  // Get categories from RSS item
  if (item.categories) {
    if (Array.isArray(item.categories)) {
      categories.push(...item.categories);
    } else if (typeof item.categories === 'string') {
      categories.push(item.categories);
    }
  }
  
  // Get category from single category field
  if (item.category) {
    if (Array.isArray(item.category)) {
      categories.push(...item.category);
    } else if (typeof item.category === 'string') {
      categories.push(item.category);
    }
  }
  
  return categories.filter(cat => cat && typeof cat === 'string').map(cat => cat.trim());
}

// Auto-categorize article based on content
function autoCategorizeArticle(title, description, rssCategories = []) {
  const detectedCategories = [];
  const content = `${title} ${description}`.toLowerCase();
  
  // First, use RSS feed categories if available
  if (rssCategories.length > 0) {
    // Try to map RSS categories to our standard categories
    for (const rssCategory of rssCategories) {
      const normalized = rssCategory.toLowerCase();
      for (const [standardCategory, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        if (keywords.some(keyword => normalized.includes(keyword.toLowerCase())) ||
            normalized.includes(standardCategory.toLowerCase())) {
          if (!detectedCategories.includes(standardCategory)) {
            detectedCategories.push(standardCategory);
          }
        }
      }
    }
  }
  
  // If no categories found from RSS, analyze content
  if (detectedCategories.length === 0) {
    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      const matchCount = keywords.filter(keyword => 
        content.includes(keyword.toLowerCase())
      ).length;
      
      // If we find multiple keywords or high-confidence single keywords, assign category
      if (matchCount >= 2 || (matchCount === 1 && keywords.some(k => content.includes(k.toLowerCase()) && k.length > 3))) {
        detectedCategories.push(category);
      }
    }
  }
  
  // Default to 'General' if no categories detected
  return detectedCategories.length > 0 ? detectedCategories : ['General'];
}

async function fetchFeedArticles(feed) {
  try {
    const parsed = await parser.parseURL(feed.url);
    return parsed.items.map(item => {
      const content = extractContent(item);
      const image = extractImageFromItem(item);
      const rssCategories = extractCategoriesFromItem(item);
      const autoCategories = autoCategorizeArticle(item.title, content.text, rssCategories);
      
      return {
        id: `${feed.id}-${item.guid || item.link}`,
        feedId: feed.id,
        feedTitle: parsed.title || feed.title,
        title: item.title,
        link: item.link,
        description: content.text,
        htmlContent: content.html,
        image: image,
        pubDate: item.pubDate,
        timestamp: new Date(item.pubDate || Date.now()).getTime(),
        rssCategories: rssCategories,
        categories: autoCategories,
        manualCategories: [] // For user-assigned categories
      };
    });
  } catch (err) {
    console.error(`Error fetching feed ${feed.url}:`, err);
    return [];
  }
}

async function updateAllFeeds() {
  const feeds = await loadFeeds();
  const allArticles = [];
  
  for (const feed of feeds) {
    const articles = await fetchFeedArticles(feed);
    allArticles.push(...articles);
  }
  
  // Sort by timestamp, newest first
  allArticles.sort((a, b) => b.timestamp - a.timestamp);
  
  // Keep only last 1000 articles to prevent file from growing too large
  const trimmed = allArticles.slice(0, 1000);
  await saveArticles(trimmed);
  
  console.log(`Updated feeds: ${allArticles.length} articles fetched`);
}

// API Routes
app.get('/api/feeds', async (req, res) => {
  const feeds = await loadFeeds();
  res.json(feeds);
});

app.post('/api/feeds', async (req, res) => {
  const { url, title, category } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }
  
  try {
    // Test the feed
    const parsed = await parser.parseURL(url);
    
    const feeds = await loadFeeds();
    const newFeed = {
      id: Date.now().toString(),
      url,
      title: title || parsed.title || 'Untitled Feed',
      category: category || 'General', // Allow manual feed categorization
      addedAt: new Date().toISOString()
    };
    
    feeds.push(newFeed);
    await saveFeeds(feeds);
    
    // Fetch articles for this feed immediately
    const articles = await fetchFeedArticles(newFeed);
    const allArticles = await loadArticles();
    allArticles.push(...articles);
    allArticles.sort((a, b) => b.timestamp - a.timestamp);
    await saveArticles(allArticles.slice(0, 1000));
    
    res.json(newFeed);
  } catch (err) {
    res.status(400).json({ error: 'Invalid RSS feed URL' });
  }
});

app.delete('/api/feeds/:id', async (req, res) => {
  const feeds = await loadFeeds();
  const filtered = feeds.filter(f => f.id !== req.params.id);
  await saveFeeds(filtered);
  
  // Remove articles from this feed
  const articles = await loadArticles();
  const filteredArticles = articles.filter(a => a.feedId !== req.params.id);
  await saveArticles(filteredArticles);
  
  res.json({ success: true });
});

app.get('/api/articles', async (req, res) => {
  const articles = await loadArticles();
  const { category } = req.query;
  
  if (category && category !== 'all') {
    const filtered = articles.filter(article => 
      article.categories.includes(category) || 
      article.manualCategories.includes(category)
    );
    res.json(filtered);
  } else {
    res.json(articles);
  }
});

// Get all available categories
app.get('/api/categories', async (req, res) => {
  const articles = await loadArticles();
  const categories = new Set(['General']);
  
  articles.forEach(article => {
    article.categories.forEach(cat => categories.add(cat));
    article.manualCategories.forEach(cat => categories.add(cat));
  });
  
  // Add predefined categories
  Object.keys(CATEGORY_KEYWORDS).forEach(cat => categories.add(cat));
  
  res.json(Array.from(categories).sort());
});

// Update article categories (manual categorization)
app.patch('/api/articles/:id/categories', async (req, res) => {
  const { categories } = req.body;
  const articles = await loadArticles();
  
  const articleIndex = articles.findIndex(a => a.id === req.params.id);
  if (articleIndex === -1) {
    return res.status(404).json({ error: 'Article not found' });
  }
  
  articles[articleIndex].manualCategories = categories || [];
  await saveArticles(articles);
  
  res.json({ success: true });
});

app.post('/api/refresh', async (req, res) => {
  await updateAllFeeds();
  res.json({ success: true });
});

// Schedule feed updates every 30 minutes
cron.schedule('*/30 * * * *', updateAllFeeds);

// Initialize and start server
initDataDir().then(() => {
  // Update feeds on startup
  updateAllFeeds();
  
  app.listen(PORT, () => {
    console.log(`RSS Reader running on http://localhost:${PORT}`);
  });
});