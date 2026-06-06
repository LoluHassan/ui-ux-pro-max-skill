/**
 * UI/UX Pro Max Core - BM25 search engine for UI/UX style guides
 */

const fs = require('fs');
const path = require('path');

// ============ CONFIGURATION ============
const DATA_DIR = path.join(__dirname, '..', 'data');
const MAX_RESULTS = 3;

const CSV_CONFIG = {
    "style": {
        "file": "styles.csv",
        "search_cols": ["Style Category", "Keywords", "Best For", "Type", "AI Prompt Keywords"],
        "output_cols": ["Style Category", "Type", "Keywords", "Primary Colors", "Effects & Animation", "Best For", "Light Mode ✓", "Dark Mode ✓", "Performance", "Accessibility", "Framework Compatibility", "Complexity", "AI Prompt Keywords", "CSS/Technical Keywords", "Implementation Checklist", "Design System Variables"]
    },
    "color": {
        "file": "colors.csv",
        "search_cols": ["Product Type", "Notes"],
        "output_cols": ["Product Type", "Primary", "On Primary", "Secondary", "On Secondary", "Accent", "On Accent", "Background", "Foreground", "Card", "Card Foreground", "Muted", "Muted Foreground", "Border", "Destructive", "On Destructive", "Ring", "Notes"]
    },
    "chart": {
        "file": "charts.csv",
        "search_cols": ["Data Type", "Keywords", "Best Chart Type", "When to Use", "When NOT to Use", "Accessibility Notes"],
        "output_cols": ["Data Type", "Keywords", "Best Chart Type", "Secondary Options", "When to Use", "When NOT to Use", "Data Volume Threshold", "Color Guidance", "Accessibility Grade", "Accessibility Notes", "A11y Fallback", "Library Recommendation", "Interactive Level"]
    },
    "landing": {
        "file": "landing.csv",
        "search_cols": ["Pattern Name", "Keywords", "Conversion Optimization", "Section Order"],
        "output_cols": ["Pattern Name", "Keywords", "Section Order", "Primary CTA Placement", "Color Strategy", "Conversion Optimization"]
    },
    "product": {
        "file": "products.csv",
        "search_cols": ["Product Type", "Keywords", "Primary Style Recommendation", "Key Considerations"],
        "output_cols": ["Product Type", "Keywords", "Primary Style Recommendation", "Secondary Styles", "Landing Page Pattern", "Dashboard Style (if applicable)", "Color Palette Focus"]
    },
    "ux": {
        "file": "ux-guidelines.csv",
        "search_cols": ["Category", "Issue", "Description", "Platform"],
        "output_cols": ["Category", "Issue", "Platform", "Description", "Do", "Don't", "Code Example Good", "Code Example Bad", "Severity"]
    },
    "typography": {
        "file": "typography.csv",
        "search_cols": ["Font Pairing Name", "Category", "Mood/Style Keywords", "Best For", "Heading Font", "Body Font"],
        "output_cols": ["Font Pairing Name", "Category", "Heading Font", "Body Font", "Mood/Style Keywords", "Best For", "Google Fonts URL", "CSS Import", "Tailwind Config", "Notes"]
    },
    "icons": {
        "file": "icons.csv",
        "search_cols": ["Category", "Icon Name", "Keywords", "Best For"],
        "output_cols": ["Category", "Icon Name", "Keywords", "Library", "Import Code", "Usage", "Best For", "Style"]
    },
    "react": {
        "file": "react-performance.csv",
        "search_cols": ["Category", "Issue", "Keywords", "Description"],
        "output_cols": ["Category", "Issue", "Platform", "Description", "Do", "Don't", "Code Example Good", "Code Example Bad", "Severity"]
    },
    "web": {
        "file": "app-interface.csv",
        "search_cols": ["Category", "Issue", "Keywords", "Description"],
        "output_cols": ["Category", "Issue", "Platform", "Description", "Do", "Don't", "Code Example Good", "Code Example Bad", "Severity"]
    },
    "google-fonts": {
        "file": "google-fonts.csv",
        "search_cols": ["Family", "Category", "Stroke", "Classifications", "Keywords", "Subsets", "Designers"],
        "output_cols": ["Family", "Category", "Stroke", "Classifications", "Styles", "Variable Axes", "Subsets", "Designers", "Popularity Rank", "Google Fonts URL"]
    }
};

