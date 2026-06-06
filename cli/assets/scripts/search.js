#!/usr/bin/env node

/**
 * UI/UX Pro Max Search - BM25 search engine for UI/UX style guides
 */

const { CSV_CONFIG, AVAILABLE_STACKS, search, searchStack } = require('./core');
const { generateDesignSystem } = require('./design_system');

function parseArgs() {
    const args = process.argv.slice(2);
    
    // Help check
    if (args.includes('--help') || args.includes('-h') || args.length === 0) {
        console.log(`UI/UX Pro Max Search
Usage: node search.js "<query>" [--domain <domain>] [--stack <stack>] [--max-results <n>] [--json]
       node search.js "<query>" --design-system [-p <project>] [-f <format>] [--persist] [--page <page>] [-o <output-dir>]

Domains: ${Object.keys(CSV_CONFIG).join(', ')}
Stacks: ${AVAILABLE_STACKS.join(', ')}`);
        process.exit(0);
    }

    const result = {
        query: "",
        domain: null,
        stack: null,
        maxResults: 3,
        json: false,
        designSystem: false,
        projectName: null,
        format: "ascii",
        persist: false,
        page: null,
        outputDir: null
    };

    let queryArgs = [];
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg.startsWith('-')) {
            if ((arg === '--domain' || arg === '-d') && i + 1 < args.length) {
                result.domain = args[++i];
            } else if ((arg === '--stack' || arg === '-s') && i + 1 < args.length) {
                result.stack = args[++i];
            } else if ((arg === '--max-results' || arg === '-n') && i + 1 < args.length) {
                result.maxResults = parseInt(args[++i], 10);
            } else if (arg === '--json') {
                result.json = true;
            } else if (arg === '--design-system' || arg === '-ds') {
                result.designSystem = true;
            } else if ((arg === '--project-name' || arg === '-p') && i + 1 < args.length) {
                result.projectName = args[++i];
            } else if ((arg === '--format' || arg === '-f') && i + 1 < args.length) {
                result.format = args[++i];
            } else if (arg === '--persist') {
                result.persist = true;
            } else if (arg === '--page' && i + 1 < args.length) {
                result.page = args[++i];
            } else if ((arg === '--output-dir' || arg === '-o') && i + 1 < args.length) {
                result.outputDir = args[++i];
            }
        } else {
            queryArgs.push(arg);
        }
    }
    result.query = queryArgs.join(" ");
    return result;
}

function formatOutput(result) {
    if (result.error) {
        return `Error: ${result.error}`;
    }

    const output = [];
    if (result.stack) {
        output.push(`## UI Pro Max Stack Guidelines`);
        output.push(`**Stack:** ${result.stack} | **Query:** ${result.query}`);
    } else {
        output.push(`## UI Pro Max Search Results`);
        output.push(`**Domain:** ${result.domain} | **Query:** ${result.query}`);
    }
    output.push(`**Source:** ${result.file} | **Found:** ${result.count} results\n`);

    result.results.forEach((row, i) => {
        output.push(`### Result ${i + 1}`);
        for (const [key, value] of Object.entries(row)) {
            let valueStr = String(value);
            if (valueStr.length > 300) {
                valueStr = valueStr.substring(0, 300) + "...";
            }
            output.push(`- **${key}:** ${valueStr}`);
        }
        output.push("");
    });

    return output.join("\n");
}

function main() {
    const args = parseArgs();

    // Validate inputs
    if (args.domain && !(args.domain in CSV_CONFIG)) {
        console.error(`Error: Invalid domain "${args.domain}". Supported domains: ${Object.keys(CSV_CONFIG).join(', ')}`);
        process.exit(1);
    }
    if (args.stack && !AVAILABLE_STACKS.includes(args.stack)) {
        console.error(`Error: Invalid stack "${args.stack}". Supported stacks: ${AVAILABLE_STACKS.join(', ')}`);
        process.exit(1);
    }

    // Design system takes priority
    if (args.designSystem) {
        const result = generateDesignSystem(
            args.query,
            args.projectName,
            args.format,
            args.persist,
            args.page,
            args.outputDir
        );
        console.log(result);

        if (args.persist) {
            const projectSlug = args.projectName 
                ? args.projectName.toLowerCase().replace(/\s+/g, '-') 
                : "default";
            console.log("\n" + "=".repeat(60));
            console.log(`✅ Design system persisted to design-system/${projectSlug}/`);
            console.log(`   📄 design-system/${projectSlug}/MASTER.md (Global Source of Truth)`);
            if (args.page) {
                const pageFilename = args.page.toLowerCase().replace(/\s+/g, '-');
                console.log(`   📄 design-system/${projectSlug}/pages/${pageFilename}.md (Page Overrides)`);
            }
            console.log("");
            console.log(`📖 Usage: When building a page, check design-system/${projectSlug}/pages/[page].md first.`);
            console.log(`   If exists, its rules override MASTER.md. Otherwise, use MASTER.md.`);
            console.log("=".repeat(60));
        }
    } else if (args.stack) {
        const result = searchStack(args.query, args.stack, args.maxResults);
        if (args.json) {
            console.log(JSON.stringify(result, null, 2));
        } else {
            console.log(formatOutput(result));
        }
    } else {
        const result = search(args.query, args.domain, args.maxResults);
        if (args.json) {
            console.log(JSON.stringify(result, null, 2));
        } else {
            console.log(formatOutput(result));
        }
    }
}

main();
