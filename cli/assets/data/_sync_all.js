#!/usr/bin/env node

/**
 * Sync colors.csv and ui-reasoning.csv with the updated products.csv (161 entries).
 * - Remove deleted product types
 * - Rename mismatched entries
 * - Add new entries for missing product types
 * - Keep colors.csv aligned 1:1 with products.csv
 * - Renumber everything
 */

const fs = require('fs');
const path = require('path');

const BASE = __dirname;

// Helper CSV parser (same as in core.js)
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

function formatCSVRow(fields, headers) {
    return headers.map(h => {
        let val = String(fields[h] || "");
        if (val.includes(',') || val.includes('"') || val.includes('\n') || val.includes('\r')) {
            val = '"' + val.replace(/"/g, '""') + '"';
        }
        return val;
    }).join(",");
}

function writeCSV(filepath, data, headers) {
    const lines = [headers.join(",")];
    for (const row of data) {
        lines.push(formatCSVRow(row, headers));
    }
    fs.writeFileSync(filepath, lines.join("\n") + "\n", 'utf8');
}

// ─── Color derivation helpers ────────────────────────────────────────────────
function h2r(h) {
    const clean = h.replace(/^#/, '');
    const bigint = parseInt(clean, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return [r, g, b];
}

function r2h(r, g, b) {
    const clamp = (val) => Math.max(0, Math.min(255, Math.round(val)));
    const rh = clamp(r).toString(16).padStart(2, '0').toUpperCase();
    const gh = clamp(g).toString(16).padStart(2, '0').toUpperCase();
    const bh = clamp(b).toString(16).padStart(2, '0').toUpperCase();
    return `#${rh}${gh}${bh}`;
}

function lum(h) {
    const rgb = h2r(h).map(x => x / 255.0);
    const adjusted = rgb.map(x => x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4));
    return 0.2126 * adjusted[0] + 0.7152 * adjusted[1] + 0.0722 * adjusted[2];
}

function isDark(bg) {
    return lum(bg) < 0.18;
}

function onColor(bg) {
    return lum(bg) < 0.4 ? "#FFFFFF" : "#0F172A";
}

function blend(a, b, f = 0.15) {
    const [ra, ga, ba] = h2r(a);
    const [rb, gb, bb] = h2r(b);
    return r2h(ra + (rb - ra) * f, ga + (gb - ga) * f, ba + (bb - ba) * f);
}

function shift(h, n) {
    const [r, g, b] = h2r(h);
    return r2h(r + n, g + n, b + n);
}

function deriveRow(pt, pri, sec, acc, bg, notes = "") {
    const dark = isDark(bg);
    const fg = dark ? "#FFFFFF" : "#0F172A";
    const on_pri = onColor(pri);
    const on_sec = onColor(sec);
    const on_acc = onColor(acc);
    const card = dark ? shift(bg, 10) : "#FFFFFF";
    const card_fg = dark ? "#FFFFFF" : "#0F172A";
    const muted = dark ? blend(bg, pri, 0.08) : blend("#FFFFFF", pri, 0.06);
    const muted_fg = dark ? "#94A3B8" : "#64748B";
    const border = dark ? "rgba(255,255,255,0.08)" : blend("#FFFFFF", pri, 0.12);
    const destr = "#DC2626";
    const on_destr = "#FFFFFF";
    const ring = pri;
    return [pt, pri, on_pri, sec, on_sec, acc, on_acc, bg, fg, card, card_fg, muted, muted_fg, border, destr, on_destr, ring, notes];
}

// ─── Rename maps ─────────────────────────────────────────────────────────────
const COLOR_RENAMES = {
    "Quantum Computing": "Quantum Computing Interface",
    "Biohacking / Longevity": "Biohacking / Longevity App",
    "Autonomous Systems": "Autonomous Drone Fleet Manager",
    "Generative AI Art": "Generative Art Platform",
    "Spatial / Vision OS": "Spatial Computing OS / App",
    "Climate Tech": "Sustainable Energy / Climate Tech",
};

const UI_RENAMES = {
    "Architecture/Interior": "Architecture / Interior",
    "Autonomous Drone Fleet": "Autonomous Drone Fleet Manager",
    "B2B SaaS Enterprise": "B2B Service",
    "Biohacking/Longevity App": "Biohacking / Longevity App",
    "Biotech/Life Sciences": "Biotech / Life Sciences",
    "Developer Tool/IDE": "Developer Tool / IDE",
    "Education": "Educational App",
    "Fintech (Banking)": "Fintech/Crypto",
    "Government/Public": "Government/Public Service",
    "Home Services": "Home Services (Plumber/Electrician)",
    "Micro-Credentials/Badges": "Micro-Credentials/Badges Platform",
    "Music/Entertainment": "Music Streaming",
    "Quantum Computing": "Quantum Computing Interface",
    "Real Estate": "Real Estate/Property",
    "Remote Work/Collaboration": "Remote Work/Collaboration Tool",
    "Restaurant/Food": "Restaurant/Food Service",
    "SaaS Dashboard": "Analytics Dashboard",
    "Space Tech/Aerospace": "Space Tech / Aerospace",
    "Spatial Computing OS": "Spatial Computing OS / App",
    "Startup Landing": "Micro SaaS",
    "Sustainable Energy/Climate": "Sustainable Energy / Climate Tech",
    "Travel/Tourism": "Travel/Tourism Agency",
    "Wellness/Mental Health": "Mental Health App",
};

const REMOVE_TYPES = new Set([
    "Service Landing Page", "Sustainability/ESG Platform",
    "Cleaning Service", "Coffee Shop",
    "Consulting Firm", "Conference/Webinar Platform",
]);

// ─── New color definitions: (primary, secondary, accent, bg, notes) ──────────
const NEW_COLORS = {
    "Todo & Task Manager":         ["#2563EB","#3B82F6","#059669","#F8FAFC","Functional blue + progress green"],
    "Personal Finance Tracker":    ["#1E40AF","#3B82F6","#059669","#0F172A","Trust blue + profit green on dark"],
    "Chat & Messaging App":        ["#2563EB","#6366F1","#059669","#FFFFFF","Messenger blue + online green"],
    "Notes & Writing App":         ["#78716C","#A8A29E","#D97706","#FFFBEB","Warm ink + amber accent on cream"],
    "Habit Tracker":               ["#D97706","#F59E0B","#059669","#FFFBEB","Streak amber + habit green"],
    "Food Delivery / On-Demand":   ["#EA580C","#F97316","#2563EB","#FFF7ED","Appetizing orange + trust blue"],
    "Ride Hailing / Transportation":["#1E293B","#334155","#2563EB","#0F172A","Map dark + route blue"],
    "Recipe & Cooking App":        ["#9A3412","#C2410C","#059669","#FFFBEB","Warm terracotta + fresh green"],
    "Meditation & Mindfulness":    ["#7C3AED","#8B5CF6","#059669","#FAF5FF","Calm lavender + mindful green"],
    "Weather App":                 ["#0284C7","#0EA5E9","#F59E0B","#F0F9FF","Sky blue + sun amber"],
    "Diary & Journal App":         ["#92400E","#A16207","#6366F1","#FFFBEB","Warm journal brown + ink violet"],
    "CRM & Client Management":     ["#2563EB","#3B82F6","#059669","#F8FAFC","Professional blue + deal green"],
    "Inventory & Stock Management":["#334155","#475569","#059669","#F8FAFC","Industrial slate + stock green"],
    "Flashcard & Study Tool":      ["#7C3AED","#8B5CF6","#059669","#FAF5FF","Study purple + correct green"],
    "Booking & Appointment App":   ["#0284C7","#0EA5E9","#059669","#F0F9FF","Calendar blue + available green"],
    "Invoice & Billing Tool":      ["#1E3A5F","#2563EB","#059669","#F8FAFC","Navy professional + paid green"],
    "Grocery & Shopping List":     ["#059669","#10B981","#D97706","#ECFDF5","Fresh green + food amber"],
    "Timer & Pomodoro":            ["#DC2626","#EF4444","#059669","#0F172A","Focus red on dark + break green"],
    "Parenting & Baby Tracker":    ["#EC4899","#F472B6","#0284C7","#FDF2F8","Soft pink + trust blue"],
    "Scanner & Document Manager":  ["#1E293B","#334155","#2563EB","#F8FAFC","Document grey + scan blue"],
    "Calendar & Scheduling App":   ["#2563EB","#3B82F6","#059669","#F8FAFC","Calendar blue + event green"],
    "Password Manager":            ["#1E3A5F","#334155","#059669","#0F172A","Vault dark blue + secure green"],
    "Expense Splitter / Bill Split":["#059669","#10B981","#DC2626","#F8FAFC","Balance green + owe red"],
    "Voice Recorder & Memo":       ["#DC2626","#EF4444","#2563EB","#FFFFFF","Recording red + waveform blue"],
    "Bookmark & Read-Later":       ["#D97706","#F59E0B","#2563EB","#FFFBEB","Warm amber + link blue"],
    "Translator App":              ["#2563EB","#0891B2","#EA580C","#F8FAFC","Global blue + teal + accent orange"],
    "Calculator & Unit Converter": ["#EA580C","#F97316","#2563EB","#1C1917","Operation orange on dark"],
    "Alarm & World Clock":         ["#D97706","#F59E0B","#6366F1","#0F172A","Time amber + night indigo on dark"],
    "File Manager & Transfer":     ["#2563EB","#3B82F6","#D97706","#F8FAFC","Folder blue + file amber"],
    "Email Client":                ["#2563EB","#3B82F6","#DC2626","#FFFFFF","Inbox blue + priority red"],
    "Casual Puzzle Game":          ["#EC4899","#8B5CF6","#F59E0B","#FDF2F8","Cheerful pink + reward gold"],
    "Trivia & Quiz Game":          ["#2563EB","#7C3AED","#F59E0B","#EFF6FF","Quiz blue + gold leaderboard"],
    "Card & Board Game":           ["#15803D","#166534","#D97706","#0F172A","Felt green + gold on dark"],
    "Idle & Clicker Game":         ["#D97706","#F59E0B","#7C3AED","#FFFBEB","Coin gold + prestige purple"],
    "Word & Crossword Game":       ["#15803D","#059669","#D97706","#FFFFFF","Word green + letter amber"],
    "Arcade & Retro Game":         ["#DC2626","#2563EB","#22C55E","#0F172A","Neon red+blue on dark + score green"],
    "Photo Editor & Filters":      ["#7C3AED","#6366F1","#0891B2","#0F172A","Editor violet + filter cyan on dark"],
    "Short Video Editor":          ["#EC4899","#DB2777","#2563EB","#0F172A","Video pink on dark + timeline blue"],
    "Drawing & Sketching Canvas":  ["#7C3AED","#8B5CF6","#0891B2","#1C1917","Canvas purple + tool teal on dark"],
    "Music Creation & Beat Maker": ["#7C3AED","#6366F1","#22C55E","#0F172A","Studio purple + waveform green on dark"],
    "Meme & Sticker Maker":        ["#EC4899","#F59E0B","#2563EB","#FFFFFF","Viral pink + comedy yellow + share blue"],
    "AI Photo & Avatar Generator": ["#7C3AED","#6366F1","#EC4899","#FAF5FF","AI purple + generation pink"],
    "Link-in-Bio Page Builder":    ["#2563EB","#7C3AED","#EC4899","#FFFFFF","Brand blue + creator purple"],
    "Wardrobe & Outfit Planner":   ["#BE185D","#EC4899","#D97706","#FDF2F8","Fashion rose + gold accent"],
    "Plant Care Tracker":          ["#15803D","#059669","#D97706","#F0FDF4","Nature green + sun yellow"],
    "Book & Reading Tracker":      ["#78716C","#92400E","#D97706","#FFFBEB","Book brown + page amber"],
    "Couple & Relationship App":   ["#BE185D","#EC4899","#DC2626","#FDF2F8","Romance rose + love red"],
    "Family Calendar & Chores":    ["#2563EB","#059669","#D97706","#F8FAFC","Family blue + chore green"],
    "Mood Tracker":                ["#7C3AED","#6366F1","#D97706","#FAF5FF","Mood purple + insight amber"],
    "Gift & Wishlist":             ["#DC2626","#D97706","#EC4899","#FFF1F2","Gift red + gold + surprise pink"],
    "Running & Cycling GPS":       ["#EA580C","#F97316","#059669","#0F172A","Energetic orange + pace green on dark"],
    "Yoga & Stretching Guide":     ["#6B7280","#78716C","#0891B2","#F5F5F0","Sage neutral + calm teal"],
    "Sleep Tracker":               ["#4338CA","#6366F1","#7C3AED","#0F172A","Night indigo + dream violet on dark"],
    "Calorie & Nutrition Counter": ["#059669","#10B981","#EA580C","#ECFDF5","Healthy green + macro orange"],
    "Period & Cycle Tracker":      ["#BE185D","#EC4899","#7C3AED","#FDF2F8","Blush rose + fertility lavender"],
    "Medication & Pill Reminder":  ["#0284C7","#0891B2","#DC2626","#F0F9FF","Medical blue + alert red"],
    "Water & Hydration Reminder":  ["#0284C7","#06B6D4","#0891B2","#F0F9FF","Refreshing blue + water cyan"],
    "Fasting & Intermittent Timer":["#6366F1","#4338CA","#059669","#0F172A","Fasting indigo on dark + eating green"],
    "Anonymous Community / Confession":["#475569","#334155","#0891B2","#0F172A","Protective grey + subtle teal on dark"],
    "Local Events & Discovery":    ["#EA580C","#F97316","#2563EB","#FFF7ED","Event orange + map blue"],
    "Study Together / Virtual Coworking":["#2563EB","#3B82F6","#059669","#F8FAFC","Focus blue + session green"],
    "Coding Challenge & Practice": ["#22C55E","#059669","#D97706","#0F172A","Code green + difficulty amber on dark"],
    "Kids Learning (ABC & Math)":  ["#2563EB","#F59E0B","#EC4899","#EFF6FF","Learning blue + play yellow + fun pink"],
    "Music Instrument Learning":   ["#DC2626","#9A3412","#D97706","#FFFBEB","Musical red + warm amber"],
    "Parking Finder":              ["#2563EB","#059669","#DC2626","#F0F9FF","Available blue/green + occupied red"],
    "Public Transit Guide":        ["#2563EB","#0891B2","#EA580C","#F8FAFC","Transit blue + line colors"],
    "Road Trip Planner":           ["#EA580C","#0891B2","#D97706","#FFF7ED","Adventure orange + map teal"],
    "VPN & Privacy Tool":          ["#1E3A5F","#334155","#22C55E","#0F172A","Shield dark + connected green"],
    "Emergency SOS & Safety":      ["#DC2626","#EF4444","#2563EB","#FFF1F2","Alert red + safety blue"],
    "Wallpaper & Theme App":       ["#7C3AED","#EC4899","#2563EB","#FAF5FF","Aesthetic purple + trending pink"],
    "White Noise & Ambient Sound": ["#475569","#334155","#4338CA","#0F172A","Ambient grey + deep indigo on dark"],
    "Home Decoration & Interior Design":["#78716C","#A8A29E","#D97706","#FAF5F2","Interior warm grey + gold accent"],
};

// ─── 1. REBUILD colors.csv ───────────────────────────────────────────────────
function rebuildColors() {
    const src = path.join(BASE, "colors.csv");
    const text = fs.readFileSync(src, 'utf8');
    const existing = parseCSV(text);

    // Build lookup: Product Type -> row data
    const colorMap = {};
    for (const row of existing) {
        let pt = (row["Product Type"] || "").trim();
        if (!pt) continue;
        // Remove deleted types
        if (REMOVE_TYPES.has(pt)) {
            console.log(`  [colors] REMOVE: ${pt}`);
            continue;
        }
        // Rename mismatched types
        if (pt in COLOR_RENAMES) {
            const newName = COLOR_RENAMES[pt];
            console.log(`  [colors] RENAME: ${pt} → ${newName}`);
            row["Product Type"] = newName;
            pt = newName;
        }
        colorMap[pt] = row;
    }

    // Read products.csv to get the correct order
    const productsText = fs.readFileSync(path.join(BASE, "products.csv"), 'utf8');
    const products = parseCSV(productsText);

    // Build final rows in products.csv order
    const headers = ["No", "Product Type", "Primary", "On Primary", "Secondary", "On Secondary", "Accent", "On Accent", "Background", "Foreground", "Card", "Card Foreground", "Muted", "Muted Foreground", "Border", "Destructive", "On Destructive", "Ring", "Notes"];
    const finalRows = [];
    let added = 0;

    products.forEach((prod, index) => {
        const i = index + 1;
        const pt = prod["Product Type"];
        if (pt in colorMap) {
            const row = colorMap[pt];
            row["No"] = String(i);
            finalRows.push(row);
        } else if (pt in NEW_COLORS) {
            const [pri, sec, acc, bg, notes] = NEW_COLORS[pt];
            const newRowValues = deriveRow(pt, pri, sec, acc, bg, notes);
            
            const newRowObj = { "No": String(i) };
            headers.slice(1).forEach((header, hIdx) => {
                newRowObj[header] = newRowValues[hIdx];
            });
            finalRows.push(newRowObj);
            added++;
        } else {
            console.log(`  [colors] WARNING: No color data for '${pt}' - using defaults`);
            const newRowValues = deriveRow(pt, "#2563EB", "#3B82F6", "#059669", "#F8FAFC", "Auto-generated default");
            
            const newRowObj = { "No": String(i) };
            headers.slice(1).forEach((header, hIdx) => {
                newRowObj[header] = newRowValues[hIdx];
            });
            finalRows.push(newRowObj);
            added++;
        }
    });

    writeCSV(src, finalRows, headers);
    console.log(`\n  ✅ colors.csv: ${finalRows.length} rows (${products.length} products)`);
    console.log(`     Added: ${added} new color rows`);
}

// ─── 2. REBUILD ui-reasoning.csv ─────────────────────────────────────────────
function deriveUiReasoning(prod) {
    const pt = prod["Product Type"];
    const style = prod["Primary Style Recommendation"] || "";
    const landing = prod["Landing Page Pattern"] || "";
    const colorFocus = prod["Color Palette Focus"] || "";
    const considerations = prod["Key Considerations"] || "";
    const keywords = prod["Keywords"] || "";

    // Typography mood derived from style
    const typoMap = {
        "Minimalism": "Professional + Clean hierarchy",
        "Glassmorphism": "Modern + Clear hierarchy",
        "Brutalism": "Bold + Oversized + Monospace",
        "Claymorphism": "Playful + Rounded + Friendly",
        "Dark Mode": "High contrast + Light on dark",
        "Neumorphism": "Subtle + Soft + Monochromatic",
        "Flat Design": "Bold + Clean + Sans-serif",
        "Vibrant": "Energetic + Bold + Large",
        "Aurora": "Elegant + Gradient-friendly",
        "AI-Native": "Conversational + Minimal chrome",
        "Organic": "Warm + Humanist + Natural",
        "Motion": "Dynamic + Hierarchy-shifting",
        "Accessible": "Large + High contrast + Clear",
        "Soft UI": "Modern + Accessible + Balanced",
        "Trust": "Professional + Serif accents",
        "Swiss": "Grid-based + Mathematical + Helvetica",
        "3D": "Immersive + Spatial + Variable",
        "Retro": "Nostalgic + Monospace + Neon",
        "Cyberpunk": "Terminal + Monospace + Neon",
        "Pixel": "Retro + Blocky + 8-bit",
    };
    
    let typoMood = "Professional + Clear hierarchy";
    for (const [key, val] of Object.entries(typoMap)) {
        if (style.toLowerCase().includes(key.toLowerCase())) {
            typoMood = val;
            break;
        }
    }

    // Key effects from style
    const effMap = {
        "Glassmorphism": "Backdrop blur (10-20px) + Translucent overlays",
        "Neumorphism": "Dual shadows (light+dark) + Soft press 150ms",
        "Claymorphism": "Multi-layer shadows + Spring bounce + Soft press 200ms",
        "Brutalism": "No transitions + Hard borders + Instant feedback",
        "Dark Mode": "Subtle glow + Neon accents + High contrast",
        "Flat Design": "Color shift hover + Fast 150ms transitions + No shadows",
        "Minimalism": "Subtle hover 200ms + Smooth transitions + Clean",
        "Motion-Driven": "Scroll animations + Parallax + Page transitions",
        "Micro-interactions": "Haptic feedback + Small 50-100ms animations",
        "Vibrant": "Large section gaps 48px+ + Color shift hover + Scroll-snap",
        "Aurora": "Flowing gradients 8-12s + Color morphing",
        "AI-Native": "Typing indicator + Streaming text + Context reveal",
        "Organic": "Rounded 16-24px + Natural shadows + Flowing SVG",
        "Soft UI": "Improved shadows + Modern 200-300ms + Focus visible",
        "3D": "WebGL/Three.js + Parallax 3-5 layers + Physics 300-400ms",
        "Trust": "Clear focus rings + Badge hover + Metric pulse",
        "Accessible": "Focus rings 3-4px + ARIA + Reduced motion",
    };
    
    let keyEffects = "Subtle hover (200ms) + Smooth transitions";
    for (const [key, val] of Object.entries(effMap)) {
        if (style.toLowerCase().includes(key.toLowerCase())) {
            keyEffects = val;
            break;
        }
    }

    // Decision rules
    const rules = {};
    if (style.toLowerCase().includes("dark") || style.toLowerCase().includes("oled")) {
        rules["if_light_mode_needed"] = "provide-theme-toggle";
    }
    if (style.toLowerCase().includes("glass")) {
        rules["if_low_performance"] = "fallback-to-flat";
    }
    if (landing.toLowerCase().includes("conversion")) {
        rules["if_conversion_focused"] = "add-urgency-colors";
    }
    if (landing.toLowerCase().includes("social")) {
        rules["if_trust_needed"] = "add-testimonials";
    }
    if (keywords.toLowerCase().includes("data") || keywords.toLowerCase().includes("dashboard")) {
        rules["if_data_heavy"] = "prioritize-data-density";
    }
    if (Object.keys(rules).length === 0) {
        rules["if_ux_focused"] = "prioritize-clarity";
        rules["if_mobile"] = "optimize-touch-targets";
    }

    // Anti-patterns
    let antiPatterns = [];
    if (style.toLowerCase().includes("minimalism") || style.toLowerCase().includes("minimal")) {
        antiPatterns.push("Excessive decoration");
    }
    if (style.toLowerCase().includes("dark")) {
        antiPatterns.push("Pure white backgrounds");
    }
    if (style.toLowerCase().includes("flat")) {
        antiPatterns.push("Complex shadows + 3D effects");
    }
    if (style.toLowerCase().includes("vibrant")) {
        antiPatterns.push("Muted colors + Low energy");
    }
    if (style.toLowerCase().includes("accessible")) {
        antiPatterns.push("Color-only indicators");
    }
    if (antiPatterns.length === 0) {
        antiPatterns = ["Inconsistent styling", "Poor contrast ratios"];
    }
    const antiStr = antiPatterns.slice(0, 2).join(" + ");

    return {
        "UI_Category": pt,
        "Recommended_Pattern": landing,
        "Style_Priority": style,
        "Color_Mood": colorFocus,
        "Typography_Mood": typoMood,
        "Key_Effects": keyEffects,
        "Decision_Rules": JSON.stringify(rules),
        "Anti_Patterns": antiStr,
        "Severity": "HIGH"
    };
}

function rebuildUiReasoning() {
    const src = path.join(BASE, "ui-reasoning.csv");
    const text = fs.readFileSync(src, 'utf8');
    const existing = parseCSV(text);

    // Build lookup
    const uiMap = {};
    for (const row of existing) {
        let cat = (row["UI_Category"] || "").trim();
        if (!cat) continue;
        if (REMOVE_TYPES.has(cat)) {
            console.log(`  [ui-reason] REMOVE: {cat}`);
            continue;
        }
        if (cat in UI_RENAMES) {
            const newName = UI_RENAMES[cat];
            console.log(`  [ui-reason] RENAME: ${cat} → ${newName}`);
            row["UI_Category"] = newName;
            cat = newName;
        }
        uiMap[cat] = row;
    }

    const productsText = fs.readFileSync(path.join(BASE, "products.csv"), 'utf8');
    const products = parseCSV(productsText);

    const headers = ["No", "UI_Category", "Recommended_Pattern", "Style_Priority", "Color_Mood", "Typography_Mood", "Key_Effects", "Decision_Rules", "Anti_Patterns", "Severity"];
    const finalRows = [];
    let added = 0;

    products.forEach((prod, index) => {
        const i = index + 1;
        const pt = prod["Product Type"];
        if (pt in uiMap) {
            const row = uiMap[pt];
            row["No"] = String(i);
            finalRows.push(row);
        } else {
            const row = deriveUiReasoning(prod);
            row["No"] = String(i);
            finalRows.push(row);
            added++;
        }
    });

    writeCSV(src, finalRows, headers);
    console.log(`\n  ✅ ui-reasoning.csv: ${finalRows.length} rows`);
    console.log(`     Added: ${added} new reasoning rows`);
}

function main() {
    console.log("=== Rebuilding colors.csv ===");
    rebuildColors();
    console.log("\n=== Rebuilding ui-reasoning.csv ===");
    rebuildUiReasoning();
    console.log("\n🎉 Done!");
}

if (require.main === module) {
    main();
}
