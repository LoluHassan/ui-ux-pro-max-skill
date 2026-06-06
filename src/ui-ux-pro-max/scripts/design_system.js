/**
 * Design System Generator - Aggregates search results and applies reasoning
 * to generate comprehensive design system recommendations.
 */

const fs = require('fs');
const path = require('path');
const { search, parseCSV, DATA_DIR } = require('./core');

// ============ CONFIGURATION ============
const REASONING_FILE = "ui-reasoning.csv";

const SEARCH_CONFIG = {
    "product": { "max_results": 1 },
    "style": { "max_results": 3 },
    "color": { "max_results": 2 },
    "landing": { "max_results": 2 },
    "typography": { "max_results": 2 }
};

// ============ DESIGN SYSTEM GENERATOR ============
class DesignSystemGenerator {
    constructor() {
        this.reasoningData = this._loadReasoning();
    }

    _loadReasoning() {
        const filepath = path.join(DATA_DIR, REASONING_FILE);
        if (!fs.existsSync(filepath)) {
            return [];
        }
        const text = fs.readFileSync(filepath, 'utf8');
        return parseCSV(text);
    }

    _multiDomainSearch(query, stylePriority = null) {
        const results = {};
        for (const [domain, config] of Object.entries(SEARCH_CONFIG)) {
            if (domain === "style" && stylePriority) {
                // For style, also search with priority keywords
                const priorityQuery = stylePriority.slice(0, 2).join(" ");
                const combinedQuery = `${query} ${priorityQuery}`;
                results[domain] = search(combinedQuery, domain, config.max_results);
            } else {
                results[domain] = search(query, domain, config.max_results);
            }
        }
        return results;
    }