const STACK_CONFIG = {
    "react":            {"file": "stacks/react.csv"},
    "nextjs":           {"file": "stacks/nextjs.csv"},
    "vue":              {"file": "stacks/vue.csv"},
    "svelte":           {"file": "stacks/svelte.csv"},
    "astro":            {"file": "stacks/astro.csv"},
    "swiftui":          {"file": "stacks/swiftui.csv"},
    "react-native":     {"file": "stacks/react-native.csv"},
    "flutter":          {"file": "stacks/flutter.csv"},
    "nuxtjs":           {"file": "stacks/nuxtjs.csv"},
    "nuxt-ui":          {"file": "stacks/nuxt-ui.csv"},
    "html-tailwind":    {"file": "stacks/html-tailwind.csv"},
    "shadcn":           {"file": "stacks/shadcn.csv"},
    "jetpack-compose":  {"file": "stacks/jetpack-compose.csv"},
    "threejs":          {"file": "stacks/threejs.csv"},
    "angular":          {"file": "stacks/angular.csv"},
    "laravel":          {"file": "stacks/laravel.csv"},
};

const _STACK_COLS = {
    "search_cols": ["Category", "Guideline", "Description", "Do", "Don't"],
    "output_cols": ["Category", "Guideline", "Description", "Do", "Don't", "Code Good", "Code Bad", "Severity", "Docs URL"]
};

const AVAILABLE_STACKS = Object.keys(STACK_CONFIG);

// ============ CSV PARSER ============
function parseCSV(text) {
    const lines = [];
    let row = [""];
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        const next = text[i+1];
        if (c === '"') {
            if (inQuotes && next === '"') {
                row[row.length - 1] += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (c === ',' && !inQuotes) {
            row.push('');
        } else if ((c === '\r' || c === '\n') && !inQuotes) {
            if (c === '\r' && next === '\n') {
                i++;
            }
            lines.push(row);
            row = [""];
        } else {
            row[row.length - 1] += c;
        }
    }
    if (row.length > 1 || row[0] !== "") {
        lines.push(row);
    }
    if (lines.length === 0) return [];
    const headers = lines[0].map(h => h.trim());
    const results = [];
    for (let i = 1; i < lines.length; i++) {
        const r = lines[i];
        if (r.length === 1 && r[0] === "") continue; // empty line
        const obj = {};
        for (let j = 0; j < headers.length; j++) {
            obj[headers[j]] = (r[j] || "").trim();
        }
        results.push(obj);
    }
    return results;
}

// ============ BM25 IMPLEMENTATION ============
class BM25 {
    constructor(k1 = 1.5, b = 0.75) {
        this.k1 = k1;
        this.b = b;
        this.corpus = [];
        this.docLengths = [];
        this.avgdl = 0;
        this.idf = {};
        this.docFreqs = {};
        this.N = 0;
    }

    tokenize(text) {
        return String(text)
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length > 2);
    }

    fit(documents) {
        this.corpus = documents.map(doc => this.tokenize(doc));
        this.N = this.corpus.length;
        if (this.N === 0) {
            return;
        }
        this.docLengths = this.corpus.map(doc => doc.length);
        this.avgdl = this.docLengths.reduce((sum, len) => sum + len, 0) / this.N;

        for (const doc of this.corpus) {
            const seen = new Set();
            for (const word of doc) {
                if (!seen.has(word)) {
                    this.docFreqs[word] = (this.docFreqs[word] || 0) + 1;
                    seen.add(word);
                }
            }
        }

        for (const [word, freq] of Object.entries(this.docFreqs)) {
            this.idf[word] = Math.log((this.N - freq + 0.5) / (freq + 0.5) + 1);
        }
    }

    score(query) {
        const queryTokens = this.tokenize(query);
        const scores = [];

        for (let idx = 0; idx < this.corpus.length; idx++) {
            const doc = this.corpus[idx];
            let score = 0;
            const docLen = this.docLengths[idx];
            
            const termFreqs = {};
            for (const word of doc) {
                termFreqs[word] = (termFreqs[word] || 0) + 1;
            }

            for (const token of queryTokens) {
                if (token in this.idf) {
                    const tf = termFreqs[token] || 0;
                    const idf = this.idf[token];
                    const numerator = tf * (this.k1 + 1);
                    const denominator = tf + this.k1 * (1 - this.b + (this.b * docLen) / this.avgdl);
                    score += (idf * numerator) / denominator;
                }
            }

            scores.push([idx, score]);
        }

        return scores.sort((a, b) => b[1] - a[1]);
    }
}

// ============ SEARCH FUNCTIONS ============
function _searchCSV(filepath, searchCols, outputCols, query, maxResults) {
    if (!fs.existsSync(filepath)) {
        return [];
    }

    const text = fs.readFileSync(filepath, 'utf8');
    const data = parseCSV(text);

    // Build documents from search columns
    const documents = data.map(row => 
        searchCols.map(col => String(row[col] || "")).join(" ")
    );

    // BM25 search
    const bm25 = new BM25();
    bm25.fit(documents);
    const ranked = bm25.score(query);

    // Get top results with score > 0
    const results = [];
    const topRanked = ranked.slice(0, maxResults);
    for (const [idx, score] of topRanked) {
        if (score > 0) {
            const row = data[idx];
            const resultRow = {};
            for (const col of outputCols) {
                if (col in row) {
                    resultRow[col] = row[col];
                }
            }
            results.push(resultRow);
        }
    }

    return results;
}

