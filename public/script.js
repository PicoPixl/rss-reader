class RSSReader {
  constructor() {
    this.feeds = [];
    this.articles = [];
    this.filteredArticles = [];
    this.categories = [];
    
    // Load settings from localStorage with fallback defaults
    this.currentView = localStorage.getItem('rss-view-mode') || 'compact';
    this.currentCategory = localStorage.getItem('rss-category-filter') || 'all';
    this.theme = localStorage.getItem('rss-theme') || 'light';
    
    this.initTheme();
    this.bindEvents();
    this.loadData();
  }

  initTheme() {
    document.documentElement.setAttribute('data-theme', this.theme);
    const themeIcon = document.querySelector('#theme-toggle .material-icons');
    themeIcon.textContent = this.theme === 'dark' ? 'light_mode' : 'dark_mode';
  }

  bindEvents() {
    // Theme toggle
    document.getElementById('theme-toggle').addEventListener('click', () => {
      this.theme = this.theme === 'light' ? 'dark' : 'light';
      localStorage.setItem('rss-theme', this.theme);
      this.initTheme();
    });

    // Add feed modal
    document.getElementById('add-feed-btn').addEventListener('click', () => {
      this.showModal();
    });

    document.getElementById('add-feed-modal').addEventListener('click', (e) => {
      if (e.target.id === 'add-feed-modal') this.hideModal();
    });

    document.querySelector('.close-btn').addEventListener('click', () => {
      this.hideModal();
    });

    document.getElementById('cancel-btn').addEventListener('click', () => {
      this.hideModal();
    });

    // Add feed form
    document.getElementById('add-feed-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.addFeed();
    });

    // Refresh feeds
    document.getElementById('refresh-btn').addEventListener('click', () => {
      this.refreshFeeds();
    });

    // View mode buttons
    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.setViewMode(btn.dataset.mode);
      });
    });

    // Category filter
    document.getElementById('category-filter').addEventListener('change', (e) => {
      this.filterByCategory(e.target.value);
    });
  }

  async loadData() {
    try {
      const [feedsRes, articlesRes, categoriesRes] = await Promise.all([
        fetch('/api/feeds'),
        fetch('/api/articles'),
        fetch('/api/categories')
      ]);
      
      this.feeds = await feedsRes.json();
      this.articles = await articlesRes.json();
      this.categories = await categoriesRes.json();
      
      this.renderFeeds();
      this.renderCategories();
      this.filterByCategory(this.currentCategory);
      
      // Restore saved settings after everything is rendered
      this.restoreSettings();
    } catch (err) {
      console.error('Error loading data:', err);
    }
  }

  restoreSettings() {
    // Restore view mode - ensure buttons are updated and view is applied
    const viewButtons = document.querySelectorAll('.view-btn');
    if (viewButtons.length > 0) {
      viewButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === this.currentView);
      });
      
      // Apply the view mode to the body class
      document.body.className = `view-${this.currentView}`;
      
      console.log('Settings restored - view mode:', this.currentView); // Debug log
    } else {
      console.log('View buttons not found, retrying...'); // Debug log
      // If buttons aren't ready yet, try again in a moment
      setTimeout(() => this.restoreSettings(), 100);
    }
  }

  renderCategories() {
    const select = document.getElementById('category-filter');
    select.innerHTML = `
      <option value="all">All Categories (${this.articles.length})</option>
      ${this.categories.map(category => {
        const count = this.articles.filter(article => 
          article.categories.includes(category) || 
          article.manualCategories?.includes(category)
        ).length;
        return `<option value="${category}">${category} (${count})</option>`;
      }).join('')}
    `;
  }

  filterByCategory(category) {
    this.currentCategory = category;
    
    // Save category filter preference
    localStorage.setItem('rss-category-filter', category);
    
    if (category === 'all') {
      this.filteredArticles = this.articles;
    } else {
      this.filteredArticles = this.articles.filter(article => 
        article.categories.includes(category) || 
        (article.manualCategories && article.manualCategories.includes(category))
      );
    }
    
    // Update category selector
    document.getElementById('category-filter').value = category;
    
    this.renderArticles();
  }

  renderFeeds() {
    const container = document.getElementById('feeds-list');
    container.innerHTML = this.feeds.map(feed => `
      <div class="feed-item">
        <div class="feed-info">
          <span class="feed-title" title="${feed.title}">${feed.title}</span>
          <span class="feed-category">${feed.category || 'General'}</span>
        </div>
        <button class="delete-feed" data-id="${feed.id}">
          <span class="material-icons">delete</span>
        </button>
      </div>
    `).join('');

    // Bind delete events
    container.querySelectorAll('.delete-feed').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteFeed(btn.dataset.id);
      });
    });
  }

  renderArticles() {
    const container = document.getElementById('articles-container');
    
    if (this.filteredArticles.length === 0) {
      const message = this.currentCategory === 'all' 
        ? 'No articles yet. Add some RSS feeds to get started!'
        : `No articles found in "${this.currentCategory}" category.`;
      
      container.innerHTML = `
        <div class="loading">
          <span class="material-icons">rss_feed</span>
          ${message}
        </div>
      `;
      return;
    }

    container.innerHTML = this.filteredArticles.map(article => this.renderArticle(article)).join('');

    // Apply current view mode
    document.body.className = `view-${this.currentView}`;
    
    // Handle image loading errors
    container.querySelectorAll('.article-image').forEach(img => {
      img.addEventListener('error', () => {
        img.style.display = 'none';
      });
    });

    // Bind category tag events
    container.querySelectorAll('.category-tag').forEach(tag => {
      tag.addEventListener('click', (e) => {
        e.preventDefault();
        const category = tag.dataset.category;
        this.filterByCategory(category);
      });
    });
  }

  renderArticle(article) {
    const hasImage = article.image && this.currentView === 'rich';
    const allCategories = [...(article.categories || []), ...(article.manualCategories || [])];
    const categoryTags = allCategories.length > 0 
      ? allCategories.map(cat => 
          `<span class="category-tag" data-category="${cat}">${cat}</span>`
        ).join('')
      : '<span class="category-tag" data-category="General">General</span>';
    
    if (this.currentView === 'rich' && hasImage) {
      return `
        <article class="article">
          <img src="${article.image}" alt="${this.escapeHtml(article.title)}" class="article-image" loading="lazy">
          <div class="article-main">
            <div class="article-header">
              <div class="article-meta">
                ${article.feedTitle} • ${this.formatDate(article.pubDate)}
              </div>
              <div class="article-categories">
                ${categoryTags}
              </div>
              <h2 class="article-title">
                <a href="${article.link}" target="_blank" rel="noopener">
                  ${this.escapeHtml(article.title)}
                </a>
              </h2>
            </div>
            <div class="article-content">
              <p class="article-description">
                ${this.escapeHtml(this.truncateText(article.description, 400))}
              </p>
            </div>
          </div>
        </article>
      `;
    } else {
      return `
        <article class="article">
          <div class="article-header">
            <div class="article-meta-row">
              <div class="article-meta">
                ${article.feedTitle} • ${this.formatDate(article.pubDate)}
              </div>
              <div class="article-categories">
                ${categoryTags}
              </div>
            </div>
            <h2 class="article-title">
              <a href="${article.link}" target="_blank" rel="noopener">
                ${this.escapeHtml(article.title)}
              </a>
            </h2>
          </div>
          <div class="article-content">
            <p class="article-description">
              ${this.escapeHtml(this.truncateText(article.description, this.currentView === 'rich' ? 400 : 300))}
            </p>
          </div>
        </article>
      `;
    }
  }

  setViewMode(mode) {
    this.currentView = mode;
    
    // Save view mode preference
    localStorage.setItem('rss-view-mode', mode);
    
    // Update active button
    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    
    // Re-render articles to handle image display
    this.renderArticles();
  }

  showModal() {
    document.getElementById('add-feed-modal').classList.add('show');
    document.getElementById('feed-url').focus();
  }

  hideModal() {
    document.getElementById('add-feed-modal').classList.remove('show');
    document.getElementById('add-feed-form').reset();
  }

  async addFeed() {
    const url = document.getElementById('feed-url').value.trim();
    const title = document.getElementById('feed-title').value.trim();
    const category = document.getElementById('feed-category').value.trim();
    
    if (!url) return;

    try {
      const submitBtn = document.querySelector('.btn-primary');
      submitBtn.textContent = 'Adding...';
      submitBtn.disabled = true;

      const response = await fetch('/api/feeds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, title, category })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add feed');
      }

      await this.loadData();
      this.hideModal();
    } catch (err) {
      alert(`Error adding feed: ${err.message}`);
    } finally {
      const submitBtn = document.querySelector('.btn-primary');
      submitBtn.textContent = 'Add Feed';
      submitBtn.disabled = false;
    }
  }

  async deleteFeed(feedId) {
    if (!confirm('Are you sure you want to delete this feed?')) return;

    try {
      await fetch(`/api/feeds/${feedId}`, { method: 'DELETE' });
      await this.loadData();
    } catch (err) {
      console.error('Error deleting feed:', err);
      alert('Error deleting feed');
    }
  }

  async refreshFeeds() {
    const refreshBtn = document.getElementById('refresh-btn');
    const icon = refreshBtn.querySelector('.material-icons');
    
    icon.classList.add('spinning');
    refreshBtn.disabled = true;

    try {
      await fetch('/api/refresh', { method: 'POST' });
      await this.loadData();
    } catch (err) {
      console.error('Error refreshing feeds:', err);
      alert('Error refreshing feeds');
    } finally {
      icon.classList.remove('spinning');
      refreshBtn.disabled = false;
    }
  }

  // Helper methods
  formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }
}

// Initialize the RSS reader when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new RSSReader();
});