    _findReasoningRule(category) {
        const categoryLower = category.toLowerCase().trim();

        // Try exact match first
        for (const rule of this.reasoningData) {
            if ((rule.UI_Category || "").toLowerCase().trim() === categoryLower) {
                return rule;
            }
        }

        // Try partial match
        for (const rule of this.reasoningData) {
            const uiCat = (rule.UI_Category || "").toLowerCase().trim();
            if (uiCat.includes(categoryLower) || categoryLower.includes(uiCat)) {
                return rule;
            }
        }

        // Try keyword match
        for (const rule of this.reasoningData) {
            const uiCat = (rule.UI_Category || "").toLowerCase().trim();
            const keywords = uiCat.replace(/\//g, " ").replace(/-/g, " ").split(/\s+/).filter(Boolean);
            if (keywords.some(kw => categoryLower.includes(kw))) {
                return rule;
            }
        }

        return null;
    }

    _applyReasoning(category, searchResults) {
        const rule = this._findReasoningRule(category);

        if (!rule) {
            return {
                "pattern": "Hero + Features + CTA",
                "style_priority": ["Minimalism", "Flat Design"],
                "color_mood": "Professional",
                "typography_mood": "Clean",
                "key_effects": "Subtle hover transitions",
                "anti_patterns": "",
                "decision_rules": {},
                "severity": "MEDIUM"
            };
        }

        // Parse decision rules JSON
        let decisionRules = {};
        try {
            decisionRules = JSON.parse(rule.Decision_Rules || "{}");
        } catch (e) {
            // ignore
        }

        return {
            "pattern": rule.Recommended_Pattern || "",
            "style_priority": (rule.Style_Priority || "").split("+").map(s => s.trim()),
            "color_mood": rule.Color_Mood || "",
            "typography_mood": rule.Typography_Mood || "",
            "key_effects": rule.Key_Effects || "",
            "anti_patterns": rule.Anti_Patterns || "",
            "decision_rules": decisionRules,
            "severity": rule.Severity || "MEDIUM"
        };
    }

    _selectBestMatch(results, priorityKeywords) {
        if (!results || results.length === 0) {
            return {};
        }

        if (!priorityKeywords || priorityKeywords.length === 0) {
            return results[0];
        }

        // First: try exact style name match
        for (const priority of priorityKeywords) {
            const priorityLower = priority.toLowerCase().trim();
            for (const result of results) {
                const styleCategory = (result["Style Category"] || "").toLowerCase().trim();
                if (styleCategory.includes(priorityLower) || priorityLower.includes(styleCategory)) {
                    return result;
                }
            }
        }

        // Second: score by keyword match in all fields
        const scored = [];
        for (const result of results) {
            const resultStr = JSON.stringify(result).toLowerCase();
            let score = 0;
            for (const kw of priorityKeywords) {
                const kwLower = kw.toLowerCase().trim();
                const styleCategory = (result["Style Category"] || "").toLowerCase().trim();
                const keywords = (result["Keywords"] || "").toLowerCase().trim();
                
                if (styleCategory.includes(kwLower)) {
                    score += 10;
                } else if (keywords.includes(kwLower)) {
                    score += 3;
                } else if (resultStr.includes(kwLower)) {
                    score += 1;
                }
            }
            scored.push({ score, result });
        }

        scored.sort((a, b) => b.score - a.score);
        return scored[0] && scored[0].score > 0 ? scored[0].result : results[0];
    }

    _extractResults(searchResult) {
        return searchResult ? (searchResult.results || []) : [];
    }

    generate(query, projectName = null) {
        // Step 1: First search product to get category
        const productResult = search(query, "product", 1);
        const productResults = productResult.results || [];
        let category = "General";
        if (productResults.length > 0) {
            category = productResults[0]["Product Type"] || "General";
        }

        // Step 2: Get reasoning rules for this category
        const reasoning = this._applyReasoning(category, {});
        const stylePriority = reasoning.style_priority || [];

        // Step 3: Multi-domain search with style priority hints
        const searchResults = this._multiDomainSearch(query, stylePriority);
        searchResults["product"] = productResult; // Reuse product search

        // Step 4: Select best matches from each domain using priority
        const styleResults = this._extractResults(searchResults.style);
        const colorResults = this._extractResults(searchResults.color);
        const typographyResults = this._extractResults(searchResults.typography);
        const landingResults = this._extractResults(searchResults.landing);

        const bestStyle = this._selectBestMatch(styleResults, stylePriority);
        const bestColor = colorResults[0] || {};
        const bestTypography = typographyResults[0] || {};
        const bestLanding = landingResults[0] || {};

        // Step 5: Build final recommendation
        const styleEffects = bestStyle["Effects & Animation"] || "";
        const reasoningEffects = reasoning.key_effects || "";
        const combinedEffects = styleEffects ? styleEffects : reasoningEffects;

        return {
            "project_name": projectName || query.toUpperCase(),
            "category": category,
            "pattern": {
                "name": bestLanding["Pattern Name"] || reasoning.pattern || "Hero + Features + CTA",
                "sections": bestLanding["Section Order"] || "Hero > Features > CTA",
                "cta_placement": bestLanding["Primary CTA Placement"] || "Above fold",
                "color_strategy": bestLanding["Color Strategy"] || "",
                "conversion": bestLanding["Conversion Optimization"] || ""
            },
            "style": {
                "name": bestStyle["Style Category"] || "Minimalism",
                "type": bestStyle["Type"] || "General",
                "effects": styleEffects,
                "keywords": bestStyle["Keywords"] || "",
                "best_for": bestStyle["Best For"] || "",
                "performance": bestStyle["Performance"] || "",
                "accessibility": bestStyle["Accessibility"] || "",
                "light_mode": bestStyle["Light Mode ✓"] || "",
                "dark_mode": bestStyle["Dark Mode ✓"] || "",
            },
            "colors": {
                "primary": bestColor["Primary"] || "#2563EB",
                "on_primary": bestColor["On Primary"] || "",
                "secondary": bestColor["Secondary"] || "#3B82F6",
                "accent": bestColor["Accent"] || "#F97316",
                "background": bestColor["Background"] || "#F8FAFC",
                "foreground": bestColor["Foreground"] || "#1E293B",
                "muted": bestColor["Muted"] || "",
                "border": bestColor["Border"] || "",
                "destructive": bestColor["Destructive"] || "",
                "ring": bestColor["Ring"] || "",
                "notes": bestColor["Notes"] || "",
                // Keep legacy keys for backward compat in MASTER.md
                "cta": bestColor["Accent"] || "#F97316",
                "text": bestColor["Foreground"] || "#1E293B",
            },
            "typography": {
                "heading": bestTypography["Heading Font"] || "Inter",
                "body": bestTypography["Body Font"] || "Inter",
                "mood": bestTypography["Mood/Style Keywords"] || reasoning.typography_mood || "",
                "best_for": bestTypography["Best For"] || "",
                "google_fonts_url": bestTypography["Google Fonts URL"] || "",
                "css_import": bestTypography["CSS Import"] || ""
            },
            "key_effects": combinedEffects,
            "anti_patterns": reasoning.anti_patterns || "",
            "decision_rules": reasoning.decision_rules || {},
            "severity": reasoning.severity || "MEDIUM"
        };
    }
}

// ============ OUTPUT FORMATTERS ============
const BOX_WIDTH = 90;

function hexToAnsi(hexColor) {
    if (!hexColor || !hexColor.startsWith('#')) {
        return "";
    }
    const colorterm = process.env.COLORTERM || '';
    if (colorterm !== 'truecolor' && colorterm !== '24bit') {
        return "";
    }
    const cleanHex = hexColor.slice(1);
    if (cleanHex.length !== 6) {
        return "";
    }
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    return `\x1b[38;2;${r};${g};${b}m██\x1b[0m `;
}

function ansiLjust(s, width) {
    const clean = s.replace(/\x1b\[[0-9;]*m/g, '').replace(/\u001b\[[0-9;]*m/g, '');
    const visibleLen = clean.length;
    const pad = width - visibleLen;
    return s + " ".repeat(Math.max(0, pad));
}

function sectionHeader(name, width) {
    const label = `─── ${name} `;
    const fill = "─".repeat(width - label.length - 1);
    return `├${label}${fill}┤`;
}

function formatAsciiBox(designSystem) {
    const project = designSystem.project_name || "PROJECT";
    const pattern = designSystem.pattern || {};
    const style = designSystem.style || {};
    const colors = designSystem.colors || {};
    const typography = designSystem.typography || {};
    const effects = designSystem.key_effects || "";
    const antiPatterns = designSystem.anti_patterns || "";

    function wrapText(text, prefix, width) {
        if (!text) return [];
        const words = text.split(/\s+/);
        const lines = [];
        let currentLine = prefix;
        for (const word of words) {
            if (currentLine.length + word.length + (currentLine === prefix ? 0 : 1) <= width - 2) {
                currentLine += (currentLine === prefix ? "" : " ") + word;
            } else {
                if (currentLine !== prefix) {
                    lines.push(currentLine);
                }
                currentLine = prefix + word;
            }
        }
        if (currentLine !== prefix) {
            lines.push(currentLine);
        }
        return lines;
    }

    const sections = (pattern.sections || "").split(">").map(s => s.trim()).filter(Boolean);
    const lines = [];
    const w = BOX_WIDTH - 1;

    // Header with double-line box
    lines.push("╔" + "═".repeat(w) + "╗");
    lines.push(ansiLjust(`║  TARGET: ${project} - RECOMMENDED DESIGN SYSTEM`, BOX_WIDTH) + "║");
    lines.push("╚" + "═".repeat(w) + "╝");
    lines.push("┌" + "─".repeat(w) + "┐");

    // Pattern section
    lines.push(sectionHeader("PATTERN", BOX_WIDTH + 1));
    lines.push(`│  Name: ${pattern.name || ''}`.padEnd(BOX_WIDTH) + "│");
    if (pattern.conversion) {
        lines.push(`│     Conversion: ${pattern.conversion}`.padEnd(BOX_WIDTH) + "│");
    }
    if (pattern.cta_placement) {
        lines.push(`│     CTA: ${pattern.cta_placement}`.padEnd(BOX_WIDTH) + "│");
    }
    lines.push("│     Sections:".padEnd(BOX_WIDTH) + "│");
    sections.forEach((section, idx) => {
        lines.push(`│       ${idx + 1}. ${section}`.padEnd(BOX_WIDTH) + "│");
    });

    // Style section
    lines.push(sectionHeader("STYLE", BOX_WIDTH + 1));
    lines.push(`│  Name: ${style.name || ''}`.padEnd(BOX_WIDTH) + "│");
    const light = style.light_mode || "";
    const dark = style.dark_mode || "";
    if (light || dark) {
        lines.push(`│     Mode Support: Light ${light}  Dark ${dark}`.padEnd(BOX_WIDTH) + "│");
    }
    if (style.keywords) {
        wrapText(`Keywords: ${style.keywords}`, "│     ", BOX_WIDTH).forEach(line => {
            lines.push(line.padEnd(BOX_WIDTH) + "│");
        });
    }
    if (style.best_for) {
        wrapText(`Best For: ${style.best_for}`, "│     ", BOX_WIDTH).forEach(line => {
            lines.push(line.padEnd(BOX_WIDTH) + "│");
        });
    }
    if (style.performance || style.accessibility) {
        const perfA11y = `Performance: ${style.performance || ''} | Accessibility: ${style.accessibility || ''}`;
        lines.push(`│     ${perfA11y}`.padEnd(BOX_WIDTH) + "│");
    }

    // Colors section
    lines.push(sectionHeader("COLORS", BOX_WIDTH + 1));
    const colorEntries = [
        ["Primary",      "primary",      "--color-primary"],
        ["On Primary",   "on_primary",   "--color-on-primary"],
        ["Secondary",    "secondary",    "--color-secondary"],
        ["Accent/CTA",   "accent",       "--color-accent"],
        ["Background",   "background",   "--color-background"],
        ["Foreground",   "foreground",   "--color-foreground"],
        ["Muted",        "muted",        "--color-muted"],
        ["Border",       "border",       "--color-border"],
        ["Destructive",  "destructive",  "--color-destructive"],
        ["Ring",         "ring",         "--color-ring"],
    ];
    for (const [label, key, cssVar] of colorEntries) {
        const hexVal = colors[key];
        if (!hexVal) continue;
        const swatch = hexToAnsi(hexVal);
        const labelWithColon = label + ":";
        const content = `│     ${swatch}${labelWithColon.padEnd(14)} ${hexVal.padEnd(10)} (${cssVar})`;
        lines.push(ansiLjust(content, BOX_WIDTH) + "│");
    }
    if (colors.notes) {
        wrapText(`Notes: ${colors.notes}`, "│     ", BOX_WIDTH).forEach(line => {
            lines.push(line.padEnd(BOX_WIDTH) + "│");
        });
    }

    // Typography section
    lines.push(sectionHeader("TYPOGRAPHY", BOX_WIDTH + 1));
    lines.push(`│  ${typography.heading || ''} / ${typography.body || ''}`.padEnd(BOX_WIDTH) + "│");
    if (typography.mood) {
        wrapText(`Mood: ${typography.mood}`, "│     ", BOX_WIDTH).forEach(line => {
            lines.push(line.padEnd(BOX_WIDTH) + "│");
        });
    }
    if (typography.best_for) {
        wrapText(`Best For: ${typography.best_for}`, "│     ", BOX_WIDTH).forEach(line => {
            lines.push(line.padEnd(BOX_WIDTH) + "│");
        });
    }
    if (typography.google_fonts_url) {
        lines.push(`│     Google Fonts: ${typography.google_fonts_url}`.padEnd(BOX_WIDTH) + "│");
    }
    if (typography.css_import) {
        lines.push(`│     CSS Import: ${typography.css_import.substring(0, 70)}...`.padEnd(BOX_WIDTH) + "│");
    }

    // Key Effects section
    if (effects) {
        lines.push(sectionHeader("KEY EFFECTS", BOX_WIDTH + 1));
        wrapText(effects, "│     ", BOX_WIDTH).forEach(line => {
            lines.push(line.padEnd(BOX_WIDTH) + "│");
        });
    }

    // Anti-patterns section
    if (antiPatterns) {
        lines.push(sectionHeader("AVOID", BOX_WIDTH + 1));
        wrapText(antiPatterns, "│     ", BOX_WIDTH).forEach(line => {
            lines.push(line.padEnd(BOX_WIDTH) + "│");
        });
    }

    // Pre-delivery Checklist
    lines.push(sectionHeader("PRE-DELIVERY CHECKLIST", BOX_WIDTH + 1));
    const checklistItems = [
        "[ ] No emojis as icons (use SVG: Heroicons/Lucide)",
        "[ ] cursor-pointer on all clickable elements",
        "[ ] Hover states with smooth transitions (150-300ms)",
        "[ ] Light mode: text contrast 4.5:1 minimum",
        "[ ] Focus states visible for keyboard nav",
        "[ ] prefers-reduced-motion respected",
        "[ ] Responsive: 375px, 768px, 1024px, 1440px"
    ];
    for (const item of checklistItems) {
        lines.push(`│     ${item}`.padEnd(BOX_WIDTH) + "│");
    }

    lines.push("└" + "─".repeat(w) + "┘");

    return lines.join("\n");
}

function formatMarkdown(designSystem) {
    const project = designSystem.project_name || "PROJECT";
    const pattern = designSystem.pattern || {};
    const style = designSystem.style || {};
    const colors = designSystem.colors || {};
    const typography = designSystem.typography || {};
    const effects = designSystem.key_effects || "";
    const antiPatterns = designSystem.anti_patterns || "";

    const lines = [];
    lines.push(`## Design System: ${project}`);
    lines.push("");

    // Pattern
    lines.push("### Pattern");
    lines.push(`- **Name:** ${pattern.name || ''}`);
    if (pattern.conversion) {
        lines.push(`- **Conversion Focus:** ${pattern.conversion}`);
    }
    if (pattern.cta_placement) {
        lines.push(`- **CTA Placement:** ${pattern.cta_placement}`);
    }
    if (pattern.color_strategy) {
        lines.push(`- **Color Strategy:** ${pattern.color_strategy}`);
    }
    lines.push(`- **Sections:** ${pattern.sections || ''}`);
    lines.push("");

    // Style
    lines.push("### Style");
    lines.push(`- **Name:** ${style.name || ''}`);
    const light = style.light_mode || "";
    const dark = style.dark_mode || "";
    if (light || dark) {
        lines.push(`- **Mode Support:** Light ${light} | Dark ${dark}`);
    }
    if (style.keywords) {
        lines.push(`- **Keywords:** ${style.keywords}`);
    }
    if (style.best_for) {
        lines.push(`- **Best For:** ${style.best_for}`);
    }
    if (style.performance || style.accessibility) {
        lines.push(`- **Performance:** ${style.performance || ''} | **Accessibility:** ${style.accessibility || ''}`);
    }
    lines.push("");

    // Colors
    lines.push("### Colors");
    lines.push("| Role | Hex | CSS Variable |");
    lines.push("|------|-----|--------------|");
    const mdColorEntries = [
        ["Primary",      "primary",      "--color-primary"],
        ["On Primary",   "on_primary",   "--color-on-primary"],
        ["Secondary",    "secondary",    "--color-secondary"],
        ["Accent/CTA",   "accent",       "--color-accent"],
        ["Background",   "background",   "--color-background"],
        ["Foreground",   "foreground",   "--color-foreground"],
        ["Muted",        "muted",        "--color-muted"],
        ["Border",       "border",       "--color-border"],
        ["Destructive",  "destructive",  "--color-destructive"],
        ["Ring",         "ring",         "--color-ring"],
    ];
    for (const [label, key, cssVar] of mdColorEntries) {
        const hexVal = colors[key];
        if (hexVal) {
            lines.push(`| ${label} | \`${hexVal}\` | \`${cssVar}\` |`);
        }
    }
    if (colors.notes) {
        lines.push(`\n*Notes: ${colors.notes}*`);
    }
    lines.push("");

    // Typography
    lines.push("### Typography");
    lines.push(`- **Heading:** ${typography.heading || ''}`);
    lines.push(`- **Body:** ${typography.body || ''}`);
    if (typography.mood) {
        lines.push(`- **Mood:** ${typography.mood}`);
    }
    if (typography.best_for) {
        lines.push(`- **Best For:** ${typography.best_for}`);
    }
    if (typography.google_fonts_url) {
        lines.push(`- **Google Fonts:** ${typography.google_fonts_url}`);
    }
    if (typography.css_import) {
        lines.push("- **CSS Import:**");
        lines.push("```css");
        lines.push(typography.css_import);
        lines.push("```");
    }
    lines.push("");

    // Key Effects
    if (effects) {
        lines.push("### Key Effects");
        lines.push(effects);
        lines.push("");
    }

    // Anti-patterns
    if (antiPatterns) {
        lines.push("### Avoid (Anti-patterns)");
        lines.push(`- ${antiPatterns.replace(/\s*\+\s*/g, '\n- ')}`);
        lines.push("");
    }

    // Pre-delivery Checklist
    lines.push("### Pre-Delivery Checklist");
    lines.push("- [ ] No emojis as icons (use SVG: Heroicons/Lucide)");
    lines.push("- [ ] cursor-pointer on all clickable elements");
    lines.push("- [ ] Hover states with smooth transitions (150-300ms)");
    lines.push("- [ ] Light mode: text contrast 4.5:1 minimum");
    lines.push("- [ ] Focus states visible for keyboard nav");
    lines.push("- [ ] prefers-reduced-motion respected");
    lines.push("- [ ] Responsive: 375px, 768px, 1024px, 1440px");
    lines.push("");

    return lines.join("\n");
}

function generateDesignSystem(query, projectName = null, outputFormat = "ascii", 
                              persist = false, page = null, outputDir = null) {
    const generator = new DesignSystemGenerator();
    const designSystem = generator.generate(query, projectName);

    // Persist to files if requested
    if (persist) {
        persistDesignSystem(designSystem, page, outputDir, query);
    }

    if (outputFormat === "markdown") {
        return formatMarkdown(designSystem);
    }
    return formatAsciiBox(designSystem);
}

function persistDesignSystem(designSystem, page = null, outputDir = null, pageQuery = null) {
    const baseDir = outputDir ? path.resolve(outputDir) : process.cwd();

    const projectName = designSystem.project_name || "default";
    const projectSlug = projectName.toLowerCase().replace(/\s+/g, '-');

    const designSystemDir = path.join(baseDir, "design-system", projectSlug);
    const pagesDir = path.join(designSystemDir, "pages");

    const createdFiles = [];

    // Create directories
    fs.mkdirSync(designSystemDir, { recursive: true });
    fs.mkdirSync(pagesDir, { recursive: true });

    const masterFile = path.join(designSystemDir, "MASTER.md");

    // Generate and write MASTER.md
    const masterContent = formatMasterMd(designSystem);
    fs.writeFileSync(masterFile, masterContent, 'utf8');
    createdFiles.push(masterFile);

    // If page is specified, create page override file
    if (page) {
        const pageFile = path.join(pagesDir, `${page.toLowerCase().replace(/\s+/g, '-')}.md`);
        const pageContent = formatPageOverrideMd(designSystem, page, pageQuery);
        fs.writeFileSync(pageFile, pageContent, 'utf8');
        createdFiles.push(pageFile);
    }

    return {
        "status": "success",
        "design_system_dir": designSystemDir,
        "created_files": createdFiles
    };
}

function formatMasterMd(designSystem) {
    const project = designSystem.project_name || "PROJECT";
    const pattern = designSystem.pattern || {};
    const style = designSystem.style || {};
    const colors = designSystem.colors || {};
    const typography = designSystem.typography || {};
    const effects = designSystem.key_effects || "";
    const antiPatterns = designSystem.anti_patterns || "";

    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const lines = [];

    lines.push("# Design System Master File");
    lines.push("");
    lines.push("> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.");
    lines.push("> If that file exists, its rules **override** this Master file.");
    lines.push("> If not, strictly follow the rules below.");
    lines.push("");
    lines.push("---");
    lines.push("");
    lines.push(`**Project:** ${project}`);
    lines.push(`**Generated:** ${timestamp}`);
    lines.push(`**Category:** ${designSystem.category || 'General'}`);
    lines.push("");
    lines.push("---");
    lines.push("");

    lines.push("## Global Rules");
    lines.push("");

    // Color Palette
    lines.push("### Color Palette");
    lines.push("");
    lines.push("| Role | Hex | CSS Variable |");
    lines.push("|------|-----|--------------|");
    const masterColorEntries = [
        ["Primary",      "primary",      "--color-primary"],
        ["On Primary",   "on_primary",   "--color-on-primary"],
        ["Secondary",    "secondary",    "--color-secondary"],
        ["Accent/CTA",   "accent",       "--color-accent"],
        ["Background",   "background",   "--color-background"],
        ["Foreground",   "foreground",   "--color-foreground"],
        ["Muted",        "muted",        "--color-muted"],
        ["Border",       "border",       "--color-border"],
        ["Destructive",  "destructive",  "--color-destructive"],
        ["Ring",         "ring",         "--color-ring"],
    ];
    for (const [label, key, cssVar] of masterColorEntries) {
        const hexVal = colors[key];
        if (hexVal) {
            lines.push(`| ${label} | \`${hexVal}\` | \`${cssVar}\` |`);
        }
    }
    lines.push("");
    if (colors.notes) {
        lines.push(`**Color Notes:** ${colors.notes}`);
        lines.push("");
    }

    // Typography
    lines.push("### Typography");
    lines.push("");
    lines.push(`- **Heading Font:** ${typography.heading || 'Inter'}`);
    lines.push(`- **Body Font:** ${typography.body || 'Inter'}`);
    if (typography.mood) {
        lines.push(`- **Mood:** ${typography.mood}`);
    }
    if (typography.google_fonts_url) {
        lines.push(`- **Google Fonts:** [${typography.heading || ''} + ${typography.body || ''}](${typography.google_fonts_url})`);
    }
    lines.push("");
    if (typography.css_import) {
        lines.push("**CSS Import:**");
        lines.push("```css");
        lines.push(typography.css_import);
        lines.push("```");
        lines.push("");
    }

    // Spacing
    lines.push("### Spacing Variables");
    lines.push("");
    lines.push("| Token | Value | Usage |");
    lines.push("|-------|-------|-------|");
    lines.push("| `--space-xs` | `4px` / `0.25rem` | Tight gaps |");
    lines.push("| `--space-sm` | `8px` / `0.5rem` | Icon gaps, inline spacing |");
    lines.push("| `--space-md` | `16px` / `1rem` | Standard padding |");
    lines.push("| `--space-lg` | `24px` / `1.5rem` | Section padding |");
    lines.push("| `--space-xl` | `32px` / `2rem` | Large gaps |");
    lines.push("| `--space-2xl` | `48px` / `3rem` | Section margins |");
    lines.push("| `--space-3xl` | `64px` / `4rem` | Hero padding |");
    lines.push("");

    // Shadows
    lines.push("### Shadow Depths");
    lines.push("");
    lines.push("| Level | Value | Usage |");
    lines.push("|-------|-------|-------|");
    lines.push("| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle lift |");
    lines.push("| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.1)` | Cards, buttons |");
    lines.push("| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Modals, dropdowns |");
    lines.push("| `--shadow-xl` | `0 20px 25px rgba(0,0,0,0.15)` | Hero images, featured cards |");
    lines.push("");

    // Components
    lines.push("---");
    lines.push("");
    lines.push("## Component Specs");
    lines.push("");

    lines.push("### Buttons");
    lines.push("");
    lines.push("```css");
    lines.push("/* Primary Button */");
    lines.push(".btn-primary {");
    lines.push(`  background: ${colors.cta || '#F97316'};`);
    lines.push("  color: white;");
    lines.push("  padding: 12px 24px;");
    lines.push("  border-radius: 8px;");
    lines.push("  font-weight: 600;");
    lines.push("  transition: all 200ms ease;");
    lines.push("  cursor: pointer;");
    lines.push("}");
    lines.push("");
    lines.push(".btn-primary:hover {");
    lines.push("  opacity: 0.9;");
    lines.push("  transform: translateY(-1px);");
    lines.push("}");
    lines.push("");
    lines.push("/* Secondary Button */");
    lines.push(".btn-secondary {");
    lines.push("  background: transparent;");
    lines.push(`  color: ${colors.primary || '#2563EB'};`);
    lines.push(`  border: 2px solid ${colors.primary || '#2563EB'};`);
    lines.push("  padding: 12px 24px;");
    lines.push("  border-radius: 8px;");
    lines.push("  font-weight: 600;");
    lines.push("  transition: all 200ms ease;");
    lines.push("  cursor: pointer;");
    lines.push("}");
    lines.push("```");
    lines.push("");

    lines.push("### Cards");
    lines.push("");
    lines.push("```css");
    lines.push(".card {");
    lines.push(`  background: ${colors.background || '#FFFFFF'};`);
    lines.push("  border-radius: 12px;");
    lines.push("  padding: 24px;");
    lines.push("  box-shadow: var(--shadow-md);");
    lines.push("  transition: all 200ms ease;");
    lines.push("  cursor: pointer;");
    lines.push("}");
    lines.push("");
    lines.push(".card:hover {");
    lines.push("  box-shadow: var(--shadow-lg);");
    lines.push("  transform: translateY(-2px);");
    lines.push("}");
    lines.push("```");
    lines.push("");

    lines.push("### Inputs");
    lines.push("");
    lines.push("```css");
    lines.push(".input {");
    lines.push("  padding: 12px 16px;");
    lines.push("  border: 1px solid #E2E8F0;");
    lines.push("  border-radius: 8px;");
    lines.push("  font-size: 16px;");
    lines.push("  transition: border-color 200ms ease;");
    lines.push("}");
    lines.push("");
    lines.push(".input:focus {");
    lines.push(`  border-color: ${colors.primary || '#2563EB'};`);
    lines.push("  outline: none;");
    lines.push(`  box-shadow: 0 0 0 3px ${colors.primary || '#2563EB'}20;`);
    lines.push("}");
    lines.push("```");
    lines.push("");

    lines.push("### Modals");
    lines.push("");
    lines.push("```css");
    lines.push(".modal-overlay {");
    lines.push("  background: rgba(0, 0, 0, 0.5);");
    lines.push("  backdrop-filter: blur(4px);");
    lines.push("}");
    lines.push("");
    lines.push(".modal {");
    lines.push("  background: white;");
    lines.push("  border-radius: 16px;");
    lines.push("  padding: 32px;");
    lines.push("  box-shadow: var(--shadow-xl);");
    lines.push("  max-width: 500px;");
    lines.push("  width: 90%;");
    lines.push("}");
    lines.push("```");
    lines.push("");

    lines.push("---");
    lines.push("");
    lines.push("## Style Guidelines");
    lines.push("");
    lines.push(`**Style:** ${style.name || 'Minimalism'}`);
    lines.push("");
    if (style.keywords) {
        lines.push(`**Keywords:** ${style.keywords}`);
        lines.push("");
    }
    if (style.best_for) {
        lines.push(`**Best For:** ${style.best_for}`);
        lines.push("");
    }
    if (effects) {
        lines.push(`**Key Effects:** ${effects}`);
        lines.push("");
    }

    lines.push("### Page Pattern");
    lines.push("");
    lines.push(`**Pattern Name:** ${pattern.name || ''}`);
    lines.push("");
    if (pattern.conversion) {
        lines.push(`- **Conversion Strategy:** ${pattern.conversion}`);
    }
    if (pattern.cta_placement) {
        lines.push(`- **CTA Placement:** ${pattern.cta_placement}`);
    }
    lines.push(`- **Section Order:** ${pattern.sections || ''}`);
    lines.push("");

    lines.push("---");
    lines.push("");
    lines.push("## Anti-Patterns (Do NOT Use)");
    lines.push("");
    if (antiPatterns) {
        const antiList = antiPatterns.split("+").map(a => a.trim()).filter(Boolean);
        for (const anti of antiList) {
            lines.push(`- ❌ ${anti}`);
        }
    }
    lines.push("");
    lines.push("### Additional Forbidden Patterns");
    lines.push("");
    lines.push("- ❌ **Emojis as icons** — Use SVG icons (Heroicons, Lucide, Simple Icons)");
    lines.push("- ❌ **Missing cursor:pointer** — All clickable elements must have cursor:pointer");
    lines.push("- ❌ **Layout-shifting hovers** — Avoid scale transforms that shift layout");
    lines.push("- ❌ **Low contrast text** — Maintain 4.5:1 minimum contrast ratio");
    lines.push("- ❌ **Instant state changes** — Always use transitions (150-300ms)");
    lines.push("- ❌ **Invisible focus states** — Focus states must be visible for a11y");
    lines.push("");

    lines.push("---");
    lines.push("");
    lines.push("## Pre-Delivery Checklist");
    lines.push("");
    lines.push("Before delivering any UI code, verify:");
    lines.push("");
    lines.push("- [ ] No emojis used as icons (use SVG instead)");
    lines.push("- [ ] All icons from consistent icon set (Heroicons/Lucide)");
    lines.push("- [ ] `cursor-pointer` on all clickable elements");
    lines.push("- [ ] Hover states with smooth transitions (150-300ms)");
    lines.push("- [ ] Light mode: text contrast 4.5:1 minimum");
    lines.push("- [ ] Focus states visible for keyboard navigation");
    lines.push("- [ ] `prefers-reduced-motion` respected");
    lines.push("- [ ] Responsive: 375px, 768px, 1024px, 1440px");
    lines.push("- [ ] No content hidden behind fixed navbars");
    lines.push("- [ ] No horizontal scroll on mobile");
    lines.push("");

    return lines.join("\n");
}

function formatPageOverrideMd(designSystem, pageName, pageQuery = null) {
    const project = designSystem.project_name || "PROJECT";
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const pageTitle = pageName.replace(/-/g, ' ').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    const pageOverrides = _generateIntelligentOverrides(pageName, pageQuery, designSystem);

    const lines = [];

    lines.push(`# ${pageTitle} Page Overrides`);
    lines.push("");
    lines.push(`> **PROJECT:** ${project}`);
    lines.push(`> **Generated:** ${timestamp}`);
    lines.push(`> **Page Type:** ${pageOverrides.page_type || 'General'}`);
    lines.push("");
    lines.push("> ⚠️ **IMPORTANT:** Rules in this file **override** the Master file (`design-system/MASTER.md`).");
    lines.push("> Only deviations from the Master are documented here. For all other rules, refer to the Master.");
    lines.push("");
    lines.push("---");
    lines.push("");

    lines.push("## Page-Specific Rules");
    lines.push("");

    // Layout Overrides
    lines.push("### Layout Overrides");
    lines.push("");
    const layout = pageOverrides.layout || {};
    if (Object.keys(layout).length > 0) {
        for (const [key, value] of Object.entries(layout)) {
            lines.push(`- **${key}:** ${value}`);
        }
    } else {
        lines.push("- No overrides — use Master layout");
    }
    lines.push("");

    // Spacing Overrides
    lines.push("### Spacing Overrides");
    lines.push("");
    const spacing = pageOverrides.spacing || {};
    if (Object.keys(spacing).length > 0) {
        for (const [key, value] of Object.entries(spacing)) {
            lines.push(`- **${key}:** ${value}`);
        }
    } else {
        lines.push("- No overrides — use Master spacing");
    }
    lines.push("");

    // Typography Overrides
    lines.push("### Typography Overrides");
    lines.push("");
    const typography = pageOverrides.typography || {};
    if (Object.keys(typography).length > 0) {
        for (const [key, value] of Object.entries(typography)) {
            lines.push(`- **${key}:** ${value}`);
        }
    } else {
        lines.push("- No overrides — use Master typography");
    }
    lines.push("");

    // Color Overrides
    lines.push("### Color Overrides");
    lines.push("");
    const colors = pageOverrides.colors || {};
    if (Object.keys(colors).length > 0) {
        for (const [key, value] of Object.entries(colors)) {
            lines.push(`- **${key}:** ${value}`);
        }
    } else {
        lines.push("- No overrides — use Master colors");
    }
    lines.push("");

    // Component Overrides
    lines.push("### Component Overrides");
    lines.push("");
    const components = pageOverrides.components || [];
    if (components.length > 0) {
        for (const comp of components) {
            lines.push(`- ${comp}`);
        }
    } else {
        lines.push("- No overrides — use Master component specs");
    }
    lines.push("");

    // Page-Specific Components
    lines.push("---");
    lines.push("");
    lines.push("## Page-Specific Components");
    lines.push("");
    const uniqueComponents = pageOverrides.unique_components || [];
    if (uniqueComponents.length > 0) {
        for (const comp of uniqueComponents) {
            lines.push(`- ${comp}`);
        }
    } else {
        lines.push("- No unique components for this page");
    }
    lines.push("");

    // Recommendations
    lines.push("---");
    lines.push("");
    lines.push("## Recommendations");
    lines.push("");
    const recommendations = pageOverrides.recommendations || [];
    if (recommendations.length > 0) {
        for (const rec of recommendations) {
            lines.push(`- ${rec}`);
        }
    }
    lines.push("");

    return lines.join("\n");
}

function _generateIntelligentOverrides(pageName, pageQuery, designSystem) {
    const pageLower = pageName.toLowerCase();
    const queryLower = (pageQuery || "").toLowerCase();
    const combinedContext = `${pageLower} ${queryLower}`;

    // Search across multiple domains for page-specific guidance
    const styleSearch = search(combinedContext, "style", 1);
    const uxSearch = search(combinedContext, "ux", 3);
    const landingSearch = search(combinedContext, "landing", 1);

    const styleResults = styleSearch.results || [];
    const uxResults = uxSearch.results || [];
    const landingResults = landingSearch.results || [];

    const pageType = _detectPageType(combinedContext, styleResults);

    const layout = {};
    const spacing = {};
    const typography = {};
    const colors = {};
    const components = [];
    const uniqueComponents = [];
    const recommendations = [];

    // Extract style-based overrides
    if (styleResults.length > 0) {
        const style = styleResults[0];
        const keywords = (style.Keywords || "").toLowerCase();
        const effects = style["Effects & Animation"] || "";

        if (keywords.includes("data") || keywords.includes("dense") || keywords.includes("dashboard") || keywords.includes("grid")) {
            layout["Max Width"] = "1400px or full-width";
            layout["Grid"] = "12-column grid for data flexibility";
            spacing["Content Density"] = "High — optimize for information display";
        } else if (keywords.includes("minimal") || keywords.includes("simple") || keywords.includes("clean") || keywords.includes("single")) {
            layout["Max Width"] = "800px (narrow, focused)";
            layout["Layout"] = "Single column, centered";
            spacing["Content Density"] = "Low — focus on clarity";
        } else {
            layout["Max Width"] = "1200px (standard)";
            layout["Layout"] = "Full-width sections, centered content";
        }

        if (effects) {
            recommendations.push(`Effects: ${effects}`);
        }
    }

    // Extract UX guidelines
    for (const ux of uxResults) {
        const category = ux.Category || "";
        const doText = ux.Do || "";
        const dontText = ux["Don't"] || "";
        if (doText) {
            recommendations.push(`${category}: ${doText}`);
        }
        if (dontText) {
            components.push(`Avoid: ${dontText}`);
        }
    }

    // Extract landing pattern info
    if (landingResults.length > 0) {
        const landing = landingResults[0];
        const sections = landing["Section Order"] || "";
        const ctaPlacement = landing["Primary CTA Placement"] || "";
        const colorStrategy = landing["Color Strategy"] || "";

        if (sections) {
            layout["Sections"] = sections;
        }
        if (ctaPlacement) {
            recommendations.push(`CTA Placement: ${ctaPlacement}`);
        }
        if (colorStrategy) {
            colors["Strategy"] = colorStrategy;
        }
    }

    if (Object.keys(layout).length === 0) {
        layout["Max Width"] = "1200px";
        layout["Layout"] = "Responsive grid";
    }

    if (recommendations.length === 0) {
        recommendations.push("Refer to MASTER.md for all design rules");
        recommendations.push("Add specific overrides as needed for this page");
    }

    return {
        "page_type": pageType,
        "layout": layout,
        "spacing": spacing,
        "typography": typography,
        "colors": colors,
        "components": components,
        "unique_components": uniqueComponents,
        "recommendations": recommendations
    };
}

function _detectPageType(context, styleResults) {
    const contextLower = context.toLowerCase();

    const pagePatterns = [
        [["dashboard", "admin", "analytics", "data", "metrics", "stats", "monitor", "overview"], "Dashboard / Data View"],
        [["checkout", "payment", "cart", "purchase", "order", "billing"], "Checkout / Payment"],
        [["settings", "profile", "account", "preferences", "config"], "Settings / Profile"],
        [["landing", "marketing", "homepage", "hero", "home", "promo"], "Landing / Marketing"],
        [["login", "signin", "signup", "register", "auth", "password"], "Authentication"],
        [["pricing", "plans", "subscription", "tiers", "packages"], "Pricing / Plans"],
        [["blog", "article", "post", "news", "content", "story"], "Blog / Article"],
        [["product", "item", "detail", "pdp", "shop", "store"], "Product Detail"],
        [["search", "results", "browse", "filter", "catalog", "list"], "Search Results"],
        [["empty", "404", "error", "not found", "zero"], "Empty State"],
    ];

    for (const [keywords, pageType] of pagePatterns) {
        if (keywords.some(kw => contextLower.includes(kw))) {
            return pageType;
        }
    }

    if (styleResults.length > 0) {
        const bestFor = (styleResults[0]["Best For"] || "").toLowerCase();
        if (bestFor.includes("dashboard") || bestFor.includes("data")) {
            return "Dashboard / Data View";
        } else if (bestFor.includes("landing") || bestFor.includes("marketing")) {
            return "Landing / Marketing";
        }
    }

    return "General";
}

module.exports = {
    DesignSystemGenerator,
    generateDesignSystem,
    persistDesignSystem,
    formatMasterMd,
    formatPageOverrideMd,
    hexToAnsi,
    ansiLjust,
    sectionHeader
};