function detectDomain(query) {
    const queryLower = query.toLowerCase();

    const domainKeywords = {
        "color": ["color", "palette", "hex", "#", "rgb", "token", "semantic", "accent", "destructive", "muted", "foreground"],
        "chart": ["chart", "graph", "visualization", "trend", "bar", "pie", "scatter", "heatmap", "funnel"],
        "landing": ["landing", "page", "cta", "conversion", "hero", "testimonial", "pricing", "section"],
        "product": ["saas", "ecommerce", "e-commerce", "fintech", "healthcare", "gaming", "portfolio", "crypto", "dashboard", "fitness", "restaurant", "hotel", "travel", "music", "education", "learning", "legal", "insurance", "medical", "beauty", "pharmacy", "dental", "pet", "dating", "wedding", "recipe", "delivery", "ride", "booking", "calendar", "timer", "tracker", "diary", "note", "chat", "messenger", "crm", "invoice", "parking", "transit", "vpn", "alarm", "weather", "sleep", "meditation", "fasting", "habit", "grocery", "meme", "wardrobe", "plant care", "reading", "flashcard", "puzzle", "trivia", "arcade", "photography", "streaming", "podcast", "newsletter", "marketplace", "freelancer", "coworking", "airline", "museum", "theater", "church", "non-profit", "charity", "kindergarten", "daycare", "senior care", "veterinary", "florist", "bakery", "brewery", "construction", "automotive", "real estate", "logistics", "agriculture", "coding bootcamp"],
        "style": ["style", "design", "ui", "minimalism", "glassmorphism", "neumorphism", "brutalism", "dark mode", "flat", "aurora", "prompt", "css", "implementation", "variable", "checklist", "tailwind"],
        "ux": ["ux", "usability", "accessibility", "wcag", "touch", "scroll", "animation", "keyboard", "navigation", "mobile"],
        "typography": ["font pairing", "typography pairing", "heading font", "body font"],
        "google-fonts": ["google font", "font family", "font weight", "font style", "variable font", "noto", "font for", "find font", "font subset", "font language", "monospace font", "serif font", "sans serif font", "display font", "handwriting font", "font", "typography", "serif", "sans"],
        "icons": ["icon", "icons", "lucide", "heroicons", "symbol", "glyph", "pictogram", "svg icon"],
        "react": ["react", "next.js", "nextjs", "suspense", "memo", "usecallback", "useeffect", "rerender", "bundle", "waterfall", "barrel", "dynamic import", "rsc", "server component"],
        "web": ["aria", "focus", "outline", "semantic", "virtualize", "autocomplete", "form", "input type", "preconnect"]
    };

    let bestDomain = "style";
    let maxScore = -1;

    for (const [domain, keywords] of Object.entries(domainKeywords)) {
        let score = 0;
        for (const kw of keywords) {
            const regex = new RegExp('\\b' + kw.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '\\b', 'i');
            if (regex.test(queryLower)) {
                score++;
            }
        }
        if (score > maxScore) {
            maxScore = score;
            bestDomain = domain;
        }
    }

    return maxScore > 0 ? bestDomain : "style";
}

function search(query, domain = null, maxResults = MAX_RESULTS) {
    if (domain === null) {
        domain = detectDomain(query);
    }

    const config = CSV_CONFIG[domain] || CSV_CONFIG["style"];
    const filepath = path.join(DATA_DIR, config.file);

    if (!fs.existsSync(filepath)) {
        return { "error": `File not found: ${filepath}`, "domain": domain };
    }

    const results = _searchCSV(filepath, config.search_cols, config.output_cols, query, maxResults);

    return {
        "domain": domain,
        "query": query,
        "file": config.file,
        "count": results.length,
        "results": results
    };
}

function searchStack(query, stack, maxResults = MAX_RESULTS) {
    if (!(stack in STACK_CONFIG)) {
        return { "error": `Unknown stack: ${stack}. Available: ${AVAILABLE_STACKS.join(', ')}` };
    }

    const filepath = path.join(DATA_DIR, STACK_CONFIG[stack].file);

    if (!fs.existsSync(filepath)) {
        return { "error": `Stack file not found: ${filepath}`, "stack": stack };
    }

    const results = _searchCSV(filepath, _STACK_COLS.search_cols, _STACK_COLS.output_cols, query, maxResults);

    return {
        "domain": "stack",
        "stack": stack,
        "query": query,
        "file": STACK_CONFIG[stack].file,
        "count": results.length,
        "results": results
    };
}

module.exports = {
    DATA_DIR,
    MAX_RESULTS,
    CSV_CONFIG,
    AVAILABLE_STACKS,
    parseCSV,
    BM25,
    detectDomain,
    search,
    searchStack
};
