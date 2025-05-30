const Parser = require('rss-parser');

class RSSService {
    constructor() {
        this.parser = new Parser({
            customFields: {
                feed: ['language', 'copyright', 'managingEditor'],
                item: ['creator', 'summary', 'enclosure']
            }
        });
    }

    async parseFeed(url) {
        try {
            const feed = await this.parser.parseURL(url);
            return {
                success: true,
                feed: {
                    title: feed.title,
                    description: feed.description,
                    link: feed.link,
                    language: feed.language,
                    lastBuildDate: feed.lastBuildDate,
                    items: feed.items.map(item => ({
                        title: item.title,
                        link: item.link,
                        pubDate: item.pubDate,
                        creator: item.creator || item.author,
                        content: item.content || item.summary || item.description,
                        guid: item.guid,
                        categories: item.categories || [],
                        enclosure: item.enclosure
                    }))
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async validateFeedUrl(url) {
        try {
            const result = await this.parseFeed(url);
            if (result.success) {
                return {
                    valid: true,
                    feedInfo: {
                        title: result.feed.title,
                        description: result.feed.description,
                        itemCount: result.feed.items.length,
                        lastUpdated: result.feed.lastBuildDate,
                        sampleItems: result.feed.items.slice(0, 3).map(item => ({
                            title: item.title,
                            pubDate: item.pubDate,
                            link: item.link
                        }))
                    }
                };
            } else {
                return {
                    valid: false,
                    error: result.error
                };
            }
        } catch (error) {
            return {
                valid: false,
                error: 'Invalid RSS feed URL'
            };
        }
    }

    extractImageFromContent(content) {
        if (!content) return null;
        
        // Try to extract image from HTML content
        const imgRegex = /<img[^>]+src="([^">]+)"/i;
        const match = content.match(imgRegex);
        return match ? match[1] : null;
    }

    stripHtmlTags(html) {
        if (!html) return '';
        return html.replace(/<[^>]*>/g, '').trim();
    }

    truncateContent(content, maxLength = 500) {
        if (!content) return '';
        const stripped = this.stripHtmlTags(content);
        return stripped.length > maxLength 
            ? stripped.substring(0, maxLength) + '...' 
            : stripped;
    }
}

module.exports = new RSSService();
